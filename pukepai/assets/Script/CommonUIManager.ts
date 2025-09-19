import { _decorator, Color, Component, director, instantiate, Label, Layers, Node, Prefab, resources, Size, Sprite, tween, UIOpacity, UITransform } from 'cc';
const { ccclass, property } = _decorator;

// 公共ui管理器 （toast，loading）
export class CommonUIManager {
    private static _inst: CommonUIManager;
    public static get inst(): CommonUIManager {
        if (this._inst == null) {
            console.log('创建toast管理器');
            this._inst = new CommonUIManager();
        }
        return this._inst;
    }

    private _commonUIManager: Node;
    private static _loading: Node;
    private static _loading_show: boolean; // 是否展示loading
    private static _toast: Node;
    private static _tween: any;

    // 获取toast存放节点
    public static get CommonUIManager(): Node {
        return this._inst._commonUIManager;
    }

    constructor() {
        // 加载toast管理节点 预制体
        resources.load('Prefabs/CommonUICanvas', Prefab, (err, prefab: Prefab) => {
            if (err) {
                console.error('加载预制体失败:', err);
                return;
            }

            // 实例化 Toast 预制体
            this._commonUIManager = instantiate(prefab);
            //@zh 创建一个节点作为 CommonUIManager
            this._commonUIManager.name = '_commonUIManager';
            //@zh 添加节点到场景
            director.getScene().addChild(this._commonUIManager);
            //@zh 标记为常驻节点，这样场景切换的时候就不会被销毁了
            director.addPersistRootNode(this._commonUIManager);
        });

    }

    // 创建Toast提示
    private ToastCreate(message: string, duration: number = 2) {
        // 加载预制体
        resources.load('Prefabs/Toast', Prefab, (err, prefab: Prefab) => {
            if (err) {
                console.error('加载预制体失败:', err);
                return;
            }

            // 实例化 Toast 预制体
            CommonUIManager._toast = instantiate(prefab);
            // 执行动画
            this.toastLoading(message, duration);
            // 将 Toast 添加到场景中
            this._commonUIManager?.addChild(CommonUIManager._toast);
        });
    }

    // 执行toast动画
    private toastLoading(message, duration) {
        const opacityComp = CommonUIManager._toast.getComponent(UIOpacity);
        // 默认设置 toast 隐藏
        opacityComp.opacity = 0;
        // 获取 Label 组件
        const label = CommonUIManager._toast.getChildByName('string');
        const background = CommonUIManager._toast.getChildByName('bg').getComponent(Sprite);

        if (label && background) {
            label.getComponent(Label).string = message;
            // 刷新 Label 的内容大小
            label.getComponent(Label).updateRenderData(true);
            label.getComponent(Label).color = new Color(255, 255, 255, 255);
            const textSize = label.getComponent(UITransform);
            // 设置背景的内边距
            const padding = 20;
            const bgSize = new Size(textSize.width + padding * 2, textSize.height);
            background.getComponent(UITransform).setContentSize(bgSize);

            // 显示动画
            CommonUIManager._tween = tween(opacityComp)
                .to(0.2, { opacity: 255 })
                .delay(duration)
                .to(0.2, { opacity: 0 })
                .call(() => {
                    // 动画结束后移除 Toast
                    CommonUIManager._toast.active = false;
                })
                .start();
        }
    }

    // 显示 Toast 提示
    public showToast(message: string, duration: number = 2) {
        if (CommonUIManager._toast) {
            // 关闭上一个 toast 的tween动画
            CommonUIManager._tween.stop();
            // 展示
            CommonUIManager._toast.active = true;
            // 执行动画
            this.toastLoading(message, duration);
        } else {
            this.ToastCreate(message, duration);
        }
    }

    // 创建加载动画
    private LoadingCreate(message) {
        // 加载预制体
        resources.load('Prefabs/Loading', Prefab, (err, prefab: Prefab) => {
            if (err) {
                console.error('加载预制体失败:', err);
                return;
            }

            // 防止多次创建
            if (CommonUIManager._loading && CommonUIManager._loading_show == true) {
                CommonUIManager._loading.active = true;
                if (message) {
                    CommonUIManager._loading.getChildByName("Str").active = true;
                    CommonUIManager._loading.getChildByName("Str").getComponent(Label).string = message;
                }
                return
            };

            CommonUIManager._loading = instantiate(prefab);
            CommonUIManager._loading.setParent(this._commonUIManager);
            // 设置消息值
            if (message) {
                CommonUIManager._loading.getChildByName("Str").active = true;
                CommonUIManager._loading.getChildByName("Str").getComponent(Label).string = message;
            }
            // 通过状态判断loading是否应该展示，因为第一次创建loading 的时候回去加载可能比较慢，接口已经响应去关闭loading了，但是loading还没创建出来，所以需要判断一下
            if (CommonUIManager._loading_show == true) {
                CommonUIManager._loading.active = true;
            }
        })
    }

    public showLoading(message = "") {
        CommonUIManager._loading_show = true;
        if (CommonUIManager._loading) {
            // console.log("showLoading")
            CommonUIManager._loading.active = true;
            CommonUIManager._loading.getChildByName("Str").getComponent(Label).string = message;
        } else {
            // console.log("showLoading1")
            this.LoadingCreate(message);
        }
    }

    public hideLoading() {
        console.log("hideLoading")
        CommonUIManager._loading_show = false;
        if (CommonUIManager._loading) {
            console.log("hideLoading1")
            CommonUIManager._loading.active = false;
        }
    }

    update(deltaTime: number) {

    }
}


