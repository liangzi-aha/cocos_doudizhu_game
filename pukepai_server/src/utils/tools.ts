import { GameStatus } from "./room";

// 判断是否是数组
export const isStringArray = function (str: string) {
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed);
  } catch (e) {
    // 如果解析失败，说明字符串不是有效的JSON格式，因此不是数组
    return false;
  }
}

// 生成房间ID
export const generateRoomId = (roomObj: any) => {
  const excludedNumbers = Object.keys(roomObj).map(item => Number(item));
  let randomNumber;
  do {
    // 生成 100000 到 999999 之间的随机数
    randomNumber = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
  } while (excludedNumbers.includes(randomNumber));
  return randomNumber;
}

// 生成随机数
export const getRandomNumber = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 对象过滤属性
 * @param obj 对象
 * @param propList 属性列表数组
 * @param include 是否筛选包含的属性
 * @returns 
 */
export const ObjectPropFilter = (obj, propList, include = true) => {
  const newObj = {};
  for (const key in obj) {
    if (include && propList.includes(key)) {
      newObj[key] = obj[key];
    } else if (!propList.includes(key)) {
      newObj[key] = obj[key];
    }
  }
  return newObj;
}


// 获取房间用户某些属性
export const getRoomUserProp = (roomUsers: any, getPropList: Array<String>, include = true) => {
  let newRoomUsers = {};
  Object.keys(roomUsers).forEach(userId => {
    newRoomUsers[userId] = ObjectPropFilter(roomUsers[userId], getPropList, include)
  });

  return newRoomUsers
}

/**
 * 客户端返回用户信息,根据用户是否明牌进行返回处理
 * @param roomUsers 
 * @param currUserId 
 * @param judgeUserId false 不校验用户id true 校验用户id
 * @returns 
 */
export const clientReturnRoomUsers = (roomUsers, currUserId, judgeUserId = true) => {
  // 设置用户信息，卡牌信息，返回给客户端（当前登录用户看不到其他用户的牌）
  const newRoomUsers = {};
  Object.keys(roomUsers).forEach(userId => {
    const roomUserInfo = roomUsers[userId];

    newRoomUsers[userId] = {
      ...roomUserInfo,
      // user_card 判断当前是否为登录用户，当前登录用户返回真值，其他用户判断是否明牌返回对应的值
      user_card: (currUserId == userId || !judgeUserId) ? roomUserInfo.user_card : (roomUserInfo.mingpai ? roomUserInfo.user_card : new Array(roomUserInfo.user_card.length).fill(0)),
      ws: "",
    };
  });

  return newRoomUsers;
}

// 定义牌面大小顺序，3 最小，2 最大
export const rankOrder = [2, 1, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3];
// 定义大小王顺序
export const jokerOrder = [54, 53];

// 扑克牌排序
export const sortPokerCards = (cards) => {
  return cards.sort((a, b) => {
    // 若 a 是大小王
    if (a === 53 || a === 54) {
      // 若 b 也是大小王，按大小王顺序排序
      if (b === 53 || b === 54) {
        return jokerOrder.indexOf(a) - jokerOrder.indexOf(b);
      }
      // 若 b 不是大小王，a 排前面
      return -1;
    }
    // 若 b 是大小王，b 排前面
    if (b === 53 || b === 54) {
      return 1;
    }

    // 获取牌面数字
    const rankA = (a - 1) % 13 + 1;
    const rankB = (b - 1) % 13 + 1;

    // 获取牌面数字在 rankOrder 中的索引
    const indexA = rankOrder.indexOf(rankA);
    const indexB = rankOrder.indexOf(rankB);

    // 牌面大小不同，按牌面大小排序
    if (indexA !== indexB) {
      return indexA - indexB;
    }

    // 牌面相同，比较花色，花色顺序：黑桃 < 红桃 < 梅花 < 方块
    return a - b;
  });
}

/**
 * 辅助方法：统计每张牌的数量
 * @param cards 传入 getPoint 返回的卡牌数组
 * @returns 
 */
export const _countCards = (cards) => {
  const countMap = {};
  cards.forEach(card => {
    countMap[card.cardSize] = (countMap[card.cardSize] || 0) + 1;
  });
  return countMap;
}

// 辅助方法：获取飞机牌型中的主体三连牌部分
export const _getPlaneTriples = (cards) => {
  const countMap = _countCards(cards);

  // 提取所有至少有三张的牌
  const possibleTriples = Object.keys(countMap)
    .filter(card => countMap[card] >= 3)
    .map(Number)
    .sort((a, b) => a - b);

  // 查找最长的连续三张牌组
  return _findMaxConsecutiveTriples(possibleTriples);
}

// 辅助方法：查找最长的连续三张牌组
export const _findMaxConsecutiveTriples = (triples) => {
  let maxLength = 0;
  let maxGroup = [];

  for (let i = 0; i < triples.length; i++) {
    for (let j = i; j < triples.length; j++) {
      // 检查i到j是否连续
      let isConsecutive = true;
      for (let k = i; k < j; k++) {
        if (triples[k + 1] !== triples[k] + 1) {
          isConsecutive = false;
          break;
        }
      }

      if (isConsecutive && (j - i + 1) > maxLength) {
        maxLength = j - i + 1;
        maxGroup = triples.slice(i, j + 1);
      }
    }
  }

  return maxGroup;
}

// 辅助方法：验证是否为纯飞机（不带牌）
export const _validatePlaneWithout = (countMap, triples) => {
  // 所有牌必须恰好是三组连续的牌，没有剩余
  for (const card of triples) {
    if (countMap[card] !== 3) {
      return false;
    }
  }

  // 检查是否有其他牌
  const allCards = Object.keys(countMap).map(Number);
  return allCards.every(card => triples.includes(card));
}

// 辅助方法：验证是否为飞机三带一
export const _validatePlaneWithSingle = (countMap, triples) => {
  const usedCards = { ...countMap };
  const groupCount = triples.length;

  // 扣除三组牌的部分
  for (const card of triples) {
    usedCards[card] -= 3;
    if (usedCards[card] < 0) return false;
  }

  // 计算剩余牌（带牌部分）的总数量
  let totalSingleCards = 0;
  for (const key in usedCards) {
    if (usedCards.hasOwnProperty(key)) {
      totalSingleCards += usedCards[key];
    }
  }

  // 带牌数量必须等于三牌组数
  return totalSingleCards === groupCount;
}

// 辅助方法：验证是否为飞机三带二
export const _validatePlaneWithPair = (countMap, triples) => {
  const usedCards = { ...countMap };
  const groupCount = triples.length;

  // 扣除三组牌的部分
  for (const card of triples) {
    usedCards[card] -= 3;
    if (usedCards[card] < 0) return false;
  }

  // 剩余牌必须能组成对子，且对子数量等于三牌组数
  let pairCount = 0;
  for (const card in usedCards) {
    const count = usedCards[card];
    if (count === 0) continue;
    if (count % 2 !== 0) return false; // 必须都是偶数
    pairCount += count / 2;
  }

  return pairCount === groupCount;
}

// 时间戳转日期
export function timestampToDate(timestamp) {
  // 时间戳通常是毫秒级，若为秒级需乘以1000
  const date = new Date(timestamp);

  const year = date.getFullYear();
  // 月份从0开始，需加1
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return {
    year,
    month,
    day,
    date: `${year}-${month}-${day}`
  };
}