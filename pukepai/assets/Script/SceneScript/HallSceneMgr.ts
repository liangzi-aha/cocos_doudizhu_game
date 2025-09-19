import { _decorator, AudioClip, Button, Color, Component, director, EditBox, instantiate, Label, Node, Prefab, resources, SpriteFrame, sys, UITransform } from 'cc';
import { noLoadingPost, post } from '../Api/FetchMgr';
import { CommonUIManager } from '../CommonUIManager';
import { WebsocketMgr } from '../Api/WebsocketMgr'
import { eventTarget } from '../../Utils/EventListening';
import { LabelEllipsisOptimized } from '../UI/LabelEllipsisOptimized';
import { findChildByNameRecursive, loadRemoteImg, secondsToMinuteSecond, timestampToDateTime } from '../../Utils/Tools';
import { RoundBox } from '../UI/RoundBox';
import { ConfirmPopUp } from '../UI/ConfirmPopUp';
import { CONFIG } from '../Config';
import { AudioMgr } from '../AudioMgr';
import Global from '../../Utils/Global'
const { ccclass, property } = _decorator;

enum CreateRoomType {
    CreateRoom, // 创建房间
    MatchRoom // 匹配房间
}

@ccclass('HallSceneMgr')
export class HallSceneMgr extends Component {

    @property({
        type: Node,
        displayName: "选择等级"
    })
    selectLevel = null;
    @property({
        type: Node,
        displayName: "用户名称"
    })
    userNameBox = null;
    @property({
        type: Node,
        displayName: "用户头像"
    })
    userAvatar = null;
    @property({
        type: Label,
        displayName: "用户ID"
    })
    userId = null;
    @property({
        type: Label,
        displayName: "用户元宝"
    })
    userIngot = null;
    @property({
        type: Node,
        displayName: "加入房间输入框"
    })
    RoomNum = null;
    @property({
        type: Node,
        displayName: "匹配弹框"
    })
    MatchLoading = null;
    @property({
        type: Node,
        displayName: "战绩弹框"
    })
    Record = null;
    @property({
        type: Node,
        displayName: "问题反馈"
    })
    Feedback = null;
    @property({
        type: Node,
        displayName: "每日赠送元宝弹框"
    })
    GetGoldPop = null;

    userInfo = null; // 用户信息
    level = []; // 房间等级
    createRoomType: CreateRoomType = null; // 房间类型（创建|匹配）
    selectLevelNum: any = 0; // 选择等级
    matchTimer: number = 0; // 匹配时间
    wxLaunchOptions: any = {}; // 微信启动参数

    protected async onLoad() {
        // 预加载资源
        resources.preload('Prefabs/Loading', Prefab);
        resources.preload('Prefabs/ConfirmPopUp', Prefab);

        // 默认展示加载动画请求接口
        CommonUIManager.inst.showLoading();
        // 获取用户信息
        await this.getUserInfo();
        // 获取创建房间等级
        await this.getLevel();
        // 获取每日赠送元宝
        await this.claimDaily();

        // 获取用户是否又加入的房间，尝试重连
        const reConnectSuccess = await this.reConnection();
        // 没有加入的房间，判断是否有分享房间ID(有已加入的房间，不能加入其他房间)
        if (!reConnectSuccess) {
            if (window.wx) {
                // 由于wx.onShow只有在热更新的时候才会触发，冷启动不会触发，故写如下
                this.wxLaunchOptions = wx.getLaunchOptionsSync() || {};
                // 默认调用一次
                this.queryShareJoinRoom();
                if (Global.isOnShowRegistered == false) {
                    // 判断是否携带分享房间ID
                    window.wx.onShow(async (options) => {
                        console.warn(options, "onShow")
                        this.queryShareJoinRoom(options);
                    })
                    Global.isOnShowRegistered = true;
                }
            }
        }
    }

    async start() {
        // 监听匹配回调
        eventTarget.on("match", this.onMatchRoom, this);
        // 监听取消匹配
        eventTarget.on("cancelMatch", this.onCancelMatch, this);
    }

    update(deltaTime: number) {

    }

    // 查询分享连接加入
    async queryShareJoinRoom(onShowOption?) {
        // 如果传入了onShowOption，则优先去切入前台传递的参数
        const roomId = onShowOption?.query?.roomId || this.wxLaunchOptions?.query?.roomId;
        // 有 onShowOption?.query?.roomId 证明点击了分享连接进入，没有可能是首次加载小游戏，调用方法获取小游戏参数（第一次不会触发小游戏的onShow事件）
        if (onShowOption?.query?.roomId || (this.wxLaunchOptions?.query?.roomId && !Global.autoJoinShareRoomId)) {
            let data = await post("/queryJoinRoom", {
                roomId: roomId
            })

            if (data.code == 200 && data.data.success == true) {
                // 加入房间
                sys.localStorage.setItem('joinRoomId', roomId);
                director.loadScene('RoomScene');
                Global.autoJoinShareRoomId = roomId;
            }
        }
    }

