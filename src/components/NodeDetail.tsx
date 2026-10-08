import { useState, type ReactNode } from "react"

import type { Node } from "@/lib/api"
import { cx } from "@/lib/cx"
import { ago, loadColor, statusOf } from "@/lib/derive"
import {
  FOREVER,
  axisBytes,
  bytes,
  cpuName,
  cycle,
  daysUntil,
  money,
  osName,
  pair,
  percent,
  rate,
  uptime,
  windows,
} from "@/lib/format"
import { useMetrics } from "@/lib/history"
import { Link } from "@/lib/route"
import { Badge } from "@/components/Badge"
import { ResourceChart } from "@/components/Chart"
import { Flag } from "@/components/Flag"
import { Icon, type IconName } from "@/components/Icon"
import { Meter } from "@/components/Meter"
import { OsIcon } from "@/components/OsIcon"
import { SketchBox, SketchRing } from "@/sketch/Sketch"

function Fact({ label, children, hand }: { label: ReactNode; children: ReactNode; hand?: boolean }) {
  return (
    <div className="fact">
      <span className="fact-key">{label}</span>
      <span className={cx("fact-value", hand && "hand")} title={typeof children === "string" ? children : undefined}>
        {children}
      </span>
    </div>
  )
}

function Panel({
  title,
  icon,
  now,
  children,
}: {
  title: string
  icon?: IconName
  now: ReactNode
  children: ReactNode
}) {
  return (
    <SketchBox className="panel" seedKey={`panel-${title}`} radius={10}>
      <div className="panel-head">
        <span className="panel-title with-icon">
          {icon ? <Icon name={icon} size={14} /> : null}
          {title}
        </span>
        <span className="panel-now">{now}</span>
      </div>
      {children}
    </SketchBox>
  )
}

