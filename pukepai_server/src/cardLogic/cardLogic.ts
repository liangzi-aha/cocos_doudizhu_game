import { _countCards, _getPlaneTriples, _findMaxConsecutiveTriples, _validatePlaneWithout, _validatePlaneWithSingle, _validatePlaneWithPair } from '../utils/tools'

// 斗地主卡牌基础类，判断类型，比较大小

// 牌型之间大小数值的定义
export const CardTypeValue = {
  One: {
    name: "One", // 单张
    value: 1,
  },
  Double: {
    name: "Double", // 对子
    value: 1,
  },
  Three: {
    name: "Three", // 三张
    value: 1,
  },
  ThreeWithOne: {
    name: "ThreeWithOne", // 三带一
    value: 1,
  },
  ThreeWithTwo: {
    name: "ThreeWithTwo", // 三带二
    value: 1,
  },
  Plane: {
    name: "Plane", // 飞机
    value: 1,
  },
  Scroll: {
    name: "Scroll", // 顺子
    value: 1,
  },
  DoubleScroll: {
    name: "DoubleScroll", //连队
    value: 1,
  },
  Boom: {
    name: "Boom", //炸弹
    value: 2,
  },
  kingboom: {
    name: "kingboom", // 王炸
    value: 3,
  },
};

// 卡牌数字大小定义（value越大卡牌的值越大）
export const CardSize = {
  3: 1,
  4: 2,
  5: 3,
  6: 4,
  7: 5,
  8: 6,
  9: 7,
  10: 8,
  11: 9,
  12: 10,
  13: 11,
  1: 12,
  2: 13,
  53: 14, // 小王
  54: 15, // 大王
};


export enum CardType {
  FANGKUAI, // 方块
  MEIHUA, // 梅花
  HONGXIN, // 红桃
  HEITAO, // 黑桃
  KING, // 王
}

/**
 * 获取卡牌点数和类型（0 方块 1 梅花 2 红桃 3 黑桃 4 王）
 * @param cardCount 卡牌序号，1-54，1-13 代表 方块A-K 14-26 代表红桃 A-K 以此类推
 * @returns 
 */
export function getPoint(cardCount) {
  let list = [];
  if (typeof cardCount == 'number') {
    list = [cardCount]
  } else if (Array.isArray(cardCount)) {
    list = cardCount;
  }

  // 校验传进来的数据是否正确
  if (list.every(item => item <= 54 && item >= 1)) {
    return list.map(item => {
      const cardNum = parseInt(item);
      var value = item == 53 || item == 54 ? item : Number(cardNum) % 13 == 0 ? 13 : Number(cardNum) % 13;
      var type = Math.ceil(Number(cardNum) / 13) - 1;
      return {
        value: value, // 牌值 1-13（A-K） 53 大王 54 小王
        type: type, // 牌类型 0 方块 1 梅花 2 红桃 3 黑桃 4 王
        index: type == CardType.KING ? value : (13 * Number(type) + Number(value)), // 卡牌下标 1-54
        cardSize: CardSize[value], // 卡牌大小
      }
    })
  } else {
    []
  }
}


// 问题现在 大王value 为2，小王为1，但是逻辑中没有判断类型，导致 111加小王被识别成了4个1，为炸弹了，需要解决

// 牌逻辑
export default class CardLogic {
  //出一张牌
  static isOneCard(cardList) {
    if (cardList.length === 1) {
      return true;
    }
    return false;
  };

  //是否对子
  static IsDoubleCard(cardList) {
    if (cardList.length != 2) {
      return false;
    }
    if (
      cardList[0].value &&
      cardList[0].value == cardList[1].value
    ) {
      return true;
    }

    return false;
  };

  //三张不带
  static Isthree(cardList) {
    if (cardList.length != 3) {
      return false;
    }
    //判断三张牌是否相等
    if (cardList[0].value != cardList[1].value) {
      return false;
    }

    if (cardList[0].value != cardList[2].value) {
      return false;
    }

    if (cardList[1].value != cardList[2].value) {
      return false;
    }
    return true;
  };

