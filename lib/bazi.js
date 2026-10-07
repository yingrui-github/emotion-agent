// 八字排盘：把公历生辰换算成四柱与大运。
//
// 历法部分（节气、干支、藏干、十神）交给 lunar-javascript，它无第三方依赖，
// 年柱按立春换岁、月柱按节气换月。这里只负责三件事：
//   1. 校验用户填的年 / 月 / 日 与选的时辰
//   2. 把排盘结果组织成页面好渲染的结构
//   3. 输入不合法时给出人话错误
//
// 注意：按整点排盘（分钟计 0），也未做出生地的真太阳时校正 —— 出生地只作记录。

import { LunarUtil, Solar } from "lunar-javascript";

const GENDER_CODE = { 男: 1, 女: 0 };

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

/** 大运取前 8 步，够看到 80 岁左右。 */
const DA_YUN_STEPS = 8;

/** 流年取当前年份前后这个范围，用于近期运势解读。 */
const LIU_NIAN_BACK = 1;
const LIU_NIAN_FORWARD = 2;

const WU_XING = ["木", "火", "土", "金", "水"];

/** 五行相生：key 生 value。 */
const SHENG = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };

/** 生我者 —— 与日主五行一起构成「同类」（比劫 + 印）。 */
const SHENG_ME = Object.fromEntries(Object.entries(SHENG).map(([a, b]) => [b, a]));

/** 藏干按本气 / 中气 / 余气递减计分（ZHI_HIDE_GAN 就是这个顺序）。 */
const HIDE_GAN_WEIGHTS = [1, 0.4, 0.2];

/** 月支当令，对旺衰的影响最大，整柱加权。 */
const MONTH_PILLAR_WEIGHT = 1.5;

/** 同类占比的强弱分界。 */
const STRONG_AT = 0.55;
const WEAK_AT = 0.45;

/** 缺字段时的提示。键的顺序也决定了校验顺序。 */
const FIELD_PROMPTS = {
  birthYear: "请填写出生年份",
  birthMonth: "请填写出生月份",
  birthDay: "请填写出生日期",
  birthHour: "请选择出生时辰",
};

const pad = (n, width = 2) => String(n).padStart(width, "0");

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 校验手输的年 / 月 / 日 与下拉选的时辰。只取数字，所以「1990」「1990年」都认。
 *
 * @returns {{value: {y:number,m:number,d:number,h:number}} | {error: string}}
 */
export function parseBirthFields(form) {
  const got = {};
  for (const key of Object.keys(FIELD_PROMPTS)) {
    const digits = String(form?.[key] ?? "").replace(/\D/g, "");
    if (!digits) return { error: FIELD_PROMPTS[key] };
    got[key] = Number(digits);
  }

  const { birthYear: y, birthMonth: m, birthDay: d, birthHour: h } = got;

  if (y < MIN_YEAR || y > MAX_YEAR) {
    return { error: `年份需在 ${MIN_YEAR}—${MAX_YEAR} 之间` };
  }
  if (m < 1 || m > 12) return { error: `没有 ${m} 月这个月份` };
  if (d < 1 || d > daysInMonth(y, m)) {
    return { error: `${y} 年 ${m} 月没有 ${d} 号` };
  }
  if (h > 23) return { error: "时用 24 小时制，需在 0—23 之间" };

  return { value: { y, m, d, h } };
}

/**
 * 统计五行力量与身强身弱。
 *
 * 天干各计 1 分，地支按藏干的本气 / 中气 / 余气递减计分，月柱整体加权（月支当令）。
 * 「同类」= 日主五行（比劫）+ 生日主的五行（印），同类占比决定身强身弱。
 *
 * 这是常见的加权计分法，够支撑解读用，但不等于专业命理的旺衰判定 ——
 * 后者还要看调候、通根、刑冲合化，这里没做。
 */
