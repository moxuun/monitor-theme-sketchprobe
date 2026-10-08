import { createHash } from "node:crypto"
import type { EventEmitter } from "node:events"
import { readFileSync } from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Socket } from "node:net"
import { gzipSync } from "node:zlib"
import type { Connect, Plugin } from "vite"

/**
 * A fabricated hub for `MONITOR_MOCK=1 vite`, answering the same five paths the
 * real one does. It exists so the theme can be looked at, and screenshotted,
 * without a hub and a fleet of agents; nothing here is loaded by a build.
 *
 * The figures drift on a slow sine so the page is alive rather than frozen, and
 * the fleet deliberately holds every shape the theme has to render: online,
 * offline, never connected, capped and uncapped traffic, expiring soon and
 * expired, grouped and ungrouped.
 */

type Mock = {
  id: number
  name: string
  group: string
  country: string
  os: string
  kernel: string
  arch: string
  virt: string
  cpu_name: string
  cpu_cores: number
  mem_total: number
  disk_total: number
  agent_version: string
  price: number
  currency: string
  billing_cycle: string
  expires_in: number | null
  traffic_limit: number
  traffic_mode: string
  /** null is a node that never reported; a number is how long it has been gone. */
  offline?: number
}

const GB = 1024 ** 3

const FLEET: Mock[] = [
  { id: 1, name: "香港 · 中转", group: "亚太", country: "HK", os: "Debian GNU/Linux 12", kernel: "6.1.0-18-amd64", arch: "x86_64", virt: "kvm", cpu_name: "AMD EPYC 7763 64-Core Processor", cpu_cores: 4, mem_total: 8 * GB, disk_total: 80 * GB, agent_version: "1.4.2", price: 32, currency: "CNY", billing_cycle: "monthly", expires_in: 24, traffic_limit: 500 * GB, traffic_mode: "sum" },
  { id: 2, name: "东京 · BGP", group: "亚太", country: "JP", os: "Ubuntu 22.04.4 LTS", kernel: "5.15.0-105-generic", arch: "x86_64", virt: "kvm", cpu_name: "Intel Xeon Platinum 8370C", cpu_cores: 2, mem_total: 4 * GB, disk_total: 40 * GB, agent_version: "1.4.2", price: 8.5, currency: "USD", billing_cycle: "yearly", expires_in: 187, traffic_limit: 1000 * GB, traffic_mode: "max" },
  { id: 3, name: "新加坡 · 落地", group: "亚太", country: "SG", os: "Alpine Linux 3.19", kernel: "6.6.28-0-lts", arch: "x86_64", virt: "kvm", cpu_name: "AMD EPYC 7B13", cpu_cores: 2, mem_total: 2 * GB, disk_total: 20 * GB, agent_version: "1.4.1", price: 5, currency: "SGD", billing_cycle: "quarterly", expires_in: 6, traffic_limit: 300 * GB, traffic_mode: "sum" },
  { id: 4, name: "法兰克福 · 备份", group: "欧洲", country: "DE", os: "Rocky Linux 9.3", kernel: "5.14.0-362.el9.x86_64", arch: "x86_64", virt: "kvm", cpu_name: "Intel Xeon E5-2680 v4", cpu_cores: 8, mem_total: 16 * GB, disk_total: 400 * GB, agent_version: "1.4.2", price: 45, currency: "EUR", billing_cycle: "monthly", expires_in: 11, traffic_limit: 2000 * GB, traffic_mode: "sum" },
  { id: 5, name: "伦敦 · 前端", group: "欧洲", country: "GB", os: "Ubuntu 24.04 LTS", kernel: "6.8.0-31-generic", arch: "x86_64", virt: "kvm", cpu_name: "AMD EPYC 9354 32-Core Processor", cpu_cores: 4, mem_total: 8 * GB, disk_total: 100 * GB, agent_version: "1.4.2", price: 0, currency: "GBP", billing_cycle: "once", expires_in: null, traffic_limit: 0, traffic_mode: "sum" },
  { id: 6, name: "硅谷 · 中转", group: "北美", country: "US", os: "CentOS Stream 9", kernel: "5.14.0-412.el9.x86_64", arch: "x86_64", virt: "kvm", cpu_name: "Intel Xeon Gold 6248", cpu_cores: 2, mem_total: 4 * GB, disk_total: 60 * GB, agent_version: "1.3.9", price: 12, currency: "USD", billing_cycle: "monthly", expires_in: -3, traffic_limit: 500 * GB, traffic_mode: "down", offline: 8_400 },
  { id: 7, name: "悉尼 · 边缘", group: "大洋洲", country: "AU", os: "Fedora Linux 39", kernel: "6.7.11-200.fc39.x86_64", arch: "aarch64", virt: "kvm", cpu_name: "Ampere Altra Q80-30", cpu_cores: 4, mem_total: 8 * GB, disk_total: 80 * GB, agent_version: "1.4.2", price: 22, currency: "AUD", billing_cycle: "60m", expires_in: 903, traffic_limit: 750 * GB, traffic_mode: "sum" },
  { id: 8, name: "孟买 · 待接入", group: "", country: "IN", os: "", kernel: "", arch: "", virt: "none", cpu_name: "", cpu_cores: 0, mem_total: 0, disk_total: 0, agent_version: "", price: 0, currency: "", billing_cycle: "once", expires_in: null, traffic_limit: 0, traffic_mode: "sum" },
  { id: 9, name: "首尔 · 测速", group: "", country: "KR", os: "Debian GNU/Linux 11", kernel: "5.10.0-28-amd64", arch: "x86_64", virt: "lxc", cpu_name: "Intel Xeon E5-2660 v3", cpu_cores: 1, mem_total: GB, disk_total: 10 * GB, agent_version: "1.4.0", price: 3.5, currency: "USD", billing_cycle: "monthly", expires_in: 2, traffic_limit: 100 * GB, traffic_mode: "up", offline: 190 },
]