export function NodeDetail({ node, historyDays }: { node: Node; historyDays: number }) {
  const offered = windows(historyDays)
  const [hours, setHours] = useState(() => offered[Math.min(1, offered.length - 1)].hours)
  const { rows, error, retry } = useMetrics(node.id, hours)

  const m = node.metrics
  const status = statusOf(node)
  const days = node.expires_in ?? daysUntil(node.expires_at)
  const trafficPct = percent(node.month_used ?? 0, node.traffic_limit)

  return (
    <div className="stack">
      <SketchBox className="detail-head" seedKey={`head-${node.id}`} radius={12}>
        <div className="detail-title">
          <Flag country={node.country} className="detail-flag" />
          <div>
            <div className="detail-name-row">
              <h1>{node.name}</h1>
              {node.os ? <OsIcon os={node.os} className="detail-os" /> : null}
            </div>
            <div className="row tiny muted">
              <span>{node.group || "未分组"}</span>
              <span>·</span>
              <span>{node.os ? osName(node.os) : "未上报系统信息"}</span>
            </div>
          </div>
        </div>
        <div className="row">
          <Badge tone={status.tone} dot={status.dot}>
            {status.mark ? <Icon name={status.mark} size={12} /> : null}
            {status.text}
          </Badge>
          {m ? <Badge tone="off">已运行 {uptime(m.uptime)}</Badge> : null}
          <Link className="icon-btn" href="/" title="返回节点列表">
            <Icon name="back" />
          </Link>
        </div>
      </SketchBox>

      {node.public_remark ? (
        <SketchBox className="notice" seedKey={`remark-${node.id}`} dashed stroke="var(--rule)" strokeWidth={1.2}>
          <Icon name="comment" size={15} className="mark-inline" />
          {node.public_remark}
        </SketchBox>
      ) : null}

      {m ? (
        <SketchBox className="tile" seedKey={`load-${node.id}`} radius={10}>
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
        </SketchBox>
      ) : null}

      <SketchBox className="facts" seedKey={`facts-${node.id}`} radius={10}>
        <Fact
          label={
            <span className="with-icon">
              <Icon name="terminal" size={13} />
              内核
            </span>
          }
        >
          {node.kernel || "—"}
        </Fact>
        <Fact
          label={
            <span className="with-icon">
              <Icon name="layers" size={13} />
              架构
            </span>
          }
        >
          {node.arch ? `${node.arch} · ${node.virt}` : "—"}
        </Fact>
        <Fact
          label={
            <span className="with-icon">
              <Icon name="chip" size={13} />
              处理器
            </span>
          }
          hand
        >
          {node.cpu_name ? `${cpuName(node.cpu_name)} · ${node.cpu_cores} 核` : "—"}
        </Fact>
        <Fact
          label={
            <span className="with-icon">
              <Icon name="ram" size={13} />
              内存
            </span>
          }
        >
          {node.mem_total ? bytes(node.mem_total) : "—"}
        </Fact>
        <Fact
          label={
            <span className="with-icon">
              <Icon name="disk" size={13} />
              磁盘
            </span>
          }
        >
          {node.disk_total ? bytes(node.disk_total) : "—"}
        </Fact>
        <Fact
          label={
            <span className="with-icon">
              <Icon name="probe" size={13} />
              探针
            </span>
          }
        >
          {node.agent_version || "—"}
        </Fact>
        <Fact
          label={
            <span className="with-icon">
              <Icon name="clock" size={13} />
              最后上报
            </span>
          }
        >
          {node.online ? "刚刚" : node.last_seen_ago ? `${ago(node.last_seen_ago)}前` : "—"}
        </Fact>
        <Fact
          label={
            <span className="with-icon">
              <Icon name="network" size={13} />
              本月流量
            </span>
          }
        >
          {node.traffic_limit > 0 ? pair(node.month_used ?? 0, node.traffic_limit) : "不限"}
        </Fact>
        <Fact label="流量上限">{node.traffic_limit > 0 ? bytes(node.traffic_limit) : FOREVER}</Fact>
        <Fact label="累计流量">{bytes(node.total_rx + node.total_tx)}</Fact>
        <Fact label="计费">
          {node.price > 0 ? `${money(node.price, node.currency || "CNY")} / ${cycle(node.billing_cycle)}` : "免费"}
        </Fact>
        <Fact
          label={
            <span className="with-icon">
              <Icon name="calendar" size={13} />
              到期
            </span>
          }
        >
          {days === null || days === undefined
            ? FOREVER
            : days < 0
              ? `已过期 ${-days} 天`
              : node.expires_at
                ? `${node.expires_at} · 剩 ${days} 天`
                : `剩 ${days} 天`}
        </Fact>
      </SketchBox>

      <div className="tabs">
        {offered.map((w) => (
          <button
            key={w.hours}
            className="tab"
            type="button"
            aria-selected={w.hours === hours}
            onClick={() => setHours(w.hours)}
          >
            {w.hours === hours ? <SketchRing seedKey={`win-${w.hours}`}>{w.label}</SketchRing> : w.label}
          </button>
        ))}
        <span className="spacer" />
        <span className="tiny muted">历史保留 {historyDays} 天</span>
      </div>

      {error ? (
        <div className="error">
          {error}
          <button className="nav-item" type="button" onClick={retry}>
            重试
          </button>
        </div>
      ) : null}

      <div className="panels">
        <Panel title="CPU 使用率" icon="gauge" now={m ? `${m.cpu.toFixed(1)}%` : "—"}>
          <ResourceChart
            rows={rows ?? []}
            hours={hours}
            axis={{ kind: "linear", unit: "percent", floor: 20, cap: 100 }}
            format={(v) => `${v.toFixed(0)}%`}
            series={[{ pick: (r) => r.cpu, color: "var(--accent)", fill: true }]}
          />
        </Panel>
        <Panel title="内存占用" icon="ram" now={m ? pair(m.mem_used, m.mem_total) : "—"}>
          <ResourceChart
            rows={rows ?? []}
            hours={hours}
            axis={{ kind: "linear", unit: "bytes", floor: node.mem_total * 0.15, cap: node.mem_total }}
            format={axisBytes}
            series={[{ pick: (r) => r.mem_used, color: "var(--plum)", fill: true }]}
          />
        </Panel>
        <Panel title="磁盘占用" icon="disk" now={m ? pair(m.disk_used, m.disk_total) : "—"}>
          <ResourceChart
            rows={rows ?? []}
            hours={hours}
            axis={{ kind: "linear", unit: "bytes", floor: node.disk_total * 0.15, cap: node.disk_total }}
            format={axisBytes}
            series={[{ pick: (r) => r.disk_used, color: "var(--ok)", fill: true }]}
          />
        </Panel>
        <Panel
          title="网络速率"
          icon="network"
          now={m ? `↓ ${rate(m.net_rx)} ↑ ${rate(m.net_tx)}` : "—"}
        >
          <ResourceChart
            rows={rows ?? []}
            hours={hours}
            axis={{ kind: "log" }}
            format={axisBytes}
            series={[
              // No area fill here: on a logarithmic axis the wash under the line
              // is most of the plot, and it swallows the second line.
              { pick: (r) => r.net_rx, color: "var(--accent)" },
              { pick: (r) => r.net_tx, color: "var(--plum)" },
            ]}
          />
        </Panel>
      </div>
    </div>
  )
}
