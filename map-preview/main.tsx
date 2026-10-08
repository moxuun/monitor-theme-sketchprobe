import { StrictMode, useState } from "react"
import { createRoot, type Root } from "react-dom/client"

import { WorldMap } from "./WorldMap"
import { SCENARIOS, type ScenarioName } from "./fixtures"

const LABEL: Record<ScenarioName, string> = { ROUTINE: "日常", INCIDENT: "故障演练" }

export function App() {
  const [scenario, setScenario] = useState<ScenarioName>("ROUTINE")
  const [picked, setPicked] = useState<string | null>(null)
  const nodes = SCENARIOS[scenario]

  const online = nodes.filter((n) => n.online).length
  const dark = nodes.filter((n) => n.online && n.cpu === null).length
  const hot = nodes.filter((n) => n.online && n.cpu !== null && n.cpu >= 75).length

  return (
    <div className="mp-app">
      <section className="mp-sheet">
        <header className="mp-head">
          <h1 className="mp-title">
            全球节点
            <small>Global nodes · 经线 30° · 纬线 20°</small>
          </h1>
          <div className="mp-stamp">
            <div>
              <b>{nodes.length}</b> 个节点 · 在线 <b>{online}</b>
              {nodes.length > online ? (
                <>
                  {" · "}
                  <span className="mp-offline">停机 {nodes.length - online}</span>
                </>
              ) : null}
            </div>
            <div>
              告警 <b>{hot}</b> · 无数据 <b>{dark}</b>
            </div>
          </div>
        </header>

        <WorldMap nodes={nodes} onOpen={(id) => setPicked(nodes.find((n) => n.id === id)?.name ?? null)} />

        <div className="mp-legend">
          <span>
            <i data-tone="ok" />
            正常
          </span>
          <span>
            <i data-tone="warn" />
            CPU ≥ 75%
          </span>
          <span>
            <i data-tone="bad" />
            CPU ≥ 90%
          </span>
          <span>
            <i data-tone="off" />
            停机
          </span>
          <span>
            <i data-tone="idle" />
            在线但无数据
          </span>
          <span className="mp-legend-note">标记落在国家/地区示意位置，不是机房位置</span>
        </div>
      </section>

      <div className="mp-controls">
        {(Object.keys(SCENARIOS) as ScenarioName[]).map((key) => (
          <button
            key={key}
            type="button"
            className="mp-btn"
            aria-pressed={scenario === key}
            onClick={() => {
              setScenario(key)
              setPicked(null)
            }}
          >
            {LABEL[key]}
          </button>
        ))}
        <span className="mp-note">
          {picked ? `已选择 ${picked} · 正式主题里从这里进入节点详情` : "滚轮缩放（最大 4 倍）· 拖动平移 · 数据是样例"}
        </span>
      </div>

      <p className="mp-note">
        原型：地图为 Natural Earth 1:110m 国界（公有领域）转 SVG path，陆地和海洋的彩铅排线是 SVG
        <code> pattern</code> 平铺；外框、罗盘和节点圈线由 Rough.js 生成，同一个种子每次画得一样。国界线保持精确，
        手绘只出现在结构与装饰上。缩放到 4 倍为止：再放大看到的是 110m 数据的坐标阶梯，不是海岸线。
      </p>
    </div>
  )
}

// Keyed on the element rather than held in a module variable: an edit re-runs
// this module, and a second createRoot on a container that already has one is
// an error rather than a re-render.
const host = document.getElementById("root") as (HTMLElement & { mpRoot?: Root }) | null
if (host) {
  host.mpRoot ??= createRoot(host)
  host.mpRoot.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
