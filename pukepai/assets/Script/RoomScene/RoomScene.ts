import { _decorator, Component, director, Label, Node, resources, SpriteFrame, sys, Animation, UITransform, Widget, instantiate, Prefab, find, game, UIOpacity } from 'cc';
import { Card } from './Card';
import { WebsocketMgr } from '../Api/WebsocketMgr';
import { eventTarget } from '../../Utils/EventListening';
import { MyDealCardAmt } from '../UI/MyDealCardAmt';
import { loadRemoteImg, findChildByNameRecursive, reorderArray, resetAnimationToFirstFrame } from '../../Utils/Tools';
import { LabelEllipsisOptimized } from '../UI/LabelEllipsisOptimized';
import { RoundBox } from '../UI/RoundBox';
import { CardBox } from './CardBox';
import { GameStatus, PlayerReadyStatus } from '../../Utils/Type';
import { CommonUIManager } from '../CommonUIManager';
import { CardItem } from './CardItem';
import { CardSelection } from './CardSelection';
import { CONFIG } from '../Config';
import { AudioMgr } from '../AudioMgr';
import { playAudios, audioPageageName, GameModel } from '../../Utils/constant';
import { RoomPlayCard } from './RoomPlayCard';
import Global from '../../Utils/Global';
const { ccclass, property } = _decorator;

// 渲染卡牌需要参数
interface renderCardParams {
    [str: string]: {
        user_card: Array<any>
    }
}

@ccclass('RoomScene')
export class RoomScene extends Component {
    @property({
        type: Node,
        displayName: "我的信息节点（包含用户信息、卡片）"
    })
    myInfoNode: Node = null;
    @property({
        type: Node,
        displayName: "我的卡片存放节点"
    })
    myCardParentNode: Node = null;
    @property({
        type: Node,
        displayName: "我的卡片发牌动画"
    })
    myDealCardAnimation: Node = null;
    @property({
        type: Node,
        displayName: "玩家1信息节点（包含用户信息、卡片）"
    })
    user1Info: Node = null;
    @property({
        type: Node,
        displayName: "玩家1卡片存放节点"
    })
    user1CardParent: Node = null;
    @property({
        type: Node,
        displayName: "玩家2信息节点（包含用户信息、卡片）"
    })
    user2Info: Node = null;
    @property({
        type: Node,
        displayName: "玩家2卡片存放节点"
    })
    user2CardParent: Node = null;
    @property({
        type: Label,
        displayName: "房间ID"
    })
    roomIdLabel: Label = null;
    @property({
        type: Node,
        displayName: "退出弹框"
    })
    OutPopUp: Node = null;
    @property({
        type: Node,
        displayName: "底牌卡牌"
    })
    bottomCardParent: Node = null;
    @property({
        type: Node,
        displayName: "底牌卡牌动画节点"
    })
    bottomCardAmtNode: Node = null;
    @property({
        type: Prefab,
        displayName: "卡牌预制体"
    })
    cardItem: Prefab = null;
    @property({
        type: Label,
        displayName: "房间倍率"
    })
    RoomRate: Label = null;
    @property({
        type: Node,
        displayName: "分享按钮"
    })
    share: Node = null;


    // 3个用户的卡片
    userCards: Array<Array<number>> = [[], [], []];
    // 房间信息
    roomInfo: any = {};
    // 本地存储用户信息
    userInfo: any = {};
    // 房间Id
    roomId: any = "";
    // socket 请求url
    socketUrl: string = "";
    // 被挤掉线
    replaceLogin: boolean = false;

    start() {
        try {
            // 解析本地用户信息
            this.userInfo = JSON.parse(sys.localStorage.getItem("userInfo"));
            this.roomId = sys.localStorage.getItem("joinRoomId");
            this.socketUrl = `/roomInfo?roomId=${this.roomId}&userId=${this.userInfo.user_id}`;
        } catch (error) {
            console.log("获取用户信息失败");
        }

        // 微信展示分享功能
        if (window.wx) {
            this.share.active = true;
        }

        // 站厅大厅音乐
        AudioMgr.inst.stop();
        // ui 兼容
        this.UI();

        // 获取房间信息
        this.getRoomInfo();
        // 监听有用户加入房间
        eventTarget.on("userJoinRoomUpdate", this.onGetRoomInfo, this);
        // 监听准备
        eventTarget.on("ready", this.onReady, this);
        // 监听用户退出
        eventTarget.on("userOutRoom", this.onUserOutRoom, this);
        // 监听抢地主倒计时器
        eventTarget.on("snatchLandlord", this.onSnatchLandlord, this);
        // 抢地主结束，分配地主
        eventTarget.on("snatchLandlordEnd", this.onSnatchLandlordEnd, this);
        // 监听发牌动画结束
        eventTarget.on("dealCardsAmt", this.onDealCardsAmt, this);
        // 监听获取房间信息
        eventTarget.on("getRoomInfo", this.onGetRoomInfo, this);
        // 监听抢地主
        eventTarget.on("selectLandlord", this.onSelectLandlord, this);
        // 监听明牌
        eventTarget.on("mingPai", this.onMingpai, this);
        // 监听选择加倍开始
        eventTarget.on("selectDoubleTimer", this.onSelectDoubleTime, this);
        // 选择加倍回调监听
        eventTarget.on("selectDouble", this.onSelectDouble, this);
        // 选择加倍结束（所有人都选择完毕|倒计时结束）
        eventTarget.on("selectDoubleEnd", this.onSelectDouble, this);
        // 监听房间倍率更新
        eventTarget.on("updateRoomRate", this.onUpdateRoomRate, this);
        // 监听发牌
        eventTarget.on("dealCards", this.onDealCards, this);
        // 重连成功
        eventTarget.on("userConnectionSuccess", this.onUserConnectionSuccess, this);
        // 被挤掉线
        eventTarget.on("replaceLogin", this.onReplaceLogin, this);
        // 用户掉线（非手动退出）
        eventTarget.on("userlostConnection", this.onUserlostConnection, this);
        // 监听底牌动画播放结束
        this.bottomCardAmtNode.getComponent(Animation).on(Animation.EventType.FINISHED, this.onBottomCardAmt, this)
    }

