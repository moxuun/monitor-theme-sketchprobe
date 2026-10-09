# SketchProbe 安全与依赖审查

- **审查对象**：`/home/emanon/Work/SketchProbe-security`
- **分支 / 基线**：`review/security` @ `413c173`（与 `main` 同点）
- **审查范围**：检查受版本控制文件清单，并重点审查相关源码与配置（`src/`、`dev/`、`map-preview/`、`public/`、`.github/workflows/`）；另参考了主工作区未跟踪的 `dist/` 产物（未建立与基线的构建对应关系）
- **结论摘要**：在已审查的源码与检索范围内**未发现 XSS 可利用点、凭据泄漏或已知依赖漏洞**。主要问题为**发布归档缺少第三方许可证文本**（合规），以及 CI 供应链加固；另有若干来源/授权待确认项。

---

## 一、按严重度排序的发现

### F1 — 发布配置未提供第三方许可证文本的分发机制（中 · 合规）

**证据**

- 归档由 `.github/workflows/release.yml:35` 生成：
  `tar czf theme.tar.gz dist theme.json preview.png`
  归档内容 = `dist/` + `theme.json` + `preview.png`，不含 `LICENSE`，也没有任何依赖许可文本。
- 参考产物中 `dist/licenses/` **只有** `Excalifont-OFL.txt` 一个文件（由 Vite 从 `public/licenses/` 拷贝），未见其他第三方声明。
- 生产依赖树共 **9 个包，全部为 MIT**；打包时经 tree-shaking，故下列为**应核对并保留声明的候选范围**，实际分发部分以产物为准：
  | 包 | 锁定版本 | 许可 | 类型 |
  | --- | --- | --- | --- |
  | react | 19.3.0 | MIT | 直接 |
  | react-dom | 19.3.0 | MIT | 直接 |
  | roughjs | 4.6.6 | MIT | 直接（手绘线条引擎） |
  | country-flag-icons | 1.6.20 | MIT | 直接（200+ 国旗 SVG） |
  | scheduler | 0.28.0 | MIT | 传递（react-dom） |
  | hachure-fill | 0.5.2 | MIT | 传递（roughjs） |
  | path-data-parser | 0.1.0 | MIT | 传递（roughjs） |
  | points-on-curve | 0.2.0 | MIT | 传递（roughjs） |
  | points-on-path | 0.2.1 | MIT | 传递（roughjs） |
- 参考产物 `dist/assets/index-*.js` 中检索 `/*!` 与 `@license` 为 0 命中（**仅说明该参考产物中未见许可注释，不足以推断构建配置行为**）。

**影响**

MIT 要求版权声明与许可声明随软件副本分发。主题以 `theme.tar.gz` 形式被第三方 hub 运营者下载、安装、再分发；**源码发布配置未明确覆盖这些 MIT 声明，参考产物中也未见（Excalifont 的 OFL 文本除外）**。README 的第三方资源一节只提到 Excalifont 与 country-flag-icons，覆盖范围小于上述候选清单。

**建议**

1. 在 `public/licenses/` 下增加声明文件，核对**实际分发的依赖部分**并保留相应 MIT 文本与版权行（可直接覆盖上述 9 个候选包）。Vite 会将其拷入 `dist/`，从而进入归档。
2. 归档命令加入主题自身 `LICENSE`：`tar czf theme.tar.gz dist theme.json preview.png LICENSE`。

> **边界**：`dist/` 位于主工作区且被 gitignore，本次未建立它与基线 `413c173` 的构建对应关系，仅作参考产物。**基线自身构建出的产物及实际发布的 `theme.tar.gz` 内容均未验证**，因此上述缺口是「发布配置与参考产物层面」的，而非已确证的发布事实。

---

### F2 — OS / 发行版图标来源为 Simple Icons，未记录来源，商标权未被 CC0 豁免（低-信息 · 授权/商标）

**证据**

