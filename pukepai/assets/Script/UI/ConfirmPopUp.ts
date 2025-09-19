import { _decorator, Component, Label, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ConfirmPopUp')
export class ConfirmPopUp extends Component {
    // 标题
    title: string = null;
    // 内容
    text: string = null;
    // 确定事件
    confirmFun = () => { };
    // 取消事件
    cancelFun = () => {
        this.node.destroy();
    };


    start() {

    }

    update(deltaTime: number) {

    }

    initConfirmPopUp(title: string, text: string, confirmFun: () => void, cancelFun?: () => void) {
        this.title = title;
        this.text = text;
        this.node.getChildByName("Title").getComponent(Label).string = title;
        this.node.getChildByName("Text").getComponent(Label).string = text;
        this.confirmFun = confirmFun;
        if (cancelFun) {
            this.cancelFun = cancelFun;
        }
        this.node.active = true;
    }

    confirm() {
        this.confirmFun();
    }

    cancel() {
        this.cancelFun();
    }
}


