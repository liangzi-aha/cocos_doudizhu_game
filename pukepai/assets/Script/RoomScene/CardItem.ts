import { _decorator, CCBoolean, CCInteger, CCString, Component, resources, Sprite, SpriteAtlas } from 'cc';
const { ccclass, property } = _decorator;

enum CardType {
    FANGKUAI, // 方块
    MEIHUA, // 梅花
    HONGXIN, // 红桃
    HEITAO, // 黑桃
}

@ccclass('CardItem')
export class CardItem extends Component {
    @property({
        type: CCInteger, // CCString
        displayName: "牌值"
    })
    public cardNum = 0; // 1-13 为 A-K 53 为小王 54 为大王 55 为背面
    @property({
        type: CCInteger,
        displayName: '卡牌类型(0 方块 1 梅花 2 红桃 3 黑桃 4 王)',
    })
    cardType: CardType = CardType.FANGKUAI;
    @property({
        type: CCBoolean,
        displayName: '是否明牌',
    })
    mingpai: boolean = false;

    start() {
        this.init();
    }

    // 根据牌值，初始化图片
    init() {
        // 加载 plist 文件和对应的 png 图片
        resources.load('Plist/card', SpriteAtlas, (err, spriteAtlas) => {
            if (err) {
                console.error('加载 plist 文件失败:', err);
                return;
            }

            console.log("加载 plist 文件成功")

            // 获取指定名称的 SpriteFrame 55为背面
            const spriteFrame = spriteAtlas.getSpriteFrame(`card_${this.renderCardPriteNum()}`);
            if (spriteFrame) {
                const targetSprite = this.node.getComponent(Sprite);
                if (targetSprite) {
                    // 将 SpriteFrame 设置到 Sprite 组件上
                    targetSprite.spriteFrame = spriteFrame;
                }
            } else {
                console.error('未找到指定的 SpriteFrame', `card_${this.renderCardPriteNum()}`);
            }
        });
    }

    // 判断渲染什么牌
    renderCardPriteNum() {
        // 没有明牌 || 牌值为0为别人的牌，没有权限访问别人的牌
        if (!this.mingpai || this.cardNum == 0) {
            return 55; // 卡牌背面
        } else {
            return this.cardType * 13 + this.cardNum
        }
    }

    update(deltaTime: number) {

    }
}


