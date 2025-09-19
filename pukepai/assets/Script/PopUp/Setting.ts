import { _decorator, AudioClip, Component, director, find, Node, sys } from 'cc';
import { CommonUIManager } from '../CommonUIManager';
import { noLoadingPost, post } from '../Api/FetchMgr';
import { Switch } from '../UI/Switch';
import { AudioMgr } from '../AudioMgr';
import { CONFIG } from '../Config';
import { HallSceneMgr } from '../SceneScript/HallSceneMgr';
const { ccclass, property } = _decorator;

@ccclass('Setting')
export class Setting extends Component {
    @property({
        type: Node,
        displayName: '绑定微信'
    })
    BindWx: Node = null;
    // @property({
    //     type: Node,
    //     displayName: '更改用户信息'
    // })
    // UserInfo: Node = null;
    @property({
        type: Node,
        displayName: '游戏音效'
    })
    GameAudio: Node = null;
    @property({
        type: Node,
        displayName: '背景音效节点'
    })
    BgAudioNode: Node = null;

    start() {

    }

    update(deltaTime: number) {

    }

    out() {
        sys.localStorage.removeItem('token');
        CommonUIManager.inst.showToast('退出成功');
        director.loadScene('LoginScene');
    }

    async showSetting() {
        // 获取设置信息
        const { code, data } = await post('/getSetting');
        if (code === 200) {
            // 不是微信，隐藏微信操作选项
            if (!window.wx) {
                // this.BindWx.active = false;
                // this.UserInfo.active = false;
            }
            // 设置微信绑定状态
            if (data.wxOpenId) {
                this.BindWx.getChildByName("Bound").active = true;
                this.BindWx.getChildByName("BindWxBtn").active = false;
            } else {
                this.BindWx.getChildByName("BindWxBtn").active = true;
                this.BindWx.getChildByName("Bound").active = false;
            }
            // 设置音频开关状态
            this.GameAudio.getChildByName("Switch").getComponent(Switch).switchFun(data.gameAudio == 1 ? true : false);
            // 设置背景音效开关状态
            this.BgAudioNode.getChildByName("Switch").getComponent(Switch).switchFun(data.bgAudio == 1 ? true : false);
        }
        this.node.active = true;
    }


    // 微信登录
    public BinxWxFun() {
        if (window.wx) {
            wx.login({
                timeout: "6000",
                success: async (res) => {
                    console.log(res);
                    // 调用接口获取openid
                    let response = await post("/codeGetOpenId", {
                        code: res.code,
                        getRegister: false, // 不去查询用户是否注册
                    });
                    const { openid } = response.data;

                    if (response.code === 200) {
                        wx.getUserProfile({
                            lang: 'zh_CN',
                            desc: '展示用户信息',
                            success: async (data) => {
                                // 当前用户取绑定微信账号
                                let res = await post("/userBindWx", {
                                    openid: openid,
                                    wxUserInfo: data.userInfo
                                });
                                if (res.code == 200 && res.data == true) {
                                    CommonUIManager.inst.showToast("绑定成功");
                                    this.BindWx.getChildByName("Bound").active = true;
                                    this.BindWx.getChildByName("BindWxBtn").active = false;
                                    // 更新用户信息
                                    find("Canvas").getComponent(HallSceneMgr).getUserInfo(true);
                                } else {
                                    CommonUIManager.inst.showToast(res.message);
                                }
                            }
                        })
                    }
                },
                fail: (err) => {
                    console.log(err);
                },
            });
        } else {
            CommonUIManager.inst.showToast("不是微信小程序无法绑定");
        }
    }

    // 设置游戏音频开关
    async changeGameAudio() {
        const audioStatus = this.GameAudio.getChildByName("Switch").getComponent(Switch).active ? 0 : 1;
        const { code, data } = await noLoadingPost('/changeAudio', {
            audioStatus
        });

        if (code === 200 && data == true) {
            CommonUIManager.inst.showToast("修改成功");
            this.GameAudio.getChildByName("Switch").getComponent(Switch).switchFun(audioStatus ? true : false)
        } else {
            CommonUIManager.inst.showToast("修改失败");
        }
    }

    // 设置大厅背景音频开关
    async changeBgAudio() {
        const audioStatus = this.BgAudioNode.getChildByName("Switch").getComponent(Switch).active ? 0 : 1;
        const { code, data } = await noLoadingPost('/changeBgAudio', {
            audioStatus
        });

        if (code === 200 && data == true) {
            CommonUIManager.inst.showToast("修改成功");
            this.BgAudioNode.getChildByName("Switch").getComponent(Switch).switchFun(audioStatus ? true : false)
            if (audioStatus) {
                AudioMgr.inst.play(CONFIG.RESOURCE_BASE_URL + "/audios/bg.mp3", 1, true);
            } else {
                AudioMgr.inst.stop();
            }
        } else {
            CommonUIManager.inst.showToast("修改失败");
        }
    }

    close() {
        this.node.active = false;
    }
}


