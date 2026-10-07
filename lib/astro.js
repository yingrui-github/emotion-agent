// 星盘排盘：把公历生辰 + 出生城市换算成行星、四轴、宫位、相位。
// 对外两个排盘入口：castAstroChart（本命盘）、castTransitChart（行运 / 次限 / 三限）；
// 另外导出 castCrossAspects 与 houseOf 给 lib/synastry.js 做合盘用。
//
// 天体位置交给 astronomy-engine（MIT、零依赖，1700—2200 年区间），但它只给行星，
// 不给宫位和上升点 —— 四轴与 Placidus 宫头在这里自己算。
//
// 两处容易踩的坑，改动时注意：
//   1. 黄经必须取真春分点黄道（ECT）下的视黄经，不能用 Astronomy.Ecliptic()（那是 J2000
//      黄道，1950 年的盘会偏约 0.7°，足以把临界度数的行星推进错的星座）。
//   2. 上升点公式分母前的负号漏掉会让 ASC 差 180°。

import {
  AstroTime,
  Body,
  GeoVector,
  RotateVector,
  Rotation_EQD_ECT,
  Rotation_EQJ_ECT,
  SiderealTime,
  SphereFromVector,
  Vector,
} from "astronomy-engine";

import { CITY_EXAMPLES, matchCity } from "./cities.js";
import { ELEMENTS, MODALITIES, SIGNS } from "./zodiac.js";

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

/** 缺字段时的提示。键的顺序也决定了校验顺序。 */
const FIELD_PROMPTS = {
  birthYear: "请填写出生年份",
  birthMonth: "请填写出生月份",
  birthDay: "请填写出生日期",
};

/** short 是圆图与相位格里只放得下一个字的位置用的 —— ☿ ♄ 这类符号多数人认不出。 */
const PLANETS = [
  { key: "sun", name: "太阳", short: "日", glyph: "☉", body: Body.Sun },
  { key: "moon", name: "月亮", short: "月", glyph: "☽", body: Body.Moon },
  { key: "mercury", name: "水星", short: "水", glyph: "☿", body: Body.Mercury },
  { key: "venus", name: "金星", short: "金", glyph: "♀", body: Body.Venus },
  { key: "mars", name: "火星", short: "火", glyph: "♂", body: Body.Mars },
  { key: "jupiter", name: "木星", short: "木", glyph: "♃", body: Body.Jupiter },
  { key: "saturn", name: "土星", short: "土", glyph: "♄", body: Body.Saturn },
  { key: "uranus", name: "天王星", short: "天", glyph: "♅", body: Body.Uranus },
  { key: "neptune", name: "海王星", short: "海", glyph: "♆", body: Body.Neptune },
  { key: "pluto", name: "冥王星", short: "冥", glyph: "♇", body: Body.Pluto },
];

const ASPECT_TYPES = [
  { name: "合", angle: 0, orb: 8 },
  { name: "六分", angle: 60, orb: 5 },
  { name: "刑", angle: 90, orb: 7 },
  { name: "三分", angle: 120, orb: 7 },
  { name: "冲", angle: 180, orb: 8 },
];

/** 日速低于此值（度/天）视为留 —— 冥王星的地心视速率本来就只有 0.0x，不能定太松。 */
const STATIONARY_SPEED = 0.003;

const TROPICAL_YEAR = 365.24219; // 回归年天数，推运换算「1 年」用它
const LUNAR_MONTH = 27.321582; // 分点月（太阴月）天数，三限法的「1 个月」

/**
 * 行运与推运的三种口径。days 是「1 年」对应的实际天数，null 表示直接取当日天象。
 * 键同时是接口参数与前端 tab 的 key。
 *
 * 三限取通行的那一种：出生后 1 日 = 人生 1 个太阴月，折成「1 年」就是 365.24 / 27.32 ≈ 13.37 天。
 * 另一种写法（1 太阴月 = 1 年，推进速度是它的两倍）通常叫小限，不是这里要的。
 */
export const TRANSIT_MODES = {
  transit: { label: "行运", days: null, note: "取当日当地正午的实际天象" },
  secondary: { label: "次限", days: 1, note: "出生后 1 日 = 1 年" },
  tertiary: {
    label: "三限",
    days: TROPICAL_YEAR / LUNAR_MONTH,
    note: "出生后 1 日 = 1 太阴月（27.32 天）",
  },
};

