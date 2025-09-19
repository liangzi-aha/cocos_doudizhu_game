
import { authSocketToken } from '../../utils/decors';
import { RoomObj, GameStatus } from '../../utils/room';
import { wsSend, socketUpdateRoomRate } from './webSocket'
import { getRandomNumber, clientReturnRoomUsers, sortPokerCards } from '../../utils/tools';
import { webSocketPlayCardRouter } from './webSocketPlayCardRouter';

// 创建卡牌
function createCard(cards?, num = 1, userCards = [[], [], [], []]) {
  if (!cards) {
    // 所有卡片
    cards = new Array(54).fill("").map((item, index) => index + 1);
    // 随机打乱
    for (let i = 0; i < cards.length; i++) {
      const randomIndex = Math.floor(Math.random() * cards.length);
      [cards[i], cards[randomIndex]] = [cards[randomIndex], cards[i]];
    }
  }

  // 随机发牌(保留最后3张)
  const random = getRandomNumber(0, cards.length - 4); // 从0开始length要减一，再减去3张牌等于4
  const randomCard = cards[random];
  // 删除该张牌
  cards = cards.filter(item => item != randomCard);
  // 保存到用户数组中
  userCards[num % 3].push(randomCard);
  if (cards.length > 3) {
    // 递归发牌
    return createCard(cards, num + 1, userCards);
  } else {
    // 发牌结束, cards底牌
    return [sortPokerCards(userCards[0]), sortPokerCards(userCards[1]), sortPokerCards(userCards[2]), cards];
  }
}


// 发牌逻辑 (包括发牌，抢地主，明牌，加倍等功能)
export class webSocketDealCardsRouter {

  /**
  * 重新开始游戏
  * @param roomId 
  */
  static async restartGame(roomId) {
    const roomInfo = RoomObj[roomId];
    // 清空抢地主记录
    roomInfo.snatch_landlord_record = [];
    // 清空房间底牌
    roomInfo.bottom_card = [];
    // 清空用户明牌记录
    roomInfo.roomUserIdList.forEach(itemUserId => {
      // 获取用户信息
      const ItemUserInfo = roomInfo.roomUsers[itemUserId]
      // 清空用户明牌
      ItemUserInfo.mingpai = false;
      // 清空用户卡牌信息
      ItemUserInfo.user_card = [];
    })
  }

  // 发牌、叫地主逻辑
  static async dealCards({ ws, token, userInfo, params }: any) {
    const roomInfo = RoomObj[params.roomId];

    // 每次发牌前，清空房间记录
    this.restartGame(params.roomId)

    // 服务器发牌
    // const userCards = createCard();
    // 测试某种牌型
    const userCards = [
      [
        53, 2, 27, 39, 52, 12, 38,
        10, 23, 8, 21, 7, 33, 5,
        4, 30, 43
      ],
      [
        54, 41, 1, 14, 40, 26, 25,
        51, 50, 36, 22, 46, 19, 45,
        44, 31, 17
      ],
      [
        28, 13, 11, 37, 9, 35, 48,
        34, 47, 20, 6, 32, 18, 42,
        29, 3, 16
      ],
      [15, 49, 24]
    ]
    console.log("发牌如下", userCards);
    const roomUserKeys = Object.keys(roomInfo.roomUsers);
    // 设置游戏状态为抢地主（已经发过牌）
    roomInfo.gameStatus = GameStatus.SNATCHLABDLORD;
    // 设置房间底牌
    roomInfo.bottom_card = userCards[3];
    // 设置游戏开始时间
    roomInfo.start_time = new Date();
    // 设置用户卡牌信息
    roomUserKeys.forEach((value, index) => {
      // 设置用户的牌
      Object.assign(roomInfo.roomUsers[value], {
        user_card: userCards[index]
      });
    })

    // 通知所有用户发牌了
    roomUserKeys.forEach((userId, index) => {
      const userInfoItem = roomInfo.roomUsers[userId];

      // 设置用户信息返回给客户端（当前登录用户看不到其他用户的牌，需要根据是否明牌进行判断）
      const newRoomUsers = clientReturnRoomUsers(roomInfo.roomUsers, userId);

      // 通知用户发的牌
      wsSend(userInfoItem.ws, {
        type: "dealCards",
        code: 200,
        data: newRoomUsers, //  需要返回3个用户的卡牌信息
        message: '成功'
      })
    })

    // 延迟3秒后开始强地主，因为发牌有一个动画，想在动画结束进行发牌，但是有不清楚动画什么时候结束，不能让客户端调用服务端开始抢地主，万一客户端掉线了，游戏就无法进行了。
    setTimeout(() => {
      // 随机一名玩家开始抢地主，然后逆时针旋转抢地主
      const randomUserId = roomUserKeys[getRandomNumber(0, 2)];
      this.grabLandlord(params.roomId, randomUserId)
    }, 3050);
  }

