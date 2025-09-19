import cardLogic, { getPoint, CardTypeValue, CardType, CardSize } from "./cardLogic";
import { _countCards, _getPlaneTriples, _findMaxConsecutiveTriples, _validatePlaneWithout, _validatePlaneWithSingle, _validatePlaneWithPair } from '../utils/tools'

// 卡牌提示类
export default class CardHint {
  // 统计各种牌面值的数量
  static countCardValues(cards) {
    const valueMap = new Map();
    cards.forEach(card => {
      if (valueMap.get(card.value)) {
        valueMap.set(card.value, valueMap.get(card.value) + 1)
      } else {
        valueMap.set(card.value, 1)
      }
    });
    return valueMap;
  }

  /**
   * 提示出牌
   * @param playCard 上家出的牌
   * @param userCardList 用户手中的牌
   */
  static cardHint(playCard, userCardList) {
    // 映射出卡牌真实值
    const mapPlayCard = getPoint(playCard);
    const mapUserCardList = getPoint(userCardList);

    console.log("用户手中的牌:", userCardList, mapUserCardList);

    // 判断上家出牌类型
    const cardType = cardLogic.judgeCardType(playCard);
    console.log("上家出牌类型:", cardType);

    // 如果上家没有出牌或者我出的牌其他玩家都不管（自己先手），生成所有可能的出牌组合
    if (!cardType) {
      return this.generateAllPossiblePlays(mapUserCardList);
    }

    // 如果卡牌类型为王炸，无法被管，返回空
    if (cardType.name === CardTypeValue.kingboom.name) {
      return [];
    }

    // 提示卡牌组合
    const hintCardList = [];

    // 处理炸弹和王炸提示（可以大过任何非炸弹牌型）
    if (cardType.name != CardTypeValue.Boom.name) {
      // 检查是否有炸弹
      const booms = this.findBombs(mapUserCardList);
      hintCardList.push(...booms);

      console.log("booms", booms)

      // 检查是否有王炸
      const kingBoom = this.findKingBoom(mapUserCardList);
      if (kingBoom) {
        hintCardList.push(kingBoom);
      }
      console.log("kingBoom", kingBoom)
    }

    // 处理相同牌型的提示
    switch (cardType.name) {
      case CardTypeValue.Boom.name: // 如果上家出的是炸弹，需要更大的炸弹才能管
        // 找到所有比当前炸弹大的炸弹
        const largerBooms = this.findLargerBombs(mapUserCardList, mapPlayCard);
        hintCardList.push(...largerBooms);

        // 王炸可以管任何炸弹
        const kingBoom = this.findKingBoom(mapUserCardList);
        if (kingBoom) {
          hintCardList.push(kingBoom);
        }

        break;
      case CardTypeValue.One.name:
        // 单牌提示
        const singleHints = this.findLargerSingles(mapUserCardList, mapPlayCard);
        hintCardList.push(...singleHints);
        break;

      case CardTypeValue.Double.name:
        // 对子提示
        const doubleHints = this.findLargerDoubles(mapUserCardList, mapPlayCard);
        hintCardList.push(...doubleHints);
        break;

      case CardTypeValue.Three.name:
        // 三张提示
        const threeHints = this.findLargerThrees(mapUserCardList, mapPlayCard);
        hintCardList.push(...threeHints);
        break;

      case CardTypeValue.ThreeWithOne.name:
        // 三带一提示
        const threeWithOneHints = this.findLargerThreeWithOne(mapUserCardList, mapPlayCard);
        hintCardList.push(...threeWithOneHints);
        break;

      case CardTypeValue.ThreeWithTwo.name:
        // 三带二提示
        const threeWithTwoHints = this.findLargerThreeWithTwo(mapUserCardList, mapPlayCard);
        hintCardList.push(...threeWithTwoHints);
        break;

      case CardTypeValue.Scroll.name:
        // 顺子提示
        const scrollHints = this.findLargerScrolls(mapUserCardList, mapPlayCard);
        hintCardList.push(...scrollHints);
        break;

      case CardTypeValue.DoubleScroll.name:
        // 连队提示
        const doubleScrollHints = this.findLargerDoubleScrolls(mapUserCardList, mapPlayCard);
        hintCardList.push(...doubleScrollHints);
        break;

      case CardTypeValue.Plane.name:
        // 飞机提示
        const planeHints = this.findLargerPlanes(mapUserCardList, mapPlayCard);
        hintCardList.push(...planeHints);
        break;
    }

    console.log("hintCardList Fun", hintCardList)

    return hintCardList;
  }

