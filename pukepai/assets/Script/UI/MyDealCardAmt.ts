import { _decorator, AudioClip, Component, Node, tween, Vec3 } from 'cc';
import { eventTarget } from '../../Utils/EventListening';
import { AudioMgr } from '../AudioMgr';
const { ccclass, property } = _decorator;

@ccclass('MyDealCardAmt')
export class MyDealCardAmt extends Component {
    @property({
        type: Node,
        displayName: "我的牌父节点(用于获取位子做动画)"
    })
    myCardParent: Node = null;
    @property({
        type: AudioClip,
        displayName: "发牌音频"
    })
    fapaiAudio: AudioClip = null;

    start() {
    }

    update(deltaTime: number) {

    }

    // 发牌动画
    dealCardAnimation() {
        // [...this.node.children].reverse()
        const cards = this.node.children;
        console.log("cards", cards);
        // 展示卡牌动画
        cards.forEach((element, index, temp) => {
            element.setPosition(0, 71, 0);
            element.active = true;
        });

        // 展示
        this.node.active = true;
        // 要移动到的目标节点位子
        const targetOpt = this.myCardParent.getWorldPosition();
        // 真实卡牌节点
        const cardList = this.myCardParent.children;
        console.log(targetOpt.x)

        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];

            this.scheduleOnce(() => {
                // 发牌音频
                AudioMgr.inst.playOneShot(this.fapaiAudio);

                // 发牌动画
                tween(card)
                    .to(0.5, { worldPosition: new Vec3(targetOpt.x + i * 40 + 50, targetOpt.y, targetOpt.z) }, {
                        easing: 'quartOut'
                    })
                    .call(() => {
                        cardList[i].active = true;
                        card.active = false;

                        if (i == cardList.length - 1) {
                            // 动画完成后的回调
                            eventTarget.emit("dealCardsAmt", i);
                        }
                    })
                    .start();
            }, 0.15 * i);
        }
    }
}