    // 每日领取
    async claimDaily() {
        let res = await post(`/claimDaily`);
        // 领取成功 
        if (res.code == 200 && res.data.success == true) {
            // 更新用户金币
            this.userIngot.string = res.data.gold;
            // 展示领取弹框
            this.GetGoldPop.active = true;
        }
    }

    // 关闭弹框
    closeClaimDaily() {
        this.GetGoldPop.active = false;
    }

    // 获取玩家是否在游戏中
    async getUserPlaying(callback) {
        return await new Promise(async (resolve, reject) => {
            let res = await post('/getUserPlaying')
            if (res.code == 200) {
                // 玩家正在游戏中，不能匹配、创建、加入其他房间
                if (res.data.isInRoom == true) {
                    this.playingTip(res.data.roomId);
                } else {
                    callback()
                }
            } else {
                reject(res.message)
            }
        });
    }

    // 游戏中提示
    playingTip(roomId) {
        resources.load('Prefabs/ConfirmPopUp', Prefab, (err, prefab: Prefab) => {
            if (err) {
                console.error('加载预制体失败:', err);
                return;
            }
            // 创建节点
            let node = instantiate(prefab);
            node.getComponent(ConfirmPopUp).initConfirmPopUp('提示', '有正在进行的游戏，是否加入游戏？', () => {
                sys.localStorage.setItem('joinRoomId', roomId);
                // 重连
                this.reConnection()
            })
            node.setParent(this.node);
        })
    }

    // 不根据本地存储roomId进行查询了，可能不准确（切换设备等操作，恶意修改）
    async reConnection() {
        // loading 
        CommonUIManager.inst.showLoading("加载中...");
        // 查询房间是否还存在，玩家是否还在房间中（断线重连的清空）
        let [res]: any = await Promise.all([
            noLoadingPost('/reConnection'),
            new Promise((resolve) => {
                setTimeout(resolve, 1000);
            })
        ]);

        // 关闭加载动画
        CommonUIManager.inst.hideLoading();
        if (res.code == 200 && res.data.roomId) {
            // 用户在房间中，本地 joinRoomId 不存在，证明用户是手动退出，不自动加入房间 
            if (sys.localStorage.getItem('joinRoomId')) {
                // 加入房间
                let joinRes = await post("/joinRoom", {
                    roomId: res.data.roomId
                })

                if (joinRes.code == 200) {
                    sys.localStorage.setItem('joinRoomId', res.data.roomId);
                    // 切换场景之后，获取存到本地的房间id，再通过room_id 获取房间信息
                    director.loadScene('RoomScene');
                    return true;
                }
            }

            return false;
        } else {
            // 删除本地存储
            sys.localStorage.removeItem('joinRoomId');
            return false;
        }
    }

    // 获取创建房间等级
    async getLevel() {
        let res = await post('/getRoomLevel');
        if (res.code == 200) {
            this.level = res.data;
            this.level.forEach((item, index) => {
                const levelNode = findChildByNameRecursive(this.selectLevel, `Level${index + 1}`);
                levelNode.getChildByName("Num").getComponent(Label).string = item.base;
                // 设置自定义数据level
                levelNode.getComponent(Button).clickEvents[0].customEventData = item.level;
            });
        }
    }

    /**
     * 获取用户信息
     * @param updataUserInfo 是否只更新用户信息，不设置背景音乐
     */
    async getUserInfo(updataUserInfo = false) {
        let res = await post('/getUserInfo');
        if (res.code == 200) {
            this.userInfo = res.data;
            sys.localStorage.setItem('userInfo', JSON.stringify(res.data));
            this.userNameBox.getComponent(LabelEllipsisOptimized).setLabelText(res.data.user_name);
            this.userId.getComponent(Label).string = `ID：${res.data.id}`;
            this.userIngot.getComponent(Label).string = res.data.gold;
            // 加载本地头像
            if (res.data.user_head_img == "/Image/default_head.png") {
                resources.load('Image/default_head/spriteFrame', SpriteFrame, (err, spriteFrame) => {
                    if (err) {
                        console.error('加载 SpriteFrame 文件失败:', err);
                        return;
                    }

                    // 设置头像
                    this.userAvatar.getComponent(RoundBox).spriteFrame = spriteFrame;
                });
            } else {
                // 加载远程图片，并赋值
                loadRemoteImg(res.data.user_head_img, this.userAvatar);
            }

            if (res.data.bg_audio === 1 && updataUserInfo == false) {
                // 加载远程音频
                AudioMgr.inst.play(CONFIG.RESOURCE_BASE_URL + "/audios/bg.mp3", 1, true, director.getScene().name);
            }
        }
        console.log(res);
    }


