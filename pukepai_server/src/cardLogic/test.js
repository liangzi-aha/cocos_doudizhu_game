const CardSize = {
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

const _countCards = (cards) => {
  const countMap = {};
  cards.forEach((card) => {
    countMap[card] = (countMap[card] || 0) + 1;
  });
  return countMap;
};

const _findMaxConsecutiveTriples = (triples) => {
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

      if (isConsecutive && j - i + 1 > maxLength) {
        maxLength = j - i + 1;
        maxGroup = triples.slice(i, j + 1);
      }
    }
  }

  return maxGroup;
};

// 辅助方法：验证是否为纯飞机（不带牌）
const _validatePlaneWithout = (countMap, triples) => {
  // 所有牌必须恰好是三组连续的牌，没有剩余
  for (const card of triples) {
    if (countMap[card] !== 3) {
      return false;
    }
  }

  // 检查是否有其他牌
  const allCards = Object.keys(countMap).map(Number);
  return allCards.every((card) => triples.includes(card));
};

// 辅助方法：验证是否为飞机三带一
const _validatePlaneWithSingle = (countMap, triples) => {
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
};

// 辅助方法：验证是否为飞机三带二
const _validatePlaneWithPair = (countMap, triples) => {
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
};

function getPoint(cardCount) {
  let list = [];
  if (typeof cardCount == "number") {
    list = [cardCount];
  } else if (Array.isArray(cardCount)) {
    list = cardCount;
  }

  // 校验传进来的数据是否正确
  if (list.every((item) => item <= 54 && item >= 1)) {
    return list.map((item) => {
      const cardNum = parseInt(item);
      var value =
        item == 53 || item == 54
          ? item
          : Number(cardNum) % 13 == 0
          ? 13
          : Number(cardNum) % 13;
      var type = Math.ceil(Number(cardNum) / 13) - 1;
      return {
        value: value, // 牌值 1-13（A-K） 53 大王 54 小王
        type: type, // 牌类型 0 方块 1 梅花 2 红桃 3 黑桃 4 王
        index: type == 4 ? value : 13 * Number(type) + Number(value), // 卡牌下标 1-54
        cardSize: CardSize[value], // 卡牌大小
      };
    });
  } else {
    [];
  }
}

// 统计各种牌面值的数量
function countCardValues(cards) {
  const valueMap = new Map();
  cards.forEach((card) => {
    if (valueMap.get(card.value)) {
      valueMap.set(card.value, valueMap.get(card.value) + 1);
    } else {
      valueMap.set(card.value, 1);
    }
  });
  return valueMap;
}

