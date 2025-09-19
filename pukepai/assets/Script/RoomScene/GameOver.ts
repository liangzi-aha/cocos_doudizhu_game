import { _decorator, Component, Label, Node, Color, resources, SpriteFrame, Sprite } from 'cc';
import { findChildByNameRecursive, loadRemoteImg } from '../../Utils/Tools';
import { RoundBox } from '../UI/RoundBox';
import { AudioMgr } from '../AudioMgr';
import { gameOverSuccessAudio, gameOverLoseAudio } from '../../Utils/constant';
const { ccclass, property } = _decorator;

@ccclass('GameOver')
export class GameOver extends Component {
    @property({
        type: Node,
        displayName: "再来一局"
    })
    PlayAnotherRound: Node = null;

    // 游戏结束数据
    gameOverData = [];

    start() {

    }

    update(deltaTime: number) {

    }

    // 展示游戏结束
    showGameOver(gameOverData, victoryStatus) {
        this.gameOverData = gameOverData;
        this.node.active = true;
        // 渲染游戏结束列表
        const User1 = this.node.getChildByName("User1");
        const User2 = this.node.getChildByName("User2");
        const User3 = this.node.getChildByName("User3");
        this.scheduleOnce(() => {
            console.log("gameOverData", gameOverData)
            // victoryStatus 胜利状态 0 进行中 1 胜利 2 失败
            this.node.getChildByName("Title").getComponent(Label).string = victoryStatus == 1 ? "胜利" : "失败";
            this.node.getChildByName("Title").getComponent(Label).color = victoryStatus == 1 ? new Color(226, 98, 98) : new Color(58, 58, 58);
            [User1, User2, User3].forEach((item, index) => {
                const itemData = this.gameOverData[index];
                const getIngots = itemData.get_ingots > 10000 ? `${(Number(itemData.get_ingots) / 10000).toFixed(2)}万` : itemData.get_ingots;
                const gold = itemData.gold > 10000 ? `${(Number(itemData.gold) / 10000).toFixed(2)}万` : itemData.gold;
                const userHead = findChildByNameRecursive(item, "Head");

                findChildByNameRecursive(item, "GetGold").getComponent(Label).string = `${itemData.victory ? '+' : '-'}${Math.abs(getIngots) > 10000 ? `${(Math.abs(getIngots) / 10000).toFixed(2)}万` : Math.abs(getIngots)}`;
                findChildByNameRecursive(item, "Num").getComponent(Label).string = gold;
                // 加载本地头像
                if (itemData.user_head_img == "/Image/default_head.png") {
                    resources.load('Image/default_head/spriteFrame', SpriteFrame, (err, spriteFrame) => {
                        if (err) {
                            console.error('加载 SpriteFrame 文件失败:', err);
                            return;
                        }

                        console.log("加载本地头像成功", userHead)

                        // 设置头像
                        userHead.getComponent(RoundBox).spriteFrame = spriteFrame;
                    });
                } else {
                    // 加载远程图片，并赋值
                    loadRemoteImg(itemData.user_head_img, userHead);
                }
                findChildByNameRecursive(item, "Head")
            })

            // 游戏结束音乐
            AudioMgr.inst.playOneShot(victoryStatus == 1 ? gameOverSuccessAudio : gameOverLoseAudio);
        });
    }

    // 隐藏游戏结束
    hideGameOver() {
        this.node.active = false;
        this.PlayAnotherRound.active = true;
    }
}