    update(deltaTime: number) {

    }
    protected onDestroy(): void {
        eventTarget.off("userJoinRoomUpdate", this.onGetRoomInfo, this);
        eventTarget.off("dealCards", this.onDealCards, this);
        eventTarget.off("ready", this.onReady, this);
        eventTarget.off("userOutRoom", this.onUserOutRoom, this);
        eventTarget.off("snatchLandlord", this.onSnatchLandlord, this);
        eventTarget.off("snatchLandlordEnd", this.onSnatchLandlordEnd, this);
        eventTarget.off("dealCardsAmt", this.onDealCardsAmt, this);
        eventTarget.off("getRoomInfo", this.onGetRoomInfo, this);
        eventTarget.off("selectLandlord", this.onSelectLandlord, this);
        eventTarget.off("mingPai", this.onMingpai, this);
        eventTarget.off("selectDoubleTimer", this.onSelectDoubleTime, this);
        eventTarget.off("selectDouble", this.onSelectDouble, this);
        eventTarget.off("selectDoubleEnd", this.onSelectDouble, this);
        eventTarget.off("updateRoomRate", this.onUpdateRoomRate, this);
        eventTarget.off("userlostConnection", this.onUserlostConnection, this);
        eventTarget.off("replaceLogin", this.onReplaceLogin, this);
        eventTarget.off("userConnectionSuccess", this.onUserConnectionSuccess, this);
    }

    // ui 刘海兼容问题
    UI() {
        if (window.wx) {
            // 获取设备信息
            const systemInfo = window.wx.getSystemInfoSync();
            const { safeArea, screenWidth, screenHeight } = systemInfo;

            // 横屏时，屏幕宽度为原高度，高度为原宽度（因横屏会交换宽高）
            const isLandscape = screenWidth > screenHeight; // 判断是否为横屏状态

            if (isLandscape) {
                // 横屏时，左侧是否有刘海（left > 0 表示左侧被刘海占据）
                const hasLeftNotch = safeArea.left > 0;
                // 横屏时，右侧是否有刘海（screenWidth - right > 0 表示右侧被刘海占据）
                const hasRightNotch = (screenWidth - safeArea.right) > 0;

                // 存在任意一侧刘海，即为刘海屏
                const isNotchScreen = hasLeftNotch || hasRightNotch;

                console.log('是否为刘海屏：', isNotchScreen);
                console.log('左侧刘海宽度：', hasLeftNotch ? safeArea.left : 0);
                console.log('右侧刘海宽度：', hasRightNotch ? (screenWidth - safeArea.right) : 0);
            }
        }
    }
    // 监听被挤掉线
    onReplaceLogin({ data, code, message }) {
        if (code == 200) {
            this.replaceLogin = true;
        }
    }

    // 监听其他用户断线重连
    onUserlostConnection({ data, code }) {
        if (code == 200) {
            // data.userId
            CommonUIManager.inst.showToast(`"${data.userName}"玩家掉线重连中，10秒内重连失败将退出房间`)
        }
    }

    // 玩家掉线重连成功，通知其他玩家
    onUserConnectionSuccess({ data, code }) {
        if (code == 200) {
            CommonUIManager.inst.showToast(`"${data.userName}"玩家重连成功`);
        }
    }

    // 更新房间出牌记录（玩家出牌后更新）
    updataRoomInfoPlayCardRecord(record) {
        this.roomInfo.play_card_record = record;
    }

    // 更新房间倍率
    onUpdateRoomRate({ data, code }) {
        if (code == 200) {
            this.RoomRate.string = data.roomRate;
        }
    }

    // 获取最近一条出牌记录
    getLastRecord() {
        return this.roomInfo.play_card_record.reduceRight((pre, cur) => {
            if (!pre && cur.playCard.length > 0) {
                return cur
            }
            return pre;
        }, null) || {};
    }