  //三带一
  static IsThreeAndOne(cardList) {
    if (cardList.length != 4) {
      return false;
    }
    if (
      cardList[0].value == cardList[1].value &&
      cardList[1].value == cardList[2].value
    ) {
      return true;
    } else if (
      cardList[1].value == cardList[2].value &&
      cardList[2].value == cardList[3].value
    ) {
      return true;
    }
    return false;
  };

  //三带二
  static IsThreeAndTwo(cardList) {
    if (cardList.length != 5) {
      return false;
    }

    if (
      cardList[0].value == cardList[1].value &&
      cardList[1].value == cardList[2].value
    ) {
      if (cardList[3].value == cardList[4].value) {
        return true;
      }
    } else if (
      cardList[2].value == cardList[3].value &&
      cardList[3].value == cardList[4].value
    ) {
      if (cardList[0].value == cardList[1].value) {
        return true;
      }
    }

    return false;
  };

  //四张炸弹
  static IsBoom(cardList) {
    if (cardList.length != 4) {
      return false;
    }

    const status = cardList.every((item) => item.value == cardList[0].value);

    return status;
  };

  //王炸
  static IsKingBoom(cardList) {
    if (cardList.length != 2) {
      return false;
    }

    // 判断两张牌是否是大小王
    if (
      cardList.every(item => item.type == CardType.KING)
    ) {
      return true;
    }

    return false;
  };

  /**
   * 判断牌型是否为飞机，并返回飞机类型
   * @param {Array} cards - 出牌数组，例如 [3,3,3,4,4,4,5,6]
   * @return {String|null} 'Plane-single'（飞机单带）、'Plane-pair'（飞机双带）、'Plane-nothing'（纯飞机）或 null（非飞机）
   */
  static IsPlan(cards) {
    if (!cards || cards.length < 6) return null;

    // 统计每张牌的数量
    const countMap = _countCards(cards);

    // 提取所有至少有三张的牌，并按牌面值排序
    const possibleTriples = Object.keys(countMap)
      .filter(card => countMap[card] >= 3)
      .map(Number)
      .sort((a, b) => a - b);

    if (possibleTriples.length < 2) return null;

    // 查找最长的连续三张牌组
    const maxConsecutiveTriples = _findMaxConsecutiveTriples(possibleTriples);
    const groupCount = maxConsecutiveTriples.length;

    // 计算总牌数是否符合飞机的三种可能：不带、单带或双带
    const totalCards = cards.length;
    if (totalCards !== groupCount * 3 &&
      totalCards !== groupCount * 4 &&
      totalCards !== groupCount * 5) {
      return null;
    }

    // 验证带牌部分
    if (totalCards === groupCount * 3) {
      return _validatePlaneWithout(countMap, maxConsecutiveTriples) ? 'Plane-nothing' : null; // 飞机不带
    } else if (totalCards === groupCount * 4) {
      return _validatePlaneWithSingle(countMap, maxConsecutiveTriples) ? 'Plane-single' : null; // 飞机带1
    } else {
      return _validatePlaneWithPair(countMap, maxConsecutiveTriples) ? 'Plane-pair' : null; // 飞机带2
    }
  }

  //顺子
  static IsShunzi(cardList) {
    if (cardList.length < 5 || cardList.length > 12) {
      return false;
    }
    var tmp_cards = cardList;
    //不能有2或者大小王
    for (var i = 0; i < tmp_cards.length; i++) {
      if (tmp_cards[i].value == 2 || tmp_cards[i].type == CardType.KING) {
        return false;
      }
    }

    //排序 从小到大
    const sortCard = tmp_cards.sort(function (x, y) {
      return Number(x.cardSize) - Number(y.cardSize);
    });

    for (var i = 0; i < sortCard.length; i++) {
      if (i + 1 == sortCard.length) {
        break;
      }
      var p1 = Number(sortCard[i].cardSize);
      var p2 = Number(sortCard[i + 1].cardSize);
      if (Math.abs(p1 - p2) != 1) {
        return false;
      }
    }

    return true;
  }

