<p align="center">
  <img src="public/favicon.svg" alt="SketchProbe" height="120">
</p>

<h1 align="center">SketchProbe</h1>

<p align="center">
  <strong>给 monitor 探针的手绘工程草图风主题：边框像随手画在纸上，数据依然清晰锐利。</strong>
</p>

<p align="center">
  专为自建服务器和 VPS 玩家设计的状态页主题。全球节点、流量配额、网络延迟照常实时更新，<br>
  只是把千篇一律的仪表盘，换成了方格纸、铅笔线条和手写草图。
</p>

<p align="center">
  <a href="https://github.com/moxuun/monitor-theme-sketchprobe/releases"><img src="https://img.shields.io/badge/release-v0.1.0-4e7ca1" alt="Release"></a>
  <a href="https://github.com/monitor-probe/monitor"><img src="https://img.shields.io/badge/monitor-theme-6e8f5a" alt="monitor theme"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-bd8a2c" alt="License"></a>
</p>

<p align="center">
  <a href="#界面预览">界面预览</a> · <a href="#主要特色">主要特色</a> · <a href="#能看什么">能看什么</a> · <a href="#安装方法">安装方法</a> · <a href="#主题设置">主题设置</a> · <a href="#使用说明">使用说明</a> · <a href="#许可">许可</a>
</p>

## 界面预览

白天像方格本上的铅笔草稿，夜间像黑板上的粉笔手绘。

![SketchProbe 浅色模式](preview.png)

<details>
<summary>点击展开：深色模式预览</summary>

![SketchProbe 深色模式](preview-dark.png)

</details>

## 主要特色

- **边框手绘，数据清晰**：外框、分隔线采用手绘笔触，但进度条、数字、刻度与趋势线均保持精准直观，绝不为了风格牺牲可读性。
- **手绘世界地图**：直观展示全球节点地理分布，支持悬浮查看详情，并能随分组标签联动切换。
- **4 种纸张底纹**：提供方格纸、点阵纸、横线纸和纯白纸，在后台随时一键切换。
- **笔触随意度可调**：手绘线条支持 0 到 4 级调节，想要工整规矩还是随性潦草，由你决定。
- **明暗双色模式**：浅色采用米白纸张与石墨墨色，深色采用暖炭底色与粉笔白，昼夜切换顺眼不刺眼。
- **刷新稳固不抖动**：卡片线条由固定种子生成，数据实时更新时外框稳固，不会随数据刷新产生画面抖动。

## 能看什么

- **首页概览**：顶部四格汇总卡片，一览在线节点数、负载最高节点、今日消耗流量与实时全网网速。
- **节点卡片**：
  - 显示国旗、系统图标、节点名称、在线/离线状态与到期提醒。
  - CPU、内存、磁盘以及月度流量配额进度条。
  - 多线路网络延迟与丢包探测（带实时走势小图与精确毫秒数）。
  - 实时上行与下行网速、管理员公开备注。
- **节点详情页**：
  - 点击任意节点进入详情，查看详细硬件规格（CPU 型号与核心数、系统内核、虚拟化架构、探针版本）。
  - 查看计费周期、价格、到期剩余天数与累计总流量。
  - 提供 CPU 使用率、内存占用、磁盘占用与网络速率的多维度历史趋势折线图，支持切换查看时间范围。

## 安装方法

### 方式一：后台直接上传（推荐）

1. 前往 [Releases](https://github.com/moxuun/monitor-theme-sketchprobe/releases) 页面，下载最新的 `theme.tar.gz`。
2. 登录 monitor hub 管理后台，进入「主题」设置页面。
3. 点击上传 `theme.tar.gz` 文件。
4. 在主题列表里找到 SketchProbe，点击启用即可。

<details>
<summary>方式二：手动解压安装</summary>

把下载的压缩包解压到 hub 启动参数 `--themes` 所指定的目录下，子目录名固定为 `sketchprobe`：

```bash
mkdir -p /path/to/themes/sketchprobe
tar -xzf theme.tar.gz -C /path/to/themes/sketchprobe
```

解压完成后重启 hub，或在后台刷新主题列表后启用。

</details>

## 主题设置

在 monitor hub 后台的「主题」设置中，可以根据喜好调整以下选项：

| 设置项 | 说明 | 默认值 | 可选范围 |
| --- | --- | --- | --- |
| **公告** | 显示在状态页顶部的提示信息，留空则不显示 | 空 | 任意文本 |
| **显示汇总** | 是否显示节点列表上方的四格汇总卡片（节点数、最忙节点、今日流量、实时网速） | 开启 | 开启 / 关闭 |
| **底纹** | 页面背景的纸张样式 | 方格纸 | 方格纸、点阵纸、横线纸、空白纸 |
| **手绘程度** | 线条的草图感与抖动程度 | 2 | 0（最规整）~ 4（最潦草） |

## 使用说明

- **中文字体呈现**：主题英文字母与数字使用内置手绘字体（Excalifont）；中文则自动使用系统楷体等手写风格字体。这样既保持了手绘视觉风格，又避免强迫访客下载数十兆的中文字体包，确保页面极速加载。

## 许可

本项目采用 [MIT](LICENSE) 许可证开源。

附带的第三方资源：

- [Excalifont](https://github.com/excalidraw/excalifont) —— [SIL Open Font License 1.1](public/licenses/Excalifont-OFL.txt)
- [country-flag-icons](https://gitlab.com/catamphetamine/country-flag-icons) —— MIT

---

<p align="center">边框可以手绘，数据必须清晰。</p>
