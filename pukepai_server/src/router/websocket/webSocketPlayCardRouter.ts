
import { authSocketToken } from '../../utils/decors';
import { RoomObj, GameStatus, PlayerReadyStatus } from '../../utils/room';
import { socketUpdateRoomRate, wsSend } from './webSocket'
import CardLogic, { getPoint } from '../../cardLogic/cardLogic';
import cardHint from '../../cardLogic/cardHint';
import pool from '../../mysql'
import { clientReturnRoomUsers } from '../../utils/tools';

// 游戏结束状态
enum VictoryStatus {
  NONE, // 游戏进行中
  VICTORY, // 胜利
  FAIL, // 失败
}

// console.log("判断类型", CardLogic.judgeCardType([27, 40, 26, 52, 12, 38, 11, 24]));
// console.log("提示卡牌", cardHint.cardHint([9, 9, 9, 10, 10], [14, 27, 40, 7, 8, 21]))

// 斗地主打牌逻辑
export class webSocketPlayCardRouter {
  // 开始出牌，初始化计时器
  static async startPlayCardInit(roomId: string) {
    const roomInfo = RoomObj[roomId];
    // 生成出牌计时器，地主先出牌
    this.playeCardTimerInit(roomId, roomInfo.landlord_id);
  }

  // 打牌计时器初始化
  private static async playeCardTimerInit(roomId, userId) {
    const roomInfo = RoomObj[roomId];
    // 设置倒计时时间
    roomInfo.play_card_countDown = roomInfo.play_card_time;
    // 设置当前出牌用户
    roomInfo.current_play_card_user = userId;

    // 判断当前用户是否被托管
    if (roomInfo.roomUsers[userId].is_hosted) {
      // 机器人出牌，不进行倒计时了
      this.robotPlay(userId, roomId);
    } else {
      // 默认执行一次，因为计时器会等一秒后执行
      this.playeCardInterval(roomId, userId);
      // 生成出牌计时器
      roomInfo.count_down_timer = setInterval(() => {
        this.playeCardInterval(roomId, userId)
      }, 1000);
    }
  }

  // 获取最近一条出牌记录
  static getLastRecord(roomId) {
    const roomInfo = RoomObj[roomId];
    // 查询最近一条的出牌记录
    return roomInfo.play_card_record.reduceRight((pre, cur) => {
      if (!pre && cur.playCard.length > 0) {
        return cur
      }
      return pre;
    }, null);
  }

  // 出牌计时器逻辑
  private static async playeCardInterval(roomId, userId) {
    const roomInfo = RoomObj[roomId];

    // 查询最近一条的出牌记录
    const lastRecord = this.getLastRecord(roomId);

    // console.log('压牌lastRecord', lastRecord);

    // 通知所有用户，出牌倒计时
    roomInfo.roomUserIdList.forEach(itemUserId => {
      const ItemUserInfo = roomInfo.roomUsers[itemUserId];
      wsSend(ItemUserInfo.ws, {
        type: "playCardTimer", // 抢地主
        code: 200,
        data: {
          userId: userId, // 出牌用户
          downTime: roomInfo.play_card_countDown, // 倒计时
          isYaPai: (!lastRecord?.userId || lastRecord?.userId == userId) ? false : true, // 最后一次出牌的记录如果是我的话，就不是压别人的牌，而是出牌
          userCard: ItemUserInfo.user_card, // 当前用户牌
        },
        message: '成功'
      })
    })

    // 倒计时结束用户没有出牌，托管有机器人出牌
    if (roomInfo.play_card_countDown <= 0) {
      // 托管
      roomInfo.roomUsers[userId].is_hosted = true;
      // 机器人出牌
      this.robotPlay(userId, roomId);
    }

    roomInfo.play_card_countDown -= 1;
  }