  //连队
  static IsLianDui(cardList) {
    console.log("IsLianDui", cardList)
    if (cardList.length < 6 || cardList.length > 24) {
      return false;
    }

    //不能包括大小王,和1、2
    for (var i = 0; i < cardList.length; i++) {
      if (
        cardList[i].value == 2 ||
        cardList[i].type == CardType.KING
      ) {
        return false;
      }
    }

    var map = {};
    for (var i = 0; i < cardList.length; i++) {
      if (map.hasOwnProperty(cardList[i].value)) {
        map[cardList[i].value]++;
      } else {
        map[cardList[i].value] = 1;
      }
    }

    //相同牌只能是2张
    for (var key in map) {
      if (map[key] != 2) {
        return false;
      }
    }
    // 连对至少3张
    var keys = Object.keys(map);
    if (keys.length < 3) {
      return false;
    }
    // 转为卡牌对比值，从小到大排序
    const mapKey = keys.map(item => CardSize[item]).sort(function (x, y) {
      return Number(x) - Number(y);
    });

    console.log("连对", mapKey)

    //对子之间相减绝对值只能是1
    for (var i = 0; i < mapKey.length; i++) {
      if (i + 1 == mapKey.length) {
        break;
      }
      var p1 = Number(mapKey[i]);
      var p2 = Number(mapKey[i + 1]);
      if (Math.abs(p1 - p2) != 1) {
        return false;
      }
    }

    return true;
  };


  //cardB大于cardA返回true
  static compareOne(previousCard, currentCard) {
    console.log("compareOne");

    console.log(CardSize[previousCard[0].value]);
    console.log(CardSize[currentCard[0].value]);

    if (CardSize[previousCard[0].value] >= CardSize[currentCard[0].value]) {
      return false;
    }
    return true;
  };

  // 对子比较大小
  static compareDouble(previousCard, currentCard) {
    console.log("compareDouble");
    var result = this.compareOne(previousCard, currentCard);
    return result;
  };

  // 对比三张
  static compareThree(previousCard, currentCard) {
    console.log("compareThree");
    var result = this.compareOne(previousCard, currentCard);
    return result;
  };

  // 对比炸弹
  static compareBoom(previousCard, currentCard) {
    console.log("compareBoom");
    var result = false;
    if (previousCard.length == 4 && currentCard.length == 4) {
      result = this.compareOne(previousCard, currentCard);
    }

    return result;
  };

  // 王炸
  static compareBoomKing(previousCard, currentCard) {
    return false;
  };

  //三带一大小比较
  static comparePlanWithSing(previousCard, currentCard) {

    //将三带存储到2个列表
    var lista = [];
    var listb = [];
    var map = {};
    for (var i = 0; i < previousCard.length; i++) {
      if (map.hasOwnProperty(previousCard.value)) {
        lista.push(previousCard);
      } else {
        map[previousCard.value] = 1;
      }
    }

    for (var i = 0; i < currentCard.length; i++) {
      if (map.hasOwnProperty(currentCard.value)) {
        listb.push(currentCard);
      } else {
        map[currentCard.value] = 1;
      }
    }

    var result = this.compareOne(previousCard, currentCard);
    return result;
  };

