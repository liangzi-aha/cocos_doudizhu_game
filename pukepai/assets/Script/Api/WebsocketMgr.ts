import { director, Scene, find, sys } from "cc";
import { eventTarget } from "../../Utils/EventListening";
import { CommonUIManager } from "../CommonUIManager";
import { HallSceneMgr } from "../SceneScript/HallSceneMgr";
import { RoomScene } from "../RoomScene/RoomScene";
import { CONFIG } from "../Config";

// websocket send 消息类型
interface Message {
    type: string;
    params?: Object;
}

export class WebsocketMgr {
    private static _instance: WebsocketMgr; // socket 实例
    private socket: WebSocket | null = null; // socket 连接
    private url: string; // socket 连接地址
    private reconnectInterval: number = 5000; // 重连间隔时间
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private openCallback: Function; // 连接之后回调
    private reconnectTimeout: number = 10; // 重连次数
    private pingInterval: number = 30000; // 心跳连接超时时间
    private pingIntervalId: number = null; // 心跳计时器
    private pingTimeout = null; // 心跳超时计时器


    private constructor(url: string) {
        this.url = url;
        this.connect();
    }

    /**
     * 获取websocket 实例
     * @param url websocket 地址
     * @returns 
     */
    public static instance({ baseUrl = CONFIG.SOCKET_BASE_URL, url = "" } = {}): Promise<WebsocketMgr> {
        console.log(baseUrl + url, this._instance);
        // 这里为什么写成异步的方法，因为我想获取到socket连接之后向直接发送send请求，但是socket创建连接之后，不是直接就能发送的，需要连接成功后才可以，所以写成了异步的，当等待异步连接完成，再去发送请求
        return new Promise((resolve, reject) => {
            if (!this._instance) {
                console.log("创建新的实例")
                this._instance = new WebsocketMgr(baseUrl + url);
                // 保存回调函数，连接成功是调用
                this._instance.openCallback = resolve;
            } else if (this._instance.isWebSocketConnected()) {
                // 判断是否连接状态。已经连接的话直接返回 _instance
                resolve(this._instance)
            } else {
                // 保存回调函数，连接成功是调用
                this._instance.openCallback = resolve;
            }
        })
    }

    // 开始心跳检测
    private startPing() {
        this.sendPing();
        this.pingIntervalId = setInterval(() => this.sendPing(), this.pingInterval);
    }

    // 关闭心跳检测
    private stopPing() {
        clearInterval(this.pingIntervalId);
        clearTimeout(this.pingTimeout);
    }

    // 发送Ping消息
    private sendPing() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log('发送Ping...');
            this.socket.send('ping'); // 发送自定义Ping消息