/** A slow, per-node phase so no two cards move together. */
const phase = (id: number) => id * 1.7

function metricsAt(node: Mock, now: number) {
  if (node.offline !== undefined) return null
  if (node.cpu_cores === 0) return null
  const t = now / 1000
  const wave = (period: number, amp: number, offset = 0) =>
    amp * (0.5 + 0.5 * Math.sin(t / period + phase(node.id) + offset))
  const cpu = Math.min(99, wave(97, 55, 0) + (node.id === 3 ? 22 : 0))
  const mem = node.mem_total * (0.28 + wave(311, 0.34))
  const disk = node.disk_total * (0.41 + node.id * 0.021)
  const rx = wave(37, 9.4e6) + wave(11, 2.1e6)
  const tx = wave(53, 3.2e6) + wave(7, 0.9e6)
  const month_rx = node.traffic_limit * (0.3 + node.id * 0.06)
  const month_tx = node.traffic_limit * (0.09 + node.id * 0.013)
  return {
    uptime: 86_400 * (11 + node.id) + 3_600 * node.id,
    cpu,
    load: [cpu / 25, cpu / 30, cpu / 34] as [number, number, number],
    mem_total: node.mem_total,
    mem_used: mem,
    swap_total: node.mem_total / 2,
    swap_used: node.mem_total * 0.012,
    disk_total: node.disk_total,
    disk_used: disk,
    net_rx: rx,
    net_tx: tx,
    total_rx: 40 * GB * node.id + month_rx,
    total_tx: 11 * GB * node.id + month_tx,
    month_rx,
    month_tx,
    tcp: 120 + node.id * 37,
    udp: 9 + node.id,
    procs: 180 + node.id * 21,
  }
}

function nodeJson(node: Mock, now: number) {
  const metrics = metricsAt(node, now)
  return {
    id: node.id,
    name: node.name,
    sort: node.id,
    public: true,
    online: metrics !== null,
    country: node.country,
    group: node.group,
    last_seen: Math.round(now / 1000) - (node.offline ?? 2),
    last_seen_ago: node.offline ?? (node.cpu_cores === 0 ? null : 2),
    metrics,
    os: node.os,
    kernel: node.kernel,
    arch: node.arch,
    virt: node.virt,
    cpu_name: node.cpu_name,
    cpu_cores: node.cpu_cores,
    mem_total: node.mem_total,
    swap_total: node.mem_total / 2,
    disk_total: node.disk_total,
    agent_version: node.agent_version,
    price: node.price,
    currency: node.currency,
    billing_cycle: node.billing_cycle,
    expires_at: null,
    expires_in: node.expires_in,
    traffic_limit: node.traffic_limit,
    traffic_mode: node.traffic_mode,
    traffic_reset_day: 1,
    total_rx: 40 * GB * node.id,
    total_tx: 11 * GB * node.id,
    month_rx: node.traffic_limit * (0.3 + node.id * 0.06),
    month_tx: node.traffic_limit * (0.09 + node.id * 0.013),
    month_used: node.traffic_mode === "max"
      ? Math.max(node.traffic_limit * (0.3 + node.id * 0.06), node.traffic_limit * (0.09 + node.id * 0.013))
      : node.traffic_mode === "down" ? node.traffic_limit * (0.3 + node.id * 0.06)
      : node.traffic_mode === "up" ? node.traffic_limit * (0.09 + node.id * 0.013)
      : node.traffic_limit * (0.39 + node.id * 0.073),
    month_start: "2026-10-01",
    day_rx: 2.4 * GB * (node.id % 4 + 1),
    day_tx: 0.7 * GB * (node.id % 3 + 1),
    public_remark: node.id === 3 ? "夜间 02:00-04:00 例行维护" : "",
  }
}

