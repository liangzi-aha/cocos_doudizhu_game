import { _decorator, Animation, AssetManager, assetManager, director, find, ImageAsset, Node, Sprite, SpriteFrame, Texture2D } from 'cc';
import { RoundBox } from '../Script/UI/RoundBox';
import { AudioType } from './constant';
import CardLogic from './cardLogic';

// 加载远程头像
export const loadRemoteImg = (url: string, node: Node, ext = ".jpg") => {
  assetManager.loadRemote<ImageAsset>(url, { ext: ext }, (err, imageAsset) => {
    if (err) {
      console.error('加载远程图片失败:', err);
      return;
    }
    if (node) {
      const spriteFrame = new SpriteFrame();
      const texture = new Texture2D();
      texture.image = imageAsset;
      spriteFrame.texture = texture;
      node.getComponent(RoundBox).spriteFrame = spriteFrame;
    }
  });
}

// 递归获取子节点
export const findChildByNameRecursive = (parent: Node, name: string): Node => {
  if (parent.name === name) {
    return parent;
  }
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    const result = findChildByNameRecursive(child, name);
    if (result) {
      return result;
    }
  }
  return null;
}

// 根据传入的数组下标，反方向旋转取值
export const reorderArray = (arr, startValue) => {
  const result = [];
  let currentIndex = startValue;
  for (let i = 0; i < arr.length; i++) {
    result.push(arr[currentIndex]);
    currentIndex = (currentIndex - 1 + arr.length) % arr.length;
  }
  return result;
}

// 动画修改为第一帧
export const resetAnimationToFirstFrame = (animationComponent: Animation) => {
  // animationComponent.stop();
  // 获取默认动画的名称
  const defaultClipName = animationComponent.defaultClip?.name;
  console.log("defaultClipName", defaultClipName);
  // 获取默认动画状态
  const clipState = animationComponent.getState(defaultClipName);
  console.log("clipState", clipState);
  if (clipState) {
    // 将动画的当前时间设置为 0，即回到第一帧
    clipState.time = 0;
    // 重新激活动画状态
    clipState.sample();
  }
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


/**
 * 将秒数转换为分钟:秒的格式
 * @param {number} seconds - 总秒数
 * @param {object} options - 配置选项
 * @param {boolean} options.showZeroMinute - 是否显示零分钟 (默认: true)
 * @param {boolean} options.showZeroSecond - 是否显示零秒 (默认: true)
 * @returns {string} 格式化后的时间字符串 (如: "01:30", "5:4", "0:0")
 */
export function secondsToMinuteSecond(seconds, options = {}) {
  // 处理负数或非数值输入
  if (isNaN(seconds) || seconds < 0) {
    return "0:0";
  }

  const { showZeroMinute = true, showZeroSecond = true }: any = options;

  // 计算分钟和秒
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  // 格式化分钟和秒
  let formattedMinutes, formattedSeconds;

  // 分钟格式化
  if (minutes > 0 || showZeroMinute) {
    formattedMinutes = minutes.toString();
  } else {
    formattedMinutes = "";
  }

  // 秒格式化
  if (remainingSeconds > 0 || showZeroSecond) {
    // 小于10的秒补零
    formattedSeconds = remainingSeconds < 10 ?
      `0${remainingSeconds}` :
      remainingSeconds.toString();
  } else {
    formattedSeconds = "";
  }

  // 组合结果
  if (formattedMinutes && formattedSeconds) {
    return `${formattedMinutes}:${formattedSeconds}`;
  } else if (formattedMinutes) {
    return formattedMinutes;
  } else if (formattedSeconds) {
    return formattedSeconds;
  } else {
    return "0:0";
  }
}

// 时间格式转换
export function timestampToDateTime(timestamp) {
  const date = new Date(timestamp);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从 0 开始
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 出牌类型判断，转音频名称
export function playCardAudio(cards) {
  if (cards?.length <= 0) return;
  // AudioType
  if (CardLogic.judgeCardType(cards).name == "One") {
    if (cards[0] == 53) {
      return AudioType.xiaowang;
    } else if (cards[0] == 54) {
      return AudioType.dawang;
    }
    const cardNum = Number(cards[0]) % 13 == 0 ? 13 : Number(cards[0]) % 13
    return AudioType[`one_${cardNum}`];
  } else if (CardLogic.judgeCardType(cards).name == "Double") {
    const cardNum = Number(cards[0]) % 13 == 0 ? 13 : Number(cards[0]) % 13;
    return AudioType[`duizi_${cardNum}`];
  } else if (CardLogic.judgeCardType(cards).name == "Three") {
    return AudioType.sanzhang;
  } else if (CardLogic.judgeCardType(cards).name == "ThreeWithOne") {
    return AudioType.dai_3_1;
  } else if (CardLogic.judgeCardType(cards).name == "ThreeWithTwo") {
    return AudioType.dai_3_2;
  } else if (CardLogic.judgeCardType(cards).name == "Plane") {
    return AudioType.feiji;
  } else if (CardLogic.judgeCardType(cards).name == "Scroll") {
    return AudioType.shunzi;
  } else if (CardLogic.judgeCardType(cards).name == "DoubleScroll") {
    return AudioType.liandui;
  } else if (CardLogic.judgeCardType(cards).name == "Boom") {
    return AudioType.zhadan;
  } else if (CardLogic.judgeCardType(cards).name == "kingboom") {
    return AudioType.wangzha;
  }
}


/**
 * 将对象转换为查询字符串（替代 URLSearchParams.toString()）
 * @param {Object} params - 要转换的参数对象，如 {a:1, b:2}
 * @returns {string} 转换后的查询字符串，如 "a=1&b=2"
 */
export function stringifyParams(params) {
  if (!params || typeof params !== 'object') {
    return '';
  }

  const parts = [];
  for (const key in params) {
    // 跳过原型链上的属性
    if (!Object.prototype.hasOwnProperty.call(params, key)) {
      continue;
    }

    const value = params[key];
    // 处理值为null或undefined的情况
    if (value === null || value === undefined) {
      continue;
    }

    // 对键和值进行编码，处理特殊字符和中文
    const encodedKey = encodeURIComponent(key);
    const encodedValue = encodeURIComponent(value);
    parts.push(`${encodedKey}=${encodedValue}`);
  }

  // 用&连接所有参数对
  return parts.join('&');
}