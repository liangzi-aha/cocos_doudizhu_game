import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CardBox')
export class CardBox extends Component {
    @property({
        type: String,
        displayName: "用户ID"
    })
    userId: string = "";

    start() {

    }

    update(deltaTime: number) {

    }
}