function analyzeWuXing(pillars, dayMasterWuXing) {
  const scores = Object.fromEntries(WU_XING.map((w) => [w, 0]));

  pillars.forEach((p) => {
    const pillarWeight = p.label === "月柱" ? MONTH_PILLAR_WEIGHT : 1;
    if (scores[p.ganWuXing] !== undefined) {
      scores[p.ganWuXing] += pillarWeight;
    }
    p.hideGan.forEach((h, j) => {
      const w = HIDE_GAN_WEIGHTS[j] ?? 0;
      if (scores[h.wuXing] !== undefined) {
        scores[h.wuXing] += w * pillarWeight;
      }
    });
  });

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const percentOf = (score) => (total ? Math.round((score / total) * 1000) / 10 : 0);

  const supportNames = [dayMasterWuXing, SHENG_ME[dayMasterWuXing]].filter(Boolean);
  const supportScore = supportNames.reduce((sum, name) => sum + (scores[name] ?? 0), 0);
  const supportPercent = percentOf(supportScore);

  let strength = "中和";
  if (supportPercent >= STRONG_AT * 100) strength = "偏强";
  else if (supportPercent <= WEAK_AT * 100) strength = "偏弱";

  return {
    total: Math.round(total * 10) / 10,
    items: WU_XING.map((name) => ({
      name,
      score: Math.round(scores[name] * 10) / 10,
      percent: percentOf(scores[name]),
    })),
    missing: WU_XING.filter((name) => scores[name] === 0),
    support: { names: supportNames, percent: supportPercent },
    strength,
  };
}

/**
 * 十神按「比劫 → 食伤 → 财 → 官杀 → 印」分组，每组两个（阳/阴之别），
 * 组内五行相同。五行由日主推出：食伤是我生，财是我克（= 沿相生走两步），
 * 官杀是克我，印是生我 —— 所以不用查表，也不依赖盘里是否真出现过这个十神。
 */
const SHI_SHEN_GROUPS = [
  { names: ["比肩", "劫财"], wuXing: (dm) => dm },
  { names: ["食神", "伤官"], wuXing: (dm) => SHENG[dm] },
  { names: ["偏财", "正财"], wuXing: (dm) => SHENG[SHENG[dm]] },
  { names: ["七杀", "正官"], wuXing: (dm) => SHENG_ME[SHENG_ME[dm]] },
  { names: ["偏印", "正印"], wuXing: (dm) => SHENG_ME[dm] },
];

const SHI_SHEN_ORDER = SHI_SHEN_GROUPS.flatMap((g) => g.names);

/**
 * 统计十神占比。
 *
 * 计分口径与 analyzeWuXing 完全一致（天干 1 分、藏干本气/中气/余气递减、月柱加权），
 * 只是把分数按十神而不是五行归堆，两张图才能横向对照。
 * 日干是十神的参照物、本身不算十神，所以日柱天干不计分（它的 shiShen 是「日主」，被过滤掉）。
 */
function analyzeShiShen(pillars, dayMasterWuXing) {
  const scores = Object.fromEntries(SHI_SHEN_ORDER.map((name) => [name, 0]));

  const add = (name, score) => {
    if (scores[name] !== undefined) scores[name] += score;
  };

  pillars.forEach((p) => {
    const pillarWeight = p.label === "月柱" ? MONTH_PILLAR_WEIGHT : 1;
    add(p.shiShen, pillarWeight);
    p.hideGan.forEach((h, j) => add(h.shiShen, (HIDE_GAN_WEIGHTS[j] ?? 0) * pillarWeight));
  });

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const wuXingOf = Object.fromEntries(
    SHI_SHEN_GROUPS.flatMap((g) => g.names.map((name) => [name, g.wuXing(dayMasterWuXing) ?? ""])),
  );

  return {
    total: Math.round(total * 10) / 10,
    items: SHI_SHEN_ORDER.map((name) => ({
      name,
      wuXing: wuXingOf[name],
      score: Math.round(scores[name] * 10) / 10,
      percent: total ? Math.round((scores[name] / total) * 1000) / 10 : 0,
    })),
  };
}

/** 取一柱的全部信息。prefix 对应 lunar-javascript 的 Year/Month/Day/Time。 */
function buildPillar(ec, prefix, label) {
  const gan = ec[`get${prefix}Gan`]();
  const zhi = ec[`get${prefix}Zhi`]();
  return {
    label,
    ganZhi: ec[`get${prefix}`](),
    gan,
    zhi,
    ganWuXing: LunarUtil.WU_XING_GAN[gan] ?? "",
    zhiWuXing: LunarUtil.WU_XING_ZHI[zhi] ?? "",
    hideGan: ec[`get${prefix}HideGan`]().map((gan, i) => ({
      gan,
      wuXing: LunarUtil.WU_XING_GAN[gan] ?? "",
      shiShen: ec[`get${prefix}ShiShenZhi`]()[i],
    })),
    naYin: ec[`get${prefix}NaYin`](),
    shiShen: ec[`get${prefix}ShiShenGan`](),
    diShi: ec[`get${prefix}DiShi`](),
    xunKong: ec[`get${prefix}XunKong`](),
  };
}

