# 性能审计（静态代码检查）

- Worktree：`/home/emanon/Work/SketchProbe-perf`
- 分支：`perf/performance-audit`
- 基线：`413c173`
- 范围：Rough.js 绘制、SVG/地图结构、地图加载路径、实时更新与重复计算。
- **动态审计尝试受阻，未取得有效浏览器测量。** 没有 Lighthouse 报告、Performance trace、运行时 DOM 计数、加载时间、帧率或耗时数据。不要将以下静态结论解读成性能分数或已复现的卡顿。

## 代码确认

### Rough.js 与实时更新

- `src/lib/api.ts:229-234` 的 `receive()` 对每个收到的帧执行 `safeNodes()`、`sample()` 和 `setNodes(safe)`；当前没有比较前后节点数据或避免相同数据的状态更新。WebSocket mock 每 2 秒推送一次（`dev/mock-api.ts:263-265`）。真实 Hub 推送频率需以目标环境确认。
- `src/App.tsx:120-123,214` 根据节点状态生成 `shown` 并传给地图；`src/components/NodeCard.tsx:13` 的卡片没有 `React.memo`。因此节点更新会令列表重新执行 React render，不能据此断言浏览器必然重绘每个 SVG。
- `src/sketch/Sketch.tsx:93-110` 的 Rough 路径在 `useMemo([size, sequence, revision])` 中生成；普通卡片框的尺寸/seed/revision 稳定时可复用现有 paths。`SketchBar` 的 revision 是 meter 值，所以值变化时相应 meter Rough 路径会重算。这是有意跟随数据的更新。
- **明确的冗余计算路径（本次已修复）：** `src/map/WorldMap.tsx` 的 cluster 在节点引用变化后重建（`useMemo` 依赖 `nodes`）；`rings` 原先依赖整个 `clusters`，因而即使国家、节点数量和圆环半径未变，仅 CPU/流量变化也会重新调用 Rough ellipse/toPaths 生成圆环。
- 拖动事件已用 `requestAnimationFrame` 合帧（`src/map/WorldMap.tsx` 约 346-370 行）；地图地理层 `Geography` 使用 `memo`（`src/map/WorldMap.tsx:152`），可避免平移时 React 重建数百个海岸路径。它们是代码层的优化措施，不代表已测得的帧率。
- `src/main.tsx:1-10` 使用 React `StrictMode`；开发模式下部分 render/effect 会额外执行，性能数据应以生产构建或正确配置的 Lighthouse 运行结果为准。

### SVG 与地图加载路径

- `src/map/world.ts` 静态数据含 **176 个国家路径条目**（按源文件对象行统计）；它们是预生成的 Natural Earth `d` 路径，不是每次更新都由 Rough.js 生成。
- `src/map/WorldMap.tsx:156-163,502-555` 将地图放在一个 SVG 根元素中；普通视口渲染一份地理层，跨越地图东西接缝时条件渲染第二份。因此静态国家 `<path>` 约为 **176 或 352**，另有经纬线、标签、标记、装饰路径。此为源码可推得的结构数，不是浏览器运行时 DOM 计数。
- `src/map/PencilDefs.tsx` 用 SVG pattern 绘制海洋和陆地的铅笔纹理（海洋 6 条、陆地 11 条定义路径），浏览器需在覆盖区域对纹理进行绘制/填充。其栅格化成本与地图可视面积、缩放和设备相关，源码无法量化。
- `src/map/world.ts` 作为模块静态导入；是否影响首屏、地图实际资源/传输耗时以及 JS 解析成本，需要 bundle/network/Lighthouse 数据。本次未执行构建或浏览器测量。
- 页面还有卡片框、计量条、旗帜等 SVG。没有浏览器 DOM，无法给出页面实际 `<svg>`/`<path>` 总数；源码标签数量不能替代运行时数量。

### 刷新与其他请求

- 主节点流是 WebSocket， mock 每 2 秒发送一次；连接失败时轮询间隔为 5 秒（`src/lib/api.ts:267,311`），隐藏标签页会暂停，恢复时重新取数并连接。
- 延迟历史在列表页按在线节点加载，存在 3 个并发 lane 限制，并每 60 秒刷新（`src/lib/latency.ts:15-18,85`）。每个请求完成会更新 hook 的 `results`，其位于 `App` 中，可能令父级及整页子树重新 render；此更新不等于整页 DOM 被替换或所有 paths 重绘。需要在 Performance trace 中确认 React commit、style/layout/paint 的范围。

## 动态审计尝试与限制

