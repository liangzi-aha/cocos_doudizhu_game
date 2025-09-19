import { _decorator, CCInteger, Component, Enum, instantiate, math, Node, Prefab, Quat, tween, UITransform, v2, v3, Widget } from 'cc';
import { CardItem } from './CardItem';
import { CardSelection } from './CardSelection';
const { ccclass, property } = _decorator;

// 定义一个枚举类型，包含下拉框的选项
enum DropdownOptions {
    my,
    leftUser,
    rightUser
}

// 将枚举类型注册到 Cocos Creator 中
const DropdownOptionsEnum = Enum(DropdownOptions);

@ccclass('Card')
export class Card extends Component {
    @property({
        type: [String],
        displayName: '卡牌列表',
    })
    public cardList = [];
    @property({
        type: Prefab,
        displayName: '卡片',
    })
    cardPrefab: Prefab = null;
    @property({
        type: DropdownOptionsEnum,
        displayName: '卡牌渲染类型',
    })
    cardUser: DropdownOptions = DropdownOptions.my;

    start() {

    }

    // 初始化卡牌
    init(isFirstInit = false) {
        if (this.cardUser == DropdownOptions.my) {
            this.initMyCard(isFirstInit);
        } else if (this.cardUser == DropdownOptions.leftUser) {
            this.initLeftUserCard();
        } else if (this.cardUser == DropdownOptions.rightUser) {
            this.initRightUserCard();
        }
    }

    // 卡牌重新排序
    cardSort(callback?) {
        if (this.cardUser == DropdownOptions.my) {
            this.myCardSort(callback);
        } else if (this.cardUser == DropdownOptions.leftUser) {
            this.LeftUserCardSort(callback);
        } else if (this.cardUser == DropdownOptions.rightUser) {
            this.RightUserCardSort(callback);
        }
    }

    // 初始化我的牌, isDealCards：是否第一次发牌，第一次执行动画默认隐藏卡牌
    private initMyCard(isFirstInit) {
        // 每次渲染之前先删除掉之前渲染的卡牌
        this.node.removeAllChildren();
        this.cardList.forEach((cardNum, index) => {
            const card = instantiate(this.cardPrefab);
            console.log("渲染我的卡牌 isFirstInit", isFirstInit);
            // 设置卡片值
            card.getComponent(CardItem).cardNum = Number(cardNum) % 13 == 0 ? 13 : Number(cardNum) % 13;
            card.getComponent(CardItem).cardType = Math.ceil(Number(cardNum) / 13) - 1;
            card.getComponent(CardItem).mingpai = true; // 我的牌必定是展示正面的
            card.getComponent(Widget).left = index * 40;
            this.node.addChild(card);
            // 默认隐藏，等待动画结束展示
            card.active = !isFirstInit;
        });

        // 第一次发牌执行动画的话，等动画执行完毕回调中初始化，选择卡牌方法
        if (!isFirstInit) {
            this.scheduleOnce(() => {
                // 设置卡牌选择功能
                this.node.getComponent(CardSelection).initSelectCard();
            }, 0)
        }
    }

    // 卡牌重新排序
    private myCardSort(callback?) {
        console.log("还剩余", this.node.children.filter(child => child.isValid).length);
        this.node.children.filter(child => child.isValid).forEach((card, index) => {
            tween(card.getComponent(Widget)).to(0.2, {
                left: index * 40
            }).call(() => {
                callback && callback();
            }).start()
        });
    }

    // 初始化左侧用户牌
    private initLeftUserCard() {
        console.log(this.cardList)
        // 每次渲染之前先删除掉之前渲染的卡牌
        this.node.removeAllChildren();
        this.cardList.forEach((cardNum, index) => {
            const card = instantiate(this.cardPrefab);
            // 0 没有明牌,不去设置牌值
            if (cardNum != 0) {
                // 设置卡片值
                card.getComponent(CardItem).cardNum = (Number(cardNum) % 13 == 0 ? 13 : Number(cardNum) % 13);
                // 设置卡牌类型
                card.getComponent(CardItem).cardType = Math.ceil(Number(cardNum) / 13) - 1;
            }
            card.getComponent(CardItem).mingpai = (cardNum == 0 ? false : true);
            card.getComponent(Widget).top = index * 22;
            card.getComponent(Widget).left = 9;
            card.getComponent(Widget).updateAlignment();
            card.getComponent(UITransform).setContentSize(53, 72);
            // 创建一个四元数对象
            const rotationQuat = new Quat();
            // 围绕 Z 轴旋转 45 度
            Quat.fromEuler(rotationQuat, 0, 0, -90);
            // 设置节点的旋转
            card.setRotation(rotationQuat);
            card.parent = this.node;
        });
    }

    // 右侧用户牌排序
    private LeftUserCardSort(callback?) {
        this.node.children.filter(child => child.isValid).forEach((card, index) => {
            tween(card.getComponent(Widget)).to(0.2, {
                top: index * 22
            }).call(() => {
                callback && callback();
            }).start()
        });
    }

    // 初始化右侧用户牌
    private initRightUserCard() {
        console.log("initRightUserCard", this.cardList)
        // 每次渲染之前先删除掉之前渲染的卡牌
        this.node.removeAllChildren();
        const cardNodes: any[] = []; // 用于暂存创建的 card 节点
        this.cardList.reverse().forEach((cardNum, index, temp) => {
            const card = instantiate(this.cardPrefab);
            // 0 没有明牌,不去设置牌值
            if (cardNum != 0) {
                // 设置卡片值
                card.getComponent(CardItem).cardNum = (Number(cardNum) % 13 == 0 ? 13 : Number(cardNum) % 13);
                // 设置卡牌类型
                card.getComponent(CardItem).cardType = Math.ceil(Number(cardNum) / 13) - 1;
            }
            card.getComponent(CardItem).mingpai = (cardNum == 0 ? false : true);
            card.getComponent(Widget).top = index * 22;
            card.getComponent(Widget).left = 9;
            card.getComponent(Widget).updateAlignment();
            card.getComponent(UITransform).setContentSize(53, 72);
            // 创建一个四元数对象
            const rotationQuat = new Quat();
            // 围绕 Z 轴旋转 90 度
            Quat.fromEuler(rotationQuat, 0, 0, 90);
            // 设置节点的旋转
            card.setRotation(rotationQuat);
            card.parent = this.node;
            // 设置目标节点的兄弟索引
            cardNodes.push(card);
        });

        cardNodes.forEach((card, index, temp) => {
            // 反向下标
            const reverseIndex = (temp.length - 1 - index);
            card.setSiblingIndex(reverseIndex);
        })
    }

    // 右侧用户牌排序
    private RightUserCardSort(callback?) {
        this.node.children.filter(child => child.isValid).forEach((card, index, temp) => {
            // 反向下标
            const reverseIndex = (temp.length - 1 - index);
            tween(card.getComponent(Widget)).to(0.2, {
                top: reverseIndex * 22
            }).call(() => {
                callback && callback();
            }).start()
        });
    }

    // 名牌翻转
    mingpai() {
        this.node.children.forEach((card, index) => {
            card.getComponent(CardItem).mingpai = true;
            card.getComponent(CardItem).init();
        });
    }

    update(deltaTime: number) {

    }
}