            // 设置超时检测，如果超时未收到Pong则关闭连接
            this.pingTimeout = setTimeout(() => {
                console.log('Ping超时，关闭连接');
                WebsocketMgr.close(1006, "Ping超时，关闭连接") // 触发重连
            }, 10000);
        }
    }

    private connect() {
        this.socket = new WebSocket(this.url);
        // 请求url地址
        const urlPath = this.url?.split('?')[0]?.split('/ws')[1];

        console.log("this.url", this.url, this.url.includes("/roomInfo"))

        this.socket.onopen = () => {
            console.log('WebSocket 连接已打开');
            this.reconnectTimeout = 10;
            // 重连成功关闭loading
            CommonUIManager.inst.hideLoading();
            // 启动心跳检测
            this.startPing();

            // 有重连计时器证明是重连
            if (this.reconnectTimer) {
                clearInterval(this.reconnectTimer);
                this.reconnectTimer = null;
                // 重连成功，需要更新最新数据，比如获取房间信息、匹配
                if (this.url.includes("/matching")) { // 匹配请求链接
                    // 匹配重连成功，重新发送请求进行匹配
                    const scriptCom = find("Canvas").getComponent(HallSceneMgr);
                    // 断线重连，重新发送请求进行匹配
                    if (scriptCom) { scriptCom.matchRoom(); }
                } else if (this.url.includes("/roomInfo")) { // 游戏房间请求链接
                    console.log("调用重连获取房间信息")
                    const scriptCom = find("Canvas").getComponent(RoomScene);
                    // 断线重连获取房间信息
                    if (scriptCom) { scriptCom.getRoomInfo() }
                }
            }
            // 连接成功回调
            this.openCallback && this.openCallback(WebsocketMgr._instance);
            eventTarget.emit("socketOpen");
        };

        // 接受消息
        this.socket.onmessage = (event) => {
            let data: any = "";
            try {
                data = JSON.parse(event.data);
                // token 失效退出登录
                if (data.type == 'out') {
                    // toast 提示
                    CommonUIManager.inst.showToast(data.message);
                    // 删除用户信息
                    sys.localStorage.removeItem("token");
                    sys.localStorage.removeItem("userInfo");
                    // 跳转登录页面
                    director.loadScene('LoginScene');
                    return;
                } else if (data.type === 'ping') {
                    // 处理消息
                    console.log('收到ping响应');
                    clearTimeout(this.pingTimeout)
                } else if (data.code == 400) {
                    CommonUIManager.inst.showToast(data.message);
                }
            } catch (error) {
                console.log("JSON.parse解析失败", event.data);
            }
            // 发送事件
            eventTarget.emit(data.type, data);
        };

        // 监听断开连接（包含手动，和被动断开）
        this.socket.onclose = (event) => {
            console.log('WebSocket 连接已关闭', event, this.reconnectTimer);
            // 关闭心跳
            this.stopPing();
            // websocket 默认使用 1000 （手动关闭）
            if (event.code != 1000 && this.reconnectTimer === null) {
                // 展示重连loading
                CommonUIManager.inst.showLoading("重连中...");
                this.reconnectTimer = setInterval(() => {
                    --this.reconnectTimeout;
                    // 超过重连次数，不再进行重连
                    if (this.reconnectTimeout <= 0) {
                        clearInterval(this.reconnectTimer);
                        this.reconnectTimer = null;
                        CommonUIManager.inst.hideLoading();
                        // 连接超时
                        this.connectTimeOut();
                        return;
                    }
                    this.connect();
                }, this.reconnectInterval);
            }

            // 发送事件
            eventTarget.emit("socketClose");
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket 发生错误:', error);
            // 可重写此方法
            eventTarget.emit("socketError", error);
        };
    }

    // 连接超时处理
    public async connectTimeOut() {
        // 删除websocket实例，下次重新创建进行连接
        WebsocketMgr._instance = null;
        // 判断是哪个请求时断开了连接
        if (this.url.includes("/matching")) {
            // 匹配超时,重连失败，关闭匹配弹框
            const component = find("Canvas").getComponent(HallSceneMgr);
            if (component) {
                component.matchLoadingHide();
            }
        } else {
            // 其他请求时断开连接，回调首页
            director.loadScene("HallScene");
        }
    }

    public send(data: Message) {
        console.log('发送数据:', data, this.socket.readyState);
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const params = data.params || {};
            this.socket.send(JSON.stringify({
                ...data,
                params: {
                    token: sys.localStorage.getItem("token"), // 默认携带token参数
                    ...params,
                }
            }))
        } else {
            console.error('WebSocket断开连接，无法发送数据');
        }
    }

    // 手动断开连接
    public static close(code = 1000, reason = "手动关闭连接") {
        if (this._instance.socket) {
            if (this._instance.reconnectTimer) {
                clearInterval(this._instance.reconnectTimer);
                this._instance.reconnectTimer = null;
            }
            this._instance.socket.close(code, reason);
            this._instance = null;
        }
    }

    // 判断WebSocket是否连接
    public isWebSocketConnected() {
        return this.socket.readyState === WebSocket.OPEN;
    }
}