  // 三带二比较大小
  static comparePlanWithTow(previousCard, currentCard) {
    let mapA = {};
    let mapB = {};

    for (var i = 0; i < previousCard.length; i++) {
      if (mapA.hasOwnProperty(previousCard[i].value)) {
        mapA[previousCard[i].value].push(previousCard[i]);
      } else {
        mapA[previousCard[i].value] = [previousCard[i]];
      }
    }
    for (var i = 0; i < currentCard.length; i++) {
      if (mapB.hasOwnProperty(currentCard[i].value)) {
        mapB[currentCard[i].value].push(currentCard[i]);
      } else {
        mapB[currentCard[i].value] = [currentCard[i]];
      }
    }

    var listA = [];
    for (var key in mapA) {
      if (mapA[key].length === 3) {
        listA = mapA[key];
      }
    }

    var listB = [];
    for (var key in mapB) {
      if (mapB[key].length === 3) {
        listB = mapB[key];
      }
    }

    var result = this.compareOne(listA, listB);
    return result;
  };


  /**
   * 判断当前飞机是否能管上上次的飞机 
   * @param {Array} previousCard - 上次出的牌
   * @param {Array} currentCard - 当前出的牌
   * @return {Boolean} 当前飞机是否更大
   */
  static comparePlan(previousCard, currentCard) {
    // 首先判断两次出牌是否都是合法的飞机
    const lastPlane = this.IsPlan(previousCard);
    const currentPlane = this.IsPlan(currentCard);

    if (!lastPlane || !currentPlane) {
      return false; // 至少有一个不是合法飞机
    }

    // 飞机类型必须相同（不带、单带、双带必须一致）
    if (lastPlane !== currentPlane) {
      return false;
    }

    // 获取两次飞机的主体部分（连续的三张牌）
    const lastTriples = _getPlaneTriples(previousCard.map(item => item.value));
    const currentTriples = _getPlaneTriples(currentCard.map(item => item.value));

    // 比较飞机长度
    if (currentTriples.length > lastTriples.length) {
      return true; // 更长的飞机可以管上
    } else if (currentTriples.length < lastTriples.length) {
      return false; // 更短的飞机不能管上
    }

    // 长度相同，比较基准牌面（最小的三张牌的值）
    const lastBaseValue = Math.min(...lastTriples);
    const currentBaseValue = Math.min(...currentTriples);

    return currentBaseValue > lastBaseValue;
  }

  // 比较顺子
  static compareScroll(previousCard, currentCard) {
    console.log("compareScroll");
    if (previousCard.length != currentCard.length) {
      return false;
    }

    // 取连对的最小值对比大小
    var minNumA = 0;
    for (var i = 0; i < previousCard.length; i++) {
      // 获取最小牌
      if (minNumA == 0 || CardSize[previousCard[i].value] < minNumA) {
        minNumA = CardSize[previousCard[i].value];
      }
    }

    var minNumB = 0;
    for (let i = 0; i < currentCard.length; i++) {
      if (minNumB == 0 || CardSize[currentCard[i].value] < minNumB) {
        minNumB = CardSize[currentCard[i].value];
      }
    }

    console.log("min a 卡牌值，不是卡牌序号" + minNumA);
    console.log("min b 卡牌值，不是卡牌序号" + minNumB);
    if (minNumA <= minNumB) {
      return true;
    }

    return false;
  };

  // 对比连队
  static compareDoubleScroll(previousCard, currentCard) {
    var mapA = {};
    var listA = [];
    for (var i = 0; i < previousCard.length; i++) {
      if (!mapA.hasOwnProperty(previousCard[i].value)) {
        mapA[previousCard[i].value] = true;
        listA.push(previousCard[i]);
      }
    }

    var mapB = {};
    var listB = [];
    for (var i = 0; i < currentCard.length; i++) {
      if (!mapB.hasOwnProperty(currentCard[i].value)) {
        mapB[currentCard[i].value] = true;
        listB.push(currentCard[i]);
      }
    }

    console.log("list a = " + JSON.stringify(listA));
    console.log("list b = " + JSON.stringify(listB));

    return this.compareScroll(listA, listB);
  };

