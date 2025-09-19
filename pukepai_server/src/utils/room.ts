import { v4 } from 'uuid'
import { generateRoomId } from './tools'
import { wsSend } from '../router/websocket/webSocket';
import pool from '../mysql'

// 游戏状态枚举
enum GameStatus {
  NOSTART, // 未开始（游戏结束数据上传完成之后，状态修改为NOSTART）
  SNATCHLABDLORD, // 抢地主状态
  START, // 开始游戏 (开始游戏之后，开始加倍没有单独的状态)
}

// 玩家准备状态
enum PlayerReadyStatus {
  READY,
  UNREADY
}

// 房间类型
export enum RoomType {
  USERCREATE, // 玩家创建
  MATCHING, // 系统匹配
}

// 房间抽象类 （房间记录表需要参数，和数据库表一致）
interface RoomAbstract {
  room_id: string; // 房间id
  start_time: Date; // 游戏开始时间
  end_time: Date; // 游戏结束时间
  room_owner_id: string; // 房主id
  landlord_id: string; // 地主id
  user_1_id: string; // 用户1 id
  user_2_id: string; // 用户2 id
  user_3_id: string; // 用户3 id
  user_1_get_ingots: number; // 游戏结束用户1获得积分
  user_2_get_ingots: number; // 游戏结束用户2获得积分
  user_3_get_ingots: number; // 游戏结束用户3获得积分
  user_1_redouble: number; // 玩家1是否加倍，0不加倍 1加倍 2超级加倍
  user_2_redouble: number; // 玩家2是否加倍，0不加倍 1加倍 2超级加倍
  user_3_redouble: number; // 玩家3是否加倍，0不加倍 1加倍 2超级加倍
  user_1_mingpai: number; // 玩家1是否名牌，0不明排 1 明牌
  user_2_mingpai: number; // 玩家2是否名牌，0不明排 1 明牌
  user_3_mingpai: number; // 玩家3是否名牌，0不明排 1 明牌
  room_rate: number; // 房间倍率
  level: number; // 抽象属性
}


// 用户表信息
interface UserInfo {
  id: string; // user主键ID
  user_id: string; // 用户id
  user_name: string; // 用户名
  user_head_img: string; // 用户头像
  user_account: string; // 用户账号
  gold: string; // 金币
  wx_openid: string; // 微信openid
}

// 玩家房间信息，包含了玩家游戏的状态
interface RoomUserStatus {
  id: string; // user主键ID
  user_card: Array<number>; // 用户卡牌
  ws: WebSocket | null; // websocket
  user_id: string; // 用户id
  user_name: string; // 用户名
  user_head_img: string; // 用户头像
  user_account: string; // 用户账号
  gold: string; // 金币
  wx_openid: string; // 微信openid
  ready: PlayerReadyStatus; // 是否准备
  redouble_status: number; // 加倍状态 1不加倍 2加倍 3超级加倍
  mingpai: boolean; // 是否是明牌
  get_ingots: number; // 游戏结束获得元宝（输了可能是负数）
  snatch_landlord_num: number; // 抢地主次数 
  is_hosted: boolean; // 是否托管
}

