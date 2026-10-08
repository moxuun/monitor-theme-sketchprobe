import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"

import { COUNTRIES, PLACES, WORLD, type Place } from "./world"
import { PencilDefs } from "./PencilDefs"
import { generator, inkOptions, penCircle, penFrame, seedOf, toPaths } from "./pen"

/**
 * What the map needs to know about a node.
 *
 * Deliberately narrower than the hub's node: this component reads a country
 * code and a status and nothing else, so it can be dropped into the theme
 * without dragging the API layer along.
 */
export type MapNode = {
  id: number
  name: string
  /** ISO 3166-1 alpha-2 as the hub resolved it; empty when it could not. */
  country: string
  group?: string
  online: boolean
  /** Percent, or null when the node is not reporting. */
  cpu: number | null
  /** Percent of memory in use, or null. */
  mem: number | null
  net_rx: number
  net_tx: number
}

type Tone = "ok" | "warn" | "bad" | "off" | "idle"

const RANK: Record<Tone, number> = { bad: 4, warn: 3, off: 2, ok: 1, idle: 0 }

function toneOf(n: MapNode): Tone {
  // Offline is grey, and red is kept for an online node at the CPU ceiling.
  // A node that has gone quiet and a node that is overloaded are two different
  // things, so they do not share a colour.
  if (!n.online) return "off"
  if (n.cpu === null) return "idle"
  return n.cpu >= 90 ? "bad" : n.cpu >= 75 ? "warn" : "ok"
}

/** A country's nodes, and where on the map that country sits. */
type Cluster = { place: Place; nodes: MapNode[]; tone: Tone; x: number; y: number }

/**
 * The window onto the map: a zoom factor over the fit-to-width scale, and the
 * top-left corner of the view in map units.
 */
type View = { z: number; x: number; y: number }

/**
 * Four is as far as this map goes.
 *
 * The paths in `world.ts` are Natural Earth 1:110m, simplified and rounded to
 * whole units. Past about this much magnification a coastline stops being a
 * coastline and becomes the staircase of the coordinates it was stored as, so
 * the limit is the data's, not the renderer's. A closer view needs the 1:50m
 * outlines, which is a different data pipeline.
 */
const Z_MIN = 1
const Z_MAX = 4

/**
 * An element's laid-out width, to half a pixel.
 *
 * The map has a fixed aspect ratio, so one measured width is enough. Rounded
 * and compared before setting: a fractional layout width would otherwise
 * report a new size on every observation, and every marker would be redrawn
 * for a difference nothing can see.
 */
function useWidth<T extends Element>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width * 2) / 2
      setWidth((prev) => (prev === w ? prev : w))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** The marker ring, wider when the country holds more than one node. */
const ringRadius = (count: number) => (count > 1 ? 9.6 : 7.8)

/** The exact dot at the centre. This one is never hand-drawn. */
const dotRadius = (count: number) => (count > 1 ? 4.6 : 3.8)

/** Longitude and latitude to map units, matching the generator's projection. */
const gx = (lon: number) => ((lon + 180) / 360) * WORLD.w
const gy = (lat: number) => ((WORLD.top - lat) / (WORLD.top - WORLD.bottom)) * WORLD.h

const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]
const PARALLELS = [-40, -20, 0, 20, 40, 60, 80]

/** A hand-drawn compass rose, small and off to one side. */
const COMPASS_R = 15

function Compass({ x, y, seed }: { x: number; y: number; seed: number }) {
  const paths = useMemo(() => {
    const r = COMPASS_R
    const drawn = [
      penCircle(generator, x, y, r, { seed, strokeWidth: 1.6, loose: 0.8 }),
      generator.line(x, y - r - 3, x, y + r * 0.35, inkOptions({ seed: seed + 1, strokeWidth: 1.3, bowing: 0.3 })),
      generator.line(x - r * 0.45, y - r * 0.35, x, y - r - 3, inkOptions({ seed: seed + 2, strokeWidth: 1.1 })),
      generator.line(x + r * 0.45, y - r * 0.35, x, y - r - 3, inkOptions({ seed: seed + 3, strokeWidth: 1.1 })),
    ]
    return drawn.flatMap(toPaths)
  }, [x, y, seed])
  return (
    <g className="mp-compass">
      {paths.map((p, i) => (
        <path key={i} d={p.d} style={{ stroke: p.stroke, strokeWidth: String(p.strokeWidth), fill: p.fill }} />
      ))}
      <text x={x} y={y + COMPASS_R + 13} textAnchor="middle" className="mp-compass-n">
        N
      </text>
    </g>
  )
}