const D2R = Math.PI / 180;
const sin = (d) => Math.sin(d * D2R);
const cos = (d) => Math.cos(d * D2R);
const tan = (d) => Math.tan(d * D2R);
const asin = (x) => Math.asin(x) / D2R;
const acos = (x) => Math.acos(x) / D2R;
const atan2 = (y, x) => Math.atan2(y, x) / D2R;
const norm360 = (d) => ((d % 360) + 360) % 360;

/** 把角度差折回 (−180, 180]，用于跨 0° 比较。 */
const wrap180 = (d) => ((((d + 540) % 360) + 360) % 360) - 180;

const pad = (n) => String(n).padStart(2, "0");

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 黄经 → 星座、宫内度数。度分都给，页面上显示「双子 26°23′」。 */
function position(lon) {
  const l = norm360(lon);
  // 先把黄经舍入到整分再切星座：直接取整度再算分，29.9995° 会显示成「29°60′」。
  const minutes = Math.round(l * 60) % 21600;
  const index = Math.floor(minutes / 1800);
  const within = minutes - index * 1800;
  return {
    lon: Math.round(l * 1000) / 1000,
    sign: SIGNS[index],
    element: ELEMENTS[index % 4],
    modality: MODALITIES[index % 3],
    degree: `${Math.floor(within / 60)}°${pad(within % 60)}′`,
  };
}

/**
 * 「9:30」式的时间填空。分隔符随便写（: ：时 空格 . 都行），没分隔符时按位数切：
 * 「930」→ 9:30、「0930」→ 09:30、「9」→ 9:00。
 *
 * @returns {{h: number, mi: number} | null} 认不出来返回 null
 */
function parseTime(raw) {
  const text = String(raw ?? "").trim().replace(/\s/g, "");
  const split = /^(\d{1,2})\D+(\d{1,2})\D*$/.exec(text);
  if (split) return { h: Number(split[1]), mi: Number(split[2]) };

  const digits = /^(\d{1,4})[时点]?$/.exec(text)?.[1];
  if (!digits) return null;
  if (digits.length <= 2) return { h: Number(digits), mi: 0 };
  if (digits.length === 3) return { h: Number(digits[0]), mi: Number(digits.slice(1)) };
  return { h: Number(digits.slice(0, 2)), mi: Number(digits.slice(2)) };
}

/**
 * 校验手输的年 / 月 / 日 / 时间。年月日只取数字，所以「1990」「1990年」都认。
 *
 * 没有复用 lib/bazi.js 的 parseBirthFields —— 八字按时辰起点取整，星盘要真实分钟
 * （上升点每 4 分钟走约 1°）。两边语义不同，这处重复是刻意的。
 *
 * @returns {{value: {y:number,m:number,d:number,h:number,mi:number}} | {error: string}}
 */
function parseBirthFields(form) {
  const got = {};
  for (const key of Object.keys(FIELD_PROMPTS)) {
    const digits = String(form?.[key] ?? "").replace(/\D/g, "");
    if (!digits) return { error: FIELD_PROMPTS[key] };
    got[key] = Number(digits);
  }

  const { birthYear: y, birthMonth: m, birthDay: d } = got;

  if (!String(form?.birthTime ?? "").trim()) return { error: "请填写出生时间" };
  const time = parseTime(form.birthTime);
  if (!time) return { error: "出生时间看不懂，写成「9:30」这样？" };
  const { h, mi } = time;

  if (y < MIN_YEAR || y > MAX_YEAR) {
    return { error: `年份需在 ${MIN_YEAR}—${MAX_YEAR} 之间` };
  }
  if (m < 1 || m > 12) return { error: `没有 ${m} 月这个月份` };
  if (d < 1 || d > daysInMonth(y, m)) return { error: `${y} 年 ${m} 月没有 ${d} 号` };
  if (h > 23) return { error: "时用 24 小时制，需在 0—23 之间" };
  if (mi > 59) return { error: "分需在 0—59 之间" };

  return { value: { y, m, d, h, mi } };
}

