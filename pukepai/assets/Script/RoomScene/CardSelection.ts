import { _decorator, Component, Node, Sprite, Vec2, EventTouch, UITransform, Input, input, Vec3, Vec4, Color, sys, Button, AudioClip } from 'cc';
import { CardItem } from './CardItem';
import { RoomScene } from './RoomScene';
import { findChildByNameRecursive } from '../../Utils/Tools';
import CardLogic from '../../Utils/cardLogic';
import { AudioMgr } from '../AudioMgr';
const { ccclass, property } = _decorator;

@ccclass('CardSelection')
export class CardSelection extends Component {
    private cards: any[] = [];
    private preSelectedCards: Node[] = []; // 选中的卡牌
    private startPosition = null;
    private movePosition = null;
    @property({
        type: RoomScene,
        displayName: "房间场景脚本"
    })
    roomScene: RoomScene = null; // 绑定房间场景脚本，获取该脚本的数据
    @property({
        type: Node,
        displayName: "卡牌按钮控制器"
    })
    CardButtonControl: Node = null; // 卡牌按钮控制器
    @property({
        type: AudioClip,
        displayName: "选择卡牌音频"
    })
    SelectCardAudio: AudioClip = null; // 卡牌按钮控制器
    // 本地存储用户信息
    userInfo: any = {};


    protected start(): void {
        try {
            // 解析本地用户信息
            this.userInfo = JSON.parse(sys.localStorage.getItem("userInfo"));
        } catch (error) {
            console.log("获取用户信息失败");
        }
    }