// 不压牌的情况下，机器人出牌
function generateAllPossiblePlays(cards) {
  let possiblePlays = [];
  const valueMap = this.countCardValues(cards);
  // 判断牌中是否有王炸
  const isKingBoom = valueMap.get(53) && valueMap.get(54);
  // map转数组方便遍历，顺序倒序是为了从小到大排序
  const valueArr = [...valueMap].reverse();

  // ============ 顺子 (只检测单张牌的情况，不进行拆牌)
  const validSingleCards = valueArr
    .filter(
      ([value, count]) => count === 1 && ![2, 14, 15].includes(value) // 过滤单牌且排除2、小王、大王
    )
    .map(([value]) => value)
    .sort((a, b) => CardSize[a] - CardSize[b]); // 按牌面大小排序

  if (validSingleCards.length >= 5) {
    let currentStraight = [validSingleCards[0]]; // 当前顺子组

    // 处理所有连续牌型
    validSingleCards.slice(1).forEach((currentValue, index) => {
      const prevValue = validSingleCards[index];
      const isConsecutive = CardSize[currentValue] - CardSize[prevValue] === 1;

      if (isConsecutive) {
        currentStraight.push(currentValue); // 延续当前顺子
      } else {
        // 断连时检查是否形成有效顺子
        if (currentStraight.length >= 5) {
          addValidStraight(currentStraight);
        }
        currentStraight = [currentValue]; // 开启新顺子检查
      }
    });

    // 检查最后一个顺子组
    if (currentStraight.length >= 5) {
      addValidStraight(currentStraight);
    }
  }

  // 提取公共方法：将顺子转换为牌索引并添加到结果
  function addValidStraight(values) {
    const indices = values.map(
      (value) => cards.find((card) => card.value === value).index
    );
    possiblePlays.push(indices);
  }
  // ============ 顺子

  // ============ 连对
  const pairValues = valueArr
    .filter(([_, count]) => count === 2) // 筛选出对子的数值
    .map(([value]) => value)
    .sort((a, b) => CardSize[a] - CardSize[b]); // 按牌面大小排序

  if (pairValues.length >= 3) {
    // 至少需要3对才能形成连对
    const consecutivePairs = []; // 存储连续连对分组
    let currentGroup = [pairValues[0]]; // 当前连对组

    for (let i = 1; i < pairValues.length; i++) {
      const prevRank = CardSize[pairValues[i - 1]];
      const currRank = CardSize[pairValues[i]];

      if (currRank - prevRank === 1) {
        // 连续牌型（如33-44）
        currentGroup.push(pairValues[i]);
      } else {
        // 断连时处理当前组
        if (currentGroup.length >= 3) {
          // 仅保留长度≥3的连对
          consecutivePairs.push(currentGroup);
        }
        currentGroup = [pairValues[i]]; // 开启新组
      }

      // 处理最后一个元素
      if (i === pairValues.length - 1) {
        if (currentGroup.length >= 3) {
          consecutivePairs.push(currentGroup);
        }
      }
    }

    // 转换为牌索引数组
    consecutivePairs.forEach((group) => {
      const indices = group.flatMap((value) =>
        cards.filter((card) => card.value === value).map((card) => card.index)
      );
      possiblePlays.push(indices);
    });
  }
  // ============ 连对

  // ============ 三张
  valueArr
    .sort((a, b) => CardSize[a[0]] - CardSize[b[0]])
    .forEach(([value, count]) => {
      if (count == 3) {
        const threeCards = cards
          .filter((c) => c.value === parseInt(value))
          .slice(0, 3);

        // 找到一张其他牌
        const otherCards = cards.filter((c) => c.value !== threeCards[0]);

        if (otherCards.length > 0) {
          let card_dai = ""; // 三带一，带的牌
          // 查找是否有单张的牌，优先带一个单张的最小牌
          const filterOneCard = [...valueMap].reduce((accValue, curCalue) => {
            // 判断牌类型，单张
            if (
              curCalue[1] == 1 &&
              (isKingBoom ? curCalue[0] != 53 && curCalue[0] != 54 : true)
            ) {
              if (accValue) {
                return CardSize[accValue] < CardSize[curCalue[0]]
                  ? accValue
                  : curCalue[0]; // [value, count]
              } else {
                return curCalue[0]; // [value, count]
              }
            } else {
              // 不符合单张返回上一次结果
              return accValue;
            }
          }, "");

          // 查找三代二带的牌
          const filterTowCard = [...valueMap].reduce((accValue, curCalue) => {
            // 判断牌类型，单张
            if (curCalue[1] == 2) {
              if (accValue) {
                return CardSize[accValue] < CardSize[curCalue[0]]
                  ? accValue
                  : curCalue[0]; // [value, count]
              } else {
                return curCalue[0]; // [value, count]
              }
            } else {
              // 不符合单张返回上一次结果
              return accValue;
            }
          }, "");

          // 查找最小的单张牌
          if (filterOneCard) {
            card_dai = filterOneCard;
          } else if (filterTowCard) {
            card_dai = filterTowCard;
          }

          if (card_dai) {
            // 查找最小的牌的下标
            const oneCardIndex = otherCards.findLast(
              (c) => c.value === card_dai
            ).index;
            possiblePlays.push([
              ...threeCards.map((c) => c.index),
              oneCardIndex,
            ]);
          } else {
            possiblePlays.push([...threeCards.map((c) => c.index)]);
          }
        } else {
          possiblePlays.push(threeCards.map((c) => c.index));
        }
      }
    });
  // ============ 三张

  // ============ 单牌
  const oneCardListAll = valueArr
    .filter(([value, count]) => {
      if (count == 1 && (isKingBoom ? value != 53 && value != 54 : true)) {
        return true;
      }
    })
    .sort((a, b) => CardSize[a[0]] - CardSize[b[0]]);
  oneCardListAll.forEach(([value, count]) => {
    const pairCards = cards.filter((c) => c.value === parseInt(value));
    possiblePlays.push(pairCards.map((c) => c.index));
  });
  // ============ 单牌

  // ============ 对子
  valueArr
    .sort((a, b) => CardSize[a[0]] - CardSize[b[0]])
    .forEach(([value, count]) => {
      if (count == 2) {
        console.log("对子");
        const pairCards = cards
          .filter((c) => c.value === parseInt(value))
          .slice(0, 2);
        possiblePlays.push(pairCards.map((c) => c.index));
      }
    });
  // ============ 对子

  // ============ 炸弹
  valueArr
    .sort((a, b) => CardSize[a[0]] - CardSize[b[0]])
    .forEach(([value, count]) => {
      if (count == 4) {
        console.log("炸弹");
        const pairCards = cards
          .filter((c) => c.value === parseInt(value))
          .slice(0, 4);
        possiblePlays.push(pairCards.map((c) => c.index));
      }
    });
  // ============ 炸弹

  // ============ 王炸
  if (isKingBoom) {
    console.log("王炸");
    const kingCards = cards.filter((c) => c.value == 54 || c.value == 53);
    possiblePlays.push(kingCards.map((c) => c.index));
  }
  // ============ 王炸

  return possiblePlays.reverse();
}