/** 读某一瞬间在某时区的 UTC 偏移（分钟，东正）。 */
function offsetMinutes(ms, tz) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(ms))
    .find((p) => p.type === "timeZoneName")?.value;

  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  if (!m) return 0; // 只会是 "GMT"，即 UTC+0
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** 读某一瞬间在某时区的墙上时间，用于回环校验。 */
function wallClock(ms, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute") };
}

/**
 * 当地墙上时间 → UTC 瞬间。
 *
 * 不硬编 +8：偏移本身依赖瞬间（中国 1986—1991 年实行过夏令时），所以用「假设偏移 →
 * 求瞬间 → 重读偏移」迭代收敛，转换规则交给系统 tzdata。
 *
 * 夏令时春季前跳会让某个小时根本不存在，迭代在两个值间来回、收不住。所以要做回环校验：
 * 把结果格式化回当地时间与输入比对，不一致就往后挪一小时（业界惯例），并标注出来。
 */
function toInstant({ y, m, d, h, mi }, tz) {
  const naive = Date.UTC(y, m - 1, d, h, mi);
  let ms = naive;
  for (let i = 0; i < 4; i += 1) {
    const next = naive - offsetMinutes(ms, tz) * 60000;
    if (next === ms) break;
    ms = next;
  }

  const back = wallClock(ms, tz);
  const skipped = back.y !== y || back.m !== m || back.d !== d || back.h !== h || back.mi !== mi;
  if (skipped) ms += 3600000;

  return { ms, offset: offsetMinutes(ms, tz), skipped };
}

/**
 * 真黄赤交角：把真赤道（EQD）的北极转进真黄道（ECT）。
 *
 * 天极在黄道坐标里是 (0, sin ε, cos ε)，所以倾角直接由 y / z 得出。y 前面不要加负号 ——
 * ε 变成负值时 MC 看不出异常（公式里只用 cos ε），但 ASC 会整个错掉。
 */
function trueObliquity(t) {
  const z = RotateVector(Rotation_EQD_ECT(t), new Vector(0, 0, 1, t));
  return atan2(z.y, z.z);
}

/** 真春分点黄道下的地心视黄经。 */
function apparentLon(body, t) {
  const v = RotateVector(Rotation_EQJ_ECT(t), GeoVector(body, t, true));
  return norm360(SphereFromVector(v).lon);
}

/** 十行星位置与顺逆。逆行用 ±6 小时的中心差分判断，留态附近无偏。 */
function castPlanets(t) {
  return PLANETS.map((p) => {
    const lon = apparentLon(p.body, t);
    const pos = position(lon);

    // 日月永不逆行，不必算。
    if (p.key === "sun" || p.key === "moon") {
      return { key: p.key, name: p.name, short: p.short, glyph: p.glyph, ...pos, motion: "" };
    }

    const before = apparentLon(p.body, t.AddDays(-0.25));
    const after = apparentLon(p.body, t.AddDays(0.25));
    const speed = wrap180(after - before) / 0.5;

    let motion = "";
    if (Math.abs(speed) < STATIONARY_SPEED) motion = "留";
    else if (speed < 0) motion = "逆";

    return { key: p.key, name: p.name, short: p.short, glyph: p.glyph, ...pos, motion };
  });
}

/** 黄道上某赤经处的黄经。δ 由 λ 唯一决定，所以不需要额外参数。 */
const lonFromRa = (ra, eps) => norm360(atan2(sin(ra), cos(ra) * cos(eps)));

/**
 * 四轴。
 *
 * RAMC 是中天的赤经 —— 格林尼治视恒星时换成度再加东经。ASC 公式分母前那个负号别漏，
 * 漏掉得到的是下降点（差 180°）。
 */
function castAngles(t, eps, lon, lat) {
  const ramc = norm360(SiderealTime(t) * 15 + lon);
  const mc = norm360(atan2(sin(ramc), cos(ramc) * cos(eps)));
  const asc = norm360(atan2(cos(ramc), -(sin(ramc) * cos(eps) + tan(lat) * sin(eps))));
  return { ramc, mc, asc };
}

