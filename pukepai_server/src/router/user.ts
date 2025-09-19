import * as Koa from 'koa';
import { v4 } from 'uuid'
import { post, validateParams, authToken } from '../utils/decors';
import pool from '../mysql'
import { create } from '../utils/token'
import { CreateRoom, GameStatus, RoomObj, userJoinRoom } from '../utils/room';
import { wsSend } from './websocket/webSocket';
import { clientReturnRoomUsers, timestampToDate } from '../utils/tools';

interface GoldIsAdequateReturn {
  status: boolean;
  message: string;
}

// 获取用户信息校验token
@authToken
export default class User {

  // 获取用户信息
  @post('/getUserInfo')
  public static async login(ctx: Koa.Context) {
    const { userInfo } = ctx.request.body || {};

    console.log("userInfo", userInfo)
    try {
      const [rows] = await pool.inst.query(`select id, user_id, user_name, user_account, user_head_img, wx_openid, gold, game_audio, bg_audio from user where user_id = ?`, [userInfo.user_id])
      // @ts-ignore
      if (rows.length > 0) {
        ctx.body = {
          code: 200,
          data: rows[0],
          message: '成功'
        }
      } else {
        ctx.body = {
          code: 400,
          error: '',
          message: '获取失败'
        }
      }
    } catch (error) {
      ctx.body = {
        code: 500,
        error: error,
        message: '服务器错误'
      }
    }
  }

  // 查询用户是否又加入的房间（尝试重连）,重连之后调用joinRoom加入房间
  @post('/reConnection')
  public static async reConnection(ctx: Koa.Context) {
    const { userInfo } = ctx.request.body || {};

    try {
      const userRoomId = Object.keys(RoomObj).filter(roomId => {
        return RoomObj[roomId].roomUsers[userInfo.user_id]
      }) || []


      // 房间存在 && 用户在房间中
      if (userRoomId[0]) {
        // 判断用户元宝是否充足
        let { status, message } = await User.GoldIsAdequate({
          userId: userInfo.user_id,
          roomId: userRoomId[0],
        })

        if (status) {
          ctx.body = {
            code: 200,
            data: {
              roomId: userRoomId[0],
            },
            message: '成功'
          }
        } else {
          ctx.body = {
            code: 400,
            message: message
          }
        }
      } else {
        ctx.body = {
          code: 200,
          data: {},
          message: '用户没有加入的房间',
        }
      }

    } catch (error) {
      ctx.body = {
        code: 500,
        error: error,
        message: '服务器错误'
      }
    }
  }

  // 加入房间
  @post("/joinRoom")
  public static async joinRoom(ctx: Koa.Context) {
    const { userInfo, roomId } = ctx.request.body || {};

    const roomInfo = RoomObj[roomId];
    // console.log("joinRoomInfo", roomInfo, roomId);
    if (!roomInfo) {
      ctx.body = {
        code: 400,
        message: "房间不存在",
      }
    } else {
      // 判断用户元宝是否充足
      let { status, message } = await User.GoldIsAdequate({
        userId: userInfo.user_id,
        roomId
      })

      if (status) {
        // 加入房间
        const { status, message } = userJoinRoom(userInfo, roomId);
        if (!status) {
          ctx.body = {
            code: 400,
            message: message,
          }
        } else {
          // 通知其他用户有人加入房间
          const otherUser = Object.keys(roomInfo.roomUsers).filter(id => id != userInfo.user_id);
          // 通知其他用户
          otherUser.forEach((value, index) => {
            const userInfo = roomInfo.roomUsers[value];
            // 通知用户有玩家加入房间
            wsSend(userInfo.ws, {
              type: "userJoinRoomUpdate",
              code: 200,
              data: {
                ...roomInfo,
                roomUsers: clientReturnRoomUsers(roomInfo.roomUsers, userInfo.user_id)
              }, // 返回用户信息
              message: '加入房间成功'
            })
          })

          // 通知加入用户加入的房间ID
          ctx.body = {
            code: 200,
            data: {
              roomId: roomId,
            },
            message: "加入房间成功",
          }
        }
      } else {
        ctx.body = {
          code: 400,
          message: message,
        }
      }
    }
  }

  // 获取玩家是否正在对局（不允许玩家存在两个对局中）
  @post('/getUserPlaying')
  public static async getUserPlaying(ctx: Koa.Context) {
    const { userInfo } = ctx.request.body || {};

    console.log("RoomObj", RoomObj, userInfo)

    let filterList = Object.keys(RoomObj).filter(roomId => {
      const roomInfo = RoomObj[roomId];
      return roomInfo.roomUserIdList.some(userId => userId === userInfo.user_id);
    })

    ctx.body = {
      code: 200,
      data: {
        isInRoom: filterList.length > 0 ? true : false, // 是否在房间中
        roomId: filterList[0],
        // 在房间中返回房间的游戏状态
        ...(filterList.length > 0 ? { gameStatus: RoomObj[filterList[0]].gameStatus } : {})
      },
      message: "获取成功",
    }
  }