    // 获取节点上绑定的用户信息
    getUserNodeInfo() {
        // 这个数组顺序很重要不能调整，是根据出牌顺序有关系的
        const UserNodeId = [
            {
                node: this.myInfoNode, // 存放我的信息节点（包含用户信息、卡牌信息等）
                nodeId: this.myInfoNode.getComponent(CardBox).userId, // 节点上绑定的用户id
                cardParentNode: this.myCardParentNode, // 存放卡牌的父节点
                cardNodeName: "my",
            },
            {
                node: this.user2Info,
                nodeId: this.user2Info.getComponent(CardBox).userId,
                cardParentNode: this.user2CardParent,
                cardNodeName: "rightUser",
            },
            {
                node: this.user1Info,
                nodeId: this.user1Info.getComponent(CardBox).userId,
                cardParentNode: this.user1CardParent,
                cardNodeName: "leftUser",
            },
        ];

        return UserNodeId;
    }

    // 获取房间信息
    async getRoomInfo() {
        let roomId = sys.localStorage.getItem("joinRoomId");
        const socket = await WebsocketMgr.instance({ url: this.socketUrl });
        socket.send({
            type: "getRoomInfo",
            params: {
                roomId
            }
        });
    }


    // 监听消息
    onGetRoomInfo({ data, code }) {
        console.log("获取房间信息", data)
        if (code == 200) {
            // 渲染房间模式
            const gameModel = this.node.getChildByName("GameModel");
            gameModel.active = true;
            gameModel.getChildByName("Str").getComponent(Label).string = GameModel[data.room_type];
            // 获取节点顺序
            const userNodeId = this.getUserNodeInfo();
            // 倍率
            this.RoomRate.string = data.room_rate;

            // ======================== 重连模式 =========================
            if (this.replaceLogin == true) {
                // 重连会调用getRoomInfo 方法，调用这个就证明重连上了
                this.replaceLogin = false;
                // 关闭重连按钮
                this.node.getChildByName("ReplaceLogin").active = false;

                // 重连UI，需要默认隐藏，抢地主按钮、加倍按钮、明牌按钮、出牌按钮、倒计时（因为可能是断线重连）
                findChildByNameRecursive(this.myInfoNode, "ReadyBtn").active = false;
                findChildByNameRecursive(this.myInfoNode, "UnReadyBtn").active = false;
                findChildByNameRecursive(this.myInfoNode, "MingPaiBtn").active = false;
                findChildByNameRecursive(this.myInfoNode, "Trusteeship").active = false;
                findChildByNameRecursive(this.myInfoNode, "Regardless").active = false;
                findChildByNameRecursive(this.user1Info, "Ready").active = false;
                findChildByNameRecursive(this.user2Info, "Ready").active = false;
                findChildByNameRecursive(this.node, "PlayAnotherRound").active = false;

                userNodeId.forEach(({ nodeId, node }) => {
                    // 隐藏玩家的倒计时，因为重新发牌的时候需要隐藏
                    findChildByNameRecursive(node, "TimeDown").active = false;
                    // 隐藏抢地主UI
                    findChildByNameRecursive(node, "QiangDIZhuRes").active = false;
                    findChildByNameRecursive(node, "BuQiangRes").active = false;
                    // 隐藏加倍UI
                    findChildByNameRecursive(node, "NoDoubleRes").active = false;
                    findChildByNameRecursive(node, "DoubleRes").active = false;
                    findChildByNameRecursive(node, "SuperDoubleRes").active = false;
                    // 删除掉玩家已出的牌，重新渲染
                    findChildByNameRecursive(node, "PlayCardBox").removeAllChildren();
                    // 删除掉玩家手中的牌，重新渲染
                    findChildByNameRecursive(node, "Card").removeAllChildren();

                    // 当前玩家独有的一些UI
                    if (nodeId == this.userInfo.user_id) {
                        console.log("隐藏按钮", nodeId, this.userInfo.user_id);
                        findChildByNameRecursive(node, "PlayHandBtn").active = false;
                        findChildByNameRecursive(node, "SnatchLandlord").active = false;
                        findChildByNameRecursive(node, "MingPaiBtn").active = false;
                        findChildByNameRecursive(node, "SelectDouble").active = false;
                    }
                })
            }

            // 获取房间信息成功
            console.log("获取房间信息成功", data)
            this.roomInfo = data;
            this.roomIdLabel.getComponent(Label).string = data.room_id;
            // 用户渲染顺序必须按照逆时针顺序排列
            const myIndex = this.roomInfo.roomUserIdList.indexOf(this.userInfo.user_id);
            // 根据当前用户在房间的顺序，调整为从当前用户开始逆时针排列
            const sortList = reorderArray(this.roomInfo.roomUserIdList, myIndex);
            console.log("当前用户信息", this.roomInfo.roomUsers, sortList);

            // 渲染用户信息
            sortList.forEach((userId, index) => {
                if (userId) {
                    // 获取当前用户信息
                    const myUserInfo = this.roomInfo.roomUsers[userId];
                    if (myUserInfo) {
                        // 渲染用户信息
                        this.renderUserInfo(userNodeId[index].node, myUserInfo);
                    }
                }
            })

            // 抢地主状态，还没有产生地主 
            if (data.gameStatus == GameStatus.SNATCHLABDLORD && !data.landlord_id) {
                console.log("渲染抢地主UI", data.snatch_landlord_record)
                // 渲染抢地主UI
                data.snatch_landlord_record.forEach(({ userId, isSnatchLandlord }) => {
                    sortList.forEach((sortUserId, index) => {
                        const userNode = userNodeId[index].node;
                        if (userId == sortUserId) {
                            findChildByNameRecursive(userNode, isSnatchLandlord ? "QiangDIZhuRes" : "BuQiangRes").active = true;
                        }
                    })
                });
            } else if (data.gameStatus == GameStatus.START && data.roomUserIdList.some((userId) => !data.roomUsers[userId].redouble_status)) { // 游戏开始，但是有玩家还没有加倍（就是正在加倍状态中，因为加倍状态只有3秒，所有没有定义加倍状态）
                // 渲染加倍UI
                data.roomUserIdList.forEach((userId) => {
                    const userItemInfo = data.roomUsers[userId];
                    sortList.forEach((sortUserId, index) => {
                        const userNode = userNodeId[index].node;
                        if (userId == sortUserId) {
                            if (userItemInfo.redouble_status == 1) {
                                findChildByNameRecursive(userNode, "NoDoubleRes").active = true;
                            } else if (userItemInfo.redouble_status == 2) {
                                findChildByNameRecursive(userNode, "DoubleRes").active = true;
                            } else if (userItemInfo.redouble_status == 3) {
                                findChildByNameRecursive(userNode, "SuperDoubleRes").active = true;
                            }
                        }
                    })
                });
            }

            // 渲染准备状态
            this.renderUserReady(this.roomInfo);

            // 开始游戏，渲染卡牌信息
            if (this.roomInfo.gameStatus != GameStatus.NOSTART) {
                // 渲染卡牌信息
                this.renderCard(this.roomInfo.roomUsers);
                // 判断是否有底牌（发过牌就有底牌了）
                if (this.roomInfo.bottom_card.length > 0) {
                    // 判断底牌是否明牌（有地主正面已经明牌了）
                    if (this.roomInfo.landlord_id) {
                        this.renderBottomCard(this.roomInfo.landlord_id, this.roomInfo.bottom_card, true);
                    } else {
                        this.renderBottomCard(this.roomInfo.landlord_id, this.roomInfo.bottom_card, false);
                    }
                }
            }

            // 渲染托管状态
            this.renderTrusteeship(this.roomInfo);

            // 渲染已出卡牌
            this.renderPlayCard(this.roomInfo);
        } else if (code == 400) {
            // 关闭连接，退出房间
            WebsocketMgr.close(1000);
            // 房间不存在退出房间
            director.loadScene('HallScene');
        }
    }