    // 创建房间
    createRoomFun() {
        this.getUserPlaying(() => {
            this.createRoomType = CreateRoomType.CreateRoom;
            this.selectLevelShow();
        })
    }

    // 匹配房间
    async matchRoomFun() {
        this.getUserPlaying(() => {
            this.createRoomType = CreateRoomType.MatchRoom;
            this.selectLevelShow();
        })

    }

    selectLevelShow() {
        this.selectLevel.active = true;
    }

    selectLevelHide() {
        this.selectLevel.active = false;
    }


    // 选择房间等级
    selectLevelFun(event, level) {
        this.selectLevelNum = level;
        if (this.createRoomType == CreateRoomType.CreateRoom) {
            this.createRoom(event, level)
        } else {
            this.matchRoom()
        }
    }

    // 匹配房间
    async matchRoom() {
        // await 等待连接成功返回
        const socketInstance = await WebsocketMgr.instance({ url: "/matching" });

        socketInstance.send({
            type: "match",
            params: {
                level: this.selectLevelNum
            }
        });
    }

    // 监听匹配结果
    onMatchRoom({ data, code }) {
        console.log("matchRoom", data, code)
        if (code == 200) {
            if (data?.roomId) { // 放回房间ID，证明匹配成功
                // 匹配结束，关闭websocket 连接
                WebsocketMgr.close();
                this.scheduleOnce(() => {
                    sys.localStorage.setItem("joinRoomId", data.roomId);
                    director.loadScene('RoomScene');
                }, 0)
            } else {
                // 隐藏选择房间等级弹窗
                this.selectLevelHide();
                // 展示匹配中弹窗
                this.matchLoadingShow();
            }
        }
    }

    // 匹配间隔函数
    matchIntervalFun() {
        this.matchTimer++;
        this.MatchLoading.getChildByName("Time").getComponent(Label).string = secondsToMinuteSecond(this.matchTimer);
    }

    // 计时器函数
    matchLoadingShow() {
        // 展示匹配弹框
        this.MatchLoading.active = true;
        this.schedule(this.matchIntervalFun, 1);
    }

    async matchLoadingHide() {
        // 停止计时器
        this.unschedule(this.matchIntervalFun);
        // 隐藏匹配弹框
        this.MatchLoading.active = false;
        this.matchTimer = 0;
        // 关闭连接
        WebsocketMgr.close();
    }

    // 取消匹配
    onCancelMatch({ data, code }) {
        if (code == 200) {
            // 隐藏匹配弹框
            this.matchLoadingHide();
        }
    }

    // 取消匹配
    async cancelMatch() {
        // await 等待连接成功返回
        const socketInstance = await WebsocketMgr.instance({ url: "/matching" });

        socketInstance.send({
            type: "cancelMatch",
            params: {
                level: this.selectLevelNum
            }
        });
    }


    // 创建房间
    async createRoom(event, level) {
        console.log("level", level)
        // await 等待连接成功返回
        let res = await post("/createRoom", {
            level
        })

        if (res.code == 200) {
            // 保存加入房间ID，到房间详情再去获取
            sys.localStorage.setItem('joinRoomId', res.data);
            director.loadScene('RoomScene');
        }
    }

    // 加入房间
    joinRoomPopShow() {
        this.getUserPlaying(() => {
            this.node.getChildByName("JoinRoom").active = true;
        })

    }

    // 隐藏加入房间弹框
    joinRoomPopHide() {
        this.node.getChildByName("JoinRoom").active = false;
    }

    // 加入房间
    async inputRoomNum(event, data) {
        console.log(data);
        const inputList = this.RoomNum.children.map(item => {
            return item.getComponent(Label).string || "";
        });
        // 获取最近一个空白
        const index = inputList.indexOf("");
        if (index != -1) {
            // 输入数字
            this.RoomNum.children[index].getComponent(Label).string = data;
        }
        if (index == 5) {
            const roomNum = [...inputList, data];
            // 输入完毕调用接口加入房间
            let res = await post("/joinRoom", {
                roomId: roomNum.join("")
            })

            if (res.code == 200) {
                // 保存加入房间ID，到房间详情再去获取
                sys.localStorage.setItem('joinRoomId', res.data.roomId);
                // 切换场景之后，获取存到本地的房间id，再通过room_id 获取房间信息
                director.loadScene('RoomScene');
            }
        }
    }