  /**
   * 抢地主
   * @param roomInfo 当前房间信息
   * @param snatchLandlordUserId 抢地主用户
   */
  static async grabLandlord(roomId, snatchLandlordUserId) {
    const roomInfo = RoomObj[roomId];

    // 设置当前抢地主玩家ID
    roomInfo.current_snatch_landlord_user = snatchLandlordUserId;
    // 用户抢地主倒计时时间
    roomInfo.snatch_landlord_countDown = roomInfo.snatch_landlord_time;
    // 默认调用一次
    this.grabLandlordInterval(snatchLandlordUserId, roomId);
    // 计时器结束，监听用户抢地主时间
    roomInfo.count_down_timer = setInterval(() => {
      // 抢地主倒计时处理
      this.grabLandlordInterval(snatchLandlordUserId, roomId)
    }, 1000)
  }

  /**
   * 抢地主倒计时处理
   * @param roomUserKeys 用户Id List
   * @param snatchLandlordUserId 抢地主用户Id
   * @param roomId 房间Id
   * @returns 
   */
  static async grabLandlordInterval(snatchLandlordUserId, roomId) {
    const roomInfo = RoomObj[roomId];
    const roomUserKeys = Object.keys(roomInfo.roomUsers);
    // 通知所有用户玩家开始抢地主了
    roomUserKeys.forEach(itemUserId => {
      // 获取用户信息
      const ItemUserInfo = roomInfo.roomUsers[itemUserId]
      // 通知抢地主倒计时
      wsSend(ItemUserInfo.ws, {
        type: "snatchLandlord", // 抢地主
        code: 200,
        data: {
          userId: snatchLandlordUserId, // 当前抢地主用户
          downTime: roomInfo.snatch_landlord_countDown, // 抢地主倒计时
        },
        message: '成功'
      })
    })

    // 用户抢地主时间结束
    if (roomInfo.snatch_landlord_countDown <= 0) {
      clearInterval(roomInfo.count_down_timer);
      // 每个用户的抢地主记录进去
      roomInfo.snatch_landlord_record.push({
        userId: snatchLandlordUserId,
        isSnatchLandlord: false,
      });

      // 通知客户端，玩家抢地主结果（这里是倒计时结束自动不抢）
      roomInfo.roomUserIdList.forEach(itemUserId => {
        const ItemUserInfo = roomInfo.roomUsers[itemUserId];
        wsSend(ItemUserInfo.ws, {
          type: "selectLandlord",
          code: 200,
          data: {
            userId: snatchLandlordUserId, // 抢地主用户
            selectLandlord: false, // 用户抢地主的选择
          },
          message: '成功'
        });
      })

      // 判断抢地主逻辑
      this.judgeLandlordUser(roomId, snatchLandlordUserId);
      return;
    }

    // 抢地主倒计时
    roomInfo.snatch_landlord_countDown -= 1;
  }