    // 渲染已出卡牌
    renderPlayCard(roomInfo) {
        // 游戏已经开始
        if (roomInfo.play_card_record.length > 0) {
            // 出牌记录取最近的3条
            const cardRecord = roomInfo.play_card_record.slice(-2) || [];
            console.log("cardRecord", cardRecord)

            this.getUserNodeInfo().forEach(({ nodeId, node, cardNodeName }) => {
                // 查询当前用户的出牌记录
                const recordFilter = cardRecord.filter(({ userId }) => userId == nodeId) || [];

                console.log("recordFilter", recordFilter)

                if (recordFilter.length > 0) {
                    // 计算出的牌总宽度，宽高 70*96，默认宽高, 每张向右偏移25
                    const totalWidth = (recordFilter[0].playCard.length - 1) * 25 + 70;
                    // 相对父级开始位子
                    const startLeftst = -((totalWidth - 70) / 2);
                    recordFilter[0].playCard.forEach((cardNum, index, temp) => {
                        const cardItem = instantiate(this.cardItem);
                        // 反向下标
                        const reverseIndex = (temp.length - 1 - index);

                        cardItem.getComponent(CardItem).cardType = Math.ceil(Number(cardNum) / 13) - 1;
                        cardItem.getComponent(CardItem).cardNum = Number(cardNum) % 13 == 0 ? 13 : Number(cardNum) % 13;
                        cardItem.getComponent(CardItem).mingpai = true;
                        cardItem.getComponent(UITransform).setContentSize(70, 96);
                        cardItem.active = true;
                        // 左边和右边渲染不一样
                        if (cardNodeName == "leftUser") {
                            cardItem.getComponent(Widget).left = index * 25;
                        } else if (cardNodeName == "rightUser") {
                            cardItem.getComponent(Widget).left = -(reverseIndex * 25);
                        } else {
                            cardItem.getComponent(Widget).left = startLeftst + 25 * index;
                        }

                        findChildByNameRecursive(node, "PlayCardBox").addChild(cardItem);
                    });
                }
            })
        }
    }

    // 渲染托管
    renderTrusteeship(roomInfo) {
        const userNodeId = this.getUserNodeInfo();
        userNodeId.forEach(({ nodeId, node }) => {
            // 判断当前玩家是否被托管
            if (roomInfo.roomUsers[nodeId]?.is_hosted) {
                // 隐藏托管按钮
                findChildByNameRecursive(node, "Trusteeship").active = true;
            } else {
                findChildByNameRecursive(node, "Trusteeship").active = false;
            }
        })
    }