- `src/components/OsIcon.tsx` 覆盖 15 个发行版键（debian、ubuntu、arch、armbian、alpine、centos、fedora、rocky、alma、opensuse、redhat、windows、apple、freebsd、linux）：`distroTitle()` 与 `DistroGlyph()` 各 15 个 `case` 分支（名称与图形），文件内**没有任何来源或版权注释**。
- 已独立核实（1/15）：`case "apple"` 的路径数据与当前 Simple Icons 上游文件 `icons/apple.svg` 的 `<path d="…">` 一致（来源：`raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/apple.svg`）。**其余 14 个图形的来源及适用授权未逐项核实。**
- Simple Icons 仓库采用 **CC0-1.0**（来源：`raw.githubusercontent.com/simple-icons/simple-icons/develop/LICENSE.md`）。

**影响**

- 一致性只说明当前上游文件与代码相同，**不证明实际复制来源**；Simple Icons 仓库的 CC0 也不能自动证明其中第三方品牌图形的全部权利均已获清理。版权与商标需分别核查。
- CC0 第 4 条 (a) 明确「No trademark or patent rights held by Affirmer are waived…」——Apple、Ubuntu、Red Hat 等 logo 的商标权仍归各自所有者；本仓库对图形的改色、变形等二次处理也不改变这一点。

**建议**：逐项核实其余 14 个图形的来源，在第三方资源清单中记录来源与许可，并保留版权与商标归属说明。

---

### F3 — README 称「没有世界地图」，与实现不符（低 · 文档）

**证据**

- `README.md`「已知限制」称：「**没有世界地图。** 节点只按国旗和分组展示。手绘世界地图的原型在 `map-preview/`，还没接进主题。」
- 实际：`src/App.tsx:11` `import { WorldMap } from "@/map/WorldMap"`，列表页渲染 `<WorldMap nodes={shown} />`；`src/map/world.ts`（68,820 字节）随包发布。

**影响**：不构成安全风险，但会误导许可证审查（使人误以为地图数据未分发）与使用者。

**建议**：更新 README，并将地图数据来源与授权（Natural Earth，公有领域）写入第三方资源清单。

---

### F4 — GitHub Actions 使用可变的 major 标签（低 · 供应链）

**证据**

- `.github/workflows/ci.yml:22-23` 与 `.github/workflows/release.yml:15,22`：`actions/checkout@v7`、`actions/setup-node@v7`。
- `release.yml:8` **工作流级**声明 `permissions: contents: write`，第 42 行以 `GH_TOKEN: ${{ github.token }}` 执行 `gh release create`——写权限作用于该工作流全部任务。

**影响**

major 标签可被上游移动；若上游账号或标签被攻陷，代码会在具备发布写权限的任务中执行。这是仓库内唯一能触达发布产物的自动化路径。

**建议**：将两个 action 固定到完整 commit SHA（行尾注释保留版本号）。

---

### F5 — `ci.yml` 未声明最小权限（低 · 最小权限）

**证据**：`.github/workflows/ci.yml` 全文无 `permissions:` 块（`release.yml` 有）。

**影响**：CI 任务继承仓库/组织默认 token 权限，若默认非只读则超出需要。

**建议**：`ci.yml` 顶层加 `permissions: contents: read`。

---

### F6 — 缺少依赖审计门禁与依赖更新机制（信息 · 可选维护建议）

**证据**

- 两个工作流均执行 `npm ci`（`ci.yml:27`、`release.yml:26`）。
- 无 `npm audit` 步骤，无 `.github/dependabot.yml`，无 `SECURITY.md`。
- `package-lock.json` 为 `lockfileVersion: 3`；受控的 56 个条目均带 `integrity`（第 57 条为根包）。锁文件中仅可选的 `fsevents` 标记了安装脚本。

**建议**（可选，按收益排序）：加入 Dependabot（npm + github-actions）；CI 增加 `npm audit --package-lock-only` 非阻塞报告。

> 不在此建议关闭安装脚本：本仓库锁文件未显示需要该措施的证据，且未经实测不宜启用。

---

### F7 — 状态页对匿名访客展示的字段取决于 hub 契约（信息 · 边界）

**证据**

- 主题渲染 `agent_version`（`src/components/NodeDetail.tsx:205`）、`price`/`currency`/`billing_cycle`（`:255`）、`expires_at`（`:269`）、`public_remark`（`src/components/NodeCard.tsx:50-54`、`src/components/NodeDetail.tsx:107-110`）。
- `src/lib/api.ts` 类型中标注为「Panel only」的 `hostname`、`ip`、`remark` 在 `src/` 中无渲染点。

**影响与边界**

