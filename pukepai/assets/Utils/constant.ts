

// 甜美女生音频地址
const sweetGirlAudio = "RoomAudio/Girl/";
// 当前用户使用的音频包名，后期如果想做多个的话可以修改
export const audioPageageName = "sweetGirlAudio";
// 胜利音频
export const gameOverSuccessAudio = "RoomAudio/success";
// 失败音频
export const gameOverLoseAudio = "RoomAudio/lose";

export enum AudioType {
  duizi_1 = "duizi_1",
  duizi_2 = "duizi_2",
  duizi_3 = "duizi_3",
  duizi_4 = "duizi_4",
  duizi_5 = "duizi_5",
  duizi_6 = "duizi_6",
  duizi_7 = "duizi_7",
  duizi_8 = "duizi_8",
  duizi_9 = "duizi_9",
  duizi_10 = "duizi_10",
  duizi_11 = "duizi_11",
  duizi_12 = "duizi_12",
  duizi_13 = "duizi_13",
  one_1 = "one_1",
  one_2 = "one_2",
  one_3 = "one_3",
  one_4 = "one_4",
  one_5 = "one_5",
  one_6 = "one_6",
  one_7 = "one_7",
  one_8 = "one_8",
  one_9 = "one_9",
  one_10 = "one_10",
  one_11 = "one_11",
  one_12 = "one_12",
  one_13 = "one_13",
  shunzi = "shunzi",
  liandui = "liandui",
  feiji = "feiji",
  dai_3_1 = "dai_3_1",
  dai_3_2 = "dai_3_2",
  zhadan = "zhadan",
  wangzha = "wangzha",
  buyao = "buyao",
  yaobuqi = "yaobuqi",
  sanzhang = "sanzhang",
  xiaowang = "xiaowang",
  dawang = "dawang",
  mingpai = "mingpai",
  bujiabei = "bujiabei",
  jiabei = "jiabei",
  chaojijiabei = "chaojijiabei",
  qiangdizhu = "qiangdizhu",
  buqiang = "buqiang",
}

export const playAudios = {
  // 甜美女生音频（后期可以添加多种语音，key必须一致）
  "sweetGirlAudio": {
    [AudioType.duizi_1]: sweetGirlAudio + AudioType.duizi_1,
    [AudioType.duizi_2]: sweetGirlAudio + AudioType.duizi_2,
    [AudioType.duizi_3]: sweetGirlAudio + AudioType.duizi_3,
    [AudioType.duizi_4]: sweetGirlAudio + AudioType.duizi_4,
    [AudioType.duizi_5]: sweetGirlAudio + AudioType.duizi_5,
    [AudioType.duizi_6]: sweetGirlAudio + AudioType.duizi_6,
    [AudioType.duizi_7]: sweetGirlAudio + AudioType.duizi_7,
    [AudioType.duizi_8]: sweetGirlAudio + AudioType.duizi_8,
    [AudioType.duizi_9]: sweetGirlAudio + AudioType.duizi_9,
    [AudioType.duizi_10]: sweetGirlAudio + AudioType.duizi_10,
    [AudioType.duizi_11]: sweetGirlAudio + AudioType.duizi_11,
    [AudioType.duizi_12]: sweetGirlAudio + AudioType.duizi_12,
    [AudioType.duizi_13]: sweetGirlAudio + AudioType.duizi_13,
    [AudioType.one_1]: sweetGirlAudio + AudioType.one_1,
    [AudioType.one_2]: sweetGirlAudio + AudioType.one_2,
    [AudioType.one_3]: sweetGirlAudio + AudioType.one_3,
    [AudioType.one_4]: sweetGirlAudio + AudioType.one_4,
    [AudioType.one_5]: sweetGirlAudio + AudioType.one_5,
    [AudioType.one_6]: sweetGirlAudio + AudioType.one_6,
    [AudioType.one_7]: sweetGirlAudio + AudioType.one_7,
    [AudioType.one_8]: sweetGirlAudio + AudioType.one_8,
    [AudioType.one_9]: sweetGirlAudio + AudioType.one_9,
    [AudioType.one_10]: sweetGirlAudio + AudioType.one_10,
    [AudioType.one_11]: sweetGirlAudio + AudioType.one_11,
    [AudioType.one_12]: sweetGirlAudio + AudioType.one_12,
    [AudioType.one_13]: sweetGirlAudio + AudioType.one_13,
    [AudioType.shunzi]: sweetGirlAudio + AudioType.shunzi,
    [AudioType.liandui]: sweetGirlAudio + AudioType.liandui,
    [AudioType.feiji]: sweetGirlAudio + AudioType.feiji,
    [AudioType.dai_3_1]: sweetGirlAudio + AudioType.dai_3_1,
    [AudioType.dai_3_2]: sweetGirlAudio + AudioType.dai_3_2,
    [AudioType.zhadan]: sweetGirlAudio + AudioType.zhadan,
    [AudioType.wangzha]: sweetGirlAudio + AudioType.wangzha,
    [AudioType.buyao]: sweetGirlAudio + AudioType.buyao,
    [AudioType.yaobuqi]: sweetGirlAudio + AudioType.yaobuqi,
    [AudioType.sanzhang]: sweetGirlAudio + AudioType.sanzhang,
    [AudioType.xiaowang]: sweetGirlAudio + AudioType.xiaowang,
    [AudioType.dawang]: sweetGirlAudio + AudioType.dawang,
    [AudioType.mingpai]: sweetGirlAudio + AudioType.mingpai,
    [AudioType.bujiabei]: sweetGirlAudio + AudioType.bujiabei,
    [AudioType.jiabei]: sweetGirlAudio + AudioType.jiabei,
    [AudioType.chaojijiabei]: sweetGirlAudio + AudioType.chaojijiabei,
    [AudioType.qiangdizhu]: sweetGirlAudio + AudioType.qiangdizhu,
    [AudioType.buqiang]: sweetGirlAudio + AudioType.buqiang,
  }
}


export const GameModel = {
  0: "创建模式",
  1: "匹配模式",
  3: "人机模式", // 后续看看能不能添加
}