/** History rows on the hub's own grid: a bucket every `step` seconds. */
function history(node: Mock, hours: number, step: number, series: string) {
  const now = Math.floor(Date.now() / 1000)
  const since = Math.floor((now - hours * 3600) / step) * step
  const rows: Record<string, unknown>[] = []
  const ping: Record<string, unknown>[] = []
  const probeIds = node.id % 2 === 0 ? [1, 2] : [1]
  for (let ts = since; ts <= now; ts += step) {
    if (series === "metrics") {
      // `ts` is already seconds. Dividing it again put the phase at 1.79e6 and
      // moved it 0.009 radians across a six-hour window, which drew every chart
      // as a flat line.
      const t = ts
      const wave = (period: number, amp: number, offset = 0) =>
        amp * (0.5 + 0.5 * Math.sin(t / period + phase(node.id) + offset))
      const rx = 1.4e5 + wave(7200, 6.1e6) + wave(1500, 2.4e6)
      const tx = 6e4 + wave(9600, 2.6e6) + wave(1100, 0.9e6)
      rows.push({
        ts,
        cpu: Math.min(99, wave(5400, 42, 0) + wave(900, 10, 1.1)),
        cpu_max: Math.min(100, wave(5400, 42, 0) + wave(900, 10, 1.1) + 22),
        mem_used: node.mem_total * (0.3 + wave(14_400, 0.22)),
        // A disk barely moves, but a perfectly flat line reads as a broken chart
        // rather than as a full one, so it drifts as logs accumulate.
        disk_used: node.disk_total * (0.41 + node.id * 0.021) + wave(7200, 2.4e9),
        net_rx: rx,
        net_tx: tx,
        net_rx_max: rx * 2.7,
        net_tx_max: tx * 2.4,
        minutes: Math.round(step / 60),
      })
    } else {
      for (const id of probeIds) {
        const base = id === 1 ? 42 : 168
        const t = ts
        const wobble = 18 * Math.sin(t / 900 + id) + 6 * Math.sin(t / 90 + id * 3)
        const latency = Math.max(1, Math.round(base + wobble))
        // A stretch of loss, so the loss badge and the gap both have something
        // to render.
        const lost = node.id === 7 && ts > now - 3600 * 3 && ts < now - 3600 * 2 && (ts / step) % 3 === 0
        ping.push({
          task_id: id,
          ts,
          latency: lost ? null : latency,
          band: lost ? undefined : [latency - 4, latency + 9],
          loss: lost ? 33 : undefined,
        })
      }
    }
  }
  return { rows, ping, probes: { "1": "电信 163", "2": "联通 4837" }, loss: node.id === 7 ? { "1": 4.31 } : {} }
}

const json = (res: ServerResponse, body: unknown) => {
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify(body))
}

/**
 * The hub hands back whatever the operator saved over the theme's declared
 * defaults. Serving theme.json's own defaults here, plus MONITOR_MOCK_CONFIG as
 * an escape hatch, means a settings variant can be looked at without editing
 * theme.json and rebuilding:
 *
 *   MONITOR_MOCK_CONFIG='{"paper":"lines","wobble":3}' npm run dev
 */
const manifest = JSON.parse(readFileSync(new URL("../theme.json", import.meta.url), "utf8")) as {
  config: ({ key: string; default: unknown } | object)[]
}

const configDefaults = Object.fromEntries(
  manifest.config.filter((f): f is { key: string; default: unknown } => "key" in f).map((f) => [f.key, f.default]),
)

const configOverrides = process.env.MONITOR_MOCK_CONFIG
  ? (JSON.parse(process.env.MONITOR_MOCK_CONFIG) as Record<string, unknown>)
  : {}

const query = (url: string, key: string): string | null =>
  new URL(url, "http://mock").searchParams.get(key)

