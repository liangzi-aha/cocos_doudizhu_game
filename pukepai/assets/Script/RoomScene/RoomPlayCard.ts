import { _decorator, Button, Color, Component, instantiate, Label, Node, Prefab, Sprite, sys, tween, UITransform, Vec3, Widget, director, AudioClip } from 'cc';
import { WebsocketMgr } from '../Api/WebsocketMgr';
import { eventTarget } from '../../Utils/EventListening';
import { findChildByNameRecursive, playCardAudio } from '../../Utils/Tools';
import { RoomScene } from './RoomScene';
import { CardItem } from './CardItem';
import { Card } from './Card';
import { CardSelection } from './CardSelection';
import { CommonUIManager } from '../CommonUIManager';
import CardHint from '../../Utils/cardHint';
import { GameOver } from './GameOver';
import { AudioMgr } from '../AudioMgr';
import { playAudios, audioPageageName } from '../../Utils/constant';
const { ccclass, property } = _decorator;

@ccclass('RoomPlayCard')
export class RoomPlayCard extends Component {

    @property({
        type: RoomScene,
        displayName: "房间场景脚本"
    })
    roomScene: RoomScene = null;
    @property({
        type: Node,
        displayName: "我的信息节点（包含用户信息、卡片）"
    })
    myInfoNode: Node = null;
    @property({
        type: Node,
        displayName: "我的卡片存放节点"
    })
    myCardParentNode: Node = null;
    @property({
        type: Prefab,
        displayName: "卡牌预制体"
    })
    cardItem: Prefab = null;
    @property({
        type: Prefab,
        displayName: "不要精灵预制体"
    })
    noPlayCards: Prefab = null;
    @property({
        type: Node,
        displayName: "玩家1卡片存放节点"
    })
    user1CardParent: Node = null;
    @property({
        type: Node,
        displayName: "玩家2卡片存放节点"
    })
    user2CardParent: Node = null;
    @property({
        type: Node,
        displayName: "游戏结束弹框"
    })
    gameOverPopUp: Node = null;

    // 本地存储用户信息
    userInfo: any = {};
    // 玩家出牌期间第一次获取到出牌倒计时信息
    firstGetPlayCardTimeDown: boolean = true;
    // 提示卡牌第几个
    hintCardNum: number = 0;

    start() {
        try {
            // 解析本地用户信息
            this.userInfo = JSON.parse(sys.localStorage.getItem("userInfo"));
        } catch (error) {
            console.log("获取用户信息失败");
        }

        console.log(this.roomScene);
        // 监听出牌倒计时器
        eventTarget.on("playCardTimer", this.onPlayCardTimer, this);
        // 取消托管监听
        eventTarget.on("cancelTrusteeship", this.onCancelTrusteeship, this);
        // 监听机器人出牌
        eventTarget.on("robotPlay", this.onRobotPlay, this);
        // 监听用户出牌回调
        eventTarget.on("userPlayCard", this.onUserPlayCard, this);
        // 被挤掉线
        eventTarget.on("replaceLogin", this.onReplaceLogin, this);

        // 测试提示方法
        // console.log("提示出牌", CardHint.cardHint([], [17, 17, 17, 4, 5, 6, 7, 8, 54]))
    }

    protected onDestroy(): void {
        eventTarget.off("playCardTimer", this.onPlayCardTimer, this);
        eventTarget.off("cancelTrusteeship", this.onCancelTrusteeship, this);
        eventTarget.off("robotPlay", this.onRobotPlay, this);
        eventTarget.off("replaceLogin", this.onReplaceLogin, this);
    }

    update(deltaTime: number) {

    }

    // 监听被挤掉线
    onReplaceLogin({ data, code, message }) {
        if (code == 200) {
            this.node.getChildByName("ReplaceLogin").active = true;
            WebsocketMgr.close(1000, "被挤掉线");
            CommonUIManager.inst.showToast(message);
            // 被挤掉线了，重置第一次获取出牌倒计时状态
            this.firstGetPlayCardTimeDown = true;
        }
    }