/**
 * The geography, as one drawing in map units.
 *
 * Pulled out and memoised because none of it changes while panning: without
 * this a drag re-created and re-diffed a few hundred paths every frame, which
 * is most of what made panning cost anything. The world repeats east-west, so
 * it is drawn a second time at `offset` when the window straddles the seam.
 */
const Geography = memo(function Geography({ offset }: { offset: number }) {
  return (
    <g transform={`translate(${offset} 0)`}>
      <rect x={0} y={0} width={WORLD.w} height={WORLD.h} fill="url(#mp-ocean)" />
      <g className="mp-land">
        {COUNTRIES.map((c, i) => (
          <path key={c.id || `x${i}`} d={c.d} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      <g className="mp-grat">
        {MERIDIANS.map((lon) => (
          <line
            key={`m${lon}`}
            x1={gx(lon)}
            y1={0}
            x2={gx(lon)}
            y2={WORLD.h}
            className={lon === 0 ? "mp-grat-main" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {PARALLELS.map((lat) => (
          <line
            key={`p${lat}`}
            x1={0}
            y1={gy(lat)}
            x2={WORLD.w}
            y2={gy(lat)}
            className={lat === 0 ? "mp-grat-main" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </g>
  )
})

/**
 * Place names, in the map's own hand.
 *
 * Held as longitude and latitude rather than map units, so a label stays where
 * it was put if the drawing is ever regenerated, and kept to open water and
 * empty interior so none of them lands under a node marker. Multi-word names
 * are stacked: set on one line, a name that long runs off its own landmass.
 */
const LABELS: readonly { lines: readonly string[]; lon: number; lat: number; kind: "continent" | "ocean" }[] = [
  { lines: ["NORTH", "AMERICA"], lon: -100, lat: 52, kind: "continent" },
  { lines: ["SOUTH", "AMERICA"], lon: -63, lat: -26, kind: "continent" },
  { lines: ["EUROPE"], lon: 25, lat: 61, kind: "continent" },
  { lines: ["AFRICA"], lon: 21, lat: 2, kind: "continent" },
  { lines: ["ASIA"], lon: 95, lat: 52, kind: "continent" },
  { lines: ["AUSTRALIA"], lon: 134, lat: -34, kind: "continent" },
  { lines: ["PACIFIC", "OCEAN"], lon: -152, lat: 26, kind: "ocean" },
  { lines: ["SOUTH", "PACIFIC"], lon: -124, lat: -34, kind: "ocean" },
  { lines: ["ATLANTIC", "OCEAN"], lon: -43, lat: 34, kind: "ocean" },
  { lines: ["SOUTH", "ATLANTIC"], lon: -17, lat: -30, kind: "ocean" },
  { lines: ["INDIAN", "OCEAN"], lon: 78, lat: -29, kind: "ocean" },
]

/**
 * The names, drawn in the hand.
 *
 * Memoised apart from the geography rather than inside it, because the two
 * change on different things: a label is counter-scaled, so it moves when the
 * zoom does and not while panning, while the coastline is the reverse. Kept
 * separate, a zoom step re-renders eleven words instead of a few hundred paths.
 */
const Labels = memo(function Labels({ offset, scale }: { offset: number; scale: number }) {
  // A zero scale happens on the first render, before anything has been
  // measured, and 1/0 is not a transform. One render later it is known.
  const k = scale > 0 ? 1 / scale : 1
  return (
    <g transform={`translate(${offset} 0)`} className="mp-labels">
      {LABELS.map((l) => (
        <text
          key={l.lines.join(" ")}
          className="mp-label"
          data-kind={l.kind}
          textAnchor="middle"
          dominantBaseline="central"
          transform={`translate(${gx(l.lon)} ${gy(l.lat)}) scale(${k.toFixed(4)})`}
        >
          {l.lines.map((line, i) => (
            <tspan key={line} x={0} dy={i === 0 ? `${-0.62 * (l.lines.length - 1)}em` : "1.24em"}>
              {line}
            </tspan>
          ))}
        </text>
      ))}
    </g>
  )
})

/**
 * The world map with a node marker per country that has one.
 *
 * Node placement is the hub's country code, which is all a public status page
 * carries: a marker sits on the country's label point, not on the machine. The
 * map says so under itself, and two nodes in one country share one marker with
 * a count rather than being stacked at the same coordinates.
 */
export function WorldMap({ nodes, onOpen }: { nodes: MapNode[]; onOpen?: (id: number) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [view, setView] = useState<View>({ z: Z_MIN, x: 0, y: 0 })
  const [hovered, setHovered] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const [panning, setPanning] = useState(false)

  const fit = w > 0 ? w / WORLD.w : 0
  const h = WORLD.h * fit
  const s = fit * view.z

  /**
   * Keep the window on the world. Longitude is a circle, so east-west there is
   * no edge to stop at and the window wraps instead; latitude is not, so the
   * top and bottom still stop.
   */
  const clamp = useCallback((v: View): View => {
    const vh = WORLD.h / v.z
    const x = ((v.x % WORLD.w) + WORLD.w) % WORLD.w
    const y = vh >= WORLD.h ? (WORLD.h - vh) / 2 : Math.min(Math.max(v.y, 0), WORLD.h - vh)
    return x === v.x && y === v.y ? v : { z: v.z, x, y }
  }, [])

  // A resize can leave the window past the edge of the world.
  useLayoutEffect(() => setView(clamp), [w, clamp])

  const zoomAt = (px: number, py: number, factor: number) => {
    if (fit <= 0) return
    setView((v) => {
      const z = Math.min(Math.max(v.z * factor, Z_MIN), Z_MAX)
      if (z === v.z) return v
      // Whatever is under the cursor stays under the cursor. Both scales are
      // worked out here rather than read from the render, so two wheel notches
      // in one frame compound instead of each applying to the same zoom.
      const from = fit * v.z
      const to = fit * z
      const mx = v.x + px / from
      const my = v.y + py / from
      return clamp({ z, x: mx - px / to, y: my - py / to })
    })
  }

  const zoomBy = (factor: number) => zoomAt(w / 2, h / 2, factor)

  // React attaches `wheel` at the root as a passive listener, where
  // preventDefault is ignored and the page scrolls out from under the map.
  // The handler is read through a ref so the listener is attached once.
  const wheel = useRef<(e: WheelEvent) => void>(() => {})
  wheel.current = (e: WheelEvent) => {
    e.preventDefault()
    const el = ref.current
    if (!el) return
    const box = el.getBoundingClientRect()
    zoomAt(e.clientX - box.left, e.clientY - box.top, Math.exp(-e.deltaY * 0.0022))
  }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: WheelEvent) => wheel.current(e)
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [])

  // A pointermove arrives as fast as the mouse reports one -- a 1000 Hz mouse
  // sends a thousand a second -- and each would otherwise be its own React
  // render. Deltas pile up here and are applied once per frame instead.
  const pending = useRef<{ dx: number; dy: number } | null>(null)
  const raf = useRef(0)
  const fitRef = useRef(fit)
  fitRef.current = fit

  const flush = useCallback(() => {
    raf.current = 0
    const p = pending.current
    pending.current = null
    if (!p) return
    // flushSync rather than a bare setView: React schedules an update made
    // outside its own event handlers through a macrotask, which lands after
    // this frame has already painted. Forcing the commit is what keeps the pan
    // on the frame that asked for it.
    flushSync(() => {
      setView((v) => {
        const scale = fitRef.current * v.z
        if (scale <= 0) return v
        return clamp({ z: v.z, x: v.x - p.dx / scale, y: v.y - p.dy / scale })
      })
    })
  }, [clamp])

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    },
    [],
  )

  // `drag` is the pointer in flight; `dragged` survives until the click it
  // belongs to has been seen, so a pan that ends on a marker does not also
  // select that marker.
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const dragged = useRef(false)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragged.current = false
    if (e.pointerType === "mouse" && e.button !== 0) return
    // A press that lands on a control belongs to that control. Capturing it
    // here would retarget the pointer events and the control would never see
    // its own click.
    if ((e.target as Element).closest("button")) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId || s <= 0) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved) {
      // A few pixels of slop, so a click with an unsteady hand is still a click.
      if (Math.hypot(dx, dy) < 4) return
      d.moved = true
      setPanning(true)
    }
    d.x = e.clientX
    d.y = e.clientY
    const p = pending.current ?? { dx: 0, dy: 0 }
    p.dx += dx
    p.dy += dy
    pending.current = p
    if (!raf.current) raf.current = requestAnimationFrame(flush)
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    // Whatever is still queued is applied now: a pan has to end where the
    // pointer was let go, not at the last frame boundary.
    if (raf.current) {
      cancelAnimationFrame(raf.current)
      raf.current = 0
    }
    flush()
    drag.current = null
    dragged.current = d.moved
    setPanning(false)
  }

  const { clusters, adrift } = useMemo(() => {
    const byCode = new Map<string, MapNode[]>()
    const adrift: MapNode[] = []
    for (const n of nodes) {
      const code = n.country.trim().toUpperCase()
      if (!PLACES[code]) {
        adrift.push(n)
        continue
      }
      const list = byCode.get(code)
      if (list) list.push(n)
      else byCode.set(code, [n])
    }
    const clusters: Cluster[] = []
    for (const [code, list] of byCode) {
      const place = PLACES[code]
      const tone = list.reduce<Tone>((worst, n) => (RANK[toneOf(n)] > RANK[worst] ? toneOf(n) : worst), "idle")
      clusters.push({ place, nodes: list, tone, x: place.x, y: place.y })
    }
    // Busiest first, so the marker that matters is not painted over by the one
    // beside it where two countries are close together.
    clusters.sort((a, b) => RANK[a.tone] - RANK[b.tone] || b.nodes.length - a.nodes.length)
    return { clusters, adrift }
  }, [nodes])

  /** Ring paths, drawn once around the origin and positioned by transform. */
  const rings = useMemo(
    () =>
      new Map(
        clusters.map((c) => [
          c.place.id,
          toPaths(
            penCircle(generator, 0, 0, ringRadius(c.nodes.length), {
              seed: seedOf(`mark-${c.place.id}`),
              strokeWidth: 1.6,
              loose: 1.25,
            }),
          ),
        ]),
      ),
    [clusters],
  )

  const frame = useMemo(
    () => (w > 0 ? toPaths(penFrame(generator, w, h, { seed: seedOf("map-frame"), strokeWidth: 1.7, inset: 6, rough: 1 })) : []),
    [w, h],
  )

  const selected = pinned ? clusters.find((c) => c.place.id === pinned) : undefined
  const tip = hovered ? clusters.find((c) => c.place.id === hovered) : undefined
  const focus = pinned ?? hovered

  const onScreen = (x: number, y: number) => x > -26 && x < w + 26 && y > -26 && y < h + 26
  /**
   * Where a marker lands on screen. The map repeats east-west, so a country is
   * drawn in whichever copy the window is over: without this the ones at the
   * seam would vanish while their country was still in view.
   */
  const at = (c: Cluster) => {
    const dx = (((c.x - view.x) % WORLD.w) + WORLD.w) % WORLD.w
    return { x: dx * s, y: (c.y - view.y) * s }
  }

  return (
    <div className="mp-map-wrap">
      <div
        className="mp-map"
        ref={ref}
        data-panning={panning ? "1" : "0"}
        data-zoomed={view.z > 1 ? "1" : "0"}
        tabIndex={0}
        role="group"
        aria-label="全球节点地图，可拖动平移、滚轮缩放"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={(e) => {
          // Anywhere that is not a marker or a zoom button means "close this".
          // A drag that happens to end here is not a click, hence `dragged`.
          if (dragged.current) return
          if ((e.target as Element).closest(".mp-hit, .mp-zoom")) return
          setPinned(null)
        }}
        onKeyDown={(e) => {
          const step = 60
          if (e.key === "Escape") {
            // The keyboard half of clicking off a marker: the panel has no
            // clear button to tab to any more.
            setPinned(null)
          } else if (e.key === "+" || e.key === "=") {
            e.preventDefault()
            zoomBy(1.5)
          } else if (e.key === "-" || e.key === "_") {
            e.preventDefault()
            zoomBy(1 / 1.5)
          } else if (e.key === "0") {
            e.preventDefault()
            setView({ z: Z_MIN, x: 0, y: 0 })
          } else if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault()
            const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0
            const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0
            setView((v) => clamp({ z: v.z, x: v.x + dx / s, y: v.y + dy / s }))
          }
        }}
      >
        <svg className="mp-svg" viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
          <PencilDefs scale={s} />
          {/* The geography is one drawing in map units, and the view is a window
              onto it: zooming moves the window rather than re-projecting, so
              the coastline never changes shape. */}
          <g transform={`translate(${-view.x * s} ${-view.y * s}) scale(${s})`}>
            <Geography offset={0} />
            {/* The window can sit across the seam, in which case the map has to
                be drawn again on the far side of it. */}
            {view.x + WORLD.w / view.z > WORLD.w ? <Geography offset={WORLD.w} /> : null}
            <Labels offset={0} scale={s} />
            {view.x + WORLD.w / view.z > WORLD.w ? <Labels offset={WORLD.w} scale={s} /> : null}
          </g>

          {/* Markers are drawn in screen pixels, not map units: one is a symbol
              for a node, and a symbol that grows with the zoom stops being one.
              The ring is generated around the origin and moved by transform, so
              panning changes an attribute and never redraws the pen. */}
          <g className="mp-marks">
            {clusters.map((c) => {
              const { x, y } = at(c)
              if (!onScreen(x, y)) return null
              return (
                <g key={c.place.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
                  <g className="mp-mark" data-tone={c.tone} data-on={c.place.id === focus ? "1" : "0"}>
                    {/* The ring is the part that answers the pointer. Scaling it
                        rather than the whole marker leaves the exact dot -- and
                        so the status colour -- exactly where it was. */}
                    <g className="mp-ring">
                      {(rings.get(c.place.id) ?? []).map((p, i) => (
                        <path key={i} d={p.d} style={{ stroke: p.stroke, strokeWidth: String(p.strokeWidth), fill: p.fill }} />
                      ))}
                    </g>
                    <circle className="mp-dot" r={dotRadius(c.nodes.length)} />
                    {c.nodes.length > 1 ? (
                      <text className="mp-count" y={3.3} textAnchor="middle">
                        {c.nodes.length}
                      </text>
                    ) : null}
                  </g>
                </g>
              )
            })}
            {w > 380 ? <Compass x={w - 46} y={h - 52} seed={seedOf("compass")} /> : null}
          </g>

          <g className="mp-frame">
            {frame.map((p, i) => (
              <path key={i} d={p.d} style={{ stroke: p.stroke, strokeWidth: String(p.strokeWidth), fill: p.fill }} />
            ))}
          </g>
        </svg>

        {/* Real buttons over the drawing: the map is decorative, and a marker
            has to be reachable by keyboard and announced as a control. */}
        <div className="mp-hits">
          {clusters.map((c) => {
            const { x, y } = at(c)
            if (!onScreen(x, y)) return null
            return (
              <button
                key={c.place.id}
                type="button"
                className="mp-hit"
                style={{ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` }}
                data-tone={c.tone}
                aria-label={`${c.place.name}，${c.nodes.length} 个节点`}
                aria-pressed={pinned === c.place.id}
                onMouseEnter={() => setHovered(c.place.id)}
                onMouseLeave={() => setHovered((v) => (v === c.place.id ? null : v))}
                onFocus={() => setHovered(c.place.id)}
                onBlur={() => setHovered((v) => (v === c.place.id ? null : v))}
                onClick={() => {
                  if (dragged.current) return
                  setPinned((p) => (p === c.place.id ? null : c.place.id))
                }}
              />
            )
          })}
        </div>

        {tip ? (
          <div
            className="mp-tip"
            data-side={tip.y * s < 74 ? "below" : "above"}
            style={{ left: Math.min(Math.max(at(tip).x, 62), Math.max(62, w - 62)), top: at(tip).y }}
          >
            <b>{tip.place.name}</b>
            <span>{tip.nodes.length > 1 ? `${tip.nodes.length} 个节点` : tip.nodes[0].name}</span>
          </div>
        ) : null}

        <div className="mp-zoom">
          <button type="button" onClick={() => zoomBy(1.5)} disabled={view.z >= Z_MAX} aria-label="放大">
            +
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.5)} disabled={view.z <= Z_MIN} aria-label="缩小">
            −
          </button>
          <button type="button" onClick={() => setView({ z: Z_MIN, x: 0, y: 0 })} disabled={view.z <= Z_MIN} aria-label="回到全图">
            ⤢
          </button>
          <span className="mp-zoom-level">{view.z.toFixed(1)}×</span>
        </div>
      </div>

      <div className="mp-panel">
        {selected ? (
          <>
            <div className="mp-panel-head">
              <b>{selected.place.name}</b>
              <span className="mp-dim">{selected.place.id}</span>
              <span className="mp-dim">{selected.nodes.length} 个节点</span>
            </div>
            <ul className="mp-list">
              {selected.nodes.map((n) => (
                <li key={n.id}>
                  <button type="button" className="mp-node" data-tone={toneOf(n)} onClick={() => onOpen?.(n.id)}>
                    <span className="mp-node-dot" />
                    <span className="mp-node-name">{n.name}</span>
                    <span className="mp-dim">{n.group || "未分组"}</span>
                    <span className="mp-node-fig">{n.online ? (n.cpu === null ? "无数据" : `CPU ${n.cpu.toFixed(0)}%`) : "停机"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mp-hint">
            图上每个标记是一个国家或地区。悬停看名字，点一下列出那里的节点，点地图别处收起；拖动平移，滚轮缩放。
          </p>
        )}

        {adrift.length ? (
          <p className="mp-hint">
            位置未知（{adrift.length}）：{adrift.map((n) => n.name).join("、")}
          </p>
        ) : null}
      </div>
    </div>
  )
}