    // 渲染用户的信息
    renderUserInfo(userInfoNode: Node, userInfo, active = true) {
        // 节点上绑定上用户ID，方便区分
        userInfoNode.getComponent(CardBox).userId = userInfo.user_id || "";
        // 判断加载默认本地头像
        if (userInfo.user_head_img == "/Image/default_head.png") {
            // 加载本地资源要写上 spriteFrame 图片类型
            resources.load('Image/default_head/spriteFrame', SpriteFrame, (err, spriteFrame) => {
                if (err) {
                    console.error('加载 SpriteFrame 文件失败:', err);
                    return;
                }

                // 设置头像
                findChildByNameRecursive(userInfoNode, "UserHead").getComponent(RoundBox).spriteFrame = spriteFrame;
            });
        } else {
            // 加载远程图片，并赋值
            loadRemoteImg(userInfo.user_head_img, findChildByNameRecursive(userInfoNode, "UserHead"));
        }

        // 设置昵称 setLabelText
        findChildByNameRecursive(userInfoNode, "UserNamBox").getComponent(LabelEllipsisOptimized).setLabelText(userInfo.user_name);
        // 设置金币
        findChildByNameRecursive(userInfoNode, "Gold").getComponent(Label).string = userInfo.gold > 10000 ? `${(userInfo.gold / 10000).toFixed(2)}万` : userInfo.gold;
        // 展示用户信息
        userInfoNode.active = active;
    }


    // 渲染用户是否准备
    renderUserReady(roomInfo) {
        console.log("renderUserReady", roomInfo)
        // 游戏未开始
        if (roomInfo.gameStatus == GameStatus.NOSTART) {
            // 获取节点上的用户分别都是谁
            const userNodeId = this.getUserNodeInfo();

            userNodeId.forEach(({ nodeId, node }) => {
                if (nodeId) {
                    const ready = roomInfo.roomUsers[nodeId].ready;
                    // 当前用户的准备状态和其他用户的UI不一样
                    if (nodeId == this.userInfo.user_id) {
                        if (ready == PlayerReadyStatus.READY) {
                            findChildByNameRecursive(node, "ReadyBtn").active = true;
                            findChildByNameRecursive(node, "UnReadyBtn").active = false;
                        } else {
                            findChildByNameRecursive(node, "ReadyBtn").active = false;
                            findChildByNameRecursive(node, "UnReadyBtn").active = true;
                        }
                    } else {
                        // 准备了
                        if (ready == PlayerReadyStatus.READY) {
                            findChildByNameRecursive(node, "Ready").active = true;
                        } else {
                            findChildByNameRecursive(node, "Ready").active = false;
                        }
                    }
                }
            })
        }
    }

    // 退出房间弹窗显示
    outRoomPopShow() {
        this.OutPopUp.active = true;
    }

    // 退出房间弹窗隐藏
    outRoomPopHide() {
        this.OutPopUp.active = false;
    }

    // 退出房间
    async outRoom() {
        // 掉线了的话，直接退出就行
        if (this.replaceLogin) {
            director.loadScene("HallScene");
            sys.localStorage.removeItem("joinRoomId");
            return;
        }
        // 发送消息给服务端
        const socket = await WebsocketMgr.instance({ url: this.socketUrl });
        socket.send({
            type: "userOutRoom",
            params: {
                roomId: sys.localStorage.getItem("joinRoomId"),
            }
        });

    }

    // 准备
    async ready() {
        // 发送准备消息给服务端
        const socket = await WebsocketMgr.instance({ url: this.socketUrl });
        socket.send({
            type: "ready",
            params: {
                roomId: sys.localStorage.getItem("joinRoomId"),
            }
        });
    }

    // 监听准备状态
    private onReady({ data, code }) {
        if (code == 200) {
            console.log("准备成功", data);

            // 渲染准备状态
            this.renderUserReady(data); // data 为房间信息
        }
    }

    // 再来一局
    PlayAnotherRound({ data, code }) {
        // 隐藏再来一局按钮
        this.node.getChildByName("PlayAnotherRound").active = false;
        // 清除游戏记录信息（清除上一局出的卡牌信息等）
        const userNode = this.getUserNodeInfo();
        // 底牌初始化
        this.bottomCardParent.children.forEach((element, index) => {
            const cardItemJs = element.getComponent(CardItem);
            cardItemJs.cardNum = 1;
            cardItemJs.cardType = 0;
            cardItemJs.mingpai = false;
            cardItemJs.init();
        });
        // 隐藏底牌卡牌
        this.bottomCardParent.active = false;
        userNode.forEach(({ nodeId, node, cardParentNode }) => {
            // 删除出牌
            node.getChildByName("PlayCardBox").removeAllChildren();
            // 删除玩家未出的牌
            cardParentNode.removeAllChildren();
            // 隐藏地主图标
            findChildByNameRecursive(node, "Dizhu").active = false;
        })
        // 准备
        this.ready();
    }

