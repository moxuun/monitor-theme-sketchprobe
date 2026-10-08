import type { Node } from "@/lib/api"
import { expiryOf, loadColor, statusOf } from "@/lib/derive"
import { pair, percent, rate } from "@/lib/format"
import { Link } from "@/lib/route"
import type { LatencyResult } from "@/lib/latency"
import { Badge } from "@/components/Badge"
import { Flag } from "@/components/Flag"
import { Icon } from "@/components/Icon"
import { Meter } from "@/components/Meter"
import { SketchBox } from "@/sketch/Sketch"

export function NodeCard({ node, latency }: { node: Node; latency?: LatencyResult }) {
  const m = node.metrics
  const status = statusOf(node)
  const expiry = expiryOf(node)
  const trafficPct = percent(node.month_used ?? 0, node.traffic_limit)

  return (
    <SketchBox
      className="card"
      seedKey={`card-${node.id}`}
      radius={11}
      fill={status.tone === "off" ? "var(--muted)" : "var(--hatch)"}
    >
      {/* A real anchor over the whole card rather than a click handler on the
          box: it is reachable by keyboard and announced as a link, and a middle
          or modified click opens the node in its own tab. */}
      <Link className="card-hit" href={`/node/${node.id}`}>
        <span className="sr-only">查看 {node.name}</span>
      </Link>

      <div className="card-head">
        <Flag country={node.country} className="card-flag" />
        <span className="card-name">{node.name}</span>
        <span className="spacer" />
        {expiry ? <Badge tone={expiry.tone}>{expiry.text}</Badge> : null}
        <Badge tone={status.tone} dot={status.dot}>
          {status.mark ? <Icon name={status.mark} size={12} /> : null}
          {status.text}
        </Badge>
      </div>

      {/* A remark is an annotation, so it is drawn as one: a dashed pen box on
          a patch of clean paper rather than a line of grey text. The ellipsis
          stays on the text inside, so the frame is never clipped. */}
      {node.public_remark ? (
        <SketchBox className="card-remark" seedKey={`card-remark-${node.id}`} radius={7} dashed stroke="var(--rule)" strokeWidth={1.2}>
          <span className="card-remark-text">
            <Icon name="comment" size={14} className="mark-inline" />
            {node.public_remark}
          </span>
        </SketchBox>
      ) : null}

      {m ? (
        <div className="card-meters">
          <Meter name="CPU" pct={m.cpu} color={loadColor(m.cpu)} label={`${m.cpu.toFixed(0)}%`} seedKey={`${node.id}-cpu`} />
          <Meter
            name="内存"
            pct={percent(m.mem_used, m.mem_total)}
            color={loadColor(percent(m.mem_used, m.mem_total))}
            label={pair(m.mem_used, m.mem_total)}
            seedKey={`${node.id}-mem`}
          />
          <Meter
            name="磁盘"
            pct={percent(m.disk_used, m.disk_total)}
            color={loadColor(percent(m.disk_used, m.disk_total))}
            label={pair(m.disk_used, m.disk_total)}
            seedKey={`${node.id}-disk`}
          />
          {/* Only where there is a cap. An uncapped node drawn at zero against
              nothing would read as an empty quota rather than as no quota. */}
          {node.traffic_limit > 0 ? (
            <Meter
              name="流量"
              pct={trafficPct}
              color={loadColor(trafficPct, "var(--plum)")}
              label={pair(node.month_used ?? 0, node.traffic_limit)}
              seedKey={`${node.id}-traffic`}
            />
          ) : null}
        </div>
      ) : null}

      {node.online ? (
        <div className="card-latency">
          <span className="card-latency-label">延迟 · 最近采样</span>
          {!latency ? <span>读取中…</span> : latency.error ? (
            <span>延迟暂不可用</span>
          ) : latency.lines.length === 0 ? <span>暂无探测记录</span> : (
            <dl className="card-latency-lines">
              {latency.lines.map((line) => (
                <div key={line.id}>
                  <dt>{line.name}</dt>
                  <dd className={line.value === null ? "error" : undefined}>
                    {line.value === null ? "超时" : `${Number(line.value.toFixed(1))} ms`}
                    <time dateTime={new Date(line.ts * 1000).toISOString()}>
                      {new Date(line.ts * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </time>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ) : null}

      <div className="card-foot">
        {m ? (
          <span className="io">
            <span className="io-item down">
              <Icon name="down" size={12} />
              {rate(m.net_rx)}
            </span>
            <span className="io-item up">
              <Icon name="up" size={12} />
              {rate(m.net_tx)}
            </span>
          </span>
        ) : (
          // The group moves to the left when there is no throughput to show, so
          // the row never has a side that is blank for no reason.
          <span className="tiny">{node.group || "未分组"}</span>
        )}
        {m ? <span className="tiny">{node.group || "未分组"}</span> : null}
      </div>
    </SketchBox>
  )
}