/**
 * 排盘主入口。
 *
 * @param {{birthYear: string, birthMonth: string, birthDay: string,
 *          birthHour: string, gender: string, birthPlace?: string}} form
 * @returns {{chart: object} | {error: string}}
 */
export function castBaziChart(form) {
  const parsed = parseBirthFields(form);
  if (parsed.error) return { error: parsed.error };

  const genderText = String(form.gender ?? "").trim();
  const genderCode = GENDER_CODE[genderText];
  if (genderCode === undefined) {
    return { error: "请选择性别 —— 大运的顺行还是逆行由性别决定" };
  }

  const { y, m, d, h } = parsed.value;
  const lunar = Solar.fromYmdHms(y, m, d, h, 0, 0).getLunar();
  const ec = lunar.getEightChar();
  const dayGan = ec.getDayGan();

  const pillars = [
    buildPillar(ec, "Year", "年柱"),
    buildPillar(ec, "Month", "月柱"),
    buildPillar(ec, "Day", "日柱"),
    buildPillar(ec, "Time", "时柱"),
  ];

  const yun = ec.getYun(genderCode);
  const nowYear = new Date().getFullYear();

  // 第 0 步是起运前的小运（干支为空），跳掉。
  const daYunSteps = yun
    .getDaYun()
    .filter((step) => step.getGanZhi())
    .slice(0, DA_YUN_STEPS);

  const daYun = daYunSteps.map((step) => ({
    ganZhi: step.getGanZhi(),
    shiShen: LunarUtil.SHI_SHEN[dayGan + step.getGanZhi()[0]] ?? "",
    startAge: step.getStartAge(),
    endAge: step.getEndAge(),
    startYear: step.getStartYear(),
    endYear: step.getEndYear(),
    current: nowYear >= step.getStartYear() && nowYear <= step.getEndYear(),
  }));

  // 近几年流年。要跨大运边界收集 —— 某一步大运只含它自己那 10 年的流年，
  // 如果今年正好卡在一步的末尾，只问这一步就会漏掉后面的年份。
  const liuNianFrom = nowYear - LIU_NIAN_BACK;
  const liuNianTo = nowYear + LIU_NIAN_FORWARD;
  const liuNian = daYunSteps
    .filter((step) => step.getEndYear() >= liuNianFrom && step.getStartYear() <= liuNianTo)
    .flatMap((step) => step.getLiuNian())
    .filter((ln) => ln.getYear() >= liuNianFrom && ln.getYear() <= liuNianTo)
    .map((ln) => ({
      year: ln.getYear(),
      age: ln.getAge(),
      ganZhi: ln.getGanZhi(),
      shiShen: LunarUtil.SHI_SHEN[dayGan + ln.getGanZhi()[0]] ?? "",
      current: ln.getYear() === nowYear,
    }));

  const dayMasterWuXing = LunarUtil.WU_XING_GAN[dayGan] ?? "";

  return {
    chart: {
      solar: `${y}-${pad(m)}-${pad(d)} ${pad(h)}:00`,
      lunar: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      shengXiao: lunar.getYearShengXiao(),
      gender: genderText,
      birthPlace: String(form.birthPlace ?? "").trim(),
      eightChar: pillars.map((p) => p.ganZhi).join(" "),
      dayMaster: { gan: dayGan, wuXing: dayMasterWuXing },
      pillars,
      wuXing: analyzeWuXing(pillars, dayMasterWuXing),
      shiShen: analyzeShiShen(pillars, dayMasterWuXing),
      qiYun: {
        after: `${yun.getStartYear()} 年 ${yun.getStartMonth()} 个月 ${yun.getStartDay()} 天`,
        solar: yun.getStartSolar().toYmd(),
      },
      daYun,
      liuNian,
      // 解读用：模型得知道「现在」是什么时候才能谈近期运势。
      now: { year: nowYear, age: nowYear - y + 1 },
    },
  };
}