// 游戏房间状态抽象类（不入库的房间状态数据）
abstract class GameRoomStatus {
  abstract room_id: string; // 房间id
  abstract start_time: Date; // 游戏开始时间
  abstract end_time: Date; // 游戏结束时间
  abstract room_owner_id: string; // 房主id
  abstract landlord_id: string; // 地主id
  abstract room_rate: number; // 房间倍率
  abstract level: number; // 房间等级 1：初级 2：中级 3：高级 4：大师 （基数）
  abstract gameStatus: GameStatus; // 游戏状态
  abstract roomUsers: roomUserObj; // 房间用户
  abstract setRoomUserStatus(userInfo: UserInfo): void; // 设置用户信息
  abstract bottom_card: Array<number>; // 底牌
  abstract snatch_landlord_record: Array<snatchLandlordRecord>; // 抢地主记录，每抢一次记录仅数组中
  abstract current_snatch_landlord_user: string; // 当前抢地主玩家
  abstract snatch_landlord_countDown: number; // 用户抢地主剩余时间
  abstract snatch_landlord_time: number; // 用户抢地主默认时间 (后期可以通过该值统一修改)
  abstract play_card_time: number; // 用户出牌默认时间
  abstract play_card_countDown: number; // 用户出牌剩余时间
  abstract double_time: number; // 用户选择加倍默认时间
  abstract double_countDown: number; // 用户选择加倍剩余时间(-1 未选择过加倍 0 所有用户都选择过加倍了)
  abstract count_down_timer: any; // 用户计时器（抢地主、出牌、加倍）
  abstract play_card_record: Array<playCardRecord>; // 玩家出牌记录
  abstract current_play_card_user: string; // 当前出牌玩家id
}

interface RoomObj {
  [roomId: string]: Room;
}

interface roomUserObj {
  [userId: string]: RoomUserStatus;
}

// 抢地主记录
interface snatchLandlordRecord {
  userId: string; // 用户id
  isSnatchLandlord: boolean; // 是否抢地主
}

// 出牌记录
interface playCardRecord {
  userId: string; // 用户id
  playCard: Array<number>; // 出牌
  gameOver: boolean; // 是否结束游戏
}

// 房间类
class Room extends GameRoomStatus { // 实现抽象属性
  start_time: Date | null = null;
  end_time: Date | null = null;
  room_owner_id: string | null = null; // 房主id
  landlord_id: string | null = null; // 地主id
  room_rate: number = 1; // 初始倍率为1
  level: number | null = null; // 房间等级
  room_base: number | null = null; // 房间基数
  room_id: string | null = null; // 房间id
  roomUsers: roomUserObj | null = null; // 定义未map 方便用户取值，但是循环麻烦
  roomUserIdList: [string, string, string] = ["", "", ""]; // 为什么有定义一个用户id List，因为出牌的时候要逆时针出牌，但是用户加入房间再次退出的时候，直接重roomUsers中删除了，所以相对应的位置也改变了（比如 1 2 3玩家，2退出了3就变成2了），想要对应的位置不改变，所以定义了一个userId数组
  gameStatus: GameStatus = GameStatus.NOSTART;
  bottom_card: Array<number> = []; // 底牌默认空
  snatch_landlord_record: Array<snatchLandlordRecord> = []; // 抢地主总记录
  current_snatch_landlord_user: string = ""; // 当前抢地主玩家
  snatch_landlord_time: number = 20; // 用户抢地主默认时间
  snatch_landlord_countDown: number = this.snatch_landlord_time; // 用户抢地主剩余时间
  play_card_time: number = 20; // 用户出牌等待时间
  play_card_countDown: number = this.play_card_time; // 用户出牌剩余时间
  double_time: number = 5; // 用户选择加倍默认时间
  double_countDown: number = -1; // 用户选择加倍剩余时间(-1 未选择过加倍)
  count_down_timer: any = null; // 计时器
  play_card_record: Array<playCardRecord> = []; // 玩家出牌记录
  current_play_card_user: string = ""; // 当前出牌用户id
  room_type: RoomType = null; // 房间类型 玩家创建 和 系统匹配

  // 修改用户信息
  setRoomUserStatus(RoomUserStatus: RoomUserStatus) {
    // 修改用户信息，先判断是否有该用户
    if (this.roomUsers[RoomUserStatus.user_id]) {
      // 修改用户信息
      Object.assign(this.roomUsers[RoomUserStatus.user_id], RoomUserStatus);
    } else {
      console.log('用户不存在,该房间')
    }
  }



  constructor(obj) {
    super();

    // 初始化数据
    Object.keys(obj).forEach(key => {
      if (this[key] !== undefined) {
        this[key] = obj[key];
      }
    });
  }
}

// 房间对象
const RoomObj: RoomObj = {};