    onLoad() {
        this.node.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDestroy() {
        this.node.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    // 获取卡牌列表,比如出完牌需要更新 cards
    initSelectCard() {
        const cardList = [];
        this.node.children.forEach((card, index, cards) => {
            const cardRect = card.getComponent(UITransform)!.getBoundingBoxToWorld();
            cardList.push({
                card: card,
                cardNum: card.getComponent(CardItem).cardNum,
                cardType: card.getComponent(CardItem).cardType,
                minX: cardRect.x,
                maxX: (index == cards?.length - 1) ? cardRect.x + cardRect.width : cardRect.x + 40,
            })
        })
        console.log('cardList', cardList);
        this.cards = cardList;
        this.preSelectedCards = [];
        this.startPosition = null;
        this.movePosition = null;
    }

    // 获取当前选中的扑克牌
    getSelectCards() {
        return this.preSelectedCards.map(card => {
            return {
                card: card,
                cardNum: card.getComponent(CardItem).cardNum,
                cardType: card.getComponent(CardItem).cardType,
                cardIndex: card.getComponent(CardItem).cardNum + card.getComponent(CardItem).cardType * 13
            }
        });
    }

    private onTouchStart(event: EventTouch) {
        console.log("onTouchStart")
        this.startPosition = event.getUILocation();
        this.checkPreSelection(true);
    }

    private onTouchMove(event: EventTouch) {
        console.log("onTouchMove")
        this.movePosition = event.getUILocation();
        this.checkPreSelection(true);
    }

    private onTouchEnd(event: EventTouch) {
        console.log("开始位子", this.startPosition);
        console.log("移动位子", this.movePosition);
        // 计算选中的牌
        this.checkPreSelection(false);
        this.scheduleOnce(() => {
            this.updateSelectedCards();
        }, 0)
        this.startPosition = null;
        this.movePosition = null;
    }

    // 检测预选卡牌，是否预选，还未确定（滑动选择未离开）
    private checkPreSelection(setColor) {
        for (const { card, minX, maxX } of this.cards) {
            const touchMaxx = this.startPosition?.x > this.movePosition?.x ? this.startPosition?.x : this.movePosition?.x;
            const touchMinx = this.startPosition?.x < this.movePosition?.x ? this.startPosition?.x : this.movePosition?.x;

            // 判断点击是否移动了（拖动多选）
            if (this.startPosition && this.movePosition) {
                // 节点包含开始位子，正面被选中了
                if ((this.startPosition.x <= maxX && this.startPosition.x >= minX) || (this.movePosition.x < maxX && this.movePosition.x >= minX) || (touchMaxx > maxX && touchMinx < minX)) {
                    if (setColor && card) {
                        card.getComponent(Sprite).color = new Color(162, 162, 162, 255);
                    } else {
                        // 满足上面条件正面该节点被选中了
                        if (this.preSelectedCards.indexOf(card) == -1) {
                            this.preSelectedCards.push(card);
                        } else {
                            const index = this.preSelectedCards.indexOf(card);
                            if (index !== -1) {
                                this.preSelectedCards.splice(index, 1);
                            }
                        }
                    }
                } else {
                    // console.log("防止下次报错打印日志（不知道什么问题） card", card)
                    card.getComponent(Sprite).color = new Color(255, 255, 255, 255);
                }
            } else if (this.startPosition) { // 点击单选
                if (this.startPosition.x <= maxX && this.startPosition.x >= minX) { // 没有移动，证明是只点击了一下
                    if (setColor) {
                        card.getComponent(Sprite).color = new Color(162, 162, 162, 255);
                    } else {
                        // 满足上面条件正面该节点被选中了
                        if (this.preSelectedCards.indexOf(card) == -1) {
                            this.preSelectedCards.push(card);
                        } else {
                            const index = this.preSelectedCards.indexOf(card);
                            if (index !== -1) {
                                this.preSelectedCards.splice(index, 1);
                            }
                        }

                    }
                } else if (card) {
                    // card.getComponent(Sprite).color = new Color(255, 255, 255, 255);
                }
            }
        }

        if (setColor == false) {
            // 执行选中音乐
            AudioMgr.inst.playOneShot(this.SelectCardAudio);
        }

        console.log("选中卡牌", this.preSelectedCards.map(item => item.getComponent(CardItem).cardNum))
    }

    // 更新选中的牌样式
    private updateSelectedCards() {
        // 先取消当前所有选中的牌(恢复卡牌位子，取消选择卡牌样式)
        this.deselectAllCard();

        // 根据预选中的牌更新选中状态和样式
        this.preSelectedCards.forEach(card => {
            this.selectCard(card);
        });

        // 更新出牌按钮是否可以点击
        this.updatePlayCardBtnStyle();
    }

    // 提示功能选中卡牌
    hintSelectCard(cardNumList) {
        // console.log("cardNumList", cardNumList)
        // console.log("this.cards", this.cards)
        if (cardNumList?.length <= 0) return;

        // 选中卡牌清空
        this.preSelectedCards = [];
        // 先取消当前所有选中的牌
        this.deselectAllCard();

        cardNumList.forEach((cardNUm) => {
            const cardInfo = this.cards.find(item => (item.cardNum + item.cardType * 13) == cardNUm);
            console.log("cardInfo", cardInfo)
            console.log("cardNUm", cardNUm)
            // 当前选中的卡牌
            if (cardInfo) {
                // 已经选中卡牌
                this.preSelectedCards.push(cardInfo.card);
                // 选中当前卡牌
                this.selectCard(cardInfo.card);
            }
        })

        // 更新出牌按钮是否可以点击
        this.updatePlayCardBtnStyle();
    }

    // 更新出牌按钮的样式
    updatePlayCardBtnStyle() {
        // 查询最近一条的出牌记录
        const lastRecord = this.roomScene.getLastRecord();
        console.log('lastRecord', lastRecord);
        // 最后一次出牌的记录如果是我的话，就不是压别人的牌，而是出牌
        const isYaPai = (!lastRecord?.userId || lastRecord?.userId == this.userInfo.user_id) ? false : true;
        // 获取选择的牌值
        const selectCardNum = this.getSelectCards().map(item => {
            return item.cardIndex
        });
        // 出牌按钮
        const playCardBtn = findChildByNameRecursive(this.CardButtonControl, "btn_chupai");

        console.log("是否压牌", isYaPai)
        console.log("选择牌值", selectCardNum)
        console.log("上个玩家出牌", lastRecord.playCard);
        console.log("选择牌类型", CardLogic.judgeCardType(selectCardNum));

        // 判断是否压牌
        if (isYaPai) {
            if (selectCardNum?.length <= 0 || CardLogic.compareWithCard(lastRecord.playCard, selectCardNum) == false) {
                // 出牌按钮灰色
                playCardBtn.getComponent(Sprite).color = new Color(162, 158, 158, 255);
                // 按钮可点击
                playCardBtn.getComponent(Button).interactable = false;
            } else {
                // 出牌按钮
                playCardBtn.getComponent(Sprite).color = new Color(255, 255, 255, 255);
                // 按钮可点击
                playCardBtn.getComponent(Button).interactable = true;
            }
        } else if (CardLogic.judgeCardType(selectCardNum)) {// 判断选择牌是否符合规则
            // 出牌按钮高亮
            playCardBtn.getComponent(Sprite).color = new Color(255, 255, 255, 255);
            playCardBtn.getComponent(Button).interactable = true;
        } else {
            // 出牌按钮高亮
            playCardBtn.getComponent(Sprite).color = new Color(162, 158, 158, 255);
            playCardBtn.getComponent(Button).interactable = false;
        }
    }

    // 设置选中卡牌样式
    private selectCard(card: Node) {
        // 改变选中牌的位置或样式
        card.setPosition(card.position.x, card.position.y + 20);
        // 设置选中卡牌颜色为白色
        card.getComponent(Sprite).color = new Color(255, 255, 255, 255);
    }

    // 单个取消选中卡牌
    private deselectCard(card: Node) {
        // 恢复未选中牌的位置或样式
        card.setPosition(card.position.x, 0);
    }

    // 取消全部选中卡牌位子和样式
    deselectAllCard() {
        // 恢复未选中牌的位置和样式
        this.cards.forEach(item => {
            item.card.setPosition(item.card.position.x, 0)
            // 取消所有选中颜色
            item.card.getComponent(Sprite).color = new Color(255, 255, 255, 255);
        });
    }

    // 不出牌
    noPlayCard() {
        // 选中卡牌清空
        this.preSelectedCards = [];
        // 先取消当前所有选中的牌
        this.deselectAllCard();
    }

}    