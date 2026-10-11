# 看台 KANTAI · 中国职业足球上座观察

一个**以单场比赛为第一公民**的中国职业足球上座数据产品。
不做传统 dashboard：首页是一条 2025 中超 240 场比赛的时间线，每场比赛一张“票根”，
到场人数、分母口径、数据来源、缺失与冲突都写在明处。

## 本地打开

```bash
cd kantai
python3 -m http.server 8080
# 浏览器打开 http://127.0.0.1:8080/
```

也可以直接双击 `index.html` 打开（构建时已内联数据包，file:// 可用；
推荐用本地服务器，以读取 `data/*.json` 最新成品）。

## 页面

| 页面 | 内容 |
|---|---|
| `index.html` 时间线 | 240 场比赛倒序票根流：人数、标称容量占比、德比/周末徽章；按球队/轮次/数据状态筛选 |
| `match.html?id=` 单场 | 三档口径（到场人数 / 标称容量占比 / 开放座位上座率·未知）、观感解释、上下文、探索性关联、数据血缘卡 |
| `team.html?team=` 球队档案 | 15 个主场走势、分布、球市温度计、容量口径（含冲突） |
| `compare.html` | 两队主场上座走势叠加对比 |
| `data.html` | 口径三原则、来源表、覆盖率矩阵、容量冲突清单、更新日志、演示模式入口 |

焦点球队：广东广州豹（2025 中甲主场 15 场）——时间线顶部 spotlight + 独立球队档案。

## 数据

- **当前覆盖**：2025 中超 240/240 场（第三方逐场）＋ 广州豹 2025 中甲 15 个主场。
- **来源**：Transfermarkt 单场报告（第三方，非官方）＋ 维基百科 2025 CSL 词条（分队汇总/球场容量/逐轮排名，交叉验证）。
  官方（中足联/俱乐部）逐场观众数无公开结构化来源，标记为缺失。
- **交叉验证**：Transfermarkt 16 队逐场加总与维基分队汇总**完全一致**（总量 6,180,990）。
- **口径**：所有百分比均为「标称容量占比 = 到场人数 ÷ 球场标称容量」；
  开放座位数未知 → 显示「未知」，不计算；缺失 ≠ 0；容量冲突双口径展示。

详见站内「数据说明」页与 `data/meta.json`。

## 更新数据

```bash
python3 tools/fetch_tm.py all   # 抓取（公开页面，1.5s 间隔，磁盘缓存，失败保留旧数据）
python3 tools/build_data.py      # 策展 + 校验 + 生成 data/*.json 与 js/data.bundle.js
python3 tests/check_data.py      # 成品校验
```

定时更新见 `.github/workflows/update-data.yml`（默认关闭，手动触发验证后再开）。

## 项目结构

```
kantai/
  index.html  match.html  team.html  compare.html  data.html
  css/style.css
  js/store.js  js/charts.js  js/app.js      # 零依赖，手工 SVG 图表
  js/data.bundle.js                          # 构建生成：内联数据包（file:// 兜底）
  data/meta.json  data/teams.json
  data/matches_csl2025.json  data/matches_gzpower2025.json  data/demo.json
  tools/fetch_tm.py  tools/build_data.py
  tests/check_data.py
  .github/workflows/update-data.yml
```

无构建工具、无 CDN 依赖、无 npm。纯静态，可直接部署 GitHub Pages。

## 项目边界确认

- 本项目位于独立目录 `~/workspace/kantai/`，独立 git 仓库（无 remote）。
- 未修改、覆盖或删除任何现有项目文件；未 push 到任何现有仓库。

## 创新点（摘要）

1. **票根时间线**：比赛是第一公民，不是球队场均表的附庸。
2. **分母三明治**：每个百分比永远标注分母；开放座位未知就写未知。
3. **观感解释器**：每场比赛一句话回答“看起来空/满，到底是人数还是口径问题”。
4. **数据血缘卡**：每个数字可追溯到来源链接、抓取时间与交叉验证状态。
5. **覆盖率矩阵**：缺失本身就是信息，240 格一目了然。
6. **冲突不静默**：维基 vs Transfermarkt 容量差异双口径展示（如长春亚泰 41,638 vs 28,669）。
7. **探索性关联严格标注**：德比/周末/排名对比只做描述性呈现，不写因果结论。
8. **演示模式**：虚构数据独立入口＋条纹标识，不与真实数据混合。