    // 监听出牌倒计时
    onPlayCardTimer({ data, code }) {
        if (code == 200) {
            // 获取节点上的用户分别都是谁
            const userNodeId = this.roomScene.getUserNodeInfo();

            // 轮到我出牌了，删除上次出牌记录
            if (data.userId == this.userInfo.user_id) {
                this.myInfoNode.getChildByName("PlayCardBox").removeAllChildren();
            }

            userNodeId.forEach(async ({ nodeId, node }) => {
                // 出牌倒计时没有结束 && 查询哪个节点用户在出牌中
                if (data.downTime != 0 && nodeId == data.userId) {
                    // 查询最近一条的出牌记录
                    const lastRecord = this.roomScene.getLastRecord();

                    // 判断当前出牌用户是否是自己
                    if (data.userId == this.userInfo.user_id) {
                        console.log("展示出牌按钮", data.isYaPai, this.firstGetPlayCardTimeDown)

                        // 第一次获取出牌倒计时
                        if (this.firstGetPlayCardTimeDown) {
                            // 提示出牌次数重置
                            this.hintCardNum = 0;
                            const PlayHandBtn = findChildByNameRecursive(node, "PlayHandBtn");
                            // 是否压牌（压排的话展示不出按钮，不是的话不展示不出按钮和提示按钮）
                            if (data.isYaPai) {
                                findChildByNameRecursive(node, "btn_buchu").active = true;
                                findChildByNameRecursive(node, "btn_tisji").active = true;
                                // this.scheduleOnce(() => {
                                PlayHandBtn.getComponent(Widget).horizontalCenter = 0;
                                // }, 0)
                                console.log("压牌")
                            } else {
                                findChildByNameRecursive(node, "btn_buchu").active = false;
                                findChildByNameRecursive(node, "btn_tisji").active = false;
                                // this.scheduleOnce(() => {
                                PlayHandBtn.getComponent(Widget).horizontalCenter = -115;
                                // }, 0)
                                console.log("不压牌")
                            }

                            // 展示按钮
                            PlayHandBtn.active = true;

                            // 第一次获取到出牌倒计时，判断是否默认禁用出牌按钮，没有选择卡牌&&选择卡牌小于上一个玩家出的牌，禁用按钮
                            this.myCardParentNode.getComponent(CardSelection).updatePlayCardBtnStyle();

                            // 默认获取一次提示，如果管不上就展示要不起遮罩
                            const hintCardList = CardHint.cardHint(lastRecord.playCard, this.myCardParentNode.getComponent(Card).cardList || []);
                            if (hintCardList.length <= 0 && data.isYaPai) {
                                findChildByNameRecursive(this.myInfoNode, "Regardless").active = true;
                            }

                            this.firstGetPlayCardTimeDown = false;
                        }
                    }

                    // 轮到该用户出牌时，删除上一次的出牌记录
                    node.getChildByName("PlayCardBox").removeAllChildren();
                    // 展示出牌倒计时
                    findChildByNameRecursive(node, "TimeDown").active = true;
                    const timeDown = findChildByNameRecursive(node, "TimeDown");
                    timeDown.getChildByName('Str').getComponent(Label).string = data.downTime;
                } else {
                    // 隐藏出牌按钮
                    const SnatchLandlord = findChildByNameRecursive(node, "PlayHandBtn");
                    SnatchLandlord ? SnatchLandlord.active = false : null;
                    // 隐藏倒计时
                    findChildByNameRecursive(node, "TimeDown").active = false;
                }
            })
        }
    }

