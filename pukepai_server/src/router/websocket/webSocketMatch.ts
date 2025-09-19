import { clientReturnRoomUsers } from '../../utils/tools';
import { authSocketToken } from '../../utils/decors';
import { RoomObj, GameStatus, CreateRoom, RoomType, userJoinRoom } from '../../utils/room';
import { wsSend } from './webSocket'
import User from '../user';

// 匹配玩家列表
export let matchUserList = {
  // "level": [{...userInfo, ws: WebSocket}]
  "1": [], // 和数据库对应
  "2": [],
  "3": [],
  "4": []
}

export const setMatchUserList = (level, arr) => {
  matchUserList[level] = arr;
}

// 匹配
export class webSocketMatchRouter {

  // 开启游戏匹配
  @authSocketToken()
  public async match({ ws, token, userInfo, params }: any) {
    // console.log("matchUserList", params, matchUserList[params.level]);
    // 判断用户元宝是否充足
    let { status, message } = await User.GoldIsAdequate({
      userId: userInfo.user_id,
      level: params.level
    })

    if (status) {
      // 查询房间类型为匹配的房间，是否有空缺，有的话直接加入空缺房间
      const matchingRoom = Object.keys(RoomObj).filter(roomId => {
        const roomInfo = RoomObj[roomId];
        console.log("roomInfo.room_type", roomInfo.room_type)
        console.log("roomInfo.gameStatus", roomInfo.gameStatus)
        console.log("roomInfo.roomUserIdList", roomInfo.roomUserIdList)
        if (roomInfo.room_type === RoomType.MATCHING && roomInfo.gameStatus === GameStatus.NOSTART && roomInfo.roomUserIdList.some(id => !id)) {
          return true
        }
      });

      console.log("matchingRoom", matchingRoom)

      // 有已经存在的匹配房间的话，优先加入
      if (matchingRoom.length > 0) {
        const roomId = matchingRoom[0];
        const roomInfo = RoomObj[roomId];
        // 加入房间内
        const { status, message } = userJoinRoom(userInfo, roomId);
        if (status) {
          // 通知该玩家匹配成功
          wsSend(ws, {
            type: 'match',
            code: 200,
            data: {
              roomId,
            },
            message: '匹配成功',
          });
          // 通知房间内其他玩家，有玩家加入房间
          Object.keys(roomInfo.roomUsers).filter(id => id != userInfo.user_id).forEach((userId) => {
            const roomUserInfo = roomInfo.roomUsers[userId];
            wsSend(roomUserInfo.ws, {
              type: "userJoinRoomUpdate",
              code: 200,
              data: {
                ...roomInfo,
                roomUsers: clientReturnRoomUsers(roomInfo.roomUsers, userId)
              }, // 返回用户信息
              message: '加入房间成功'
            })
          })
        } else {
          wsSend(ws, {
            type: 'match',
            code: 400,
            message: message,
          });
        }
      } else {
        // 加入到匹配数组中
        matchUserList[params.level].push({
          ...userInfo,
          ws,
        });

        // 匹配玩家
        if (matchUserList[params.level].length >= 3) {
          const roomId = await CreateRoom({ userInfo, level: params.level, roomType: RoomType.MATCHING });

          // 删除匹配列表中已匹配的玩家
          let matchUser = matchUserList[params.level].splice(0, 3);
          console.log("匹配成功", matchUser)
          matchUser.forEach(async (userInfo) => {
            // 加入房间内
            userJoinRoom(userInfo, roomId);

            // 通知客户端，匹配成功，需要客户端调用加入房间websocket接口
            wsSend(userInfo.ws, {
              type: 'match',
              code: 200,
              data: {
                roomId,
              },
              message: '匹配成功',
            });
          });
        } else {
          wsSend(ws, { type: 'match', code: 200, message: '匹配中' });
        }
      }
    } else {
      wsSend(ws, {
        type: "match",
        code: 400,
        message: message
      })
    }
  }

  // 退出匹配
  @authSocketToken()
  public cancelMatch({ ws, token, userInfo, params }: any) {
    if (matchUserList[params.level]) {
      matchUserList[params.level] = matchUserList[params.level].filter((item) => userInfo.user_id !== item.user_id);
    }

    wsSend(ws, {
      type: 'cancelMatch',
      code: 200,
      message: '退出匹配成功',
    });
  }
}