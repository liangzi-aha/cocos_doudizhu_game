import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Switch')
export class Switch extends Component {

    @property(Node)
    ActiveImg: Node = null;

    @property(Node)
    InActive: Node = null;

    public active = false;

    start() {

    }

    switchFun(status) {
        // 如果传入状态，则切换为传入状态
        if (status != undefined) {
            this.active = status;
        } else {
            // 如果不传入状态，则切换状态
            this.active = !this.active;
        }
        console.log("当前状态：", this.active)
        this.ActiveImg.active = this.active;
        this.InActive.active = !this.active;
    }

    update(deltaTime: number) {

    }
}