/**
 * 创建房间
 * @param {Object} userInfo 用户信息
 * @param {number} level 房间等级
 * @param {RoomType} roomType 房间类型 玩家创建 和 系统匹配
 */
const CreateRoom = async ({ userInfo, level, roomType = RoomType.USERCREATE }: any) => {
  // 获取房间等级信息
  const [rows]: any = await pool.inst.query(`select id, level, base from room_level`)
  const [userInfoDb]: any = await pool.inst.query(`select id, user_id, user_name, user_account, user_head_img, wx_openid, gold from user where user_id = ?`, [userInfo.user_id]);

  console.log(userInfoDb);

  const room_id = generateRoomId(RoomObj);
  console.log("生成房间id为", room_id);
  RoomObj[room_id] = new Room({
    room_id,
    room_owner_id: userInfoDb[0].user_id, // 房主id
    level, // 房间等级
    room_rate: 1, //  初始倍率为1
    room_base: rows.find(item => item.level === level).base, // 房间基数
    room_type: roomType, // 房间类型
    roomUsers: {
      [userInfoDb[0].user_id]: { // 设置默认用户，为创建用户者
        id: userInfoDb[0].id, // user主键ID
        user_card: [], // 用户卡牌
        ws: null, // websocket
        user_id: userInfoDb[0].user_id, // 用户id
        user_name: userInfoDb[0].user_name, // 用户名
        user_head_img: userInfoDb[0].user_head_img, // 用户头像
        user_account: userInfoDb[0].user_account, // 用户账号
        gold: userInfoDb[0].gold, // 金币
        wx_openid: userInfoDb[0].wx_openid, // 微信openid
        ready: PlayerReadyStatus.UNREADY, // 是否准备
        redouble_status: null, // 加倍状态 1不加倍 2加倍 3超级加倍
        mingpai: false,// 是否是明牌
        get_ingots: 0, // 游戏结束获得元宝（输了可能是负数）
      }
    },
    roomUserIdList: [userInfoDb[0].user_id, "", ""]
  });

  return room_id;
}

// 房间加入用户
function userJoinRoom(userInfo: UserInfo, roomId) {

  const roomInfo = RoomObj[roomId];
  // 获取用户已经加入的房间ID
  const userJoinRooms = Object.keys(RoomObj).filter(roomId => {
    return RoomObj[roomId].roomUsers[userInfo.user_id]
  });

  // 房间不存在
  if (!roomInfo) {
    return {
      status: false,
      message: '房间不存在'
    };
  } else if (userJoinRooms.length > 0) { // 存在已经加入的房间
    // 如果已经加入的房间和要加入的房间ID一致，证明是断线重连，则直接返回true
    if (userJoinRooms[0] == roomId) {
      return {
        status: true,
        message: '允许加入'
      };
    } else {
      return {
        status: false,
        message: '你已经加入过别的房间，不能加入两个房间'
      };
    }
  } else if (Object.keys(roomInfo.roomUsers).length >= 3) { // 判断用户列表中有多少用户
    return {
      status: false,
      message: "房间已满"
    };
  } else {
    // 添加用户
    roomInfo.roomUsers[userInfo.user_id] = {
      ws: null,
      user_card: [],
      ready: PlayerReadyStatus.UNREADY, // 是否准备
      redouble_status: null, // 加倍状态 1不加倍 2加倍 3超级加倍 
      mingpai: false, // 是否是明牌
      get_ingots: 0, // 游戏结束获得元宝（输了可能是负数）
      snatch_landlord_num: 0, // 抢地主次数 
      is_hosted: false, // 是否被托管
      ...userInfo,
    };
    // 存入用户id列表
    const index = roomInfo.roomUserIdList.indexOf("");
    roomInfo.roomUserIdList[index] = userInfo.user_id;
    return {
      status: true,
      message: "加入成功"
    };
  }
}

export {
  RoomObj,
  CreateRoom,
  userJoinRoom,
  GameStatus,
  PlayerReadyStatus
}