- `agent_version` 会暴露 agent 版本，便于攻击者挑选对应漏洞；`price`/`expires_at` 属运营信息。
- **前端不渲染 `ip`/`hostname`/`remark` 并不证明接口不返回它们**——只要 `/api/nodes` 把字段发给浏览器，匿名访客即可从网络响应读取。是否应公开这些字段取决于 monitor hub 的 API 契约，不是本主题能强制的。

**建议**：向 hub 侧确认 `/api/nodes` 对匿名请求的字段白名单；若这些字段本就仅对已认证请求返回，则无需改动，仅记录。

---

## 二、已核查且未发现问题的项

### XSS / 注入

在已审查源码与检索范围内未发现可利用点：

- 在 `src/`、`dev/`、`index.html`、`map-preview/` 检索 `dangerouslySetInnerHTML` / `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write` / `srcdoc` / `eval(` / `new Function` / `javascript:`，均 0 命中。
- 唯一手工 DOM 写入为 `src/App.tsx:93`：`document.body.dataset.paper = String(config.paper ?? "grid")`。`config.paper` 经 `src/lib/config.ts:15-21` 的 `valid()` 限定为 `grid|dots|lines|plain`；且 `dataset` 为属性值写入，不解析为标记。
- 运维配置 `notice` 以 React 文本子节点渲染（`src/App.tsx:128,176`），由 React 转义。
- 国旗只做构建期查表：`src/components/Flag.tsx:17-21` 用 `import.meta.glob` 生成 URL 映射，`:40-44` 按大写国家码取 URL，取不到返回 `null`。
- 地图 SVG 的 `d` / `style` / `href` 均来自静态生成数据或数字格式化（`src/map/WorldMap.tsx:135,158,226,532,552,568-571`），节点数据仅经 React 转义进入 DOM。
- 路由正则 `src/lib/route.tsx:10` 的 `^\/node\/(\d+)` 只匹配数字前缀（无结尾锚点，故不足以单独证明整条路径合法）；安全性依据是已检查的调用点只生成固定站内路径（`href` 与 `history.pushState` 均如此）。
- WebSocket 地址仅由 `location.protocol` / `location.host` 拼接（`src/lib/api.ts:258`），无用户输入参与。
- `src/lib/api.ts:181` 的 `safeNodes()` 会把指标非有限值的节点其 `metrics` 置为 `null`（不丢弃节点，也不校验载荷其余字段）；`src/lib/api.ts:156` 的 `KEEP = 60` 限制 `speedHistory` 中**各分组及全局**吞吐序列长度（非按节点）。
- `src/lib/format.ts:98-109` 的 `money()` 用 try/catch 包裹 `Intl.NumberFormat`，非法货币码回退为纯文本。

**边界**：以上为静态代码审查结论，未做动态验证（无浏览器实测、无模糊测试）。

### 敏感信息泄漏（仓库内）

在已审查源码与检索范围内未发现硬编码凭据：

- 检索 `api_key|secret|password|token|Bearer|BEGIN … PRIVATE KEY|sk-…|ghp_…`，唯一命中为 `.github/workflows/release.yml:44` 的 `GH_TOKEN: ${{ github.token }}`（GitHub 每次运行临时签发，非硬编码）。
- 无 `.env`、`.npmrc`、`.pem`、`.key` 被跟踪。
- `localStorage` 只存主题偏好键 `sketchprobe:theme`（`src/App.tsx:24,45`）；不读写 cookie，不存 token。
- 开发期专用面未进入产物：`dev/mock-api.ts` 由 `vite.config.ts:11` 仅在 `MONITOR_MOCK` 下注册，插件自身为 `apply: "serve"`（`dev/mock-api.ts:327-329`）。参考产物中检索 `MONITOR_MOCK|mockApi|Sec-WebSocket-Accept` 为 0 命中，且无 `.map` 源映射（**同样仅代表该参考产物**）。
- `MONITOR_HUB` / `MONITOR_MOCK_CONFIG` 只在 dev 进程环境读取，代码未使用 `import.meta.env`。
- 本地遗留：主工作区 `.playwright-mcp/` 有约 28 MB 浏览器自动化日志/截图，已被 `.gitignore:12` 忽略且未跟踪；其中可能含测试时抓取的页面内容，保持忽略即可。