/**
 * Placidus 宫头：11 / 12 / 2 / 3 宫。
 *
 * 半弧三分法 —— 11 宫头是从中天出发、走完自身昼半弧 1/3 的那个黄道点。半弧又取决于该点
 * 的赤纬，而赤纬取决于要求的黄经本身，是个隐式方程，所以从等分赤经出发迭代。
 *
 * @param {(dsa: number) => number} step 由昼半弧算出相对 RAMC 的赤经增量
 * @returns {number | null} 收敛后的黄经；该纬度下半弧不存在（极昼极夜）时返回 null
 */
function placidusCusp(ramc, eps, lat, startOffset, step) {
  let ra = norm360(ramc + startOffset);

  for (let i = 0; i < 20; i += 1) {
    const dec = asin(sin(eps) * sin(lonFromRa(ra, eps)));
    const cosDsa = -tan(lat) * tan(dec);
    if (Math.abs(cosDsa) > 1) return null;

    const next = norm360(ramc + step(acos(cosDsa)));
    const delta = wrap180(next - ra);
    ra = next;
    if (Math.abs(delta) < 1e-7) return lonFromRa(ra, eps);
  }
  return null;
}

/** 昼半弧 → 相对 RAMC 的赤经增量，依次对应 11 / 12 / 2 / 3 宫。 */
const PLACIDUS_STEPS = [
  { house: 11, start: 30, step: (dsa) => dsa / 3 },
  { house: 12, start: 60, step: (dsa) => (2 * dsa) / 3 },
  { house: 2, start: 120, step: (dsa) => dsa + (180 - dsa) / 3 },
  { house: 3, start: 150, step: (dsa) => dsa + (2 * (180 - dsa)) / 3 },
];

/** Porphyry：把 ASC—MC 的两个象限各三等分。高纬度下 Placidus 无解时的标准退路。 */
function porphyryCusps(asc, mc) {
  const ic = norm360(mc + 180);
  const q1 = norm360(ic - asc); // ASC → IC，中间是 2、3 宫头
  const q2 = norm360(asc - mc); // MC → ASC，中间是 11、12 宫头
  return {
    2: norm360(asc + q1 / 3),
    3: norm360(asc + (2 * q1) / 3),
    11: norm360(mc + q2 / 3),
    12: norm360(mc + (2 * q2) / 3),
  };
}

/**
 * 12 宫头。1 / 4 / 7 / 10 宫就是四轴，11 / 12 / 2 / 3 宫算出来，剩下四宫取对宫。
 *
 * @returns {{system: string, cusps: {house: number, lon: number}[]}}
 */
function castHouses(ramc, eps, lat, asc, mc) {
  let system = "Placidus";
  let solved = {};

  // 极区内昼半弧退化，三分法本身不成立。
  if (Math.abs(lat) > 66) {
    system = "Porphyry";
  } else {
    for (const { house, start, step } of PLACIDUS_STEPS) {
      const lon = placidusCusp(ramc, eps, lat, start, step);
      if (lon === null) {
        system = "Porphyry";
        break;
      }
      solved[house] = lon;
    }
  }

  if (system === "Porphyry") solved = porphyryCusps(asc, mc);

  const base = { 1: asc, 10: mc, ...solved };
  const cusps = [];
  for (let house = 1; house <= 12; house += 1) {
    const lon = base[house] ?? norm360(base[((house + 5) % 12) + 1] + 180);
    cusps.push({ house, ...position(lon) });
  }

  return { system, cusps };
}

/** 某黄经落在第几宫：从该宫头走到下一宫头的弧内即属于它。 */
export function houseOf(lon, cusps) {
  for (let i = 0; i < 12; i += 1) {
    const from = cusps[i].lon;
    const span = norm360(cusps[(i + 1) % 12].lon - from);
    if (norm360(lon - from) < span) return cusps[i].house;
  }
  return 12;
}

/** 两点之间的相位；容许度之外返回 null。相位无向，只看夹角。 */
function aspectBetween(lonA, lonB) {
  const sep = Math.abs(wrap180(lonB - lonA));
  for (const type of ASPECT_TYPES) {
    const orb = sep - type.angle;
    if (Math.abs(orb) <= type.orb) {
      return { type: type.name, orb: Math.round(Math.abs(orb) * 10) / 10 };
    }
  }
  return null;
}