  // 生成机器人先手出牌，不是压牌的情况下，优先顺序，数组是从后面取的，越靠前优先级越低，分别是：顺子>连对>三张>单牌>对子>炸弹>王炸
  static generateAllPossiblePlays(cards) {
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
          const otherCards = cards.filter((c) => c.value != threeCards[0]);

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
              possiblePlays.push([...threeCards.map((c) => c.index), oneCardIndex]);
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
          // console.log("对子");
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

    return possiblePlays.reverse(); // 倒序原因，因为取值的顺序是从数组后面开始的，所以倒序一下（卡牌默认排列就是大的在前，循环时就先取大值了）
  }

  // 查找单牌提示
  static findLargerSingles(userCards, playCards) {
    const playCardValue = playCards[0].value;
    const valueMap = this.countCardValues(userCards);

    const largerSingles = [];
    const multipleCards = [];
    valueMap.forEach((count, value) => {
      // 优先提示单张
      if (CardSize[parseInt(value)] > CardSize[playCardValue] && count == 1) {
        const singleCard = userCards.findLast(c => c.value === parseInt(value));
        // console.log("singleCard", singleCard)
        largerSingles.push([singleCard.index]);
      } else if (CardSize[parseInt(value)] > CardSize[playCardValue] && count > 1) { // 然后提示多张
        const singleCard = userCards.findLast(c => c.value === parseInt(value));
        // console.log("singleCard", singleCard)
        multipleCards.push([singleCard.index]);
      }
    });

    console.log("单张牌提示", largerSingles)
    console.log("多张牌提示", multipleCards)
    console.log("用户卡牌", userCards)
    console.log("上家用户出牌", playCards)

    return [...multipleCards, ...largerSingles];
  }

  // 查找对子提示
  static findLargerDoubles(userCards, playCards) {
    const playCardValue = playCards[0].value;
    const valueMap = this.countCardValues(userCards);

    const largerDoubles = [];
    valueMap.forEach((count, value) => {
      if (CardSize[parseInt(value)] > CardSize[playCardValue] && count >= 2) {
        const pairCards = userCards.filter(c => c.value === parseInt(value)).slice(0, 2);
        largerDoubles.push(pairCards.map(c => c.index));
      }
    });

    return largerDoubles;
  }

  // 查找三张提示
  static findLargerThrees(userCards, playCards) {
    const playCardValue = playCards[0].value;
    const valueMap = this.countCardValues(userCards);

    const largerThrees = [];
    valueMap.forEach((count, value) => {
      if (CardSize[parseInt(value)] > CardSize[playCardValue] && count >= 3) {
        const threeCards = userCards.filter(c => c.value === parseInt(value)).slice(0, 3);
        largerThrees.push(threeCards.map(c => c.index));
      }
    });

    return largerThrees;
  }

  // 查找三带一提示
  static findLargerThreeWithOne(userCards, playCards) {
    const playCardValue = playCards.find(c => {
      const count = playCards.filter(pc => pc.value === c.value).length;
      return count === 3;
    }).value;

    const valueMap = this.countCardValues(userCards);
    const largerThrees = [];

    // 找到所有大于playCardValue的三张
    valueMap.forEach((count, value) => {
      if (CardSize[parseInt(value)] > CardSize[playCardValue] && count >= 3) {
        largerThrees.push(parseInt(value));
      }
    });

    const result = [];
    console.log("largerThrees", largerThrees)
    largerThrees.forEach(threeValue => {
      // 找到三张牌
      const threeCards = userCards.filter(c => c.value === threeValue).slice(0, 3);

      // 找到一张其他牌
      const otherCards = userCards.filter(c => c.value != threeValue);
      if (otherCards.length > 0) {
        let oneCard = ""; // 三带一，带的牌
        // 判断牌中是否有王炸
        const isKingBoom = valueMap.get(53) && valueMap.get(54);

        // 查找是否有单张的牌，优先带一个单张的最小牌
        const filterOneCard = [...valueMap].reduce((accValue, curCalue) => {
          // 判断牌类型，单张
          if (curCalue[1] == 1 && (isKingBoom ? curCalue[0] != 53 && curCalue[0] != 54 : true)) {
            if (accValue) {
              return CardSize[accValue] < CardSize[curCalue[0]] ? accValue : curCalue[0]; // [value, count]
            } else {
              return curCalue[0]; // [value, count]
            }
          } else { // 不符合单张返回上一次结果
            return accValue;
          }
        }, "");

        // 判断排除炸弹和王炸之外的牌带一张最小的(三带一不拆炸弹和王炸的情况下，但最小的一张单排)
        const noBoomCard = [...valueMap].reduce((accValue, curCalue) => {
          // 判处4一样的牌（炸弹）和王炸
          if (curCalue[1] != 4 && (isKingBoom ? curCalue[0] != 53 && curCalue[0] != 54 : true)) {
            if (accValue) {
              return CardSize[accValue] < CardSize[curCalue[0]] ? accValue : curCalue[0]; // [value, count]
            } else { // 不符合单张返回上一次结果
              return accValue;
            }
          } else {
            return accValue;
          }
        }, "");

        // 查找最小的单张牌
        if (filterOneCard) {
          oneCard = filterOneCard;
        } else if (noBoomCard) { // 判断排除炸弹和王炸之外的牌带一张最小的
          oneCard = noBoomCard;
        } else {
          // 取最后一张最小值牌
          oneCard = otherCards[otherCards.length - 1].value;
        }

        console.log("filterOneCard", filterOneCard);
        console.log("noBoomCard", noBoomCard);
        console.log("oneCard", oneCard);
        console.log("otherCards", otherCards);

        // 查找最小的牌的下标
        const oneCardIndex = otherCards.findLast(c => c.value === oneCard).index;

        result.push([...threeCards.map(c => c.index), oneCardIndex]);
      }
    });

    return result;
  }