- 用户后续授权关闭占用实例后，检查进程命令行未发现引用 `/home/emanon/.cache/chrome-devtools-mcp/chrome-profile` 或 `/home/emanon/.cache/ms-playwright-mcp/mcp-chrome-fd38334` 的浏览器主进程；没有对 Brave 或其他进程发送信号。
- Chrome DevTools MCP 的 `list_pages` 曾返回 `1: about:blank [selected]`，但 `new_page` 仍失败：`The browser is already running for /home/emanon/.cache/chrome-devtools-mcp/chrome-profile. Use --isolated to run multiple browser instances.` 因无法安全定位并释放占用者，未继续动态测量。
- Lighthouse MCP 工具说明明确其审计覆盖 accessibility、SEO、best practices 和 agentic browsing，**不含 performance**；性能应由 Performance trace 工具验证。
- 可复用的另一个 checkout 源码与本审计目标 `413c173` 一致，mock 插件提供 `configurePreviewServer`，但其 `dist/` 是 Git 忽略产物，无法从 Git 证明构建来源；没有将其作为本目标的生产结果。目标 worktree 当前也没有可直接用的 `dist/` 或 `node_modules/`。
- 因此本次未启动目标服务、未打开应用页面、未执行 Lighthouse 或 Performance trace；未测加载时间、运行时 DOM 数量、绘制成本、帧率、长任务或实时帧造成的浏览器工作。动态性能审计仍未完成。

重新获得可用浏览器 profile 并确认目标构建后，建议在同一 mock/真实目标环境记录 Performance：

1. 冷启动导航：记录 LCP、CLS、主线程长任务、网络资源及地图模块加载时序；分别标明网络/CPU 模拟条件。Performance trace 可记录性能事件；若需要 Lighthouse Performance 分数，需使用确实包含 performance 类别的 Lighthouse 运行方式。
2. 地图空闲、缩放、拖拽：记录帧时间、主线程 scripting/rendering/painting、SVG DOM 节点数及地图绘制耗时；特别观察 hatch pattern 的栅格化。
3. 至少覆盖数个 2 秒实时帧：比较 React render/commit、Rough 生成调用、DOM mutations、style/layout/paint；确认仅指标变化时 `rings` 是否重复生成，检查卡片框 paths 是否保持稳定。
4. 延迟历史初始加载与 60 秒刷新单独观察，避免把其状态更新误判成 WebSocket 帧引发的工作。

## 本次实施的修复

`src/map/WorldMap.tsx`：地图圆环路径的 `useMemo` 原先以整个 `clusters` 数组为依赖，而该数组在每次实时推送时都会重建，因此仅指标变化也会重算全部圆环的 Rough 几何。现将依赖缩窄为真正决定路径的几何输入。

- 新增 `ringGeometry`：`clusters.map((c) => `${c.place.id}:${ringRadius(c.nodes.length)}`).sort().join("|")`，即每国的 id 与环半径；`sort()` 使键与 cluster 顺序无关（`clusters` 会按 tone/数量排序，tone 变化会改变顺序）。
- `rings` 的 `useMemo` 依赖改为 `[ringGeometry, factor]`，并在 memo 内部从 `ringGeometry` 解析 id/半径，因此 memo 读取的输入与依赖一一对应，不存在闭包读取 `clusters` 的隐式不变量。
- 除 `factor`（pen factor）外，`circleAt` 的其余参数（`strokeWidth: 1.6`、`loose: 1.25`、由 id 派生的 seed）都是常量或已由键覆盖；`ringRadius` 本身也是纯函数并直接进入键，故键覆盖了全部几何输入。
- 未改动绘制结果、实时采样语义、节点去重或渲染边界；`<path>` 的 `d`/style 与修复前逐项相同，只是等价输入下不再重新生成。

验证方式与限制：

- `npm run typecheck`（`tsc -b --noEmit`）退出码 0。该 worktree 本身无 `node_modules`；为运行类型检查，临时将 `node_modules` 软链到 `/home/emanon/Work/SketchProbe/node_modules`（两份 `package.json` 已比对为完全相同），检查后已删除软链及 `tsc -b` 产生的 `*.tsbuildinfo`，未安装任何依赖。
- 用独立脚本核验键的等价性：仅指标变化、cluster 顺序变化、节点数 2→5（半径不变）时键不变；节点数 1→2（半径 7.8→9.6）、新增国家、移除国家时键改变；空集合得到 `""` 且经 `filter(Boolean)` 后不生成幽灵圆环。
- **仍未取得动态证据**：没有 Performance trace、实际耗时、帧率或运行时 DOM 数据，因此无法断言该冗余计算原本占用多少时间、也无法给出修复后的收益数字。

## 最小后续优化方向（未实施）

地图圆环缓存的依赖已缩窄（见上）。其余静态发现尚不足以支持改动：节点数据去重、`NodeCard` 的 `memo` 化、渲染边界拆分或地图懒加载都缺少 trace 证据，且实时采样有语义（不能为跳过 render 丢弃样本）。建议在获得可用浏览器 profile 并确认目标构建后，按上面的 Performance 检查清单实测，再决定是否值得进一步改动。