    // 监听发牌（发牌每场游戏只会执行一次）
    private onDealCards({ data, code }) {
        if (code == 200) {
            const userNodeId = this.getUserNodeInfo();
            // 发牌清空出牌记录
            this.updataRoomInfoPlayCardRecord([]);
            // 隐藏底牌节点
            this.bottomCardParent.active = false;
            // 隐藏所有玩家的准备UI
            findChildByNameRecursive(this.myInfoNode, "ReadyBtn").active = false;
            findChildByNameRecursive(this.myInfoNode, "UnReadyBtn").active = false;
            findChildByNameRecursive(this.user1Info, "Ready").active = false;
            findChildByNameRecursive(this.user2Info, "Ready").active = false;
            // 展示名牌按钮，在发牌的期间可以选择名牌，发牌动画结束后不能明牌了
            findChildByNameRecursive(this.myInfoNode, "MingPaiBtn").active = true;
            // 隐藏抢地主按钮
            findChildByNameRecursive(this.myInfoNode, "SnatchLandlord").active = false;
            userNodeId.forEach(({ nodeId, node }) => {
                console.log("发牌")
                // 隐藏玩家的倒计时，因为重新发牌的时候需要隐藏
                findChildByNameRecursive(node, "TimeDown").active = false;
                // 隐藏抢地主UI
                findChildByNameRecursive(node, "QiangDIZhuRes").active = false;
                findChildByNameRecursive(node, "BuQiangRes").active = false;
                // 隐藏加倍UI
                findChildByNameRecursive(node, "NoDoubleRes").active = false;
                findChildByNameRecursive(node, "DoubleRes").active = false;
                findChildByNameRecursive(node, "SuperDoubleRes").active = false;
            })

            // 重置倍率为1
            this.RoomRate.string = "1";

            // 渲染卡牌信息
            this.renderCard(data, true);
            // 重置底牌动画到第一帧，为了重新播放
            resetAnimationToFirstFrame(this.bottomCardAmtNode.getComponent(Animation));
            // 展示底牌动画节点
            this.bottomCardAmtNode.active = true;
            // 执行我的卡片动画
            this.myDealCardAnimation.getComponent(MyDealCardAmt).dealCardAnimation();
        }
    }

    /**
     * 渲染卡牌, roomUser，传入哪个用户就渲染/更新，那个用户的卡牌
     * @param roomUsers { `userId`: `用户信息` }
     * @param isFirstInit 是否第一次发牌
     */
    renderCard(roomUsers: renderCardParams, isFirstInit = false) {
        // 渲染卡牌，游戏已经开始了
        const userNodeId = this.getUserNodeInfo();
        userNodeId.forEach(({ nodeId, node, cardParentNode }) => {
            const userInfo = roomUsers[nodeId];
            if (userInfo) {
                const cardJs = cardParentNode.getComponent(Card);
                cardJs.cardList = userInfo.user_card;
                // 创建卡牌
                cardJs.init(isFirstInit);
            }
        })
    }

    // 监听用户退出房间
    async onUserOutRoom({ data, code }) {
        if (code == 200) {
            if (data.roomOutUserId == this.userInfo.user_id) {
                Global.outRoomId = this.roomId;
                sys.localStorage.removeItem("joinRoomId");
                // 关闭连接
                WebsocketMgr.close();
                console.log("关闭了连接");
                director.loadScene("HallScene");
            } else {
                // 获取房间节点用户都有哪些
                const userNodeId = this.getUserNodeInfo();
                // 删除节点上绑定的用户信息
                userNodeId.forEach(({ nodeId, node, cardParentNode }) => {
                    if (nodeId == data.roomOutUserId) {
                        // 用户退出房间，渲染用户信息，传递空数据
                        this.renderUserInfo(node, {
                            user_id: "",
                            user_head_img: "/Image/default_head.png",
                            user_name: "",
                            gold: "",
                        }, false);
                        // 清空用户的卡牌和已出卡片
                        cardParentNode.removeAllChildren();
                        node.getChildByName("PlayCardBox").removeAllChildren();
                    }
                })
            }
        }
    }

    // 抢地主回调
    onSelectLandlord({ code, data, message }) {
        if (code == 200) {
            const userNodeId = this.getUserNodeInfo();

            // data.userId 抢地主用户Id data,selectLandlord 抢地主选择
            AudioMgr.inst.playOneShot(playAudios[audioPageageName][data.selectLandlord ? "qiangdizhu" : "buqiang"]);

            // 展示抢地主图片
            userNodeId.forEach(({ nodeId, node }) => {
                if (nodeId == data.userId) {
                    console.log("展示抢地主图片")
                    findChildByNameRecursive(node, data.selectLandlord ? "QiangDIZhuRes" : "BuQiangRes").active = true;
                }
            });

            // 这块选择地主回调操作倒计时和选择地主按钮 和 抢地主倒计时操作ui冲突，导致延迟好像第一秒展示有隐藏了（先触发抢地主倒计时又触发选择地主倒计时，导致展示又隐藏了）
            findChildByNameRecursive(this.myInfoNode, "SnatchLandlord").active = false;
            findChildByNameRecursive(this.myInfoNode, "TimeDown").active = false;
        }
    }

    // 抢地主方法
    async selectLandlord(event, status) {
        const socket = await WebsocketMgr.instance({ url: this.socketUrl });
        socket.send({
            type: "selectLandlord",
            params: {
                roomId: sys.localStorage.getItem("joinRoomId"),
                selectLandlord: status == 1 ? true : false
            }
        });
    }