  // 机器人出牌 (托管出牌)
  private static async robotPlay(userId, roomId) {
    const roomInfo = RoomObj[roomId];
    const roomUserInfo = roomInfo.roomUsers[userId];
    const roomUserIdList = roomInfo.roomUserIdList;
    // 查询最近一条的出牌记录
    const lastRecord = this.getLastRecord(roomId);

    // 获取机器人需要出的牌，可以出的牌集合,最后一次出牌是我的话，证明没人管上我的牌
    const playCards = cardHint.cardHint(!lastRecord?.userId || lastRecord?.userId == userId ? [] : lastRecord.playCard, roomUserInfo.user_card);
    // 出牌内容
    let playCard = [];
    // 可以管上
    if (playCards.length > 0) {
      // 靠前的组合牌大，优先出牌小能管上的牌
      playCard = playCards[playCards.length - 1];
      // 玩家扑克牌中删除牌
      roomUserInfo.user_card = roomUserInfo.user_card.filter(item => !playCard.includes(item));

      // 判断机器人出的牌是否是炸弹，炸弹倍数*2
      if (CardLogic.IsBoom(getPoint(playCard)) || CardLogic.IsKingBoom(getPoint(playCard))) {
        roomInfo.room_rate *= 2;
        // 通知客户端更新房间倍率
        socketUpdateRoomRate(roomId);
        console.log("机器人出牌炸弹倍率*2", roomInfo.room_rate);
      }
    }

    // 游戏结束数据, gameOver 方法返回两个数组 [胜利玩家数据, 失败玩家数据]
    let gameOverData = [[], []];
    if (roomUserInfo.user_card.length === 0) {
      gameOverData = await webSocketPlayCardRouter.gameOver(roomId, userId);
    }

    // console.log('机器人出牌', playCards);
    // 出牌记录
    const record = {
      userId: userId, // 用户id
      playCard: playCard, // 出牌
      gameOver: roomUserInfo.user_card.length === 0 ? true : false, // 是否结束
      gameOverData: [...gameOverData[0], ...gameOverData[1]], // 游戏结束数据
    }
    // 设置出牌记录
    roomInfo.play_card_record.push(record)


    // 通知所有用户，玩家自动出牌
    roomUserIdList.forEach(itemUserId => {
      const ItemUserInfo = roomInfo.roomUsers[itemUserId];
      wsSend(ItemUserInfo.ws, {
        type: "robotPlay", // 机器人出牌
        code: 200,
        data: {
          ...record,
          // 是否所有用户都被托管
          isAllHosted: roomUserIdList.every(itemUserId => roomInfo.roomUsers[itemUserId].is_hosted),
          // 胜利状态 0 进行中 1 胜利 2 失败
          victoryStatus: roomUserInfo.user_card.length === 0 ? (gameOverData[0].some(item => item.user_id === itemUserId) ? VictoryStatus.VICTORY : VictoryStatus.FAIL) : VictoryStatus.NONE,
          // 返回所有用户的出牌记录
          play_card_record: roomInfo.play_card_record,
          // 游戏结束返回所有用户的卡牌数据
          roomUsers: roomUserInfo.user_card.length === 0 ? clientReturnRoomUsers(roomInfo.roomUsers, "", false) : {},
        },
        message: '成功'
      })
    })

    // 切换下一个用户出牌
    this.switchNextUserPlay(roomId, userId);
  }

  /**
   * 切换下一个用户出牌
   * @param roomId 房间id
   * @param userId 当前出牌用户id
   */
  private static switchNextUserPlay(roomId, userId) {
    const roomInfo = RoomObj[roomId];
    const userInfo = roomInfo.roomUsers[userId];
    // 清除计时器
    clearInterval(roomInfo.count_down_timer);
    // 玩家胜利，不切换下一个用户出牌了
    if (userInfo.user_card.length === 0) {
      return;
    } else {
      // 获取当前玩家，在房间的位子下标，判断下个用户出牌
      const index = roomInfo.roomUserIdList.indexOf(userId);
      const nextUserId = roomInfo.roomUserIdList[index - 1 < 0 ? 2 : index - 1];
      // 下个用户被托管，等ui渲染, 延迟600 毫秒再去切下个用户
      if (roomInfo.roomUsers[nextUserId].is_hosted) {
        setTimeout(() => {
          // 通知下个用户出牌
          this.playeCardTimerInit(roomId, nextUserId);
        }, 600);
      } else {
        // 通知下个用户出牌
        this.playeCardTimerInit(roomId, nextUserId);
      }
    }
  }

