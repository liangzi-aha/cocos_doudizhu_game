import { _decorator, Component, Node, director, view, Enum, UITransform } from 'cc';
const { ccclass, property } = _decorator;

// 如果你需要自定义枚举值的显示名称，可以这样做
const CustomDirection = Enum({
    Width: 0,
    Height: 1,
    Scale: 2,
});

@ccclass('Adaptive')
export class Adaptive extends Component {

    @property({
        type: CustomDirection,
        displayName: '屏幕适配，1宽，2高，3宽高适配'
    })
    scale = CustomDirection.Scale;

    start() {
        console.log('屏幕适配', this.scale)

        // 获取当前屏幕的实际尺寸
        const winSize = view.getVisibleSize();
        // 获取设计分辨率（项目设置宽高分辨率）
        const designResolution = view.getDesignResolutionSize();

        // 计算缩放比例
        const scaleX = winSize.width / designResolution.width;
        const scaleY = winSize.height / designResolution.height;


        if (this.scale == CustomDirection.Scale) {
            // 根据缩放比例调整节点的位置和大小
            console.log('背景缩放比例', winSize, designResolution, scaleX, scaleY)
            const scale = scaleX > scaleY ? scaleX : scaleY;
            this.node.setScale(scale, scale, 1);
        } else if (this.scale == CustomDirection.Width) {
            this.node.getComponent(UITransform).width = winSize.width;
        } else if (this.scale == CustomDirection.Height) {
            this.node.getComponent(UITransform).height = winSize.height;
        }

    }
}