  /**
   * 处理判断地主逻辑
   * @param roomId 房间id
   * @param snatchLandlordUserId 抢地主用户ID
   */
  static async judgeLandlordUser(roomId, snatchLandlordUserId) {
    const roomInfo = RoomObj[roomId];
    const roomUserKeys = Object.keys(roomInfo.roomUsers);
    /**
     * 斗地主-抢地主逻辑
     * 首先随机一个玩家叫地主，其他玩家可以抢一次地主（不叫地主的玩家不能抢地主）
     */

    // 抢地主的记录中筛选出抢地主的用户
    const snatchLandlordUser = roomInfo.snatch_landlord_record.filter(item => item.isSnatchLandlord == true);

    // 获取最后一个抢地主的用户
    const last = roomInfo.snatch_landlord_record.reduceRight((pre, cur) => {
      if (!pre && cur.isSnatchLandlord) {
        return cur
      }
      return pre;
    }, null);

    // 判断是否抢了3次了，3次只有两种结果 1：没人叫地主重新开始 2：有一个人叫地主分配地主
    if (roomInfo.snatch_landlord_record.length == 3) {
      // 没有人抢地主
      if (snatchLandlordUser.length == 0) {
        // 从新发牌
        this.dealCards({ params: { roomId } });
      } else if (snatchLandlordUser.length == 1) { // 只有一人抢地主，直接给他地主
        // 抢地主结束，发放底牌，通知所有用户
        this.snatchLandlordEnd(snatchLandlordUser[0].userId, roomId)
      } else if (snatchLandlordUser.length > 1) { // 超过一个人抢地主
        // 判断第一个玩家是否叫地主，叫地主的话它可以在抢一次地主
        if (roomInfo.snatch_landlord_record[0].isSnatchLandlord == true) {
          // 通知第一个抢地主的玩家继续抢地主
          this.grabLandlord(roomId, roomInfo.snatch_landlord_record[0].userId);
        } else {
          // 抢地主结束，发放底牌，通知所有用户
          this.snatchLandlordEnd(last.userId, roomId);
        }
      }
    } else if (roomInfo.snatch_landlord_record.length == 4) { // 抢了4次了，判断地主分配给谁
      // 抢地主结束，发放底牌，通知所有用户
      this.snatchLandlordEnd(last.userId, roomId)
    } else {
      // 获取当前抢地主玩家，再房间的位子下标
      const index = roomInfo.roomUserIdList.indexOf(snatchLandlordUserId);
      // 通知下个用户抢地主
      this.grabLandlord(roomId, roomInfo.roomUserIdList[index - 1 < 0 ? 2 : index - 1]);
    }
  }

  // 用户抢地主选择
  @authSocketToken({
    verifyRoomId: true
  })
  public async selectLandlord({ ws, token, userInfo, params }: any) {
    const roomInfo = RoomObj[params.roomId];
    // 判断参数传递是否正确
    if (params.selectLandlord != undefined) {
      // 清除计时器
      clearInterval(roomInfo.count_down_timer);

      if (params.selectLandlord == true) {
        // 用户抢地主数量加一
        roomInfo.roomUsers[userInfo.user_id].snatch_landlord_num += 1;

        // 已经有玩家抢地主了，再抢的话倍率*2
        if (roomInfo.snatch_landlord_record.some(item => item.isSnatchLandlord == true)) {
          roomInfo.room_rate *= 2;
          // 通知客户端更新房间倍率
          socketUpdateRoomRate(params.roomId);
          console.log("抢地主倍率*2", roomInfo.room_rate);
        }
      }

      // 每个用户的抢地主记录进去
      roomInfo.snatch_landlord_record.push({
        userId: userInfo.user_id,
        isSnatchLandlord: params.selectLandlord,
      });

      // 通知所有玩家，该玩家抢地主结果
      roomInfo.roomUserIdList.forEach(itemUserId => {
        const ItemUserInfo = roomInfo.roomUsers[itemUserId];
        wsSend(ItemUserInfo.ws, {
          type: "selectLandlord",
          code: 200,
          data: {
            userId: userInfo.user_id, // 抢地主用户
            selectLandlord: params.selectLandlord, // 用户抢地主的选择
          },
          message: '成功'
        });
      })

      // 判断抢地主逻辑
      webSocketDealCardsRouter.judgeLandlordUser(params.roomId, userInfo.user_id);

    } else {
      wsSend(ws, {
        type: "selectLandlord",
        code: 400,
        message: '参数传递错误'
      });
    }
  }

