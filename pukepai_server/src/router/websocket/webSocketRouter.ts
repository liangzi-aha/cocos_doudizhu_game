import pool from '../../mysql';
import { create, verify } from '../../utils/token';
import { authSocketToken } from '../../utils/decors';
import { RoomObj, CreateRoom, PlayerReadyStatus, GameStatus } from '../../utils/room';
import { wsSend } from './webSocket'
import { getRandomNumber, getRoomUserProp } from '../../utils/tools';
import { webSocketRoomBaseRouter } from './webSocketRoomBaseRouter';
import { webSocketPlayCardRouter } from './webSocketPlayCardRouter';
import { webSocketDealCardsRouter } from './webSocketDealCardsRouter';
import { webSocketMatchRouter } from './webSocketMatch';

// 类转换为对象
function convertClassMethodsToObject<T>(cls: new (...args: any[]) => T): { [key: string]: (...args: any[]) => any } {
  const prototype = cls.prototype;
  const methodObject: { [key: string]: (...args: any[]) => any } = {};

  const propertyNames = Object.getOwnPropertyNames(prototype);
  for (const propertyName of propertyNames) {
    const property = prototype[propertyName];
    if (typeof property === 'function' && propertyName !== 'constructor') {
      methodObject[propertyName] = property;
    }
  }

  return methodObject;
}

// websocket 路由文件出口
export const socketRoute = {
  ...convertClassMethodsToObject(webSocketRoomBaseRouter), // 房间基础路由
  ...convertClassMethodsToObject(webSocketPlayCardRouter), // 房间出牌路由处理
  ...convertClassMethodsToObject(webSocketDealCardsRouter), // 房间发牌路由处理
  ...convertClassMethodsToObject(webSocketMatchRouter), // 用户匹配逻辑
}