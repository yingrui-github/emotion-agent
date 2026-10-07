// 出生城市 → 经纬度与时区。星盘的上升点和宫位都依赖这两样，不给坐标就没法排盘。
//
// 不接在线地理编码：排盘只需要市一级精度（市中心与郊区相差几十公里，上升点差不到 0.1°），
// 一张内置表就够，还省掉网络失败这条路径。
//
// 经度东正西负。内地一律 Asia/Shanghai —— 包括乌鲁木齐，当地出生证明上的时间是北京时。

const CITIES = [
  // 直辖市
  { name: "北京", lon: 116.41, lat: 39.9, tz: "Asia/Shanghai" },
  { name: "上海", lon: 121.47, lat: 31.23, tz: "Asia/Shanghai" },
  { name: "天津", lon: 117.2, lat: 39.13, tz: "Asia/Shanghai" },
  { name: "重庆", lon: 106.55, lat: 29.56, tz: "Asia/Shanghai" },

  // 省会 / 首府
  { name: "石家庄", lon: 114.51, lat: 38.04, tz: "Asia/Shanghai" },
  { name: "太原", lon: 112.55, lat: 37.87, tz: "Asia/Shanghai" },
  { name: "呼和浩特", lon: 111.75, lat: 40.84, tz: "Asia/Shanghai" },
  { name: "沈阳", lon: 123.43, lat: 41.8, tz: "Asia/Shanghai" },
  { name: "长春", lon: 125.32, lat: 43.82, tz: "Asia/Shanghai" },
  { name: "哈尔滨", lon: 126.53, lat: 45.8, tz: "Asia/Shanghai" },
  { name: "南京", lon: 118.78, lat: 32.06, tz: "Asia/Shanghai" },
  { name: "杭州", lon: 120.16, lat: 30.27, tz: "Asia/Shanghai" },
  { name: "合肥", lon: 117.28, lat: 31.86, tz: "Asia/Shanghai" },
  { name: "福州", lon: 119.3, lat: 26.08, tz: "Asia/Shanghai" },
  { name: "南昌", lon: 115.89, lat: 28.68, tz: "Asia/Shanghai" },
  { name: "济南", lon: 117.0, lat: 36.65, tz: "Asia/Shanghai" },
  { name: "郑州", lon: 113.63, lat: 34.75, tz: "Asia/Shanghai" },
  { name: "武汉", lon: 114.3, lat: 30.6, tz: "Asia/Shanghai" },
  { name: "长沙", lon: 112.94, lat: 28.23, tz: "Asia/Shanghai" },
  { name: "广州", lon: 113.26, lat: 23.13, tz: "Asia/Shanghai" },
  { name: "南宁", lon: 108.37, lat: 22.82, tz: "Asia/Shanghai" },
  { name: "海口", lon: 110.2, lat: 20.04, tz: "Asia/Shanghai" },
  { name: "成都", lon: 104.07, lat: 30.57, tz: "Asia/Shanghai" },
  { name: "贵阳", lon: 106.63, lat: 26.65, tz: "Asia/Shanghai" },
  { name: "昆明", lon: 102.83, lat: 24.88, tz: "Asia/Shanghai" },
  { name: "拉萨", lon: 91.11, lat: 29.65, tz: "Asia/Shanghai" },
  { name: "西安", lon: 108.95, lat: 34.27, tz: "Asia/Shanghai" },
  { name: "兰州", lon: 103.82, lat: 36.06, tz: "Asia/Shanghai" },
  { name: "西宁", lon: 101.78, lat: 36.62, tz: "Asia/Shanghai" },
  { name: "银川", lon: 106.23, lat: 38.49, tz: "Asia/Shanghai" },
  { name: "乌鲁木齐", lon: 87.62, lat: 43.83, tz: "Asia/Shanghai" },

  // 主要地级市
  { name: "深圳", lon: 114.06, lat: 22.55, tz: "Asia/Shanghai" },
  { name: "青岛", lon: 120.38, lat: 36.07, tz: "Asia/Shanghai" },
  { name: "大连", lon: 121.62, lat: 38.92, tz: "Asia/Shanghai" },
  { name: "厦门", lon: 118.09, lat: 24.48, tz: "Asia/Shanghai" },
  { name: "苏州", lon: 120.59, lat: 31.3, tz: "Asia/Shanghai" },
  { name: "宁波", lon: 121.55, lat: 29.87, tz: "Asia/Shanghai" },
  { name: "无锡", lon: 120.3, lat: 31.57, tz: "Asia/Shanghai" },
  { name: "温州", lon: 120.7, lat: 28.0, tz: "Asia/Shanghai" },
  { name: "佛山", lon: 113.12, lat: 23.03, tz: "Asia/Shanghai" },
  { name: "东莞", lon: 113.75, lat: 23.05, tz: "Asia/Shanghai" },
  { name: "珠海", lon: 113.58, lat: 22.27, tz: "Asia/Shanghai" },
  { name: "三亚", lon: 109.51, lat: 18.25, tz: "Asia/Shanghai" },
  { name: "洛阳", lon: 112.45, lat: 34.62, tz: "Asia/Shanghai" },
  { name: "唐山", lon: 118.18, lat: 39.63, tz: "Asia/Shanghai" },
  { name: "烟台", lon: 121.39, lat: 37.54, tz: "Asia/Shanghai" },
  { name: "徐州", lon: 117.18, lat: 34.27, tz: "Asia/Shanghai" },

  // 港澳台
  { name: "香港", lon: 114.17, lat: 22.32, tz: "Asia/Hong_Kong" },
  { name: "澳门", lon: 113.54, lat: 22.19, tz: "Asia/Macau" },
  { name: "台北", lon: 121.56, lat: 25.04, tz: "Asia/Taipei" },
  { name: "高雄", lon: 120.3, lat: 22.63, tz: "Asia/Taipei" },
];

/** 用户会写「上海市」「内蒙古自治区」，这些后缀不影响城市身份，先剥掉。 */
const SUFFIX = /(特别行政区|自治区|自治州|地区|省|市|区|县)$/;

function normalize(input) {
  return String(input ?? "").replace(/\s+/g, "").replace(SUFFIX, "");
}

/**
 * 匹配出生城市。先精确，再双向包含 —— 「上海浦东」含「上海」，「京」被「北京」含。
 *
 * @returns {{name: string, lon: number, lat: number, tz: string} | null}
 */
export function matchCity(input) {
  const key = normalize(input);
  if (!key) return null;

  const exact = CITIES.find((c) => c.name === key);
  if (exact) return exact;

  return CITIES.find((c) => key.includes(c.name) || c.name.includes(key)) ?? null;
}

/** 错误提示里举例用，避免把整张表写死在文案里。 */
export const CITY_EXAMPLES = ["上海", "北京", "广州", "成都"];
