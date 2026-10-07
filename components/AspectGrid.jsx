// 相位矩阵，两种形状：
//
// 不传 cols —— 阶梯形。行列是同一组点，名字沿对角线落在每列顶上，左边各格是它与前面各点的
// 相位。同一张盘内相位无向，所以一格一个字，查表键把两个名字排个序即可。
// 本命盘的行列是十行星 + 天顶 + 上升；行运/推运盘只有十行星（不另排行运四轴）。
//
// 传了 cols —— 矩形。行是 points、列是 cols，用于两张盘之间的跨盘相位（合盘）。
// 两张盘的行星同名，所以键**不能排序**，`${行}|${列}` 本身就是方向。

"use client";

/**
 * 相位格里一格只放一个字：三分相口语叫「拱」，六分相简作「六」。
 * tone 决定颜色 —— 刑冲是紧张相，六分三分是和谐相，合位于两者之间，用主色。
 */
const ASPECTS = [
  { type: "合", short: "合", angle: 0 },
  { type: "六分", short: "六", angle: 60, tone: "soft" },
  { type: "刑", short: "刑", angle: 90, tone: "hard" },
  { type: "三分", short: "拱", angle: 120, tone: "soft" },
  { type: "冲", short: "冲", angle: 180, tone: "hard" },
];

const TONE_COLOR = { soft: "var(--el-air)", hard: "var(--el-fire)" };

const ASPECT_BY_TYPE = new Map(ASPECTS.map((a) => [a.type, a]));

const headCell = `h-8 w-8 border border-fg/[.07] bg-fg/[.05] text-center
                  text-xs font-normal text-fg/55`;

export default function AspectGrid({
  points,
  aspects,
  accent,
  accentFg,
  cols,
  rowPrefix = "",
  colPrefix = "",
}) {
  const colorOf = (aspect) => (aspect.tone ? TONE_COLOR[aspect.tone] : accentFg);
  const rect = Boolean(cols);
  const keyOf = rect ? (a, b) => `${a}|${b}` : (a, b) => [a, b].sort().join("|");
  const at = new Map(aspects.map((x) => [keyOf(x.a, x.b), x]));

  if (aspects.length === 0) {
    return <p className="text-sm text-fg/45">容许度内没有成相的组合。</p>;
  }

  const cell = (row, col) => {
    const hit = at.get(keyOf(row.name, col.name));
    const aspect = hit && ASPECT_BY_TYPE.get(hit.type);
    return (
      <td
        key={col.key}
        className="h-8 w-8 border border-fg/[.07] text-center align-middle"
        style={aspect ? { background: `${accent}0d` } : undefined}
      >
        {aspect && (
          <span
            className="text-xs"
            style={{ color: colorOf(aspect) }}
            title={`${rowPrefix}${row.name} ${hit.type} ${colPrefix}${col.name} · 容许度 ${hit.orb}°`}
          >
            {aspect.short}
          </span>
        )}
      </td>
    );
  };

  /** 行首的名字。阶梯形第一行没有格子，写了名字反而像漏了一格。 */
  const rowHead = (row, blank) => (
    <th
      scope="row"
      title={`${rowPrefix}${row.name} ${row.sign}${row.degree}`}
      className="h-8 w-9 pr-1 text-right text-xs font-normal text-fg/40"
    >
      {blank ? "" : row.short}
    </th>
  );

  return (
    <>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <caption className="sr-only">
            {rect
              ? "跨盘相位矩阵，行是一方的点、列是另一方的点，交点标出两点之间的相位"
              : "相位矩阵，左侧与对角线是各点的名字，行列交点标出两点之间的相位"}
          </caption>
          {rect && (
            <thead>
              <tr>
                <th className="h-8 w-9" />
                {cols.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    title={`${colPrefix}${col.name} ${col.sign}${col.degree}`}
                    className={headCell}
                  >
                    {col.short}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {points.map((row, i) => (
              <tr key={row.key}>
                {/* 左侧行名：一行一眼能认出是谁的相位，不用沿阶梯找到行尾 */}
                {rowHead(row, !rect && i === 0)}
                {rect ? (
                  cols.map((col) => cell(row, col))
                ) : (
                  <>
                    {points.slice(0, i).map((col) => cell(row, col))}
                    {/* 阶梯形：对角线那格当这一列的列名 */}
                    <th
                      scope="col"
                      title={`${row.name} ${row.sign}${row.degree}`}
                      className={headCell}
                    >
                      {row.short}
                    </th>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg/35">
        {ASPECTS.map((a) => (
          <span key={a.type}>
            <span className="mr-1" style={{ color: colorOf(a) }}>
              {a.short}
            </span>
            {a.type} {a.angle}°
          </span>
        ))}
      </div>
    </>
  );
}
