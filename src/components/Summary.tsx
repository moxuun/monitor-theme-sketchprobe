import { speedHistory, type Node } from "@/lib/api"
import { bytes, rate } from "@/lib/format"
import { Icon } from "@/components/Icon"
import { SketchBox, useBoxSize } from "@/sketch/Sketch"

/** Two lines of throughput over the last two minutes, one point per push. */
function Spark({ series }: { series: { rx: number; tx: number }[] }) {
  const [ref, [w, h]] = useBoxSize<HTMLDivElement>()
  // Deliberately not memoised: the series array is mutated in place by the
  // stream, so its identity never changes and a dependency on it would never
  // fire. Sixty points twice over is not worth the bookkeeping.
  const path = (pick: (s: { rx: number; tx: number }) => number) => {
    if (w <= 0 || h <= 0 || series.length < 2) return null
    const peak = Math.max(1, ...series.map((s) => Math.max(s.rx, s.tx)))
    const step = w / (series.length - 1)
    return series
      .map((s, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${(h - 2 - (pick(s) / peak) * (h - 6)).toFixed(1)}`)
      .join(" ")
  }
  const rx = path((s) => s.rx)
  const tx = path((s) => s.tx)
  return (
    <div className="spark" ref={ref}>
      {rx ? (
        <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          <path d={tx ?? ""} fill="none" stroke="var(--plum)" strokeWidth={1.4} strokeLinejoin="round" />
          <path d={rx} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  )
}

function Tile({ label, children, note, seedKey }: { label: string; children: React.ReactNode; note?: React.ReactNode; seedKey: string }) {
  return (
    <SketchBox className="tile" seedKey={seedKey} radius={10}>
      <div className="label">{label}</div>
      <div className="tile-value">{children}</div>
      {note ? <div className="tile-note">{note}</div> : null}
    </SketchBox>
  )
}

/** The four figures above the node list, scoped to the tab that is showing. */
export function Summary({ nodes, group }: { nodes: Node[]; group: string | null }) {
  const reporting = nodes.filter((n) => n.online && n.metrics)
  const busiest = reporting.reduce<Node | null>(
    (top, n) => (!top || (n.metrics?.cpu ?? 0) > (top.metrics?.cpu ?? 0) ? n : top),
    null,
  )
  const dayRx = nodes.reduce((sum, n) => sum + (n.day_rx || 0), 0)
  const dayTx = nodes.reduce((sum, n) => sum + (n.day_tx || 0), 0)
  // Keyed as the stream keys it: null for the whole fleet, "" for the ungrouped.
  const series = speedHistory.get(group) ?? []
  const last = series[series.length - 1] ?? { rx: 0, tx: 0 }
  const groups = new Set(nodes.map((n) => n.group ?? "").filter(Boolean)).size

  return (
    <div className="summary">
      <Tile
        label="节点"
        seedKey="sum-nodes"
        note={
          <span className="with-icon">
            <Icon name="bracket" size={13} />
            {groups} 个分组
          </span>
        }
      >
        {reporting.length}
        <span className="tile-of"> / {nodes.length}</span>
      </Tile>
      <Tile
        label="最忙节点"
        seedKey="sum-busy"
        note={busiest ? busiest.name : "没有节点在线"}
      >
        {busiest ? `${(busiest.metrics?.cpu ?? 0).toFixed(0)}%` : "—"}
      </Tile>
      <Tile
        label="今日流量"
        seedKey="sum-day"
        note={
          <span className="io">
            <span className="io-item down">
              <Icon name="down" size={12} />
              {bytes(dayRx)}
            </span>
            <span className="io-item up">
              <Icon name="up" size={12} />
              {bytes(dayTx)}
            </span>
          </span>
        }
      >
        {bytes(dayRx + dayTx)}
      </Tile>
      <SketchBox className="tile" seedKey="sum-speed" radius={10}>
        <div className="label">实时网速</div>
        <div className="tile-value small">
          <span className="io-item down">
            <Icon name="down" size={13} />
            {rate(last.rx)}
          </span>
        </div>
        <div className="tile-note">
          <span className="io-item up">
            <Icon name="up" size={12} />
            {rate(last.tx)}
          </span>
        </div>
        <Spark series={series} />
      </SketchBox>
    </div>
  )
}