    /**
     * 出牌动作执行
     * @param playCard 出牌数组
     * @param userId 出牌用户id
     */
    playCardRender(playCard: Array<number>, userId) {
        const userNodeId = this.roomScene.getUserNodeInfo();
        // 没有出牌（不出|管不上）
        if (playCard?.length <= 0) {
            userNodeId.forEach(({ nodeId, node }) => {
                if (nodeId == userId) {
                    // 删除出牌内容
                    node.getChildByName("PlayCardBox").removeAllChildren();
                    // 展示不要图片
                    node.getChildByName("PlayCardBox").addChild(instantiate(this.noPlayCards));
                }
            })
        } else if (userId == this.userInfo.user_id) { // 当前出牌的玩家是自己的话有动画
            // 我的卡牌节点组件Card
            const myCardCom = this.myCardParentNode.getComponent(Card);
            const myCardSelectionCom = this.myCardParentNode.getComponent(CardSelection);
            // 需要出的卡牌节点
            const playCardNode = [];
            // 获取要出的卡牌节点
            this.myCardParentNode.children.forEach((card, index) => {
                const cardItem = card.getComponent(CardItem)
                // 获取卡牌
                if (playCard.indexOf(cardItem.cardNum + cardItem.cardType * 13) != -1) {
                    playCardNode.push(card)
                }
            })
            // 我出的卡牌存放节点
            const playCardBox = this.myInfoNode.getChildByName("PlayCardBox");
            // 获取位子
            const playCardBoxPos = playCardBox.getWorldPosition();
            // 计算出的牌总宽度，宽高 70*96，默认宽高, 每张向右偏移25
            const totalWidth = (playCardNode.length - 1) * 25 + 70;
            // 相对世界位子，开始位子
            const worldStartLeft = playCardBoxPos.x - ((totalWidth - 70) / 2);
            // 相对父级开始位子
            const startLeftst = -((totalWidth - 70) / 2);
            // 自动出牌删除上一次出牌记录
            playCardBox.removeAllChildren();


            // 执行出牌动画
            playCardNode.forEach((card: Node, index) => {
                const cardWorldPos = card.getWorldPosition();
                const cardPos = card.getPosition();
                const world_x = worldStartLeft + 25 * index;
                const x = startLeftst + 25 * index;
                // 世界位置的差值，进行相对位置的移动
                const x_difference_value = world_x - cardWorldPos.x;
                const y_difference_value = playCardBoxPos.y - cardWorldPos.y;
                const startWidth = card.getComponent(UITransform).width;
                const startHeight = card.getComponent(UITransform).height;

                // 复制一份用户出的卡牌，到playCardBox节点下，然后动画结束，删除掉用户卡牌中已出卡牌
                const cardItem = instantiate(this.cardItem);
                cardItem.getComponent(CardItem).cardType = card.getComponent(CardItem).cardType;
                cardItem.getComponent(CardItem).cardNum = card.getComponent(CardItem).cardNum;
                cardItem.getComponent(CardItem).mingpai = true;
                cardItem.getComponent(UITransform).setContentSize(70, 96);
                cardItem.active = false;
                playCardBox.addChild(cardItem);

                // 创建一个tween动画
                tween(card)
                    .to(0.2, {
                        position: new Vec3(cardPos.x + x_difference_value, cardPos.y + y_difference_value, playCardBoxPos.z),
                    }, {
                        onUpdate: (target, ratio) => {
                            // 动画执行中，执行回调
                            target.getComponent(UITransform).width = startWidth + (70 - startWidth) * ratio;
                            target.getComponent(UITransform).height = startHeight + (96 - startHeight) * ratio;
                        }
                    }).call(() => {
                        // 动画完成后的回调
                        playCardBox.children.forEach((item, index) => {
                            item.getComponent(Widget).left = startLeftst + 25 * index;
                            item.active = true;
                        })
                        // 删除原卡牌
                        card.destroy();

                        // 最后一个动画执行完毕
                        if (index == playCardNode.length - 1) {
                            this.scheduleOnce(() => {
                                // 删除已出卡牌
                                myCardCom.cardList = myCardCom.cardList.filter((cardNum, index) => { return playCard.indexOf(cardNum) == -1 });
                                // 卡牌排序
                                myCardCom.cardSort(() => {
                                    // 更新选中卡牌方法（出了一张牌，所以需要更新以下）
                                    myCardSelectionCom.initSelectCard();
                                });
                            }, 0)
                        }
                    })
                    .start();
            })
        } else { // 其他玩家出牌的话没有动画
            userNodeId.forEach(({ nodeId, node, cardParentNode, cardNodeName }) => {
                if (nodeId == userId) {
                    // 删除掉上一次的出牌记录
                    findChildByNameRecursive(node, "PlayCardBox").removeAllChildren();
                    // 判断是否明牌
                    if (this.roomScene.roomInfo.roomUsers[nodeId].mingpai) { // 明牌删除对应卡牌，并出牌
                        cardParentNode.children.forEach((card, index) => {
                            const cardItem = card.getComponent(CardItem)
                            if (playCard.indexOf(cardItem.cardNum + cardItem.cardType * 13) != -1) {
                                card.destroy();
                            }
                        })

                        this.scheduleOnce(() => {
                            // 重新排序
                            cardParentNode.getComponent(Card).cardSort();
                        }, 0)
                    } else {
                        const cardCom = cardParentNode.getComponent(Card)
                        // 从结尾开始删除
                        if (cardNodeName == "leftUser") {
                            cardCom.cardList = cardCom.cardList.slice(0, cardCom.cardList.length - playCard.length);
                        } else {
                            // 从头开始删除
                            cardCom.cardList = cardCom.cardList.slice(0 + playCard.length, cardCom.cardList.length);
                        }
                        cardCom.init();
                    }

                    // 出牌
                    playCard.forEach((cardNum, index, temp) => {
                        const cardItem = instantiate(this.cardItem);
                        // 反向下标
                        const reverseIndex = (temp.length - 1 - index);

                        // 左边和右边渲染不一样
                        if (cardNodeName == "leftUser") {
                            cardItem.getComponent(Widget).left = index * 25;
                            cardItem.getComponent(CardItem).cardType = Math.ceil(Number(cardNum) / 13) - 1;
                            cardItem.getComponent(CardItem).cardNum = Number(cardNum) % 13 == 0 ? 13 : Number(cardNum) % 13;
                        } else {
                            cardItem.getComponent(Widget).left = -(reverseIndex * 25);
                            cardItem.getComponent(CardItem).cardType = Math.ceil(Number(cardNum) / 13) - 1;
                            cardItem.getComponent(CardItem).cardNum = Number(cardNum) % 13 == 0 ? 13 : Number(cardNum) % 13;
                        }
                        cardItem.getComponent(CardItem).mingpai = true;
                        cardItem.getComponent(UITransform).setContentSize(70, 96);
                        findChildByNameRecursive(node, "PlayCardBox").addChild(cardItem);
                    })
                }
            })
        }
    }