  // 创建房间
  @post("/createRoom")
  public static async createRoom(ctx: Koa.Context) {
    const { userInfo, level } = ctx.request.body || {};

    // 判断用户元宝是否充足
    let { status, message } = await User.GoldIsAdequate({
      userId: userInfo.user_id,
      level
    })

    if (status) {
      // 创建房间，存到内存中，不写入数据库
      const roomId = await CreateRoom({ userInfo, level: level })
      console.log("createRoomInfo", roomId)

      ctx.body = {
        code: 200,
        data: roomId,
        message: "创建房间成功",
      }
    } else {
      ctx.body = {
        code: 400,
        message: message,
      }
    }
  }


  // 获取战绩
  @post("/getRecord")
  public static async getRecord(ctx: Koa.Context) {
    const { userInfo } = ctx.request.body || {};
    console.log("getRecord", userInfo)

    try {
      const [rows] = await pool.inst.query(`select * from game_record where user_1_id = ? or user_2_id = ? or user_3_id = ? order by end_time DESC`, [userInfo.user_id, userInfo.user_id, userInfo.user_id])
      // @ts-ignore
      ctx.body = {
        code: 200,
        data: rows,
      }
    } catch (error) {
      ctx.body = {
        code: 500,
        error: error,
        message: '服务器错误'
      }
    }
  }