**边界**：未做完整 git 历史秘密扫描（仅扫描了受控文件的当前内容），未审查 hub 后端的鉴权与日志。

### 依赖漏洞

- `npm audit --package-lock-only --ignore-scripts`（JSON 输出）退出码 **0**，stderr 为空，`vulnerabilities: {}`，info/low/moderate/high/critical 均为 0。未安装依赖、未运行 lifecycle 脚本。
- 生产依赖树 9 个包全为 MIT（见 F1 表）；开发依赖含 `vite 8.3.3`（MIT）、`typescript 6.0.3`（Apache-2.0）、`@vitejs/plugin-react 6.1.2`（MIT）。注：`package.json` 中为范围声明（react / react-dom `^19.2.8`、vite `^8.2.2`、typescript `~6.0.2`、@vitejs/plugin-react `^6.1.0`），上表为锁文件解析后的实际版本。
- **边界**：结论限于注册表已知公告，未评估注册表之外的风险；无持续审计。

### 第三方资源（运行时无外链）

- 无 CDN `<script>`/`<link>`、无 `@import`、无 `url(http…)`。`src/index.css:139` 的噪点底纹是 `data:` URI；图标为内联 SVG（`src/components/Icon.tsx`、`src/components/OsIcon.tsx`）；国旗为打包资源；字体自托管（`public/fonts/Excalifont-Regular.woff2` → `dist/fonts/…`）。
- 外部 URL 仅出现在 README 徽章与注释/文档链接中，应用运行时不请求。

---

## 三、授权核实（Excalidraw 素材 / 地图 / 字体 / 图标）

| 对象 | 授权 | 状态 |
| --- | --- | --- |
| Excalifont 字体 | SIL OFL-1.1，`Copyright (c) 2024 by Excalidraw` | ✅ 已核实：OFL 全文随包分发（`public/licenses/Excalifont-OFL.txt` → `dist/licenses/`） |
| 世界地图数据 | 公有领域（Natural Earth） | ✅ 已核实：官方 terms 页面明确「in the public domain… Crediting the authors is unnecessary」；仓库仅分发生成的路径数据，原始 GeoJSON 缓存在 gitignore 的 `.cache/` |
| OS / 发行版图标 | Simple Icons，CC0-1.0 | ⚠️ 仅核实 Apple 一例（与上游一致）；**其余 14 个图形来源与授权待核实**，商标权未豁免（见 F2） |
| country-flag-icons 及另外 8 个生产依赖候选 | MIT | ⚠️ 源码发布配置未明确覆盖这些 MIT 声明，参考产物中也未见；基线构建与实际发布归档未验证（见 F1） |
| `src/components/Icon.tsx`（界面图标） | 项目自述自有 | ⚠️ 文件自述「Hand-drawn icons, authored as paths rather than generated by rough.js」，已检查范围内未发现其他来源证据；**原创性未独立证明** |
| `src/sketch/shapes.ts`（手绘形状） | 项目自述自有 | ⚠️ 只依赖 `roughjs`（MIT）的类型与生成器，已检查范围内未发现其他来源证据；**原创性未独立证明** |
| Excalidraw 项目本身 | 仅作视觉参考（`theme.json:4`、README） | ⚠️ 已检查范围内未发现 Excalidraw 源码或素材文件；手绘效果来自 `roughjs`（MIT）。注意：**Excalidraw 社区素材不能默认继承其应用源码许可证** |

**字体细节**：已读取仓库内的 OFL 文本，其中**未声明 Reserved Font Name**（检索仅命中第 33 行 OFL 对术语的定义），故 RFN 条款（第 3 条）不被触发。OFL 第 2 条要求版权与许可随附，第 5 条要求字体仍按 OFL 分发；本仓库已提供版权行与许可文件。**但字体上游版本、是否经过修改、以及本地副本与实际发布包的对应关系均未核实。** 前言限制的是「单独出售字体」，与主题整体分发无关。`public/fonts/Excalifont-Regular.woff2` 与 `map-preview/fonts/Excalifont-Regular.woff2` 同为 52,296 字节。另：CSS 中把系统字体名写作 fallback 不等于分发这些字体，不需要随主题附带其许可证。

