<p align="center">
  <img src="public/favicon.svg" alt="SketchProbe" height="120">
</p>

<h1 align="center">SketchProbe</h1>

<p align="center">
  <strong>monitor 的手绘工程草图风主题：边框像画在白板上，数据依然锐利。</strong>
</p>

<p align="center">
  给运维和自建服务的人用的状态页主题。节点、流量、延迟照常实时更新，<br>
  只是换成了方格纸、铅笔线条和手写标注。
</p>

<p align="center">
  <a href="https://github.com/moxuun/monitor-theme-sketchprobe/releases"><img src="https://img.shields.io/badge/release-v0.1.0-4e7ca1" alt="Release"></a>
  <a href="https://github.com/monitor-probe/monitor"><img src="https://img.shields.io/badge/monitor-theme-6e8f5a" alt="monitor theme"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-bd8a2c" alt="License"></a>
</p>

<p align="center">
  <a href="#预览">预览</a> · <a href="#特性">特性</a> · <a href="#安装">安装</a> · <a href="#配置">配置</a> · <a href="#设计说明">设计说明</a> · <a href="#开发">开发</a> · <a href="#许可">许可</a>
</p>

## 预览

浅色是方格纸上的铅笔稿，深色是炭黑笔记本上的粉笔字。

![SketchProbe 浅色模式](preview.png)

<details>
<summary>深色模式</summary>

![SketchProbe 深色模式](preview-dark.png)

</details>

## 特性

- **边框手绘，数据精确** —— 卡片、区块底纹走手绘线条，数字、刻度、趋势线和进度条长度都是精确的。
- **四种纸张底纹** —— 方格纸、点阵纸、横线纸、空白纸，后台一键切换。
- **明暗两套纸色** —— 深色不是把浅色反相：纸变成暖炭色，墨变成粉笔白，同一张图两边读起来一样。
- **刷新不抖动** —— 每张卡片的线条由固定种子生成，数据每两秒更新一次，外框不会跟着晃。
- **实时数据走 WebSocket** —— 断线自动退回轮询，切到后台标签页暂停，切回来立刻续上。
- **自带 mock 数据** —— `npm run dev:mock` 不需要 hub 就能跑，节点数值会平滑波动。

## 安装

1. 从 [Releases](https://github.com/moxuun/monitor-theme-sketchprobe/releases) 下载 `theme.tar.gz`。
2. 登录 hub 后台，进「主题」页，上传这个文件。
3. 在主题列表里启用 SketchProbe。

<details>
<summary>手动解压安装</summary>

解压到 hub 启动参数 `--themes` 指向的目录下，子目录名要用 `sketchprobe`：

```bash
mkdir -p /path/to/themes/sketchprobe
tar -xzf theme.tar.gz -C /path/to/themes/sketchprobe
```

然后重启 hub，或在后台刷新主题列表。

</details>

## 配置

在 hub 后台的主题设置里调整：

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `notice` | text | 空 | 页面顶部的公告，留空不显示 |
| `show_summary` | boolean | `true` | 节点列表上方的四格汇总：节点数、最忙节点、今日流量、实时网速 |
| `paper` | select | `grid` | 纸张底纹：`grid` 方格、`dots` 点阵、`lines` 横线、`plain` 空白 |
| `wobble` | number | `2` | 手绘程度，`0` 最规整、`4` 最潦草 |

## 设计说明

这个主题只有一条规则：**边框可以手绘，数据必须清晰。**

这不是审美偏好，有实证依据。Wood 等人在 *Sketchy Rendering for Information Visualization*（IEEE TVCG 2012）里证明，手绘渲染会明显损害人对几何面积的判断，而且不同人的判断差异很大。所以：

- 排线只用在卡片底纹、区块背景这类**身份与分区**元素上。
- 进度条用实心填充而不是排线——10px 高的地方排线会读成理发店转灯。
- 数字、单位、时间轴刻度、趋势线全部几何精确。

视觉参考是 Excalidraw 的手绘线条和 Nord 的低饱和配色。

## 开发

```bash
npm ci
npm run dev:mock     # 自带 mock 数据，不需要 hub
```

想接真实 hub：

```bash
MONITOR_HUB=https://hub.example.com npm run dev
```

不设 `MONITOR_HUB` 时代理到 `http://127.0.0.1:9911`。

```bash
npm run build          # tsc -b && vite build，产物在 dist/
npm run preview:mock   # 用构建产物跑一遍，验证生产包
```

## 已知限制

- **中文不是手写体。** Excalifont 只覆盖拉丁字母和数字，中文落回读者系统的楷体（见 `src/index.css` 的 `--font-hand`）。打包一套中文手写体要 6–13 MB，不值得让状态页的访客为一个标签下载。
- **地图按国家码落点。** 节点按 `country` 落在手绘世界地图上，同一国家的多个节点共用一个标记，标记落在国家标注点而不是机器位置；地图跟随上方的分组标签一起过滤，没有 `country` 的节点不出现在地图上。海岸线只到 Natural Earth 1:110m，缩放上限为 4 倍。
- **历史桶的 `minutes` 没用上。** 数据里每个桶带了自己覆盖多少分钟，主题没拿它算在线率——某行不满额说明那段时间节点掉过线，但图上直接看不出来。

## 许可

[MIT](LICENSE)。

随主题一起打包的第三方资源：

- [Excalifont](https://github.com/excalidraw/excalifont) —— [SIL Open Font License 1.1](public/licenses/Excalifont-OFL.txt)
- [country-flag-icons](https://gitlab.com/catamphetamine/country-flag-icons) —— MIT（国旗）
- [rough.js](https://www.npmjs.com/package/roughjs) —— MIT（手绘线条，含 hachure-fill / path-data-parser / points-on-curve / points-on-path）
- [React](https://www.npmjs.com/package/react) / [react-dom](https://www.npmjs.com/package/react-dom) / [scheduler](https://www.npmjs.com/package/scheduler) —— MIT
- [Natural Earth](https://www.naturalearthdata.com/) —— 地图数据，公有领域

每个依赖的完整 MIT 许可文本见 [`public/licenses/THIRD-PARTY-NOTICES.txt`](public/licenses/THIRD-PARTY-NOTICES.txt)。

---

<p align="center">边框可以手绘，数据必须清晰。</p>
