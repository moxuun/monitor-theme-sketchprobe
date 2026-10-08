import type { MapNode } from "./WorldMap"

/**
 * Sample nodes, shaped like what the hub's status endpoint returns.
 *
 * Enough of them to exercise the map rather than to look impressive: two
 * countries with more than one node, one node that is down, one that is up but
 * has not reported, and one whose country code the hub could not resolve.
 */
export const ROUTINE: MapNode[] = [
  { id: 1, name: "hk-01", country: "HK", group: "亚太", online: true, cpu: 41.2, mem: 63.4, net_rx: 812_000_000, net_tx: 1_240_000_000 },
  { id: 2, name: "hk-02", country: "HK", group: "亚太", online: true, cpu: 88.7, mem: 71.9, net_rx: 1_920_000_000, net_tx: 2_460_000_000 },
  { id: 3, name: "sg-01", country: "SG", group: "亚太", online: true, cpu: 22.4, mem: 38.1, net_rx: 410_000_000, net_tx: 388_000_000 },
  { id: 4, name: "tyo-01", country: "JP", group: "亚太", online: true, cpu: 12.8, mem: 30.6, net_rx: 264_000_000, net_tx: 301_000_000 },
  { id: 5, name: "syd-01", country: "AU", group: "亚太", online: true, cpu: 5.1, mem: 18.2, net_rx: 96_000_000, net_tx: 88_000_000 },
  { id: 6, name: "blr-01", country: "IN", group: "亚太", online: true, cpu: 63.9, mem: 55.0, net_rx: 733_000_000, net_tx: 690_000_000 },
  { id: 7, name: "fra-01", country: "DE", group: "欧洲", online: true, cpu: 34.6, mem: 47.3, net_rx: 512_000_000, net_tx: 604_000_000 },
  { id: 8, name: "fra-02", country: "DE", group: "欧洲", online: true, cpu: 91.5, mem: 82.7, net_rx: 2_310_000_000, net_tx: 2_870_000_000 },
  { id: 9, name: "ams-01", country: "NL", group: "欧洲", online: true, cpu: null, mem: null, net_rx: 445_000_000, net_tx: 470_000_000 },
  { id: 10, name: "lon-01", country: "GB", group: "欧洲", online: true, cpu: 47.0, mem: 52.1, net_rx: 688_000_000, net_tx: 731_000_000 },
  { id: 11, name: "nyc-01", country: "US", group: "北美", online: true, cpu: 55.7, mem: 61.2, net_rx: 1_120_000_000, net_tx: 1_480_000_000 },
  { id: 12, name: "sfo-01", country: "US", group: "北美", online: true, cpu: 19.4, mem: 33.7, net_rx: 322_000_000, net_tx: 356_000_000 },
  { id: 13, name: "sao-01", country: "BR", group: "南美", online: false, cpu: 0, mem: 0, net_rx: 0, net_tx: 0 },
  { id: 14, name: "edge-ny5", country: "", group: "边缘", online: true, cpu: null, mem: null, net_rx: 12_400_000, net_tx: 9_800_000 },
]

/** The same fleet with a bad afternoon: one down, one running hot, one dark. */
export const INCIDENT: MapNode[] = ROUTINE.map((n) => {
  if (n.name === "hk-02") return { ...n, online: false, cpu: 0, mem: 0, net_rx: 0, net_tx: 0 }
  if (n.name === "fra-01") return { ...n, cpu: 96.3, mem: 94.1 }
  if (n.name === "ams-01") return { ...n, cpu: 79.4, mem: 84.2 }
  if (n.name === "tyo-01") return { ...n, cpu: null, mem: null }
  if (n.name === "sg-01") return { ...n, cpu: 79.4, mem: 84.2 }
  return n
})

export const SCENARIOS = { ROUTINE, INCIDENT } as const

export type ScenarioName = keyof typeof SCENARIOS
