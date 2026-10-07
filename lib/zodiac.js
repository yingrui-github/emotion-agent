// 黄道十二宫的名字与分类。lib/astro.js 与 components/AstroChart.jsx 共用 ——
// 组件跑在客户端，若从 lib/astro.js 取这几张表，astronomy-engine 会被一起打进浏览器包。

export const SIGNS = [
  "白羊", "金牛", "双子", "巨蟹", "狮子", "处女",
  "天秤", "天蝎", "射手", "摩羯", "水瓶", "双鱼",
];

/** 星座序号 % 4 定元素、% 3 定三分法，所以只需这两张短表。 */
export const ELEMENTS = ["火", "土", "风", "水"];
export const MODALITIES = ["基本", "固定", "变动"];