    // 监听取消托管
    onCancelTrusteeship({ data, code }) {
        if (code == 200) {
            // 获取节点上的用户分别都是谁
            const userNodeId = this.roomScene.getUserNodeInfo();
            userNodeId.forEach(({ nodeId, node }) => {
                if (nodeId == data.userId) {
                    // 隐藏托管按钮
                    findChildByNameRecursive(node, "Trusteeship").active = false;
                }
            })
        }
    }

    // 取消托管
    async cancelTrusteeship() {
        const socket = await WebsocketMgr.instance({ url: `/roomInfo?roomId=${sys.localStorage.getItem("joinRoomId")}&userId=${this.userInfo.user_id}` });
        socket.send({
            type: "cancelTrusteeship",
            params: {
                roomId: sys.localStorage.getItem("joinRoomId"),
            }
        });
    }

    /**
     * 用户出牌
     * @param event 
     * @param type 1 不出 2 出牌
     */
    async userPlayCard(event, type) {
        const selectCard = this.myCardParentNode.getComponent(CardSelection).getSelectCards() || [];
        console.log("selectCard", selectCard);

        // 用户点击按钮，隐藏要不起遮罩
        findChildByNameRecursive(this.myInfoNode, "Regardless").active = false;

        // 选择卡牌为空
        if (type == 2 && selectCard.length == 0) {
            return CommonUIManager.inst.showToast("请选择出牌");
        } else if (type == 1) {
            // 选中卡牌取消
            this.myCardParentNode.getComponent(CardSelection).noPlayCard();
        }

        const socket = await WebsocketMgr.instance({ url: `/roomInfo?roomId=${sys.localStorage.getItem("joinRoomId")}&userId=${this.userInfo.user_id}` });
        socket.send({
            type: "userPlayCard",
            params: {
                roomId: sys.localStorage.getItem("joinRoomId"),
                playCards: type == 1 ? [] : selectCard.map(item => item.cardIndex)
            }
        });
    }

