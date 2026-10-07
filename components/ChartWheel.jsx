// 星盘圆图：外环黄道十二宫，内环 12 宫位，行星按黄经落在环上。
//
// 画法是业界通用的「上升点在左、宫位逆时针」：屏幕角 = 180° + (黄经 − 上升点黄经)，
// SVG 的 y 轴朝下，所以取点时 y 用减号，这样一宫落在左下，与纸质星盘一致。

import { ELEMENTS, SIGNS } from "@/lib/zodiac";

const SIZE = 420;
const C = SIZE / 2;
const R = {
  zodiacOuter: 204,
  zodiacInner: 176,
  // 星座环里侧单独留一圈写宫号，宫头线穿过它，宫号落在每宫弧段的正中。
  houseBand: 152,
  // 圆点标真实黄经，单字可能被推开，所以两者之间牵一条细引线。
  mark: 145,
  planet: 128,
  houseInner: 80,
};

/** 度数写在单字正下方，两者一起错层，避免「这个度数是哪颗星的」。 */
const DEGREE_DROP = 15;
const LEVEL_DROP = 30;

const R_SIGN_LABEL = (R.zodiacInner + R.zodiacOuter) / 2;
const R_HOUSE_LABEL = (R.houseBand + R.zodiacInner) / 2;

/** 行星挨得太近时字会叠在一起，沿环推开到至少差这么多度。 */
const MIN_GAP = 7.5;

const norm360 = (deg) => ((deg % 360) + 360) % 360;

function point(r, screenDeg) {
  const rad = (screenDeg * Math.PI) / 180;
  return [C + r * Math.cos(rad), C - r * Math.sin(rad)];
}

/** 把行星按环上间距推开，返回带 at（显示角）、raw（真实角）与 level（度数标层数）的副本。 */
function spread(planets, asc) {
  const sorted = planets
    .map((p) => ({ ...p, raw: norm360(p.lon - asc) }))
    .sort((a, b) => a.raw - b.raw);

  let prev = -Infinity;
  let level = 0;
  for (const p of sorted) {
    p.at = Math.max(p.raw, prev + MIN_GAP);
    level = p.at - prev < 14 ? (level + 1) % 2 : 0;
    p.level = level;
    prev = p.at;
  }
  return sorted;
}

export default function ChartWheel({ chart, title = "本命星盘", accent, accentFg, elementColor }) {
  const { planets, houses, bigThree } = chart;
  const asc = bigThree.asc.lon;
  const screen = (lon) => 180 + norm360(lon - asc);
  const cusps = houses.cusps;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto w-full max-w-[420px]"
      role="img"
      aria-label={`${title}圆图，上升${bigThree.asc.sign}，${houses.system} 宫位制`}
    >
      {[R.zodiacOuter, R.zodiacInner, R.houseBand, R.houseInner].map((r) => (
        <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="currentColor" strokeWidth="1" className="text-fg/12" />
      ))}

      {/* 外环：十二星座，每格 30°，格内写名字并按元素着色 */}
      {SIGNS.map((sign, i) => {
        const [bx, by] = point(R.zodiacInner, screen(i * 30));
        const [ox, oy] = point(R.zodiacOuter, screen(i * 30));
        const [lx, ly] = point(R_SIGN_LABEL, screen(i * 30 + 15));
        return (
          <g key={sign}>
            <line x1={bx} y1={by} x2={ox} y2={oy} stroke="currentColor" strokeWidth="1" className="text-fg/12" />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="13"
              fill={elementColor[ELEMENTS[i % 4]]}
            >
              {sign}
            </text>
          </g>
        );
      })}

      {/* 宫头线从中心圈穿到星座环，四轴加粗；宫号单独落在宫号环里 */}
      {cusps.map((c, i) => {
        const axis = c.house === 1 || c.house === 4 || c.house === 7 || c.house === 10;
        const [ix, iy] = point(R.houseInner, screen(c.lon));
        const [ox, oy] = point(R.zodiacInner, screen(c.lon));
        const span = norm360(cusps[(i + 1) % 12].lon - c.lon);
        const [nx, ny] = point(R_HOUSE_LABEL, screen(c.lon + span / 2));
        return (
          <g key={c.house}>
            <line
              x1={ix}
              y1={iy}
              x2={ox}
              y2={oy}
              stroke={axis ? accent : "currentColor"}
              strokeWidth={axis ? 1.6 : 0.8}
              className={axis ? undefined : "text-fg/15"}
              strokeDasharray={axis ? undefined : "3 4"}
            />
            <text
              x={nx}
              y={ny}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="13"
              fontWeight={axis ? 600 : 400}
              fill={axis ? accentFg : "currentColor"}
              className={axis ? undefined : "text-fg/55"}
            >
              {c.house}
            </text>
          </g>
        );
      })}

      {/* 四轴标签贴在内环里侧，不占中间 */}
      {chart.angles.map((a) => {
        const [x, y] = point(R.houseInner - 12, screen(a.lon));
        return (
          <text
            key={a.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="12"
            fill={accentFg}
          >
            {a.short}
          </text>
        );
      })}

      {/* 行星：圆点钉在真实黄经上，引线连到被推开的单字，度数写在字下 */}
      {spread(planets, asc).map((p) => {
        const [mx, my] = point(R.mark, screen(asc + p.raw));
        const r = R.planet - p.level * LEVEL_DROP;
        const [lx, ly] = point(r + 9, screen(asc + p.at));
        const [gx, gy] = point(r, screen(asc + p.at));
        const [dx, dy] = point(r - DEGREE_DROP, screen(asc + p.at));
        return (
          <g key={p.key}>
            <line
              x1={mx}
              y1={my}
              x2={lx}
              y2={ly}
              stroke={elementColor[p.element]}
              strokeWidth="0.8"
              opacity="0.4"
            />
            <circle cx={mx} cy={my} r="2.6" fill={elementColor[p.element]} />
            <text
              x={gx}
              y={gy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fill={elementColor[p.element]}
            >
              {p.short}
            </text>
            <text
              x={dx}
              y={dy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="9"
              fill="currentColor"
              className="text-fg/40"
            >
              {Math.floor(p.lon % 30)}°{p.motion === "逆" ? "逆" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