/** 同一张盘内两两配对找相位。紧的排前面。 */
function castAspects(points) {
  const found = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const hit = aspectBetween(points[i].lon, points[j].lon);
      if (hit) found.push({ a: points[i].name, b: points[j].name, ...hit });
    }
  }
  return found.sort((x, y) => x.orb - y.orb);
}

/**
 * 两张盘之间的跨盘相位：A 的每个点配 B 的每个点，跑满矩形。
 *
 * **不要把两个名字排序去做键** —— 两张盘的行星同名，排完序「A太阳×B月亮」和
 * 「A月亮×B太阳」会撞成一个，而它们在合盘里是两回事。`a` 恒为 A 方、`b` 恒为 B 方。
 */
export function castCrossAspects(pointsA, pointsB) {
  const found = [];
  for (const x of pointsA) {
    for (const y of pointsB) {
      const hit = aspectBetween(x.lon, y.lon);
      if (hit) found.push({ a: x.name, b: y.name, ...hit });
    }
  }
  return found.sort((x, y) => x.orb - y.orb);
}

/**
 * 元素 / 三分法分布。口径是十行星各 1 分 + 上升 1 分，共 11 分 ——
 * 和五行力量那张图一样只为看偏向，不等于专业判读。
 */
function distribution(names, items, pick) {
  const scores = Object.fromEntries(names.map((n) => [n, 0]));
  items.forEach((it) => {
    scores[pick(it)] += 1;
  });
  const total = items.length;
  return {
    total,
    items: names.map((name) => ({
      name,
      score: scores[name],
      percent: total ? Math.round((scores[name] / total) * 1000) / 10 : 0,
    })),
    missing: names.filter((name) => scores[name] === 0),
  };
}

/**
 * 某一瞬间、某地的盘面：行星 + 四轴 + 12 宫头。本命与推运共用这一步。
 *
 * 行星的 house 按这张盘自己的宫头给。行运/推运盘要的是「落在本命第几宫」，
 * 由 castTransitChart 用本命宫头另算，不走这里。
 */
function castWheel(t, city) {
  const eps = trueObliquity(t);
  const { ramc, asc, mc } = castAngles(t, eps, city.lon, city.lat);
  const houses = castHouses(ramc, eps, city.lat, asc, mc);
  const planets = castPlanets(t).map((p) => ({ ...p, house: houseOf(p.lon, houses.cusps) }));

  const angles = [
    { key: "asc", name: "上升", short: "升", glyph: "ASC", ...position(asc) },
    { key: "mc", name: "天顶", short: "顶", glyph: "MC", ...position(mc) },
    { key: "dsc", name: "下降", short: "降", glyph: "DSC", ...position(asc + 180) },
    { key: "ic", name: "天底", short: "底", glyph: "IC", ...position(mc + 180) },
  ];

  return { planets, angles, houses };
}

/** UTC+8 / UTC+5.5 这样的时区标签。 */
function timezoneLabel(offsetMin) {
  const hours = offsetMin / 60;
  const abs = Math.abs(hours);
  return `UTC${hours < 0 ? "-" : "+"}${Number.isInteger(abs) ? abs : abs.toFixed(1)}`;
}

/**
 * 排盘主入口。
 *
 * @param {{birthYear: string, birthMonth: string, birthDay: string, birthTime: string,
 *          birthPlace?: string}} form
 * @returns {{chart: object} | {error: string}}
 */
