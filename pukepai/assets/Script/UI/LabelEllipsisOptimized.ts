import { _decorator, CCBoolean, Component, Label, Node, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LabelEllipsisOptimized')
export class LabelEllipsisOptimized extends Component {
    @property(Label)
    private myLabel: Label | null = null;

    @property(Node)
    private container: Node | null = null;

    @property({
        type: CCBoolean,
    })
    private isCenter: boolean = true;


    start() {
        if (this.myLabel && this.container) {
            this.updateEllipsis();
        }
    }

    // 修改标签文本
    setLabelText(newText: string) {
        if (this.myLabel && this.container) {
            this.myLabel.string = newText;
            this.scheduleOnce(() => {
                this.updateEllipsis();
            })
        }
    }

    updateEllipsis() {
        if (!this.myLabel || !this.container) {
            return;
        }
        const label = this.myLabel;
        const containerTransform = this.container.getComponent(UITransform);
        const labelTransform = label.node.getComponent(UITransform);
        const containerWidth = containerTransform.width;
        const originalText = label.string;

        // 先直接设置为原始文本获取宽度
        label.string = originalText;

        if (labelTransform.width <= containerWidth) {
            if (this.isCenter) {
                label.node.setPosition(containerWidth / 2 - labelTransform.width / 2, 0);
            }
            return;
        }

        // 逐步减少字符直到宽度合适
        let tempText = originalText;
        while (labelTransform.width > containerWidth && tempText.length > 0) {
            tempText = tempText.slice(0, -1);
            label.string = tempText + '...';
            // 重新计算并更新渲染数据
            label.updateRenderData(true);
        }

        // 如果裁剪后文本为空，至少保留一个字符和省略号
        if (tempText.length === 0) {
            label.string = originalText[0] + '...';
        }
    }

    onEnable() {
        this.updateEllipsis();
    }

    onResize() {
        this.updateEllipsis();
    }

    // 提供一个公共方法，方便外部调用更新
    public updateLabelText(newText: string) {
        if (this.myLabel) {
            this.myLabel.string = newText;
            this.updateEllipsis();
        }
    }
}    