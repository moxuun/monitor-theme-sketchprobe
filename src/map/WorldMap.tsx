import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import type { Drawable, PathInfo } from "roughjs/bin/core"

import type { Node } from "@/lib/api"
import { statusOf } from "@/lib/derive"
import { Link } from "@/lib/route"
import { generator, inkOptions, pathStyle, seedOf, toPaths } from "@/sketch/core"
import { SketchBox, useBoxSize, usePenFactor } from "@/sketch/Sketch"
import { PencilDefs } from "@/map/PencilDefs"
import { COUNTRIES, PLACES, WORLD, type Place } from "@/map/world"

type Tone = "ok" | "warn" | "bad" | "off" | "idle"

const RANK: Record<Tone, number> = { bad: 4, warn: 3, off: 2, ok: 1, idle: 0 }

/**
 * A node's state, in the vocabulary the cards already use.
 *
 * Offline is the card's own tone rather than a colour of its own: a node that is
 * red in the grid and grey on the map would be the same node saying two things.
 * `idle` is the one addition -- online, but not reporting -- and it is drawn as a
 * hollow dot rather than as a fifth colour, so the four the theme has stay the
 * four it has.
 */
function toneOf(node: Node): Tone {
  if (!node.online) return "off"
  const cpu = node.metrics?.cpu
  if (cpu === undefined || cpu === null) return "idle"
  // The meters' own thresholds, so a marker turns amber on the same reading the
  // bar beside the node's name does.
  if (cpu >= 92) return "bad"
  if (cpu >= 80) return "warn"
  return "ok"
}

/** The figure the panel shows beside a node: its load, or why there is none. */
function figureOf(node: Node): string {
  if (!node.online) return statusOf(node).text
  return node.metrics ? `CPU ${node.metrics.cpu.toFixed(0)}%` : "无数据"
}

/** A country's nodes, and where on the map that country sits. */
type Cluster = { place: Place; nodes: Node[]; tone: Tone; x: number; y: number }

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

/** The marker ring, wider when the country holds more than one node. */
const ringRadius = (count: number) => (count > 1 ? 9.6 : 7.8)

/** The exact dot at the centre. This one is never hand-drawn. */
const dotRadius = (count: number) => (count > 1 ? 4.6 : 3.8)

/** Longitude and latitude to map units, matching the generator's projection. */
const gx = (lon: number) => ((lon + 180) / 360) * WORLD.w
const gy = (lat: number) => ((WORLD.top - lat) / (WORLD.top - WORLD.bottom)) * WORLD.h

const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]
const PARALLELS = [-40, -20, 0, 20, 40, 60, 80]

/**
 * A circle of a known radius about a known point.
 *
 * The theme's `penCircle` sizes itself to the box it is circling, which is what
 * a word wants; a marker ring is a radius. Looser than every other shape here on
 * purpose -- this reads as a pen circling a spot on a map, which overshoots and
 * does not close neatly. The dot inside stays exact.
 */
function circleAt(cx: number, cy: number, r: number, o: { factor: number; seed: number; strokeWidth?: number; loose?: number }): Drawable {
  const loose = o.loose ?? 1
  return generator.ellipse(cx, cy, r * 2, r * 2, inkOptions(o.factor, {
    seed: o.seed,
    strokeWidth: o.strokeWidth ?? 1.5,
    roughness: 1.5 * loose * o.factor,
    bowing: 0.9 * loose * o.factor,
    maxRandomnessOffset: 1.6 * loose * o.factor,
    curveStepCount: 12,
  }))
}

/**
 * The map's own border.
 *
 * `generator.rectangle` rather than the theme's `frame`, which is a rounded
 * rectangle drawn as one path. This box is a thousand units wide and under four
 * hundred tall, and as a single path rough.js spends the whole of the wobble
 * bowing the long edges inwards until the border reads as a warped banner.
 * Stroked as four sides, each corner runs past the one it meets instead, which
 * is the thing that reads as drawn.
 */
function mapFrame(w: number, h: number, factor: number, seed: number): Drawable {
  const inset = 5
  return generator.rectangle(inset, inset, Math.max(0, w - 2 * inset), Math.max(0, h - 2 * inset), inkOptions(factor, {
    seed,
    strokeWidth: 1.7,
    roughness: 1.2 * factor,
    bowing: 1.1 * factor,
    maxRandomnessOffset: 2.2 * factor,
  }))
}