export function castAstroChart(form) {
  const parsed = parseBirthFields(form);
  if (parsed.error) return { error: parsed.error };

  const city = matchCity(form?.birthPlace);
  if (!city) {
    const place = String(form?.birthPlace ?? "").trim();
    return {
      error: place
        ? `没找到「${place}」的坐标，换成最近的大城市（例如${CITY_EXAMPLES.join("、")}）再试？`
        : "请填写出生城市 —— 上升点和宫位都要靠经纬度才能算",
    };
  }

  const { y, m, d, h, mi } = parsed.value;
  const { ms, offset, skipped } = toInstant(parsed.value, city.tz);
  const { planets, angles, houses } = castWheel(new AstroTime(new Date(ms)), city);

  const ascPos = angles[0];
  const scored = [...planets, ascPos];

  return {
    chart: {
      solar: `${y}-${pad(m)}-${pad(d)} ${pad(h)}:${pad(mi)}`,
      timezone: timezoneLabel(offset),
      // 夏令时前跳吃掉的那一小时：用户填的时刻当天不存在，已顺延一小时。
      timeShifted: skipped,
      city,
      bigThree: {
        sun: planets.find((p) => p.key === "sun"),
        moon: planets.find((p) => p.key === "moon"),
        asc: ascPos,
      },
      planets,
      angles,
      houses,
      aspects: castAspects([...planets, angles[0], angles[1]]),
      elements: distribution(ELEMENTS, scored, (it) => it.element),
      modalities: distribution(MODALITIES, scored, (it) => it.modality),
    },
  };
}

/** 「2026-10-04」。日期控件给的就是这个格式，别的格式一律回错。 */
function parseTargetDate(raw) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw ?? "").trim());
  if (!m) return { error: "请选择日期" };

  const value = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  if (value.y < MIN_YEAR || value.y > MAX_YEAR) {
    return { error: `日期需在 ${MIN_YEAR}—${MAX_YEAR} 年之间` };
  }
  if (value.m < 1 || value.m > 12) return { error: "月份不对" };
  if (value.d < 1 || value.d > daysInMonth(value.y, value.m)) return { error: "日期不对" };
  return { value };
}

/**
 * 行运 / 次限 / 三限盘。
 *
 * 三种盘只换「取天象的那个瞬间」，地点一律用出生城市，行星落宫一律按**本命宫头**算 ——
 * 要看的是行运行星打进本命第几宫；而且日期只到天、没有时刻，现算一套行运上升点意义不大。
 *
 * 相位只看这张盘自己的十行星互相，和本命盘同一口径 —— 跨盘的交叉相位有方向、一格两读，
 * 看不懂的人比看懂的多，先不做。
 *
 * @param {object} form 与 castAstroChart 相同的生辰表单
 * @param {{mode: keyof TRANSIT_MODES, date: string}} target 推运方式与目标日期
 * @returns {{chart: object} | {error: string}}
 */
export function castTransitChart(form, { mode, date } = {}) {
  const def = TRANSIT_MODES[mode];
  if (!def) return { error: "未知的推运方式" };

  const parsedDate = parseTargetDate(date);
  if (parsedDate.error) return { error: parsedDate.error };

  const parsed = parseBirthFields(form);
  if (parsed.error) return { error: parsed.error };

  const city = matchCity(form?.birthPlace);
  if (!city) return { error: "出生城市认不出来，重新排一次本命盘？" };

  const birth = toInstant(parsed.value, city.tz);
  // 目标日没有时刻，取当地正午：离一天里任何时刻都不超过 12 小时，月亮的误差最多 7°。
  const noon = toInstant({ ...parsedDate.value, h: 12, mi: 0 }, city.tz);

  // 次限 / 三限：出生后每 def.days 天的天象代表人生 1 年，按年龄等比例折算回那个瞬间。
  const ageYears = (noon.ms - birth.ms) / (TROPICAL_YEAR * 86400000);
  const ms = def.days === null ? noon.ms : birth.ms + ageYears * def.days * 86400000;

  const natal = castWheel(new AstroTime(new Date(birth.ms)), city);
  const planets = castPlanets(new AstroTime(new Date(ms))).map((p) => ({
    ...p,
    house: houseOf(p.lon, natal.houses.cusps),
  }));

  const w = wallClock(ms, city.tz);

  return {
    chart: {
      mode,
      label: def.label,
      note: def.note,
      date: `${parsedDate.value.y}-${pad(parsedDate.value.m)}-${pad(parsedDate.value.d)}`,
      // 实际取天象的瞬间。次限 / 三限下它离目标日期很远，写出来用户才知道盘是怎么来的。
      moment: `${w.y}-${pad(w.m)}-${pad(w.d)} ${pad(w.h)}:${pad(w.mi)} ${timezoneLabel(
        offsetMinutes(ms, city.tz),
      )}`,
      planets,
      aspects: castAspects(planets),
    },
  };
}
