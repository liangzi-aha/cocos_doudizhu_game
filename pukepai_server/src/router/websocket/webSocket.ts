import * as WebSocket from 'ws';
import pool from '../../mysql';
import * as cookie from 'cookie'; // 使用 cookie 库来解析 Cookie 字符串
import { socketRoute } from './webSocketRouter';
import { create, verify } from '../../utils/token';
import { matchUserList, setMatchUserList } from './webSocketMatch';
import { GameStatus, PlayerReadyStatus, RoomObj } from '../../utils/room';

interface SocketData {
  type: string,
  data?: any,
  code: number,
  message?: string,
  error?: string,
}

// 游戏房间，断线用户
const lostConnectionUser = {
  // [userId: string]: connectionTimer;
}


// 单例模式
export default class WebSocketServer {
  // 实例化的websocket
  private static wss: WebSocket.Server = null;
  // 获取实例
  public static get inst(): WebSocket.Server {
    return this.wss;
  }

  // 初始化 websocket服务
  public static init(server) {
    // 没有初始化过进行初始化
    if (!this.wss) {
      // 创建一个websocket服务
      this.wss = new WebSocket.Server({ server });

      // 连接
      this.wss.on('connection', function connection(ws: WebSocket, req) {
        // 解析数据
        let parseData: any = {};
        // 请求url（url前缀必须是/ws）  可以通过url区分websocket的请求，感觉体量不够没必要
        const beforeQuestion = req.url.split('?')[0];
        let url = beforeQuestion.slice(beforeQuestion.lastIndexOf('/'));
        console.log("连接成功 url", req.url, url)
        // 获取参数
        let urlParams = require('qs').parse(req.url.split('?')[1]);
        // 房间信息
        const roomInfo = RoomObj[urlParams.roomId];
        console.log(url, urlParams);
        // 游戏房间ws，连接成功
        if (url == "/roomInfo" && lostConnectionUser[urlParams.userId]) {
          // 判断是否是重连用户，如果是则删除延时踢出玩家的计时器
          clearTimeout(lostConnectionUser[urlParams.userId]);
          delete lostConnectionUser[urlParams.userId];
          // 更新重连玩家的 socket 请求
          roomInfo.roomUsers[urlParams.userId].ws = ws;
          // 通知其他用户，玩家连接成功
          const outherUser = roomInfo.roomUserIdList.filter(item => item && item != urlParams.userId);
          if (outherUser.length > 0) {
            // 通知其他用户玩家掉线，取消准备重连中
            outherUser.forEach(id => {
              wsSend(roomInfo.roomUsers[id].ws, {
                type: "userConnectionSuccess", // 断线重连
                code: 200,
                data: {
                  userId: urlParams.userId,
                  userName: roomInfo.roomUsers[urlParams.userId].user_name,
                }
              });
            })
          }
        }

        // 监听客户端发送的消息
        ws.on('message', function (data) {  //前端发送过来的是个数组  data是个数组
          console.log("接收到客户端发送的消息")
          // 构建字符串
          const buffer = Buffer.from(data).toString('utf-8'); // 将Uint8Array转换为Buffer
          console.log(buffer)
          if (buffer == 'ping') {
            return wsSend(ws, {
              type: "ping", // 所有用户都已经选择过了
              code: 200,
            })
          }

          try {
            parseData = JSON.parse(buffer); // 将Buffer转换为字符串
            console.log('客户端发送过来的数据', parseData.type);
            // 调用不同路由
            console.log("socketRoute", parseData)
            socketRoute[parseData.type] && socketRoute[parseData.type]({
              params: parseData.params, // params 客户端发送过来的参数，里面默认也会传当前房间的token
              urlParams: urlParams, // websocket url参数
              ws, // 当前发送请求用户ws
              token: parseData.params.token, // token
            })
          } catch (error) {
            console.log('解析错误,数据传输不是json格式', buffer);
          }
        })

        // 处理连接关闭事件
        ws.on('close', (code) => {
          console.log("e.code", code);
          // 匹配连接断开
          matchClose(code);
          // 房间连接断开 (断线不踢出玩家了，展示没想好，客户端重连的时候该怎么做，加入服务端断线重连30秒，客户端30秒没有连上，就踢出玩家，30秒后连上了推到首页，还有假如玩家准备了，但是掉线了，重连30秒不踢出玩家，其他玩家准备了，开始了游戏，玩家重连上之后还得处理，重连计时器)
          roomClose(code);
          console.log('client disconnected');
        });

        ws.on('error', (error) => {
          matchClose(1006);
          console.log("连接错误", error);
        });

        // 匹配关闭（断开连接关闭匹配）
        function matchClose(code) {
          // 判断是不是匹配中掉线了, code 1000 为手动正常关闭
          if (url == "/matching" && code != 1000) { // 匹配ws连接
            const userId = verify(parseData.params.token).decoded.user_id;
            console.log("玩家匹配掉线", userId)
            // 删除匹配列表中匹配的玩家
            setMatchUserList(parseData.params.level, matchUserList[parseData.params.level].filter((item, index) => {
              return item.user_id != userId
            }))
          }
        }

        // 房间websocket 断开连接
        function roomClose(code) {
          console.log("roomClose url", url)
          if (url == "/roomInfo") { // 房间ws连接
            const { roomId, userId } = urlParams;
            const roomInfo = RoomObj[roomId];

            // 玩家断开连接，直接删除玩家的ws 连接（ws用来判断玩家是否断开连接）
            // delete roomInfo?.roomUsers[userId]?.ws; // 这块好像不需要，添加的话有bug

            // 判断房间是否已经开始游戏的话不踢出用户，1000为玩家被挤掉
            if (roomInfo?.gameStatus == GameStatus.NOSTART && code != 1000) {
              // 玩家掉线，需要第一时间把玩家的准备状态修改为未准备，通知其他玩家有用户掉线重连中
              console.log(roomInfo.roomUsers[userId].user_name + " 掉线");
              if (roomInfo.roomUsers[userId]?.ready == PlayerReadyStatus.READY) {
                // 取消准备状态
                roomInfo.roomUsers[userId].ready = PlayerReadyStatus.UNREADY;
                // 通知所有用户，房间用户更新准备状态
                const roomUserIds = Object.keys(roomInfo.roomUsers);
                roomUserIds.forEach((value, index) => {
                  const userInfo = roomInfo.roomUsers[value];
                  // 通知更新准备状态
                  wsSend(userInfo.ws, {
                    type: "ready",
                    code: 200,
                    data: roomInfo, // 返回所有用户的准备状态
                    message: '成功'
                  })
                })
              }

              // 获取房间其他玩家
              const outherUser = roomInfo.roomUserIdList.filter(item => item && item != userId);
              console.log("通知其他玩家由用户掉线", outherUser)
              if (outherUser.length > 0) {
                // 通知其他用户玩家掉线，取消准备重连中
                outherUser.forEach(id => {
                  wsSend(roomInfo.roomUsers[id].ws, {
                    type: "userlostConnection", // 断线重连
                    code: 200,
                    data: {
                      userId: userId, // 断线用户id
                      userName: roomInfo.roomUsers[userId].user_name,
                    }
                  });
                })
              }

              // 玩家断开连接，服务器给出10秒时间进行重连，重连失败，判断游戏是否
              lostConnectionUser[userId] = setTimeout(() => {
                // 删除掉线重连玩家的计时器
                delete lostConnectionUser[userId];
                // 踢出玩家，通知房间其他玩家，如果房间没有玩家，删除房间
                delete roomInfo.roomUsers[userId];
                // 删除用户数组中的对应项，数组能保证顺序不会改变
                const index = roomInfo.roomUserIdList.indexOf(userId);
                roomInfo.roomUserIdList[index] = "";
                // 删除之后剩余玩家ID
                const roomUserIds = Object.keys(roomInfo.roomUsers);

                // 所有玩家都退出了，就删除房间
                if (roomUserIds.length <= 0) {
                  console.log("玩家全部退出，删除房间")
                  // 删除房间
                  delete RoomObj[roomId];
                } else {
                  // 退出的是房主，将第一个onlineUserList用户设置为房主
                  if (userId == roomInfo.room_owner_id) {
                    roomInfo.room_owner_id = roomUserIds[0];
                  }
                  // 通知在线用户，有玩家退出了，更新ui
                  roomUserIds.forEach(id => {
                    const userInfo = roomInfo.roomUsers[id];
                    wsSend(userInfo.ws, {
                      type: "userOutRoom",
                      code: 200,
                      data: {
                        roomOutUserId: userId,
                        roomInfo: roomInfo
                      },
                      message: '成功'
                    });
                  })
                }
              }, 10000);
            } else if (roomInfo?.gameStatus == GameStatus.SNATCHLABDLORD && code != 1000) { // 抢地主状态下，如果三个玩家全部掉线，则直接结束游戏，删除房间（解决性能）
              const allUserClose = roomInfo?.roomUserIdList.every(userId => {
                // 没有ws证明玩家掉线
                return !roomInfo?.roomUsers[userId]?.ws
              });
              // 所有玩家都掉线
              if (allUserClose) {
                console.log(roomId, '全部玩家掉线删除房间')
                clearInterval(roomInfo.count_down_timer);
                // 删除房间
                delete RoomObj[roomId];
              }
            }
          }
        }
      });

      console.log("初始化websocket服务");
    }
  }

}


export function wsSend(ws: WebSocket, data: SocketData) {
  // 需要忽略房间信息的计时器和websocket（如果包含的话，在这里统一过滤），返回给客户端会报错
  const ignoreKey = ["ws", "count_down_timer"];
  // 定义 replacer 函数
  function replacer(key, value) {
    // 忽略 password 属性
    if (ignoreKey.includes(key)) {
      return undefined;
    }

    // 其他属性正常返回
    return value;
  }

  // 如果用户退出登录ws可能为空
  if (ws) {
    ws.send(JSON.stringify(data, replacer))
  }
}

// 根据房间ID，通过websocket 通知用户更新房间倍率
export const socketUpdateRoomRate = (RoomId) => {
  const roomRate = RoomObj[RoomId].room_rate;

  RoomObj[RoomId].roomUserIdList.forEach(userId => {
    const ws = RoomObj[RoomId].roomUsers[userId].ws;
    if (ws) {
      wsSend(ws, {
        type: "updateRoomRate",
        code: 200,
        data: {
          roomRate: roomRate,
        },
      });
    }
  });
}