    // 监听抢地主
    onSnatchLandlord({ data, code }) {
        if (code == 200) {
            const userNodeId = this.getUserNodeInfo();
            userNodeId.forEach(({ nodeId, node }) => {
                if (data.downTime != 0 && nodeId == data.userId) {
                    // console.log(nodeId, "展示抢地主按钮", data.downTime);
                    // 隐藏上一次选择抢地主结果（加入有两个人抢地主，可能会抢两次）
                    findChildByNameRecursive(node, "QiangDIZhuRes").active = false;
                    findChildByNameRecursive(node, "BuQiangRes").active = false;

                    // 展示抢地主按钮
                    const SnatchLandlord = findChildByNameRecursive(node, "SnatchLandlord");
                    SnatchLandlord ? SnatchLandlord.active = true : null;

                    // 展示倒计时
                    const timeDown = findChildByNameRecursive(node, "TimeDown");
                    timeDown.active = true;
                    timeDown.getChildByName('Str').getComponent(Label).string = data.downTime;
                } else {
                    // console.log(nodeId, "隐藏抢地主按钮", data.downTime)
                    // 隐藏抢地主按钮
                    const SnatchLandlord = findChildByNameRecursive(node, "SnatchLandlord");
                    SnatchLandlord ? SnatchLandlord.active = false : null;
                    // 隐藏倒计时
                    findChildByNameRecursive(node, "TimeDown").active = false;
                }
            })
        }
    }

    // 玩家分配地主
    onSnatchLandlordEnd({ data, code }) {
        if (code == 200) {
            const userNodeId = this.getUserNodeInfo();
            // 隐藏所有玩家抢地主样式
            userNodeId.forEach(({ nodeId, node }) => {
                findChildByNameRecursive(node, "QiangDIZhuRes").active = false;
                findChildByNameRecursive(node, "BuQiangRes").active = false;
            })
            // 隐藏其他玩家的倒计时
            findChildByNameRecursive(this.user1Info, "TimeDown").active = false;
            findChildByNameRecursive(this.user2Info, "TimeDown").active = false;
            // 渲染底牌
            this.renderBottomCard(data.userId, data.bottomCard, true);
            // 更新地主卡牌
            this.renderCard(data.roomUsers);
        }
    }

    // 渲染底牌
    renderBottomCard(userId, bottomCard, mingpai) {
        this.bottomCardParent.active = true;
        // 用户头像地主icon展示
        const userNodeId = this.getUserNodeInfo();

        // 玩家展示地主Icon
        userNodeId.forEach(({ node, nodeId }) => {
            if (nodeId == userId) {
                findChildByNameRecursive(node, "Dizhu").active = true;
            }
        });

        // 底牌明牌
        this.bottomCardParent.children.forEach((element, index) => {
            const cardItemJs = element.getComponent(CardItem);
            const cardNum = bottomCard[index];
            cardItemJs.cardNum = Number(cardNum) % 13 == 0 ? 13 : Number(cardNum) % 13;
            cardItemJs.cardType = Math.ceil(Number(cardNum) / 13) - 1;
            cardItemJs.mingpai = mingpai;
            cardItemJs.init();
        });
    }

    // 监听发牌动画结束, 执行底牌动画
    onDealCardsAmt() {
        console.log("动画结束隐藏明牌");
        this.bottomCardAmtNode.getComponent(Animation).play(); // play 不传参数播放默认动画
        // 发牌结束隐藏明牌按钮
        findChildByNameRecursive(this.myInfoNode, "MingPaiBtn").active = false;
        // 初始化选择卡牌方法
        this.scheduleOnce(() => {
            this.myCardParentNode.getComponent(CardSelection).initSelectCard();
        })
    }

    // 底牌动画播放结束
    onBottomCardAmt() {
        this.bottomCardParent.active = true;
        this.bottomCardAmtNode.active = false;
    }

    // 玩家明牌
    async mingpai() {
        const socket = await WebsocketMgr.instance({ url: this.socketUrl });
        socket.send({
            type: "mingPai",
            params: {
                roomId: sys.localStorage.getItem("joinRoomId"),
            }
        });
    }

    // 监听明牌
    onMingpai({ data, code }) {
        if (code == 200) {
            // 设置玩家状态为明牌
            this.roomInfo.roomUsers[data.userId].mingpai = true;
            // 该玩家提交的明牌请求成功，隐藏明牌按钮
            if (data.userId == this.userInfo.user_id) {
                findChildByNameRecursive(this.myInfoNode, "MingPaiBtn").active = false;
            } else { // 其他玩家明牌，重新渲染他们的卡牌
                // 渲染明牌用户的卡牌 roomUser 只包含明牌用户的信息
                this.renderCard(data.roomUser)
            }
            // 明牌音频
            AudioMgr.inst.playOneShot(playAudios[audioPageageName]["mingpai"]);
        }
    }

    // 选择加倍
    async selectDouble(event, status) {
        const socket = await WebsocketMgr.instance({ url: this.socketUrl });
        socket.send({
            type: "selectDouble",
            params: {
                roomId: sys.localStorage.getItem("joinRoomId"),
                selectDouble: status
            }
        });
    }