  /**
   * 抢地主结束，发放底牌，通知所有用户
   * @param landlord_id 地主id
   * @param roomId 房间id
   */
  static async snatchLandlordEnd(landlord_id, roomId) {
    const roomInfo = RoomObj[roomId];
    const roomUserKeys = Object.keys(roomInfo.roomUsers);

    // 设置地主ID
    roomInfo.landlord_id = landlord_id;
    // 开始游戏
    roomInfo.gameStatus = GameStatus.START;
    // 给地主发放底牌
    roomInfo.roomUsers[landlord_id].user_card = sortPokerCards([...roomInfo.roomUsers[landlord_id].user_card, ...roomInfo.bottom_card]);
    // 通知所有玩家抢地主结束
    roomUserKeys.forEach(itemUserId => {
      // 获取用户信息
      const ItemUserInfo = roomInfo.roomUsers[itemUserId];

      // 设置用户信息返回给客户端（当前登录用户看不到其他用户的牌，需要根据是否明牌进行判断）
      const newRoomUsers = clientReturnRoomUsers({
        [landlord_id]: roomInfo.roomUsers[landlord_id]
      }, itemUserId);

      // 通知抢地主结束
      wsSend(ItemUserInfo.ws, {
        type: "snatchLandlordEnd", // 抢地主结束
        code: 200,
        data: {
          userId: landlord_id, // 获得地主玩家
          roomUsers: newRoomUsers,  // 需要更新玩家的牌
          bottomCard: roomInfo.bottom_card, // 底牌
          mingpai: roomInfo.roomUsers[landlord_id].mingpai, // 玩家是否明牌
        }
      });
    });

    // 用户选择加倍
    this.selectDoubleInterval(roomId);
  }

  /**
   * 用户选择加倍倒计时
   * @param roomId 
   */
  static async selectDoubleInterval(roomId) {
    const roomInfo = RoomObj[roomId];
    // 初始化默认时间
    roomInfo.double_countDown = roomInfo.double_time;

    roomInfo.count_down_timer = setInterval(() => {
      // 通知所有玩家
      roomInfo.roomUserIdList.forEach(itemUserId => {
        // 获取用户信息
        const ItemUserInfo = roomInfo.roomUsers[itemUserId];

        // 加倍逻辑，通知用户开始选择，加倍\超级加倍
        wsSend(ItemUserInfo.ws, {
          type: "selectDoubleTimer", // 选择加倍倒计时
          code: 200,
          data: {
            downTime: roomInfo.double_countDown,
            userSelectDouble: roomInfo.roomUsers[itemUserId].redouble_status,
            roomRate: roomInfo.room_rate, // 房间房间倍数
            selectDoubleList: Object.keys(roomInfo.roomUsers).map(itemUserId => {
              return {
                userId: itemUserId,
                userSelectDouble: roomInfo.roomUsers[itemUserId].redouble_status,
              }
            }), // 用户选择的加倍状态
          }
        });
      });

      if (roomInfo.double_countDown <= 0) {
        // 加倍倒计时结束，设置没有选择加倍用户状态
        roomInfo.roomUserIdList.forEach(itemUserId => {
          // 获取用户信息
          const ItemUserInfo = roomInfo.roomUsers[itemUserId];
          // 判断玩家是否选择加倍
          if (!ItemUserInfo.redouble_status) {
            // 没有选择倒计时结束，默认为不加倍
            roomInfo.roomUsers[itemUserId].redouble_status = 1;
          }
        })
        // 清除计时器
        clearInterval(roomInfo.count_down_timer);
        // 延迟400毫秒，用来展示加倍ui
        setTimeout(() => {
          // 开始游戏
          webSocketPlayCardRouter.startPlayCardInit(roomId)
        }, 400)
      }

      // 加倍倒计时
      roomInfo.double_countDown -= 1;
    }, 1000);
  }