  // 分享链接获取是否可以加入房间
  @post("/queryJoinRoom")
  public static async queryJoinRoom(ctx: Koa.Context) {
    const { userInfo, roomId } = ctx.request.body || {};
    // console.log("getRecord", userInfo)
    const roomInfo = RoomObj[roomId]

    try {
      // 先判断房间是否存在 userJoinRoom 方法也会进行判断，但是他判断可以加入时，直接加入房间了
      if (!roomInfo) {
        ctx.body = {
          code: 200,
          data: {
            success: false,
          },
          message: "房间不存在",
        }
      } else {
        // 判断用户元宝是否充足
        let { status: goldIsAdequate, message } = await User.GoldIsAdequate({
          userId: userInfo.user_id,
          roomId
        })

        if (goldIsAdequate) {
          // 判断玩家是否存在其他房间中，判断加入房间是否已满，判断加入房间
          let { status, message } = userJoinRoom(userInfo, roomId);
          if (status) {
            // 通知房间内其他用户有玩家加入
            const outherUser = roomInfo.roomUserIdList.filter(userId => userId && userId != userInfo.user_id);

            outherUser.forEach(userId => {
              // 通知其他用户更新用户信息
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

            ctx.body = {
              code: 200,
              data: {
                success: true,
              },
              message: "加入房间成功",
            }

          } else {
            ctx.body = {
              code: 200,
              data: {
                success: false,
              },
              message: message,
            }
          }
        } else {
          ctx.body = {
            code: 400,
            error: message,
          }
        }
      }

    } catch (error) {
      ctx.body = {
        code: 500,
        error: error,
        message: '服务器错误'
      }
    }
  }

  // 问题反馈
  @post("/feedback")
  public static async feedback(ctx: Koa.Context) {
    const { userInfo, feedback } = ctx.request.body || {};

    // console.log("feedback", userInfo, feedback)

    try {
      let [rows]: any = await pool.inst.query(`insert into feedback (user_id, feedback, time) values (?, ?, ?)`, [userInfo.user_id, feedback, new Date()])
      if (rows.affectedRows > 0) {
        ctx.body = {
          code: 200,
          data: {
            success: true,
          },
          message: "反馈成功",
        }
      } else {
        ctx.body = {
          code: 200,
          data: {
            success: false,
          },
          message: "反馈失败",
        };
      }
    } catch (error) {
      ctx.body = {
        code: 500,
        error: error,
        message: '服务器错误'
      }
    }
  }


  // 获取设置信息
  @post("/getSetting")
  public static async getSetting(ctx: Koa.Context) {
    const { userInfo } = ctx.request.body || {};

    try {
      let [rows]: any = await pool.inst.query(`select id, user_id, user_name, user_account, user_head_img, wx_openid, gold, game_audio, bg_audio from user where user_id = ?`, [userInfo.user_id])
      if (rows.length > 0) {
        ctx.body = {
          code: 200,
          data: {
            wxOpenId: rows[0].wx_openid,
            gameAudio: rows[0].game_audio,
            bgAudio: rows[0].bg_audio
          },
          message: "获取成功",
        };
      } else {
        ctx.body = {
          code: 200,
          message: "获取失败",
        };
      }
    } catch (error) {
      ctx.body = {
        code: 500,
        error: error,
        message: '服务器错误'
      }
    }
  }

  // 获取设置信息
  @post("/changeAudio")
  public static async changeAudio(ctx: Koa.Context) {
    const { userInfo, audioStatus } = ctx.request.body || {};

    try {
      let [rows]: any = await pool.inst.query(`update user set game_audio = ? where user_id = ?`, [audioStatus, userInfo.user_id])

      ctx.body = {
        code: 200,
        data: true,
        message: '修改成功'
      }
    } catch (error) {
      ctx.body = {
        code: 500,
        error: error,
        message: '服务器错误'
      }
    }
  }

  // 获取设置信息
  @post("/changeBgAudio")
  public static async changeBgAudio(ctx: Koa.Context) {
    const { userInfo, audioStatus } = ctx.request.body || {};

    try {
      let [rows]: any = await pool.inst.query(`update user set bg_audio = ? where user_id = ?`, [audioStatus, userInfo.user_id])

      ctx.body = {
        code: 200,
        data: true,
        message: '修改成功'
      }
    } catch (error) {
      ctx.body = {
        code: 500,
        error: error,
        message: '服务器错误'
      }
    }
  }

  // 用户绑定微信
  @post('/userBindWx')
  public static async userBindWx(ctx: Koa.Context) {
    const { userInfo, openid, wxUserInfo } = ctx.request.body || {};

    console.log('userInfo', userInfo);

    try {
      // 查询该微信是否已经绑定账号
      let [userRows]: any = await pool.inst.query(`select id, user_id, user_name, user_account, user_head_img, wx_openid, gold, game_audio from user where wx_openid = ?`, [openid])
      if (userRows.length > 0) {
        return ctx.body = {
          code: 200,
          data: false,
          message: '改微信已经绑定账号'
        }
      }

      // 绑定微信账号
      const [rows] = await pool.inst.query(`update user set wx_openid = ?, user_name = ?, user_head_img = ? where user_id = ?`, [openid, wxUserInfo.nickName, wxUserInfo.avatarUrl, userInfo.user_id]);

      console.log("rows", rows)

      // @ts-ignore
      if (rows.affectedRows > 0) {
        ctx.body = {
          code: 200,
          data: true,
          message: '绑定成功'
        }
      } else {
        ctx.body = {
          code: 200,
          data: false,
          message: '绑定失败'
        }
      }
    } catch (error) {
      console.log("error", error)
      ctx.body = {
        code: 500,
        message: '绑定失败'
      }
    }
  }

  // 每日领取元宝
  @post('/claimDaily')
  public static async claimDaily(ctx: Koa.Context) {
    const { userInfo } = ctx.request.body || {};

    try {
      // 查询该微信是否已经绑定账号
      let [userRows]: any = await pool.inst.query(`select day_get_gold, gold from user where user_id = ?`, [userInfo.user_id])

      if (userRows.length > 0) {
        const { year, month, day } = userRows[0]?.day_get_gold ? timestampToDate(userRows[0].day_get_gold) : {};
        const { year: locYear, month: locMonth, day: locDay } = timestampToDate(new Date().getTime());
        if (year != locYear || month != locMonth || day != locDay) {
          // 更新用户金币
          let [rows] = await pool.inst.query(`update user set gold = gold + ?, day_get_gold = ? where user_id = ?`, [1000, new Date(), userInfo.user_id]);

          // @ts-ignore
          if (rows.affectedRows > 0) {
            return ctx.body = {
              code: 200,
              data: {
                success: true,
                gold: Number(userRows[0].gold) + 1000
              },
              message: '领取成功'
            }
          } else {
            return ctx.body = {
              code: 200,
              data: {
                success: false,
              },
              message: '领取失败,更新数据失败'
            }
          }
        } else {
          return ctx.body = {
            code: 200,
            data: {
              success: false,
              gold: 0
            },
            message: '已领取'
          }
        }
      } else {
        return ctx.body = {
          code: 200,
          data: {
            success: false,
          },
          message: '领取失败'
        }
      }
    } catch (error) {
      console.log("error", error)
      ctx.body = {
        code: 500,
        message: '服务器错误'
      }
    }
  }

  /**
   * 判断玩家元宝是否充足，匹配、创建房间、加入房间、分享加入，都需要判断
   * @param userId 请求用户ID 
   * @param level 根据房间等级判断用户元宝是否充足
   * @param roomId 根据房间ID判断用户元宝是否充足
   * @returns 
   */
  public static async GoldIsAdequate({
    userId,
    level = "",
    roomId = ""
  }): Promise<GoldIsAdequateReturn> {

    // 传入了房间ID但是房间不存在
    if (roomId && !RoomObj[roomId]) {
      console.log(roomId, !RoomObj[roomId])
      return {
        status: false,
        message: '房间不存在'
      };
    } else {
      // 查询用户信息获取用户元宝
      const [userInfos]: any = await pool.inst.query(`select * from user where user_id = ?`, [userId]);

      if (userInfos.length > 0) {
        // 传入了房间ID，证明是要加入房间，对比当前用户元宝和房间元宝基数做对比
        const [levelInfo]: any = await pool.inst.query(`select * from room_level where level = ?`, [roomId && RoomObj[roomId] ? RoomObj[roomId].level : level]);

        // 用户元宝大于房间基数，运行进行下一步
        if (Number(userInfos[0].gold) >= Number(levelInfo[0].base)) {
          return {
            status: true,
            message: '元宝充足'
          };
        } else {
          return {
            status: false,
            message: '元宝不足'
          };
        }

      } else {
        return {
          status: false,
          message: '用户信息查询失败'
        };
      }
    }
  }
}