    // 卡牌提示
    cardHint() {
        // 查询最近一条的出牌记录
        const lastRecord = this.roomScene.getLastRecord();
        // 最后一次出牌的记录如果是我的话，就不是压别人的牌，而是出牌
        const isYaPai = (!lastRecord?.userId || lastRecord?.userId == this.userInfo.user_id) ? false : true;
        // 压牌提示出牌，不是压牌不提示（内容太多，没想好怎么处理）
        if (isYaPai) {
            // 获取提示卡牌
            const hintCardList = CardHint.cardHint(lastRecord.playCard, this.myCardParentNode.getComponent(Card).cardList || []);
            console.log("提示卡牌为", hintCardList)
            console.log("获取当前玩家卡牌信息", this.myCardParentNode.getComponent(Card).cardList);
            // 判断是否有提示卡牌（是否能管的上）
            if (hintCardList.length > 0) {
                // 判断提示的卡牌，是否已经提示一圈了，如果已经提示过，则从0开始提示
                if (this.hintCardNum > hintCardList.length - 1) {
                    this.hintCardNum = 0;
                }
                // 提示卡牌
                this.myCardParentNode.getComponent(CardSelection).hintSelectCard(hintCardList[hintCardList.length - 1 - this.hintCardNum]);
                // 提示次数加1
                this.hintCardNum++;
            }
        } else {
            return []
        }
    }

    // 监听机器人出牌
    onRobotPlay({ data, code }) {
        if (code == 200) {
            // 更新房间出牌记录
            this.roomScene.updataRoomInfoPlayCardRecord(data.play_card_record);

            // 展示托管按钮
            const userNodeId = this.roomScene.getUserNodeInfo();
            // 机器人托管，隐藏要不起遮罩
            findChildByNameRecursive(this.myInfoNode, "Regardless").active = false;
            userNodeId.forEach(({ nodeId, node }) => {
                // 出牌用户
                if (nodeId == data.userId) {
                    findChildByNameRecursive(node, "Trusteeship").active = true;
                }
            })

            // 渲染卡牌
            this.playCardRender(data.playCard, data.userId);

            // 判断是否所有玩家都已经被托管了，都被托管的话，不播放出牌音乐了
            // if (data.isAllHosted == false) {
            if (data.playCard?.length <= 0) {
                AudioMgr.inst.playOneShot(playAudios[audioPageageName]["buyao"]);
            } else {
                // 出牌音频名称;
                const playCardAudioName = playCardAudio(data.playCard);
                // 播放音频
                AudioMgr.inst.playOneShot(playAudios[audioPageageName][playCardAudioName]);
            }
            // }

            // 当前登录玩家机器人出牌后，重置第一次获取出牌倒计时状态，下次轮到自己出牌时，更新出牌按钮状态
            if (this.userInfo.user_id == data.userId) {
                this.firstGetPlayCardTimeDown = true;
            }

            // 判断游戏是否结束
            if (data.gameOver) {
                this.gameOver(data)
            }
        }
    }

    // 监听用户出牌, 隐藏出牌按钮
    onUserPlayCard({ data, code }) {
        if (code == 200) {
            // 获取节点上的用户分别都是谁
            const userNodeId = this.roomScene.getUserNodeInfo();
            // 游戏结束清空出牌记录，更新房间出牌记录
            this.roomScene.updataRoomInfoPlayCardRecord(data.gameOver ? [] : data.play_card_record);

            // 用户不出牌，展示不要图片
            if (data.playCard?.length <= 0) {
                userNodeId.forEach(({ nodeId, node }) => {
                    if (nodeId == data.userId) {
                        // 展示不要图片
                        node.getChildByName("PlayCardBox").addChild(instantiate(this.noPlayCards));
                    }
                });
                AudioMgr.inst.playOneShot(playAudios[audioPageageName]["buyao"]);
            } else {
                // 渲染用户出的卡牌
                this.playCardRender(data.playCard, data.userId);
                // 出牌音频名称;
                const playCardAudioName = playCardAudio(data.playCard);
                // 播放音频
                AudioMgr.inst.playOneShot(playAudios[audioPageageName][playCardAudioName]);
            }

            // 当前玩家出牌后
            if (this.userInfo.user_id == data.userId) {
                // 隐藏出牌按钮
                findChildByNameRecursive(this.myInfoNode, "PlayHandBtn").active = false;
                // 隐藏倒计时
                findChildByNameRecursive(this.myInfoNode, "TimeDown").active = false;
                // 重置首次获取出牌倒计时，下次轮到自己出牌时，更新出牌按钮状态
                this.firstGetPlayCardTimeDown = true;
            }

            // 判断游戏是否结束
            if (data.gameOver) {
                this.gameOver(data)
            }
        }
    }