  // 查找三带二提示
  static findLargerThreeWithTwo(userCards, playCards) {
    const playCardValue = playCards.find(c => {
      const count = playCards.filter(pc => pc.value === c.value).length;
      return count === 3;
    }).value;

    const valueMap = this.countCardValues(userCards);
    const largerThrees = [];

    // 找到所有大于playCardValue的三张
    valueMap.forEach((count, value) => {
      if (CardSize[parseInt(value)] > CardSize[playCardValue] && count >= 3) {
        largerThrees.push(parseInt(value));
      }
    });

    const result = [];
    largerThrees.forEach(threeValue => {
      // 找到三张牌
      const threeCards = userCards.filter(c => c.value === threeValue).slice(0, 3);

      // 找到两张其他对牌(排除三带的牌 和 4张的炸弹 且 牌是对子的)
      const otherValues = [...valueMap].filter(([value, count]) => value != threeValue.toString() && count >= 2 && count != 4).sort((a, b) => CardSize[a[0]] - CardSize[b[0]]);
      if (otherValues.length > 0) {
        for (const [v, c] of otherValues) {
          if (c >= 2) {
            const pairCards = userCards.filter(c => c.value === parseInt(v)).slice(0, 2);
            result.push([...threeCards.map(c => c.index), ...pairCards.map(c => c.index)]);
            break;
          }
        }
      }

      // console.log("threeCards", threeCards)
      // console.log("valueMap", valueMap)
      // console.log("threeValue", threeValue)
    });

    return result;
  }

  // 查找炸弹
  static findBombs(userCards) {
    const valueMap = this.countCardValues(userCards);
    const bombs = [];

    console.log("findBombs valueMap", valueMap)

    valueMap.forEach((count, value) => {
      if (count >= 4) {
        const boomCards = userCards.filter(c => c.value === parseInt(value)).slice(0, 4);
        bombs.push(boomCards.map(c => c.index));
      }
    });

    return bombs;
  }

  // 查找王炸
  static findKingBoom(userCards) {
    const kings = userCards.filter(c => c.type === CardType.KING);
    if (kings.length >= 2) {
      return kings.map(c => c.index);
    }
    return null;
  }

  // 查找比当前炸弹大的炸弹
  static findLargerBombs(userCards, playCards) {
    const playCardValue = playCards[0].value;
    const valueMap = this.countCardValues(userCards);
    const largerBombs = [];

    valueMap.forEach((count, value) => {
      if (CardSize[parseInt(value)] > CardSize[playCardValue] && count >= 4) {
        const boomCards = userCards.filter(c => c.value === parseInt(value)).slice(0, 4);
        largerBombs.push(boomCards.map(c => c.index));
      }
    });

    return largerBombs;
  }

  // 查找顺子提示（简化版，只处理相同长度的顺子）
  static findLargerScrolls(userCards, playCards) {
    const scrollLength = playCards.length;
    const minPlayValue = Math.min(...playCards.map(c => c.value));

    // 对用户手牌按值排序
    const sortedCards = [...userCards].sort((a, b) => a.value - b.value);

    // 寻找可能的顺子
    const possibleScrolls = [];

    for (let i = 0; i <= sortedCards.length - scrollLength; i++) {
      let isValid = true;
      const values: any = new Set();

      for (let j = 0; j < scrollLength; j++) {
        const currentCard = sortedCards[i + j];

        // 不能有2或王
        if (currentCard.value === 2 || currentCard.type === CardType.KING) {
          isValid = false;
          break;
        }

        // 检查是否连续
        if (j > 0) {
          if (currentCard.value != sortedCards[i + j - 1].value + 1) {
            isValid = false;
            break;
          }
        }

        // 检查是否有重复值
        if (values.has(currentCard.value)) {
          isValid = false;
          break;
        }
        values.add(currentCard.value);
      }

      if (isValid && Math.min(...values) > minPlayValue) {
        possibleScrolls.push(sortedCards.slice(i, i + scrollLength).map(c => c.index));
      }
    }

    return possibleScrolls;
  }