**边界**：未比对所分发 `woff2` 与上游 Excalifont 的哈希（本地无上游副本），因此**不能断言**该字体未经修改，也**不能断言**当前分发方式已完整满足 OFL 第 2、5 条。

---

## 四、方法与边界

- **只读审查**：未修改任何业务文件，未安装依赖，未执行构建，未新增测试，未提交或发布。本报告是本工作区唯一新增文件。
- **依赖结论**：基于 `package-lock.json` 的实际锁定版本与 `npm audit --package-lock-only --ignore-scripts`（未安装依赖、未运行 lifecycle 脚本）。
- **产物结论**：`dist/` 读取自主工作区 `~/Work/SketchProbe/dist`（被 gitignore，本工作区未构建），**未建立与基线 `413c173` 的构建对应关系**，仅作参考；实际发布归档未验证。
- **未验证项**（需后续确认）：
  1. hub 侧 `/api/nodes` 对匿名请求的字段白名单（F7）；
  2. `src/components/Icon.tsx` 图标是否为外部来源（§三）；
  3. 所分发字体相对上游是否被修改（§三）；
  4. PNG 素材的元数据与像素内容：本次仅查看了 `preview.png`，并对 `preview.png` 与 `map-preview/shot-*.png` 做过有限的字符串检索；**未查看 map-preview 截图内容，未完成元数据审计**，不能据此断言这些素材不含敏感信息；
  5. 注册表公告之外的传递依赖风险；git 历史中的秘密（未扫描历史）。
- 本报告不含任何秘密值。

### 关键命令记录

| 命令 | 结果 |
| --- | --- |
| `npm audit --package-lock-only --ignore-scripts --json` | **退出码 0**（原始记录）；`vulnerabilities: {}` |
| 检索秘密模式（`git grep` / `grep -rE`） | 命中 1 处：`${{ github.token }}`，非硬编码凭据 |
| 检索 XSS 汇聚点（`grep -rE`） | 0 命中 |
| 检索产物内 `/*!`、`@license` | 0 命中（仅代表该参考产物） |
| 检索产物内 `MONITOR_MOCK`、`mockApi` | 0 命中（仅代表该参考产物） |
| `find dist -name '*.map'` | 无源映射 |

> 上表中除 `npm audit` 外，其余为检索结果记录；多数经管道执行，未单独保留各上游命令的退出码，故不补写单命令退出码。

---

## 五、修复状态（本次提交）

本节记录对上述发现的处置。报告其余部分仍描述基线 `413c173` 的原始状态，§四 中「本报告是本工作区唯一新增文件」只适用于审查阶段。

| 发现 | 处置 | 落点 |
| --- | --- | --- |
| F1 | 已修 | 新增 `public/licenses/THIRD-PARTY-NOTICES.txt`（9 个 MIT 包的完整许可文本，逐包保留上游版权行）；`release.yml` 归档加入 `LICENSE` |
| F3 | 已修 | `README.md` 的「已知限制」改为按国家码落点；第三方资源清单补全并指向声明文件 |
| F4 | 已修 | `ci.yml`、`release.yml` 中 `actions/checkout` 与 `actions/setup-node` 固定到 `v7` 标签所指提交 |
| F5 | 已修 | `ci.yml` 增加顶层 `permissions: contents: read` |
| F2 | 未修 | 图标来源与商标归属需产品决定，报告仅记录核实结果 |
| F6 | 未修 | 按用户选择不引入 Dependabot；`npm audit` 门禁仍为可选建议 |
| F7 | 未修 | 属 hub 契约，不在本仓库范围 |

F4 固定的提交：`actions/checkout` → `3d3c42e5aac5ba805825da76410c181273ba90b1`，`actions/setup-node` → `949feb2413d6458794dcd2491c4babbbce0c15c1`（均以 `git ls-remote` 解析 `refs/tags/v7` 得到）。

F1 的两点说明：

- 许可文本取自各包发布版本自带的 `LICENSE`。其中 `points-on-path@0.2.1` 的版权行上游原文即为 `Copyright (c) 2020 Preet`（缺姓氏），声明文件按原样保留并加注说明。
- 声明文件放在 `public/licenses/`，由 Vite 拷贝进 `dist/licenses/`，因此随归档分发，无需改动构建流程。

本次修复未改动业务逻辑（`src/` 未变），未安装依赖，未执行构建，未推送远端。