    // 游戏结束
    gameOver({ gameOverData, roomUsers, victoryStatus }) {
        // 隐藏所有玩家倒计时，隐藏出牌按钮，隐藏机器人托管样式
        const userNodeId = this.roomScene.getUserNodeInfo()

        // 筛选需要明牌的用户卡牌节点（过滤当前玩家和已出完牌玩家和明牌玩家）
        const mingPaiAnimationUser = userNodeId.filter(item => item.nodeId != this.userInfo.user_id && roomUsers[item.nodeId].user_card.length > 0 && roomUsers[item.nodeId].mingpai == false) || [];

        // 设置游戏结束，需要隐藏的UI
        userNodeId.forEach(({ nodeId, node, cardParentNode }, i) => {
            // 更新玩家元宝信息
            findChildByNameRecursive(node, "Gold").getComponent(Label).string = roomUsers[nodeId].gold > 10000 ? `${(roomUsers[nodeId].gold / 10000).toFixed(2)}万` : roomUsers[nodeId].gold;

            // 当前玩家节点
            if (nodeId == this.userInfo.user_id) {
                // 隐藏掉当前玩家的出牌按、要不起样式
                findChildByNameRecursive(this.myInfoNode, "PlayHandBtn").active = false;
                findChildByNameRecursive(this.myInfoNode, "Regardless").active = false;
            }
            // 所有玩家需要隐藏节点
            findChildByNameRecursive(node, "TimeDown").active = false;
            findChildByNameRecursive(node, "Trusteeship").active = false;
        })

        if (mingPaiAnimationUser.length > 0) {
            // 默认为第一个用户的卡牌length
            let lastIndex = roomUsers[mingPaiAnimationUser[0].nodeId].user_card.length;
            // 如果有两个玩家需要执行明牌动画，需要对比一下谁的牌多，等他执行完毕，展示结束弹框
            if (mingPaiAnimationUser[0] && mingPaiAnimationUser[1] && roomUsers[mingPaiAnimationUser[0].nodeId].user_card.length < roomUsers[mingPaiAnimationUser[1].nodeId].user_card.length) {
                lastIndex = roomUsers[mingPaiAnimationUser[1].nodeId].user_card.length;
            }

            mingPaiAnimationUser.forEach(({ nodeId, node, cardParentNode, cardNodeName }, index) => {
                // 卡牌明牌
                cardParentNode.getComponent(Card).cardList = roomUsers[nodeId].user_card;
                // 执行明牌动画
                roomUsers[nodeId].user_card.forEach((cardNum, index) => {
                    const card = cardParentNode.children[index];
                    if (!card.getComponent) {
                        console.log("执行结束翻牌动画错误", card);
                        return
                    }
                    this.scheduleOnce(() => {
                        card.getComponent(CardItem).cardNum = Number(cardNum) % 13 == 0 ? 13 : Number(cardNum) % 13;
                        card.getComponent(CardItem).cardType = Math.ceil(Number(cardNum) / 13) - 1;
                        card.getComponent(CardItem).mingpai = true;
                        card.getComponent(CardItem).init();

                        if (index == lastIndex - 1) {
                            this.scheduleOnce(() => {
                                // 展示游戏结束弹框
                                this.gameOverPopUp.getComponent(GameOver).showGameOver(gameOverData, victoryStatus);
                            }, 0.3)
                        }
                    }, 0.05 * index)
                });

            })
        } else { // 没有需要明牌的玩家，直接展示结束弹框
            // 展示游戏结束弹框
            this.gameOverPopUp.getComponent(GameOver).showGameOver(gameOverData, victoryStatus);
        }

        console.log("mingPaiAnimationUser", mingPaiAnimationUser, mingPaiAnimationUser.length);
    }
}


