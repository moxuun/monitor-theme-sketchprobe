<p align="center">
  <img src="public/favicon.svg" alt="SketchProbe" height="120">
</p>

<h1 align="center">SketchProbe</h1>

<p align="center">
  <strong>monitor 的手绘风格主题。</strong>
</p>

<p align="center">
  可以查看服务器状态、资源使用情况、流量和网络延迟。<br>
  需要配合 monitor 使用，不能单独运行。
</p>

<p align="center">
  <a href="https://github.com/moxuun/monitor-theme-sketchprobe/releases"><img src="https://img.shields.io/badge/release-v0.1.0-4e7ca1" alt="Release"></a>
  <a href="https://github.com/monitor-probe/monitor"><img src="https://img.shields.io/badge/monitor-theme-6e8f5a" alt="monitor theme"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-bd8a2c" alt="License"></a>
</p>

<p align="center">
  <a href="#界面预览">界面预览</a> · <a href="#主要特点">主要特点</a> · <a href="#页面能看什么">页面能看什么</a> · <a href="#安装方法">安装方法</a> · <a href="#主题设置">主题设置</a> · <a href="#说明">说明</a> · <a href="#许可">许可</a>
</p>

## 界面预览

支持浅色和深色，可以在页面右上角切换。

![SketchProbe 浅色模式](preview.png)

<details>
<summary>深色模式预览</summary>

![SketchProbe 深色模式](preview-dark.png)

</details>

## 主要特点

- **手绘边框与背景**：卡片外框、分割线为手绘线条，进度条、数值与图表仍为标准图形。
- **手绘世界地图**：显示各区域节点分布，支持随分组标签筛选，点击或悬浮可查看对应节点。
- **4 种底纹背景**：提供方格纸、点阵纸、横线纸和空白纸，可在后台切换。
- **手绘弯曲程度可调**：可在后台调整线条的弯曲程度（0 到 4 级）。
- **浅色与深色模式**：浅色为米白底色，深色为深灰底色。
- **实时刷新不抖动**：数据刷新时，边框线条保持固定，不会随数值变动而重新晃动。

## 页面能看什么

- **顶部汇总**：显示当前分组的节点数、最忙节点、今日流量以及实时网速。
- **节点列表卡片**：
  - 显示国旗、节点名称、在线状态与到期提示。
  - CPU、内存、磁盘使用率，以及设置了上限的月度流量进度。
  - 多线路网络延迟走势与实时数值。
  - 实时上下行网速、管理员公开备注。
- **节点详情页**：
  - 点击节点卡片进入详情，可查看 CPU 型号、系统与内核版本、虚拟化架构、探针版本。
  - 显示计费周期、价格、到期剩余天数与累计总流量。
  - 查看 CPU、内存、磁盘和网速的历史变化折线图，支持切换时间范围。

## 安装方法

### 方式一：后台直接上传（推荐）

1. 从 [Releases](https://github.com/moxuun/monitor-theme-sketchprobe/releases) 下载 `theme.tar.gz`。
2. 登录 monitor hub 后台，进入「主题」页面。
3. 上传下载好的 `theme.tar.gz` 文件。
4. 在主题列表里启用 SketchProbe。

<details>
<summary>方式二：手动解压安装</summary>

解压到 hub 启动参数 `--themes` 指向的目录下，子目录名使用 `sketchprobe`：

```bash
mkdir -p /path/to/themes/sketchprobe
tar -xzf theme.tar.gz -C /path/to/themes/sketchprobe
```

解压后重启 hub，或在后台刷新主题列表。

</details>

## 主题设置

在 monitor hub 后台的「主题」设置中修改：

| 设置项 | 说明 | 默认值 | 可选范围 |
| --- | --- | --- | --- |
| **公告** | 页面顶部的提示文字，留空则不显示 | 空 | 文本 |
| **显示汇总** | 节点列表上方的四格汇总卡片开关 | 开启 | 开启 / 关闭 |
| **底纹** | 页面背景样式 | 方格纸 | 方格纸、点阵纸、横线纸、空白纸 |
| **手绘程度** | 线条的弯曲程度 | 2 | 0（最规整）~ 4（最潦草） |

## 说明

- **中文字体**：英文字母和数字使用内置的 Excalifont 手写体；中文使用访问设备上的本地字体，不同系统或浏览器下的显示效果可能略有差异。

## 许可

本项目采用 [MIT](LICENSE) 许可证开源。

引用的第三方资源：

- [Excalifont](https://github.com/excalidraw/excalifont) —— [SIL Open Font License 1.1](public/licenses/Excalifont-OFL.txt)
- [country-flag-icons](https://gitlab.com/catamphetamine/country-flag-icons) —— MIT
