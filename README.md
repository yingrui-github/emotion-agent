# 灵犀 · 情感 Agent

一个主 Agent 输入框 + 3 个独立子功能模块的网页产品骨架。

**当前状态：三个模块都接了真实排盘**（命盘四柱 + 大运、星盘本命 + 行运 / 次限 / 三限、合盘跨盘相位 + 落宫叠加），
并都接了 AI 解读。页面、路由、意图分派都能跑通并体验。

## 启动

```bash
npm install   # 首次
npm run dev
```

然后打开 http://localhost:3000

## 技术栈

Next.js 16（App Router）+ React 19 + Tailwind CSS 4。前后端都在这一个工程里，
以后接大模型直接在 `app/api/` 下加 route handler，API key 放服务端环境变量，不会泄到浏览器。

## 结构

```
app/
├── layout.jsx              外壳：星空背景、导航、页脚
├── page.jsx                首页：主输入框 + 3 张模块卡片
├── globals.css             Tailwind 入口 + 主题色 + 星空动效
├── not-found.jsx           未知模块的 404
├── m/[id]/
│   ├── page.jsx            模块页（服务端：取模块、读 ?q=）
│   └── ModuleView.jsx      模块页交互（客户端：表单 + 结果区）
└── api/
    ├── agent/route.js      POST 主 Agent 意图分派  ← 接模型放这里
    └── reading/[id]/
        ├── route.js        POST 单模块排盘
        ├── transit/route.js    POST 行运 / 次限 / 三限
        ├── insight/route.js    POST 某个方向的 AI 解读
        └── followup/route.js   POST 追问（流式）

components/
├── AgentConsole.jsx        首页输入框 + 分派结果卡片
├── AspectGrid.jsx          相位矩阵（本命阶梯形 / 合盘矩形两种模式）
├── AstroChart.jsx          星盘结果：三要素 + 行星表 + 相位 + 行运/推运
├── BaziChart.jsx           排盘结果：四柱表 + 大运表
├── ChartWheel.jsx          星盘圆盘图
├── InsightPanel.jsx        AI 解读面板（分方向 + 追问流式）
├── ModuleCard.jsx          首页模块入口卡片
├── SynastryChart.jsx       合盘结果：双方三要素 + 跨盘相位 + 落宫叠加
├── SiteNav.jsx             顶部导航（高亮当前模块）
└── ThemeToggle.jsx         深浅主题切换

lib/
├── modules.js              3 个模块的元数据 —— 唯一数据源
├── bazi.js                 八字排盘：解析生辰 + 排四柱 + 排大运
├── astro.js                星盘排盘：行星黄经 + 宫位 + 相位 + 行运/推运
├── synastry.js             合盘：两张本命盘 + 跨盘相位 + 落宫叠加
├── aiReading.js            AI 解读入口：PROFILES 注册表 + 调模型
├── baziReading.js          八字的 persona / topics / chart→文本
├── astroReading.js         星盘的 persona / topics / chart→文本
├── synastryReading.js      合盘的 persona / topics / chart→文本
├── cities.js               城市 → 经纬度与时区
├── zodiac.js               星座 / 元素 / 三分法等基础表
└── agent.js                意图分派逻辑（带权关键词，占位实现）
```

## 排盘说明

`lib/bazi.js` 基于 [lunar-javascript](https://github.com/6tail/lunar-javascript) 做历法计算：
年柱以**立春**换岁、月柱以**节气**换月，大运的顺行/逆行由年干阴阳与性别决定
（阳男阴女顺行，阴男阳女逆行），起运按到下一个/上一个节气的距离折算。

年 / 月 / 日 是手动输入（横排一行），各自只取数字，所以「1990」「1990年」都认。
时柱从下拉里选十二时辰（如 `1:00-3:00 丑时`），按该时辰的起始整点排盘 ——
**不输分钟**，只在出生时刻正好卡在节气交界、或者要精确到天的起运数字时才有影响。
子时跨零点，按 23:00 算（晚子时），所以 0:00—1:00 出生的时干会差一位；
要区分早子时 / 晚子时的话，得在 `lib/modules.js` 的 `HOUR_OPTIONS` 里把子时拆成两项。

出生地目前只作记录，**未做真太阳时校正** —— 要做的话得先把出生地转成经度。

## 路由

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/` | 首页 |
| GET | `/m/{id}` | 模块页，支持 `?q=` 预填问题 |
| POST | `/api/agent` | `{ q }` → 分派结果（module / reply / alternatives） |
| POST | `/api/reading/{id}` | 模块表单 → 真实排盘结果 |
| POST | `/api/reading/astro/transit` | `{ inputs, mode, date }` → 行运 / 次限 / 三限 |
| POST | `/api/reading/{id}/insight` | `{ topic, chart }` → 某个方向的 AI 解读 |
| POST | `/api/reading/{id}/followup` | `{ topic, chart, insight, history, question }` → 追问（流式） |

`{id}` 为 `bazi` / `astro` / `synastry`。

## 三个模块

| id | 名称 | 关键词 | 状态 |
| --- | --- | --- | --- |
| `bazi` | 命盘解读 | 八字 · 五行 · 十神 | 真实排盘（四柱 + 大运） |
| `astro` | 星盘解读 | 星座 · 宫位 · 相位 | 真实排盘（本命 + 行运 / 次限 / 三限） |
| `synastry` | 关系合盘 | 相位 · 落宫 · 叠加 | 真实排盘（跨盘相位 + 落宫叠加） |

## 下一步接入点

- **主 Agent 意图分派**：`lib/agent.js` 的 `route()`，或直接在 `app/api/agent/route.js` 里换成模型调用，返回结构保持不变。
- **命盘解读的下一步**：可以补真太阳时校正。
- **星盘与合盘的下一步**：月交点、凯龙星与小行星尚未纳入；合盘不含组合盘（composite）与中点盘；行运与推运盘还没喂给 AI 解读。
- **新增模块**：往 `lib/modules.js` 的 `MODULES` 里追加一项即可，首页卡片、顶部导航、`/m/[id]` 路由会自动出现，不需要改页面。
  模块可选字段 `submitLabel` / `pendingLabel` / `resultLabel` 用来覆盖按钮与结果区文案；
  输入项 `type: "select"` 配 `options` 就是下拉框（`options` 可以写成 `{ value, label }`
  让显示文案和提交值不同），相邻输入项写同一个 `group` 会横排成一行
  （`groupLabel` 写在该组第一项上，作为这一行的总标题）。

## 说明

dev server 只监听本机。目前没有登录态，也不存储任何数据。
如果后续要对外暴露或者落库用户的出生信息，需要先加鉴权和数据保护。

`.npmrc` 里把 registry 指向了 npmmirror 镜像，并单独指定了缓存目录 ——
因为本机默认的 `~/.npm/_cacache` 里有一批 root 拥有的残留目录会让 `npm install` 报 EACCES。
想根治可以执行 `sudo chown -R $(whoami) ~/.npm`，之后就能把 `.npmrc` 里的 `cache=` 那行删掉。