  // 用户选择加倍
  @authSocketToken({
    verifyRoomId: true
  })
  public async selectDouble({ ws, token, userInfo, params }: any) {
    const roomInfo = RoomObj[params.roomId];
    // 设置加倍 redouble_status: number; // 加倍状态 1不加倍 2加倍 3超级加倍
    roomInfo.roomUsers[userInfo.user_id].redouble_status = params.selectDouble;
    roomInfo.room_rate *= params.selectDouble;
    // 通知客户端更新房间倍率
    socketUpdateRoomRate(params.roomId);

    // 判断是否所有用户都已经选择过
    if (roomInfo.roomUserIdList.every(itemUserId => roomInfo.roomUsers[itemUserId].redouble_status !== null)) {
      // 清除计时器
      clearInterval(roomInfo.count_down_timer);

      // 发送给所有用户，加倍结束
      roomInfo.roomUserIdList.forEach(itemUserId => {
        // 获取用户信息
        const ItemUserInfo = roomInfo.roomUsers[itemUserId]

        // 所有用户都选择过加倍了，通知加倍结束
        wsSend(ItemUserInfo.ws, {
          type: "selectDoubleEnd", // 所有用户都已经选择过了
          code: 200,
          data: {
            roomRate: roomInfo.room_rate, // 房间房间倍数
            redouble_status: roomInfo.roomUsers[userInfo.user_id].redouble_status, // 用户选择的加倍状态
            selectUserId: userInfo.user_id,
          }
        })
      })

      // 延迟400毫秒，用来展示加倍ui
      setTimeout(() => {
        // 开始游戏
        webSocketPlayCardRouter.startPlayCardInit(params.roomId)
      }, 400)
    } else {
      // 发送给所有用户，有用户加倍了
      roomInfo.roomUserIdList.forEach(itemUserId => {
        // 获取用户信息
        const ItemUserInfo = roomInfo.roomUsers[itemUserId]

        // 所有用户都选择过加倍了，通知加倍结束
        wsSend(ItemUserInfo.ws, {
          type: "selectDouble", // 所有用户都已经选择过了
          code: 200,
          data: {
            roomRate: roomInfo.room_rate, // 房间房间倍数
            redouble_status: roomInfo.roomUsers[userInfo.user_id].redouble_status, // 用户选择的加倍状态
            selectUserId: userInfo.user_id,
          }
        })
      })
    }
  }

  // 用户明牌
  @authSocketToken({
    verifyRoomId: true
  })
  public async mingPai({ ws, token, userInfo, params }: any) {
    const roomInfo = RoomObj[params.roomId];
    const roomUserKeys = Object.keys(roomInfo.roomUsers);
    roomInfo.roomUsers[userInfo.user_id].mingpai = true;
    // 房间倍率*2
    roomInfo.room_rate *= 2;
    // 通知客户端更新房间倍率
    socketUpdateRoomRate(params.roomId);

    console.log("明牌倍率*2", roomInfo.room_rate);

    // 通知所以用户我名牌了
    roomUserKeys.forEach(itemUserId => {
      // 设置用户信息返回给客户端（当前登录用户看不到其他用户的牌，需要根据是否明牌进行判断）
      const newRoomUsers = clientReturnRoomUsers({
        [userInfo.user_id]: roomInfo.roomUsers[userInfo.user_id]
      }, itemUserId);

      // 获取用户信息
      const ItemUserInfo = roomInfo.roomUsers[itemUserId]
      wsSend(ItemUserInfo.ws, {
        type: "mingPai",
        code: 200,
        data: {
          userId: userInfo.user_id, // 明牌用户
          roomUser: newRoomUsers, // 明牌，roomUser只包含当前明牌玩家的信息
        },
        message: '成功'
      });
    });
  }
}