  /**
   * 对比两个牌型相同的卡牌大小
   * @param previousCard 上一个玩家出的牌
   * @param currentCard 当前出牌
   * @param cardType 
   * @returns 
   */
  static compare(previousCard, currentCard, cardType) {
    // 卡牌下标转卡牌值
    previousCard = getPoint(previousCard)
    currentCard = getPoint(currentCard)

    var result = false;
    switch (cardType.name) {
      case CardTypeValue.One.name:
        result = this.compareOne(previousCard, currentCard);
        break;
      case CardTypeValue.Double.name:
        result = this.compareDouble(previousCard, currentCard);
        break;
      case CardTypeValue.Three.name:
        result = this.compareThree(previousCard, currentCard);
        break;
      case CardTypeValue.Boom.name:
        result = this.compareBoom(previousCard, currentCard);
        break;
      case CardTypeValue.kingboom.name: // 应该不会走到这一步，因为没有和王炸只有两张
        result = this.compareBoomKing(previousCard, currentCard);
        break;
      case CardTypeValue.ThreeWithOne.name:
        result = this.comparePlanWithSing(previousCard, currentCard)
        break
      case CardTypeValue.ThreeWithTwo.name:
        result = this.comparePlanWithTow(previousCard, currentCard)
        break
      case CardTypeValue.Plane.name:
        result = this.comparePlan(previousCard, currentCard);
        break;
      case CardTypeValue.Scroll.name:
        result = this.compareScroll(previousCard, currentCard);
        break;
      case CardTypeValue.DoubleScroll.name:
        result = this.compareDoubleScroll(previousCard, currentCard);
        break;
      default:
        console.log("no found card value!");
        result = false;
        break;
    }

    return result;
  };

  // 判断卡牌类型
  static judgeCardType(cardList) {
    // 卡牌下标转卡牌值
    cardList = getPoint(cardList)

    if (this.isOneCard(cardList)) {
      console.log("isOneCard sucess");
      return CardTypeValue.One;
    }

    if (this.IsDoubleCard(cardList)) {
      console.log("IsDoubleCard sucess");
      return CardTypeValue.Double;
    }

    if (this.Isthree(cardList)) {
      console.log("Isthree sucess");
      return CardTypeValue.Three;
    }

    if (this.IsBoom(cardList)) {
      console.log("IsBoom sucess");
      return CardTypeValue.Boom;
    }

    if (this.IsThreeAndOne(cardList)) {
      console.log("IsThreeAndOne sucess");
      return CardTypeValue.ThreeWithOne;
    }

    if (this.IsThreeAndTwo(cardList)) {
      console.log("IsThreeAndTwo sucess");
      return CardTypeValue.ThreeWithTwo;
    }

    if (this.IsKingBoom(cardList)) {
      console.log("IsKingBoom sucess");
      return CardTypeValue.kingboom;
    }

    if (this.IsPlan(cardList)) {
      console.log("IsPlan sucess");
      return CardTypeValue.Plane;
    }

    if (this.IsShunzi(cardList)) {
      console.log("IsShunzi sucess");
      return CardTypeValue.Scroll;
    }

    if (this.IsLianDui(cardList)) {
      console.log("IsLianDui sucess");
      return CardTypeValue.DoubleScroll;
    }
    //return false
    return undefined;
  };

  // 比较牌值，是否能管上
  static compareWithCard = function (previousCard, currentCard) {
    // 获取牌类型
    const lastCardType = this.judgeCardType(previousCard);
    const currentCardType = this.judgeCardType(currentCard);

    console.log("lastCardType", lastCardType);
    console.log("currentCardType", currentCardType);
    console.log("previousCard", previousCard);
    console.log("currentCard", currentCard);

    if (!lastCardType || !currentCardType) { // 判断卡牌类型是否正确
      return false;
    } else if (lastCardType.value < currentCardType.value) { // 判断牌类型不同的卡牌值的大小
      return true;
    } else if (previousCard.value == currentCard.value) {
      //牌型必须相同
      if (lastCardType.name != currentCardType.name) {
        return false;
      }

      var result = this.compare(previousCard, currentCard, lastCardType);

      return result;
    } else {
      console.log("牌型不一样管不上")
      return false;
    }
  };
};