//顺子
function IsShunzi(cardList) {
  if (cardList.length < 5 || cardList.length > 12) {
    return false;
  }
  var tmp_cards = cardList;
  //不能有2或者大小王
  for (var i = 0; i < tmp_cards.length; i++) {
    if (tmp_cards[i].value == 2 || tmp_cards[i].type == 4) {
      return false;
    }
  }

  //排序 从小到大
  const sortCard = tmp_cards.sort(function (x, y) {
    return Number(x.cardSize) - Number(y.cardSize);
  });

  console.log("tmp_cards", sortCard, tmp_cards);

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

function IsPlan(cards) {
  if (!cards || cards.length < 6) return null;

  // 统计每张牌的数量
  const countMap = _countCards(cards);

  console.log("countMap", countMap);

  // 提取所有至少有三张的牌，并按牌面值排序
  const possibleTriples = Object.keys(countMap)
    .filter((card) => countMap[card] >= 3)
    .map(Number)
    .sort((a, b) => a - b);

  if (possibleTriples.length < 2) return null;

  // 查找最长的连续三张牌组
  const maxConsecutiveTriples = _findMaxConsecutiveTriples(possibleTriples);
  const groupCount = maxConsecutiveTriples.length;

  console.log("maxConsecutiveTriples", maxConsecutiveTriples);
  console.log("groupCount", groupCount);

  // 计算总牌数是否符合飞机的三种可能：不带、单带或双带
  const totalCards = cards.length;
  if (
    totalCards !== groupCount * 3 &&
    totalCards !== groupCount * 4 &&
    totalCards !== groupCount * 5
  ) {
    return null;
  }

  // 验证带牌部分
  if (totalCards === groupCount * 3) {
    return _validatePlaneWithout(countMap, maxConsecutiveTriples)
      ? "Plane-nothing"
      : null; // 飞机不带
  } else if (totalCards === groupCount * 4) {
    return _validatePlaneWithSingle(countMap, maxConsecutiveTriples)
      ? "Plane-single"
      : null; // 飞机带1
  } else {
    return _validatePlaneWithPair(countMap, maxConsecutiveTriples)
      ? "Plane-pair"
      : null; // 飞机带2
  }
}