    // 选择加倍倒计时(触发改事件，证明有玩家没有选择加倍)
    onSelectDoubleTime({ data, code }) {
        if (code == 200) {
            console.log(data)
            // 用户节点
            const userNodeId = this.getUserNodeInfo();

            data.selectDoubleList.forEach(({ userSelectDouble, userId }) => {
                userNodeId.forEach(({ nodeId, node, cardNodeName }) => {
                    if (nodeId == userId) {
                        // 倒计时结束 && 该用户没有选择加倍
                        if (userSelectDouble == null && data.downTime <= 0) {
                            // 默认展示不加倍
                            findChildByNameRecursive(node, "NoDoubleRes").active = true;
                            // 播放不加倍音乐
                            AudioMgr.inst.playOneShot(playAudios[audioPageageName]["bujiabei"]);
                        }

                        // 该用户已经选择过加倍了 或 加倍倒计时结束了
                        if (userSelectDouble !== null || data.downTime <= 0) {
                            // 判断是不是当前用户的节点，因为不是当前用户没有选择加倍ui
                            cardNodeName == "my" && (findChildByNameRecursive(node, "SelectDouble").active = false);
                            findChildByNameRecursive(node, "TimeDown").active = false;
                        } else {
                            // 展示加倍倒计时按钮
                            cardNodeName == "my" && (findChildByNameRecursive(node, "SelectDouble").active = true);
                            // 展示加倍倒计时
                            findChildByNameRecursive(node, "TimeDown").active = true;
                            findChildByNameRecursive(node, "TimeDown").getChildByName('Str').getComponent(Label).string = data.downTime;
                        }
                    }
                })
            });

            // 倒计时结束，延迟0.4秒隐藏，展示一下用户默认选择不加倍
            if (data.downTime <= 0) {
                this.scheduleOnce(() => {
                    userNodeId.forEach(({ nodeId, node, cardNodeName }) => {
                        findChildByNameRecursive(node, "NoDoubleRes").active = false;
                        findChildByNameRecursive(node, "DoubleRes").active = false;
                        findChildByNameRecursive(node, "SuperDoubleRes").active = false;
                    })
                }, 0.4);
            }
        }
    }

    // 监听用户选择加倍成功
    onSelectDouble({ data, code, type }) {
        if (code == 200) {
            // 获取节点顺序
            const userNodeId = this.getUserNodeInfo();
            userNodeId.forEach(({ node, nodeId }) => {
                // data.redouble_status 1不加倍 2加倍 3超级加倍
                if (data.redouble_status == 1) {
                    if (data.selectUserId == nodeId) {
                        // 展示不加倍
                        findChildByNameRecursive(node, "NoDoubleRes").active = true;
                    }
                    // 不加倍音频
                    AudioMgr.inst.playOneShot(playAudios[audioPageageName]["bujiabei"]);
                } else if (data.redouble_status == 2) {
                    if (data.selectUserId == nodeId) {
                        // 展示加倍
                        findChildByNameRecursive(node, "DoubleRes").active = true;
                    }
                    // 加倍音频
                    AudioMgr.inst.playOneShot(playAudios[audioPageageName]["jiabei"]);
                } else if (data.redouble_status == 3) {
                    if (data.selectUserId == nodeId) {
                        // 展示超级加倍
                        findChildByNameRecursive(node, "SuperDoubleRes").active = true;
                    }
                    // 超级加倍音频
                    AudioMgr.inst.playOneShot(playAudios[audioPageageName]["chaojijiabei"]);
                }
            })


            // 选择结束通知所有人，隐藏选择加倍按钮和计时器
            if (type == "selectDoubleEnd") {
                findChildByNameRecursive(this.myInfoNode, "SelectDouble").active = false;
                // 隐藏加倍倒计时
                findChildByNameRecursive(this.myInfoNode, "TimeDown").active = false;

                // 延迟400毫秒再去隐藏选中加倍结果
                this.scheduleOnce(() => {
                    userNodeId.forEach(({ node, nodeId }) => {
                        // 展示不加倍
                        findChildByNameRecursive(node, "NoDoubleRes").active = false;
                        // 展示加倍
                        findChildByNameRecursive(node, "DoubleRes").active = false;
                        // 展示超级加倍
                        findChildByNameRecursive(node, "SuperDoubleRes").active = false;
                    })
                }, 0.4)
            } else if (type = "selectDouble") {
                // 选择加倍没有结束，选择加倍用户隐藏选择加倍按钮和计时器
                if (data.selectUserId == this.userInfo.user_id) {
                    findChildByNameRecursive(this.myInfoNode, "SelectDouble").active = false;
                    // 隐藏加倍倒计时
                    findChildByNameRecursive(this.myInfoNode, "TimeDown").active = false;
                }
            }
        }
    }

    // 微信分享好友功能
    wxShare() {
        if (window.wx) {
            window.wx.shareAppMessage({
                title: '好友邀请你一起来游戏',
                imageUrl: CONFIG.RESOURCE_BASE_URL + "/images/roomShare.png",
                query: `roomId=${this.roomId}`,
            })
        }
    }

    // 测试
    testWebsocketClose() {
        // 关闭连接
        WebsocketMgr.close();
    }
}