  /**
   * 游戏结束,结算元宝
   * @param roomId 房间id
   * @param userId 当前出牌用户id
   */
  private static async gameOver(roomId, userId) {
    const roomInfo = RoomObj[roomId];
    // 游戏结束要结算用户的元宝，获取数据库玩家最新的元宝数据
    const [rows]: any = await pool.inst.query(`select user_id, gold, user_account from user where user_id in ("${roomInfo.roomUserIdList[0]}","${roomInfo.roomUserIdList[1]}","${roomInfo.roomUserIdList[2]}")`);
    rows.forEach(element => { roomInfo.roomUsers[element.user_id].gold = element.gold; });

    // 牌出完的玩家
    const successUser: any = Object.keys(roomInfo.roomUsers).reduce((acc, key) => {
      if (roomInfo.roomUsers[key].user_id == userId) {
        return roomInfo.roomUsers[key];
      }
      return acc;
    }, {});

    // 判断是否有出完牌的玩家
    if (successUser.user_id) {
      roomInfo.end_time = new Date();
      // 判断胜利玩家是否是地主
      const successUserIsLandlord = roomInfo.landlord_id == successUser.user_id;
      // 玩家分类 [0] 位胜利玩家列表 [1] 失败玩家列表
      const [successList, loseList]: Array<Array<any>> = Object.keys(roomInfo.roomUsers).reduce((acc, key) => {
        // 胜利玩家是否是地主
        if (successUserIsLandlord) {
          // 判断出完牌玩家
          if (roomInfo.roomUsers[key].user_id == successUser.user_id) {
            acc[0].push(roomInfo.roomUsers[key]);
          } else {
            acc[1].push(roomInfo.roomUsers[key]);
          }
        } else {
          // 判断牌出完的玩家是否是地主
          if (roomInfo.roomUsers[key].user_id != roomInfo.landlord_id) {
            acc[0].push(roomInfo.roomUsers[key]);
          } else {
            acc[1].push(roomInfo.roomUsers[key]);
          }
        }
        return acc;
      }, [[], []]);
      // console.log("出完牌玩家", successUser)
      // console.log("成功玩家", successList)
      // console.log("失败玩家", loseList)
      // console.log("房间信息", roomInfo)

      // 返回结束得分数据
      const score = roomInfo.room_rate * roomInfo.room_base; // 总分 场景底分 * 倍率（默认1） 倍率：抢地主*2、加倍*2、超级加倍*4、炸弹*2（包括王炸）
      console.log("得分", score, roomInfo.room_rate, roomInfo.level, roomInfo.room_base)
      // goldEnough 失败玩家元宝是否够扣除  DeductPoints：失败玩家扣除的元宝总合（可能玩家元宝不够）
      const [goldEnough, DeductPoints] = loseList.reduce((acc, itemUser) => {
        // 判断玩家是否有足够的元宝
        if (Number(itemUser.gold) >= (score / loseList.length)) {
          return [acc[0], Number(acc[1]) + (score / loseList.length)];
        } else { // 元宝不够
          return [false, Number(acc[1]) + Number(itemUser.gold)];
        }
      }, [true, 0])

      // 胜利玩家元宝计算
      const successUserGold = successList.map(item => {
        const gold = Number(item.gold) + (DeductPoints / successList.length);
        // 更新房间玩家元宝
        roomInfo.roomUsers[item.user_id].gold = String(gold);
        roomInfo.roomUsers[item.user_id].get_ingots = DeductPoints;

        return {
          ...item,
          gold: Number(gold),
          get_ingots: (DeductPoints / successList.length), // 获得元宝，正数为胜利加，负数为失败减
          victory: true, // 胜利
        }
      }) || [];
      // 失败玩家元宝计算
      const loseUserGold = loseList.map(item => {
        const gold = item.gold - (score / loseList.length) < 0 ? 0 : Number(item.gold) - (score / loseList.length);
        const get_ingots = item.gold - (score / loseList.length) < 0 ? -(item.gold) : -(score / loseList.length);
        // 更新房间玩家元宝
        roomInfo.roomUsers[item.user_id].gold = String(gold);
        roomInfo.roomUsers[item.user_id].get_ingots = get_ingots;

        return {
          ...item,
          gold: gold,
          get_ingots: get_ingots, // 获得元宝，正数为胜利加，负数为失败减
          victory: false, // 失败
        }
      }) || [];

      console.log("游戏结束，玩家结算信息", [...successUserGold, ...loseUserGold])

      // 调用接口修改用户元宝
      const promiseList = [...successUserGold, ...loseUserGold].map(item => {
        return new Promise(async (resolve, reject) => {
          console.log("修改用户元宝", `update user set gold = ? where user_id = ? `, [item.gold, item.user_id]);
          let [rows]: any = await pool.inst.query(`update user set gold = ? where user_id = ? `, [item.gold, item.user_id]);

          if (rows.affectedRows > 0) {
            resolve(true)
          } else {
            reject()
          }
        })
      })

      // 批量更新玩家元宝（异步执行）
      Promise.all(promiseList).then(res => {
        console.log(roomId, "游戏结束：用户元宝扣除成功", [...successUserGold, ...loseUserGold])
      }).catch(err => {
        console.log("err:用户元宝扣除失败", err)
      })

      // 保存游戏记录到数据库（异步执行）
      webSocketPlayCardRouter.saveRecordMysql(roomId, successUserGold)

      return [successUserGold, loseUserGold]
    }
  }