  // 查找连队提示（简化版，只处理相同长度的连队）
  static findLargerDoubleScrolls(userCards, playCards) {
    const pairCount = playCards.length / 2;
    const minPlayValue = Math.min(...playCards.map(c => c.value));

    const valueMap = this.countCardValues(userCards);

    // 找出所有对子的值
    const pairs = [...valueMap]
      .filter(([_, count]: any) => count >= 2)
      .map(([value]) => parseInt(value))
      .sort((a, b) => a - b);

    // 寻找可能的连队
    const possibleDoubleScrolls = [];

    for (let i = 0; i <= pairs.length - pairCount; i++) {
      let isValid = true;

      // 检查是否连续
      for (let j = 0; j < pairCount - 1; j++) {
        if (pairs[i + j + 1] != pairs[i + j] + 1) {
          isValid = false;
          break;
        }
      }

      // 检查是否所有对子的值都大于上家出牌的最小值
      if (isValid && pairs[i] > minPlayValue) {
        // 构建连队
        const doubleScroll = [];
        for (let j = 0; j < pairCount; j++) {
          const pairValue = pairs[i + j];
          const pairCards = userCards.filter(c => c.value === pairValue).slice(0, 2);
          doubleScroll.push(...pairCards);
        }
        possibleDoubleScrolls.push(doubleScroll.map(c => c.index));
      }
    }

    return possibleDoubleScrolls;
  }

  // 查找飞机提示（简化版，只处理相同结构的飞机）
  static findLargerPlanes(userCards, playCards) {
    // 首先确定上家飞机的结构
    const planeType = cardLogic.IsPlan(playCards);
    if (!planeType) return [];

    // 获取飞机的主体部分（连续的三张牌）
    const playTriples = _getPlaneTriples(playCards.map(item => item.value));
    const playBaseValue = Math.min(...playTriples);
    const playGroupCount = playTriples.length;

    // 统计用户手牌中各种牌的数量
    const valueMap = this.countCardValues(userCards);

    // 找出所有至少有三张的牌，并按值排序
    const possibleTriples = Object.keys(valueMap)
      .filter(value => valueMap[value] >= 3)
      .map(Number)
      .sort((a, b) => a - b);

    // 找出所有可能的连续三张牌组
    const possiblePlaneTriples = [];

    for (let i = 0; i <= possibleTriples.length - playGroupCount; i++) {
      let isValid = true;

      // 检查是否连续
      for (let j = 0; j < playGroupCount - 1; j++) {
        if (possibleTriples[i + j + 1] != possibleTriples[i + j] + 1) {
          isValid = false;
          break;
        }
      }

      // 检查是否大于上家的飞机
      if (isValid && possibleTriples[i] > playBaseValue) {
        possiblePlaneTriples.push(possibleTriples.slice(i, i + playGroupCount));
      }
    }

    // 根据飞机类型构建完整的飞机牌型
    const result = [];

    possiblePlaneTriples.forEach(triples => {
      // 构建飞机主体
      const planeCards = [];
      triples.forEach(tripleValue => {
        const cards = userCards.filter(c => c.value === tripleValue).slice(0, 3);
        planeCards.push(...cards);
      });

      // 根据飞机类型添加带牌
      if (planeType === 'Plane-nothing') {
        // 纯飞机，不需要带牌
        result.push(planeCards.map(c => c.index));
      } else if (planeType === 'Plane-single') {
        // 飞机带单张
        const neededSingleCount = playGroupCount;
        const availableSingleValues = Object.keys(valueMap)
          .filter(value => !triples.includes(parseInt(value)) && valueMap[value] >= 1)
          .map(Number);

        if (availableSingleValues.length >= neededSingleCount) {
          const singles = availableSingleValues.slice(0, neededSingleCount);
          const singleCards = [];

          singles.forEach(value => {
            const card = userCards.findLast(c => c.value === value);
            singleCards.push(card);
          });

          result.push([...planeCards.map(c => c.index), ...singleCards.map(c => c.index)]);
        }
      } else if (planeType === 'Plane-pair') {
        // 飞机带对子
        const neededPairCount = playGroupCount;
        const availablePairValues = Object.keys(valueMap)
          .filter(value => !triples.includes(parseInt(value)) && valueMap[value] >= 2)
          .map(Number);

        if (availablePairValues.length >= neededPairCount) {
          const pairs = availablePairValues.slice(0, neededPairCount);
          const pairCards = [];

          pairs.forEach(value => {
            const cards = userCards.filter(c => c.value === value).slice(0, 2);
            pairCards.push(...cards);
          });

          result.push([...planeCards.map(c => c.index), ...pairCards.map(c => c.index)]);
        }
      }
    });

    return result;
  }
}