    // 房间号删除
    RoomNumDelete() {
        const inputList = this.RoomNum.children.map(item => {
            return item.getComponent(Label).string || "";
        });
        // 获取最近一个空白
        const index = inputList.indexOf("") == 0 ? 0 : (inputList.indexOf("") == -1 ? 5 : inputList.indexOf("") - 1);
        console.log("删除下标", index);
        // 输入数字
        this.RoomNum.children[index].getComponent(Label).string = "";
    }

    // 展示战绩
    async showRecord() {
        this.Record.active = true;
        // 获取战绩数据
        let res = await post('/getRecord');
        if (res.code == 200) {
            // 加载预制体
            resources.load('Prefabs/RecordItem', Prefab, (err, prefab: Prefab) => {
                if (err) {
                    console.error('加载预制体失败:', err);
                    return;
                }

                // 添加节点到场景
                const RecordContent = findChildByNameRecursive(this.Record, "RecordContent");

                // 循环创建节点
                res.data.forEach((element, index, arr) => {
                    const victory = JSON.parse(element.victory_user_id).indexOf(this.userInfo.user_id) !== -1;
                    // 用户的记录
                    const userRecord = [
                        {
                            user_id: element.user_1_id,
                            get_ingots: element.user_1_get_ingots,
                            mingpai: element.user_1_mingpai,
                            redouble: element.user_1_redouble,
                        },
                        {
                            user_id: element.user_2_id,
                            get_ingots: element.user_2_get_ingots,
                            mingpai: element.user_2_mingpai,
                            redouble: element.user_2_redouble,
                        },
                        {
                            user_id: element.user_3_id,
                            get_ingots: element.user_3_get_ingots,
                            mingpai: element.user_3_mingpai,
                            redouble: element.user_3_redouble,
                        },
                    ]
                    // 创建节点
                    const node = instantiate(prefab);
                    // 设置节点信息
                    node.getChildByName("ResultText").getComponent(Label).string = victory ? "胜" : "败";
                    node.getChildByName("ResultText").getComponent(Label).color = victory ? new Color(235, 183, 20) : new Color(184, 37, 37);
                    node.getChildByName("Time").getComponent(Label).string = timestampToDateTime(element.end_time);
                    node.getChildByName("DIzhu").getComponent(Label).string = element.landlord_id == this.userInfo.user_id ? "地主" : "农民";
                    findChildByNameRecursive(node, "Text").getComponent(Label).string = `${victory ? "+" : ""}${userRecord.filter(item => item.user_id == this.userInfo.user_id)[0].get_ingots}`;
                    findChildByNameRecursive(node, "Text").getComponent(Label).color = victory ? new Color(105, 250, 8) : new Color(195, 73, 73);
                    // 设置位子
                    node.setPosition(0, -index * (85));

                    if (index == arr.length - 1) {
                        // 设置滚动容器高度
                        RecordContent.getComponent(UITransform).height = arr.length * (85);
                    }

                    RecordContent.addChild(node);
                });

            })
        }
    }

    // 隐藏战绩
    hidRecord() {
        this.Record.active = false;
        // 添加节点到场景
        const RecordContent = findChildByNameRecursive(this.Record, "RecordContent");
        RecordContent.removeAllChildren();
    }

    // 展示反馈弹框
    showFeedbackPop() {
        this.Feedback.active = true;
    }

    // 展示反馈弹框
    hidFeedbackPop() {
        this.Feedback.active = false;
    }

    // 提交反馈
    async submitFeedback() {
        let text = findChildByNameRecursive(this.Feedback, "EditBox").getComponent(EditBox).string;
        console.log('test', text)
        if (!text) { return CommonUIManager.inst.showToast("请输入反馈内容"); }
        let res = await post('/feedback', {
            feedback: text,
        });
        if (res.code == 200) {
            this.hidFeedbackPop();
            findChildByNameRecursive(this.Feedback, "EditBox").getComponent(EditBox).string = "";
            CommonUIManager.inst.showToast("提交成功");
        } else {
            CommonUIManager.inst.showToast("提交失败");
        }
    }

    // 微信分享好友功能
    wxShare() {
        if (window.wx) {
            window.wx.shareAppMessage({
                title: '在家无聊，不如一起斗地主',
                imageUrl: CONFIG.RESOURCE_BASE_URL + "/images/homeShare.png",
            })
        } else {
            CommonUIManager.inst.showToast("请使用微信小程序打开");
        }
    }


    protected onDestroy(): void {
        // 监听匹配回调
        eventTarget.off("match", this.onMatchRoom, this);
    }
}