  // 保存游戏记录到数据库
  private static async saveRecordMysql(roomId, successUserGold) {
    const roomInfo = RoomObj[roomId];
    const roomUsers = Object.keys(roomInfo.roomUsers).map((item) => {
      return {
        ...roomInfo.roomUsers[item],
        user_id: item
      }
    })

    console.log("保存游戏数据参数", [roomInfo.start_time, roomInfo.end_time, roomUsers[0].user_id, roomUsers[1].user_id, roomUsers[2].user_id, roomInfo.room_owner_id, roomInfo.landlord_id, roomUsers[0].get_ingots, roomUsers[1].get_ingots, roomUsers[2].get_ingots, roomUsers[0].redouble_status, roomUsers[1].redouble_status, roomUsers[2].redouble_status, roomUsers[0].mingpai, roomUsers[1].mingpai, roomUsers[2].mingpai, roomInfo.room_rate, roomInfo.level, roomId, JSON.stringify(successUserGold.map(item => item.user_id)), JSON.stringify(roomInfo.play_card_record)]);

    const [data] = await pool.inst.query(`insert into game_record (start_time, end_time, user_1_id, user_2_id, user_3_id, room_owner_id, landlord_id, user_1_get_ingots, user_2_get_ingots, user_3_get_ingots, user_1_redouble, user_2_redouble, user_3_redouble, user_1_mingpai, user_2_mingpai, user_3_mingpai, room_rate, level, room_id, victory_user_id, play_card_record) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [roomInfo.start_time, roomInfo.end_time, roomUsers[0].user_id, roomUsers[1].user_id, roomUsers[2].user_id, roomInfo.room_owner_id, roomInfo.landlord_id, roomUsers[0].get_ingots, roomUsers[1].get_ingots, roomUsers[2].get_ingots, roomUsers[0].redouble_status, roomUsers[1].redouble_status, roomUsers[2].redouble_status, roomUsers[0].mingpai, roomUsers[1].mingpai, roomUsers[2].mingpai, roomInfo.room_rate, roomInfo.level, roomId, JSON.stringify(successUserGold.map(item => item.user_id)), JSON.stringify(roomInfo.play_card_record)]);

    // @ts-ignore
    if (data?.insertId) {
      // TODO 没有保存出牌记录和获胜玩家等数据，待处理
      console.log("保存游戏数据成功");
      // 清空房间信息，等待玩家重新准备
      webSocketPlayCardRouter.clearRoomInfo(roomId)
    }
  }

  // 清空房间信息
  private static async clearRoomInfo(roomId) {
    const roomInfo = RoomObj[roomId];

    roomInfo.gameStatus = GameStatus.NOSTART;  // 游戏状态修改为未开始
    roomInfo.bottom_card = []; // 底牌默认空
    roomInfo.landlord_id = ""; // 地主id
    roomInfo.room_rate = 1; // 初始倍率为1
    roomInfo.snatch_landlord_record = []; // 抢地主总记录
    roomInfo.current_snatch_landlord_user = ""; // 当前抢地主玩家
    roomInfo.play_card_record = []; // 玩家出牌记录
    roomInfo.current_play_card_user = ""; // 当前出牌用户id

    // 游戏结束，清空玩家游戏数据，可以重新开始游戏
    Object.keys(roomInfo.roomUsers).forEach(item => {
      roomInfo.roomUsers[item].user_card = [];
      roomInfo.roomUsers[item].ready = PlayerReadyStatus.UNREADY;
      roomInfo.roomUsers[item].redouble_status = null;
      roomInfo.roomUsers[item].mingpai = false;
      roomInfo.roomUsers[item].get_ingots = 0;
      roomInfo.roomUsers[item].snatch_landlord_num = 0;
      roomInfo.roomUsers[item].is_hosted = false;
    })

    // 判断哪些玩家在游戏中退出游戏了，从房间中剔除玩家（退出房间的玩家ws，会被清空）
    const outUserList = [];
    const onlineUserList = [];
    Object.keys(roomInfo.roomUsers).forEach(item => {
      if (roomInfo.roomUsers[item].ws) {
        onlineUserList.push(roomInfo.roomUsers[item])
      } else {
        outUserList.push(roomInfo.roomUsers[item])
      }
    });

    // 所有玩家都退出了，就删除房间
    if (onlineUserList.length == 0) {
      // 删除房间
      delete RoomObj[roomId];
    } else if (outUserList.length > 0) { // 通知在线的玩家，有玩家退出了房间
      // 延迟3秒踢出玩家，展示一些玩家卡牌
      setTimeout(() => {
        outUserList.forEach(userInfo => {
          // 删除该用户
          delete roomInfo.roomUsers[userInfo.user_id];
          // 删除用户数组中的对应项，数组能保证顺序不会改变
          const index = roomInfo.roomUserIdList.indexOf(userInfo.user_id);
          roomInfo.roomUserIdList[index] = "";

          // 退出的是房主，将第一个onlineUserList用户设置为房主
          if (userInfo.user_id == roomInfo.room_owner_id) {
            roomInfo.room_owner_id = onlineUserList[0].user_id;
          }
        })

        // 通知在线用户，有谁退出了
        onlineUserList.forEach(item => {
          outUserList.forEach(outUser => {
            wsSend(item.ws, {
              type: "userOutRoom",
              code: 200,
              data: {
                roomOutUserId: outUser.user_id,
                roomInfo: roomInfo
              },
              message: '成功'
            });
          })
        })
      }, 3000)
    }
  }

  // 接口，用户出牌逻辑（出牌）
  @authSocketToken({
    verifyRoomId: true
  })
  public async userPlayCard({ ws, token, userInfo, params }: any) {
    const roomInfo = RoomObj[params.roomId];
    const roomUserIdList = roomInfo.roomUserIdList;
    const roomUserInfo = roomInfo.roomUsers[userInfo.user_id];

    if (!roomUserInfo) { // 判断玩家是否存在房间
      wsSend(ws, {
        type: "userPlayCard", // 用户出牌
        code: 400,
        data: {},
        message: '玩家不在该房间'
      })
    } else {
      let isHave = true;
      let copyUserCards = [...roomUserInfo.user_card];
      // 判断出牌玩家是否拥有该卡牌（以防客户端和服务端不一致）
      if (params.playCards.length > 0) {
        // 判断客户端发送的牌，该玩家是否有
        isHave = params.playCards.every(item => {
          if (copyUserCards.includes(item)) {
            // 删除掉该张牌
            copyUserCards.splice(copyUserCards.indexOf(item), 1);
            return true;
          }
        })
      }

      if (isHave) {
        // 判断玩家出的牌是否是炸弹，炸弹倍数*2
        if (CardLogic.IsBoom(getPoint(params.playCards)) || CardLogic.IsKingBoom(getPoint(params.playCards))) {
          roomInfo.room_rate *= 2;
          // 通知客户端更新房间倍率
          socketUpdateRoomRate(params.roomId);
          console.log("玩家出牌炸弹倍率*2", roomInfo.room_rate);
        }

        // 删除出的卡牌重新赋值
        roomUserInfo.user_card = copyUserCards;

        // 游戏结束数据, gameOver 方法返回两个数组 [胜利玩家数据, 失败玩家数据]
        let gameOverData = [[], []];
        if (roomUserInfo.user_card.length === 0) {
          gameOverData = await webSocketPlayCardRouter.gameOver(params.roomId, userInfo.user_id);
        }
        const record = {
          userId: roomUserInfo.user_id, // 出牌用户
          playCard: params.playCards, // 出牌，playCards可能为空数组，管不上
          gameOver: roomUserInfo.user_card.length === 0 ? true : false, // 是否结束
          gameOverData: [...gameOverData[0], ...gameOverData[1]], // 游戏结束数据
        }
        // 保存出牌记录
        roomInfo.play_card_record.push(record);
        // 通知所有用户，玩家出牌
        roomUserIdList.forEach(itemUserId => {
          const ItemUserInfo = roomInfo.roomUsers[itemUserId];
          wsSend(ItemUserInfo.ws, {
            type: "userPlayCard", // 用户出牌
            code: 200,
            data: {
              // 当前用户的出牌信息
              ...record,
              // 胜利状态 0 进行中 1 胜利 2 失败
              victoryStatus: roomUserInfo.user_card.length === 0 ? (gameOverData[0].some(item => item.user_id === itemUserId) ? VictoryStatus.VICTORY : VictoryStatus.FAIL) : VictoryStatus.NONE,
              // 返回所有用户的出牌记录
              play_card_record: roomInfo.play_card_record,
              // 玩家出完牌，游戏结束返回所有用户的卡牌数据
              roomUsers: roomUserInfo.user_card.length === 0 ? clientReturnRoomUsers(roomInfo.roomUsers, "", false) : {},
            },
            message: '成功'
          })
        })

        // 切换下一个用户出牌
        webSocketPlayCardRouter.switchNextUserPlay(params.roomId, userInfo.user_id);
      } else {
        wsSend(ws, {
          type: "userPlayCard", // 用户出牌
          code: 400,
          data: {},
          message: '出牌错误'
        })
      }
    }
  }

  // 取消托管
  @authSocketToken({
    verifyRoomId: true
  })
  public async cancelTrusteeship({ ws, token, userInfo, params }: any) {
    const roomInfo = RoomObj[params.roomId];

    if (roomInfo.roomUsers[userInfo.user_id]) {
      roomInfo.roomUsers[userInfo.user_id].is_hosted = false;

      // 取消托管通知所有用户，托管的话会展示托管icon
      roomInfo.roomUserIdList.forEach(itemUserId => {
        const ItemUserInfo = roomInfo.roomUsers[itemUserId];
        wsSend(ItemUserInfo.ws, {
          type: "cancelTrusteeship", // 取消托管
          code: 200,
          data: {
            userId: userInfo.user_id,
          },
          message: '成功'
        })
      })
    } else {
      wsSend(ws, {
        type: "cancelTrusteeship", // 取消托管
        code: 400,
        message: '用户不在房间内'
      })
    }
  }
}