/** A hand-drawn compass rose, small and off to one side. */
const COMPASS_R = 15

function Compass({ x, y, factor, seed }: { x: number; y: number; factor: number; seed: number }) {
  const paths = useMemo(() => {
    const r = COMPASS_R
    const drawn = [
      circleAt(x, y, r, { factor, seed, strokeWidth: 1.6, loose: 0.8 }),
      generator.line(x, y - r - 3, x, y + r * 0.35, inkOptions(factor, { seed: seed + 1, strokeWidth: 1.3, bowing: 0.3 })),
      generator.line(x - r * 0.45, y - r * 0.35, x, y - r - 3, inkOptions(factor, { seed: seed + 2, strokeWidth: 1.1 })),
      generator.line(x + r * 0.45, y - r * 0.35, x, y - r - 3, inkOptions(factor, { seed: seed + 3, strokeWidth: 1.1 })),
    ]
    return drawn.flatMap(toPaths)
  }, [x, y, factor, seed])
  return (
    <g className="map-compass">
      {paths.map((p, i) => (
        <path key={i} d={p.d} style={pathStyle(p)} />
      ))}
      <text x={x} y={y + COMPASS_R + 13} textAnchor="middle" className="map-compass-n">
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
      <rect x={0} y={0} width={WORLD.w} height={WORLD.h} fill="url(#map-sea)" />
      <g className="map-land">
        {COUNTRIES.map((c, i) => (
          <path key={c.id || `x${i}`} d={c.d} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      <g className="map-grat">
        {MERIDIANS.map((lon) => (
          <line
            key={`m${lon}`}
            x1={gx(lon)}
            y1={0}
            x2={gx(lon)}
            y2={WORLD.h}
            className={lon === 0 ? "map-grat-main" : undefined}
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
            className={lat === 0 ? "map-grat-main" : undefined}
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
    <g transform={`translate(${offset} 0)`} className="map-labels">
      {LABELS.map((l) => (
        <text
          key={l.lines.join(" ")}
          className="map-label"
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
export function WorldMap({ nodes }: { nodes: Node[] }) {
  const [ref, size] = useBoxSize<HTMLDivElement>()
  const factor = usePenFactor()
  const w = size[0]
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

  const zoomAt = (px: number, py: number, factorScale: number) => {
    if (fit <= 0) return
    setView((v) => {
      const z = Math.min(Math.max(v.z * factorScale, Z_MIN), Z_MAX)
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

  const zoomBy = (factorScale: number) => zoomAt(w / 2, h / 2, factorScale)

  // React attaches `wheel` at the root as a passive listener, where
  // preventDefault is ignored and the page scrolls out from under the map.
  // The handler is read through a ref so the listener is attached once.
  const wheel = useRef<(e: WheelEvent) => void>(() => {})
  wheel.current = (e: WheelEvent) => {
    const el = ref.current
    if (!el || fit <= 0 || e.deltaY === 0) return
    // At a zoom limit, let the browser scroll the page in that direction.
    if (e.deltaY > 0 ? view.z <= Z_MIN : view.z >= Z_MAX) return
    e.preventDefault()
    const box = el.getBoundingClientRect()
    zoomAt(e.clientX - box.left, e.clientY - box.top, Math.exp(-e.deltaY * 0.0022))
  }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: WheelEvent) => wheel.current(e)
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [ref])

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
    if ((e.target as Element).closest("button, a")) return
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
    const byCode = new Map<string, Node[]>()
    const adrift: Node[] = []
    for (const n of nodes) {
      const code = (n.country || "").trim().toUpperCase()
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

  /**
   * Ring paths, drawn once around the origin and positioned by transform.
   *
   * The memo is keyed on the geometry itself -- each country's id and its ring
   * radius -- rather than on `clusters`, which is a fresh array on every push.
   * A node's CPU changing moves no ring, so the pen is not put to paper again
   * for it; the sort keeps the key independent of the order clusters arrive in.
   */
  const ringGeometry = clusters.map((c) => `${c.place.id}:${ringRadius(c.nodes.length)}`).sort().join("|")
  const rings = useMemo(
    () =>
      new Map<string, PathInfo[]>(
        ringGeometry
          .split("|")
          .filter(Boolean)
          .map((entry): [string, PathInfo[]] => {
            const cut = entry.indexOf(":")
            const id = entry.slice(0, cut)
            return [
              id,
              toPaths(circleAt(0, 0, Number(entry.slice(cut + 1)), { factor, seed: seedOf(`map-mark-${id}`), strokeWidth: 1.6, loose: 1.25 })),
            ]
          }),
      ),
    [ringGeometry, factor],
  )

  const frame = useMemo(() => (w > 0 ? toPaths(mapFrame(w, h, factor, seedOf("map-frame"))) : []), [w, h, factor])

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
    <div className="map-wrap">
      <div
        className="map"
        ref={ref}
        data-panning={panning ? "1" : "0"}
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
          if ((e.target as Element).closest(".map-hit, .map-zoom")) return
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
        <svg className="map-svg" viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
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
          <g className="map-marks">
            {clusters.map((c) => {
              const { x, y } = at(c)
              if (!onScreen(x, y)) return null
              return (
                <g key={c.place.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
                  <g className="map-mark" data-tone={c.tone} data-on={c.place.id === focus ? "1" : "0"}>
                    {/* The ring is the part that answers the pointer. Scaling it
                        rather than the whole marker leaves the exact dot -- and
                        so the status colour -- exactly where it was. */}
                    <g className="map-ring">
                      {(rings.get(c.place.id) ?? []).map((p, i) => (
                        <path key={i} d={p.d} style={pathStyle(p)} />
                      ))}
                    </g>
                    <circle className="map-dot" r={dotRadius(c.nodes.length)} />
                    {c.nodes.length > 1 ? (
                      <text className="map-count" y={3.3} textAnchor="middle">
                        {c.nodes.length}
                      </text>
                    ) : null}
                  </g>
                </g>
              )
            })}
            {/* Bottom left: the zoom controls take the other corner, and a
                compass is read against the map's own edge either way. */}
            {w > 380 ? <Compass x={46} y={h - 52} factor={factor} seed={seedOf("map-compass")} /> : null}
          </g>

          <g className="map-frame">
            {frame.map((p, i) => (
              <path key={i} d={p.d} style={pathStyle(p)} />
            ))}
          </g>
        </svg>

        {/* Real controls over the drawing: the map is decorative, and a marker
            has to be reachable by keyboard and announced as one. */}
        <div className="map-hits">
          {clusters.map((c) => {
            const { x, y } = at(c)
            if (!onScreen(x, y)) return null
            return (
              <button
                key={c.place.id}
                type="button"
                className="map-hit"
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
            className="map-tip"
            data-side={at(tip).y < 74 ? "below" : "above"}
            style={{ left: Math.min(Math.max(at(tip).x, 62), Math.max(62, w - 62)), top: at(tip).y }}
          >
            <b>{tip.place.name}</b>
            <span>{tip.nodes.length > 1 ? `${tip.nodes.length} 个节点` : tip.nodes[0].name}</span>
          </div>
        ) : null}

        <div className="map-zoom">
          <button type="button" onClick={() => zoomBy(1.5)} disabled={view.z >= Z_MAX} aria-label="放大">
            +
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.5)} disabled={view.z <= Z_MIN} aria-label="缩小">
            −
          </button>
          <button type="button" onClick={() => setView({ z: Z_MIN, x: 0, y: 0 })} disabled={view.z <= Z_MIN} aria-label="回到全图">
            ⤢
          </button>
          <span className="map-zoom-level">{view.z.toFixed(1)}×</span>
        </div>
      </div>

      <div className="map-panel">
        {selected ? (
          <SketchBox className="map-box" seedKey={`map-box-${selected.place.id}`} radius={10}>
            <div className="map-panel-head">
              <b>{selected.place.name}</b>
              <span className="map-dim">{selected.place.id}</span>
              <span className="map-dim">{selected.nodes.length} 个节点</span>
            </div>
            <ul className="map-list">
              {selected.nodes.map((n) => (
                <li key={n.id}>
                  <Link className="map-node" data-tone={toneOf(n)} href={`/node/${n.id}`}>
                    <span className="map-node-dot" />
                    <span className="map-node-name">{n.name}</span>
                    {n.group ? <span className="map-dim">{n.group}</span> : null}
                    <span className="map-node-fig">{figureOf(n)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </SketchBox>
        ) : null}

        {adrift.length ? (
          <p className="map-hint">
            位置未知（{adrift.length}）：{adrift.map((n) => n.name).join("、")}
          </p>
        ) : null}
      </div>
    </div>
  )
}