/**
 * The push stream, `/api/ws`.
 *
 * Hand-rolled rather than taken from `ws`: this file is dev-only, and the whole
 * of RFC 6455 the page exercises is one unmasked frame every two seconds in one
 * direction. `?gzip` sends those frames as binary, which is what a real hub does
 * and what the page's decode path is written against -- without it the live path
 * is never run at all, only the polling fallback it degrades to.
 */
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

/** One unmasked server frame: a FIN bit, the opcode, and the length. */
function wsFrame(payload: Buffer, opcode: number): Buffer {
  const n = payload.length
  const head = Buffer.alloc(n < 126 ? 2 : n < 65536 ? 4 : 10)
  head[0] = 0x80 | opcode
  if (n < 126) head[1] = n
  else if (n < 65536) {
    head[1] = 126
    head.writeUInt16BE(n, 2)
  } else {
    head[1] = 127
    head.writeBigUInt64BE(BigInt(n), 2)
  }
  return Buffer.concat([head, payload])
}

function upgrade(req: IncomingMessage, socket: Socket) {
  const url = new URL(req.url ?? "", "http://localhost")
  // Vite's own HMR socket arrives on the same server; leave it to Vite.
  if (url.pathname !== "/api/ws") return
  const key = req.headers["sec-websocket-key"]
  if (typeof key !== "string") return socket.destroy()
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${createHash("sha1").update(key + WS_GUID).digest("base64")}\r\n\r\n`,
  )
  socket.setNoDelay(true)
  const gzip = url.searchParams.has("gzip")
  const push = setInterval(() => {
    const body = Buffer.from(JSON.stringify({ nodes: FLEET.map((n) => nodeJson(n, Date.now())) }))
    socket.write(wsFrame(gzip ? gzipSync(body) : body, gzip ? 2 : 1))
  }, 2000)
  // A close frame, sent when the page goes away. Masked, so only the opcode is
  // read; that is enough to answer the handshake and let the browser's socket go.
  socket.on("data", (buf) => {
    if ((buf[0] & 0x0f) !== 8) return
    socket.write(wsFrame(Buffer.alloc(0), 8))
    socket.destroy()
  })
  socket.on("close", () => clearInterval(push))
  socket.on("error", () => {
    clearInterval(push)
    socket.destroy()
  })
}

export function mockApi(): Plugin {
  const handle: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ?? ""
    if (!url.startsWith("/api/")) return next()
    const now = Date.now()

    if (url.startsWith("/api/me")) {
      return json(res, { authed: false, github: false, site_name: "SketchProbe · Demo", public_page: true, history_days: 30 })
    }
    if (url.startsWith("/api/themes/")) {
      return json(res, { ...configDefaults, ...configOverrides })
    }
    if (url.startsWith("/api/nodes/") && url.includes("/metrics")) {
      const id = Number(/\/api\/nodes\/(\d+)\//.exec(url)?.[1])
      const node = FLEET.find((n) => n.id === id)
      if (!node) return next()
      const hours = Number(query(url, "hours") ?? 6)
      const points = Number(query(url, "points") ?? 1440)
      const hourly = hours > 24 * 7
      const unit = hourly ? 3600 : 60
      const step = unit * Math.max(1, Math.ceil((hours * 3600) / unit / points))
      const series = query(url, "series") ?? "metrics"
      const { rows, ping, probes, loss } = history(node, hours, step, series)
      return json(res, {
        metrics: series === "ping" ? [] : rows,
        ping: series === "metrics" ? [] : ping,
        probes: series === "metrics" ? {} : probes,
        loss: series === "metrics" ? {} : loss,
        step,
      })
    }
    if (url.startsWith("/api/nodes")) {
      return json(res, { nodes: FLEET.map((n) => nodeJson(n, now)) })
    }
    return next()
  }

  // `httpServer` is typed as the http1/http2 union, and only the http1 member
  // declares an `upgrade` event, so the parameter is taken as what both really
  // are. Vite serves http1 unless the project asks for http2.
  const mount = (server: { middlewares: Connect.Server; httpServer: EventEmitter | null }) => {
    server.middlewares.use(handle)
    server.httpServer?.on("upgrade", upgrade)
  }

  return {
    name: "sketchprobe-mock-hub",
    apply: "serve",
    configureServer: mount,
    // `vite preview` serves the built bundle, and the dev server never touches
    // dist/ -- so this is the only place that checks what actually ships
    // renders against a hub. `npm run preview:mock`.
    configurePreviewServer: mount,
  }
}
