import { _decorator, Component, Graphics, Sprite, Mask, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('RoundCornerGraphics')
export class RoundCornerGraphics extends Component {
    @property(Sprite)
    sprite: Sprite | null = null;

    @property
    radius: number = 20;

    start() {
        if (this.sprite) {
            const graphics = this.node.addComponent(Graphics);
            const size = this.sprite.getComponent(UITransform).contentSize;
            // 将绘制原点设置为精灵中心
            const centerX = -size.width / 2;
            const centerY = -size.height / 2;
            graphics.roundRect(centerX, centerY, size.width, size.height, this.radius);
            graphics.fill();

            const mask = this.node.addComponent(Mask);
            mask.type = Mask.Type.GRAPHICS_STENCIL;
        }
    }
}    