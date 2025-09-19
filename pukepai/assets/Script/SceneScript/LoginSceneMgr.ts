import { _decorator, Component, director, EditBox, Node, sys } from 'cc';
import { CommonUIManager } from '../CommonUIManager';
import { post, get } from '../Api/FetchMgr';
import { AudioMgr } from '../AudioMgr';
const { ccclass, property } = _decorator;

@ccclass('LoginSceneMgr')
export class LoginSceneMgr extends Component {

    @property({
        type: Node,
        displayName: "游客登录弹框"
    })
    public visitorLoginPop: Node = null;
    @property({
        type: Node,
        displayName: "账号"
    })
    public account: Node = null;
    @property({
        type: Node,
        displayName: "账号"
    })
    public password: Node = null;

    async start() {
        const token = sys.localStorage.getItem("token");
        // 本地存储有token，直接跳转大厅
        if (token) {
            director.loadScene("HallScene");
        }

        if (!window.wx) {
            this.node.getChildByName("WxLoginBtn").active = false;
        }

        // 停止背景音乐
        AudioMgr.inst.stop();
    }

    update(deltaTime: number) {

    }

    toast(str: string) {
        CommonUIManager.inst.showToast(str);
    }

    // 游客登录弹框展示
    public visitorLoginPopShow() {
        this.visitorLoginPop.active = true;
    }

    // 游客登录弹框隐藏
    public visitorLoginPopHide() {
        this.visitorLoginPop.active = false;
    }

    // 游客登录
    public visitorLogin() {
        // 获取账号
        let acc = this.account.getComponent(EditBox).string;
        let pwd = this.password.getComponent(EditBox).string;
        console.log(acc, pwd);
        if (!acc) {
            this.toast("请输入账号");
        } else if (!pwd) {
            this.toast("请输入密码");
        } else {
            post('/login', {
                userAccount: acc,
                userPassword: pwd
            }).then((response) => {
                console.log(response);
                if (response.code == 200) {
                    console.log("登录成功");
                    this.toast("登录成功");
                    sys.localStorage.setItem('token', response.token);
                    // 跳转到大厅
                    director.loadScene('HallScene');
                } else {
                    this.toast(response.message);
                }
            })
        }

    }

    // 游客注册
    public visitorRegister() {
        // 获取账号
        let acc = this.account.getComponent(EditBox).string;
        let pwd = this.password.getComponent(EditBox).string;
        console.log(acc, pwd);
        if (!acc) {
            this.toast("请输入账号");
        } else if (!pwd) {
            this.toast("请输入密码");
        } else {
            post('/registerUser', {
                userAccount: acc,
                userPassword: pwd
            }).then((response) => {
                console.log(response);
                if (response.code == 200) {
                    this.toast("注册成功");
                } else {
                    this.toast(response.message);
                }
            })
        }
    }

    // 微信登录
    public WxLogin() {
        console.log("login");
        if (window.wx) {
            wx.login({
                timeout: "6000",
                success: async (res) => {
                    console.log(res);
                    // 调用接口获取openid
                    let response = await post("/codeGetOpenId", {
                        code: res.code,
                        getRegister: true,
                    });
                    const { openid, isRegister } = response.data;

                    if (response.code === 200) {
                        if (isRegister) {
                            let res = await post("/wxLogin", {
                                openid: openid,
                            });
                            if (res.code == 200) {
                                sys.localStorage.setItem('token', res.token);
                                // 跳转到大厅
                                director.loadScene('HallScene');
                            }
                        } else {
                            // 该微信在数据库中没有查询到
                            wx.getUserProfile({
                                lang: 'zh_CN',
                                desc: '展示用户信息',
                                success: async (data) => {
                                    let res = await post("/wxLogin", {
                                        openid: openid,
                                        wxUserInfo: data.userInfo
                                    });
                                    if (res.code == 200) {
                                        sys.localStorage.setItem('token', res.token);
                                        // 跳转到大厅
                                        director.loadScene('HallScene');
                                    }
                                }
                            })
                        }
                    }
                },
                fail: (err) => {
                    console.log(err);
                },
            });
        }
    }
}


