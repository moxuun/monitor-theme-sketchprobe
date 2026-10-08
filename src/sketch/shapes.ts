import type { Drawable } from "roughjs/bin/core"
import type { RoughGenerator } from "roughjs/bin/generator"

import { inkOptions, pencilOptions, roundRect } from "@/sketch/core"

/** What every shape needs: how wobbly, and which random sequence to draw from. */
export type Pen = { factor: number; seed: number }

export type FrameOpts = Pen & {
  radius?: number
  inset?: number
  dashed?: boolean
  /** Shaded with pencil strokes in this colour. */
  fill?: string
  strokeWidth?: number
  stroke?: string
}

/**
 * The outline of a box, sized to the element it is drawn over.
 *
 * Drawn a couple of pixels inside the element: a rough stroke overshoots its
 * geometry by up to `maxRandomnessOffset`, and at the very edge the browser
 * clips it, which reads as a border that is broken in places rather than as a
 * hand-drawn one.
 */
export function frame(gen: RoughGenerator, w: number, h: number, o: FrameOpts): Drawable {
  const inset = o.inset ?? 2
  const x = Math.min(inset, w / 2)
  const y = Math.min(inset, h / 2)
  const d = roundRect(x, y, Math.max(0, w - 2 * x), Math.max(0, h - 2 * y), o.radius ?? 10)
  const common = {
    seed: o.seed,
    strokeWidth: o.strokeWidth ?? 1.5,
    ...(o.stroke ? { stroke: o.stroke } : {}),
    ...(o.dashed ? { strokeLineDash: [8, 5] } : {}),
  }
  // A shaded box gets the pencil treatment, a plain one only a stroke: hachure
  // is worth its extra paths on a panel-sized area, which is the only place this
  // is called with a fill. The gap is set from the card rather than from the
  // default: a panel is large enough that the 6 px a meter wants reads as a
  // dense weave, and the lines have to stay far enough apart to look drawn one
  // at a time.
  return o.fill
    ? gen.path(d, pencilOptions(o.factor, { ...common, fill: o.fill, hachureGap: 7.5, fillWeight: 1.4 }))
    : gen.path(d, inkOptions(o.factor, common))
}

export type BarOpts = Pen & { color: string }

/**
 * A meter: an empty track with a value filled into it.
 *
 * Filled solid rather than hatched, which is the one place in this theme where
 * that is true. A hachure needs room to read as shading -- at a meter's height it
 * is a handful of parallel strokes, and parallel strokes at that scale read as a
 * barber's pole, not as pencil. The wash is drawn a little transparent so the
 * paper's ruling shows through it, which is what a marker stroke on notebook
 * paper does.
 */
export function bar(gen: RoughGenerator, w: number, h: number, frac: number, o: BarOpts): Drawable[] {
  const pad = 1
  const iw = Math.max(0, w - 2 * pad)
  const ih = Math.max(0, h - 2 * pad)
  const body = iw * Math.min(1, Math.max(0, frac))
  const radius = Math.min(3, ih / 3)
  const shapes: Drawable[] = []
  // A fill narrower than its own outline has nowhere to put a stroke.
  if (body > 4 && ih > 2) {
    const bleed = 1
    shapes.push(
      gen.path(roundRect(pad + bleed, pad + bleed, body - bleed * 2, ih - bleed * 2, radius), inkOptions(o.factor, {
        seed: o.seed + 1,
        stroke: "none",
        fill: `color-mix(in srgb, ${o.color} 84%, transparent)`,
        fillStyle: "solid",
        // Damped: at full roughness the wash spills past the stroke meant to
        // contain it, which on a 10px meter reads as a smear.
        fillShapeRoughnessGain: 0.35,
        roughness: 0.85 * o.factor,
        bowing: 0.35 * o.factor,
      })),
    )
  }
  shapes.push(
    gen.path(roundRect(pad, pad, iw, ih, radius), inkOptions(o.factor, {
      seed: o.seed,
      strokeWidth: 1.3,
      // The track's edge is the line the eye measures the value against, so it is
      // damped well below the wobble the card's own border carries.
      roughness: 0.65 * o.factor,
      bowing: 0.3 * o.factor,
    })),
  )
  return shapes
}

/** A horizontal rule, for a divider between rows. */
export function rule(gen: RoughGenerator, w: number, o: Pen & { dashed?: boolean; strokeWidth?: number }): Drawable {
  return gen.line(1, 1, Math.max(3, w - 1), 1, inkOptions(o.factor, {
    seed: o.seed,
    strokeWidth: o.strokeWidth ?? 1.2,
    // A long span at full bowing turns a rule into an arc.
    bowing: 0.5 * o.factor,
    roughness: 0.8 * o.factor,
    ...(o.dashed ? { strokeLineDash: [7, 6] } : {}),
  }))
}

/**
 * A circle drawn around something, for the group tab that is showing.
 *
 * Looser than every other shape here on purpose: this is meant to read as a pen
 * circling the word you are on, which overshoots the target and does not close
 * neatly. That looseness is why the tab's own label stays a clean, upright
 * font -- the circle is the decoration, the word has to remain legible.
 */
export function penCircle(gen: RoughGenerator, w: number, h: number, o: Pen): Drawable {
  return gen.ellipse(w / 2, h / 2, Math.max(6, w - 4), Math.max(6, h - 4), inkOptions(o.factor, {
    seed: o.seed,
    strokeWidth: 1.6,
    roughness: 1.7 * o.factor,
    bowing: 1.2 * o.factor,
    maxRandomnessOffset: 2.4 * o.factor,
    curveStepCount: 14,
  }))
}

/** One horizontal gridline across a chart, faint and dashed. */
export function gridLine(gen: RoughGenerator, w: number, y: number, o: Pen): Drawable {
  return gen.line(1, y, Math.max(3, w - 1), y, inkOptions(o.factor, {
    seed: o.seed,
    strokeWidth: 1,
    roughness: 0.55 * o.factor,
    bowing: 0.25 * o.factor,
    strokeLineDash: [5, 6],
    stroke: "var(--rule)",
  }))
}

/** The x and y axis of a chart, as two drawn lines meeting at the origin. */
export function axes(gen: RoughGenerator, w: number, h: number, o: Pen): Drawable[] {
  const line = { roughness: 0.9 * o.factor, bowing: 0.45 * o.factor, strokeWidth: 1.4 }
  return [
    gen.line(1, 1, 1, h - 1, inkOptions(o.factor, { ...line, seed: o.seed })),
    gen.line(1, h - 1, Math.max(3, w - 1), h - 1, inkOptions(o.factor, { ...line, seed: o.seed + 1 })),
  ]
}

/* --------------------------------------------------------- summary art -- */

/**
 * Points along a circular arc.
 *
 * The generator's own `arc` closes the sweep into a loop, which reads as a
 * scribbled circle rather than the half of one a dial needs, so the curves here
 * are sampled and drawn as paths instead. Angles are degrees, 0 at three
 * o'clock, counterclockwise.
 */
function arcPoints(cx: number, cy: number, r: number, from: number, to: number, steps = 8): [number, number][] {
  const points: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180
    points.push([cx + Math.cos(a) * r, cy - Math.sin(a) * r])
  }
  return points
}

/**
 * A rack of node slots, for the node-count tile.
 *
 * Decoration, deliberately: it says "a set of machines" and is not a count of
 * anything. A drawing that tried to encode the fleet would be the first thing on
 * the page to disagree with the figure beside it, the moment there are more
 * nodes than there are slots to draw them in.
 */
export function rack(gen: RoughGenerator, w: number, h: number, o: Pen): Drawable[] {
  const shapes: Drawable[] = [gen.path(roundRect(2, 2, w - 4, h - 4, 4), inkOptions(o.factor, { seed: o.seed, strokeWidth: 1.4 }))]
  const slot = 11
  const top = 6
  const gap = (h - top * 2 - slot * 3) / 2
  for (let i = 0; i < 3; i++) {
    const y = top + i * (slot + gap)
    const seed = o.seed + i * 7
    shapes.push(gen.path(roundRect(10, y, w - 20, slot, 2.5), inkOptions(o.factor, { seed, strokeWidth: 1.2 })))
    shapes.push(gen.circle(15.5, y + slot / 2, 2.4, inkOptions(o.factor, { seed: seed + 1, strokeWidth: 1.1 })))
    shapes.push(gen.line(w - 27, y + slot / 2, w - 15, y + slot / 2, inkOptions(o.factor, { seed: seed + 2, strokeWidth: 1.1 })))
  }
  return shapes
}

/**
 * A dial beside the chip it reads, for the busiest node's CPU.
 *
 * `frac` is null when nothing is reporting, and then there is no needle at all:
 * one parked at zero would say "idle" about a node that is not there.
 */
/**
 * A handcrafted CPU chip for the busiest node's tile.
 * Drawn with rough.js pencil hachure fill and sketchy pins.
 */
export function chip(gen: RoughGenerator, w: number, h: number, o: Pen & { frac?: number | null; color?: string }): Drawable[] {
  const shapes: Drawable[] = []
  const cx = w / 2
  const cy = h / 2
  const size = 34
  const half = size / 2

  // Outer chip body with pencil shading
  shapes.push(
    gen.path(
      roundRect(cx - half, cy - half, size, size, 4),
      pencilOptions(o.factor, {
        seed: o.seed,
        strokeWidth: 1.4,
        fill: "color-mix(in srgb, var(--accent) 18%, transparent)",
        fillStyle: "hachure",
        hachureAngle: -35,
        hachureGap: 4.5,
      }),
    ),
  )

  // Inner core
  const coreSize = 14
  shapes.push(
    gen.path(
      roundRect(cx - coreSize / 2, cy - coreSize / 2, coreSize, coreSize, 2),
      pencilOptions(o.factor, {
        seed: o.seed + 1,
        strokeWidth: 1.2,
        stroke: o.color ?? "var(--accent)",
        fill: o.color ? `color-mix(in srgb, ${o.color} 30%, transparent)` : "color-mix(in srgb, var(--accent) 30%, transparent)",
        fillStyle: "hachure",
        hachureAngle: 45,
        hachureGap: 3.5,
      }),
    ),
  )

  // Pins on all 4 sides
  const pinLen = 5
  const pinOffsets = [-8, 0, 8]
  pinOffsets.forEach((offset, i) => {
    const s = o.seed + 10 + i * 4
    // Top & Bottom pins
    shapes.push(gen.line(cx + offset, cy - half, cx + offset, cy - half - pinLen, inkOptions(o.factor, { seed: s, strokeWidth: 1.2 })))
    shapes.push(gen.line(cx + offset, cy + half, cx + offset, cy + half + pinLen, inkOptions(o.factor, { seed: s + 1, strokeWidth: 1.2 })))
    // Left & Right pins
    shapes.push(gen.line(cx - half, cy + offset, cx - half - pinLen, cy + offset, inkOptions(o.factor, { seed: s + 2, strokeWidth: 1.2 })))
    shapes.push(gen.line(cx + half, cy + offset, cx + half + pinLen, cy + offset, inkOptions(o.factor, { seed: s + 3, strokeWidth: 1.2 })))
  })

  return shapes
}

/**
 * Two pencil-shaded hand-drawn arrows for throughput (download & upload).
 */
export function transfer(gen: RoughGenerator, w: number, h: number, o: Pen): Drawable[] {
  const shapes: Drawable[] = []
  const cx = w / 2

  // Down arrow (Accent / Blue)
  const xDown = cx - 12
  const yTop = 10
  const yBottom = h - 12
  shapes.push(gen.line(xDown, yTop, xDown, yBottom, inkOptions(o.factor, { seed: o.seed, strokeWidth: 1.8, stroke: "var(--accent)" })))
  shapes.push(
    gen.path(
      `M${xDown - 8},${yBottom - 11} L${xDown},${yBottom} L${xDown + 8},${yBottom - 11} Z`,
      pencilOptions(o.factor, {
        seed: o.seed + 1,
        strokeWidth: 1.3,
        stroke: "var(--accent)",
        fill: "color-mix(in srgb, var(--accent) 35%, transparent)",
        fillStyle: "hachure",
        hachureAngle: 45,
        hachureGap: 3.5,
      }),
    ),
  )

  // Up arrow (Plum / Purple)
  const xUp = cx + 12
  shapes.push(gen.line(xUp, yBottom, xUp, yTop, inkOptions(o.factor, { seed: o.seed + 2, strokeWidth: 1.8, stroke: "var(--plum)" })))
  shapes.push(
    gen.path(
      `M${xUp - 8},${yTop + 11} L${xUp},${yTop} L${xUp + 8},${yTop + 11} Z`,
      pencilOptions(o.factor, {
        seed: o.seed + 3,
        strokeWidth: 1.3,
        stroke: "var(--plum)",
        fill: "color-mix(in srgb, var(--plum) 35%, transparent)",
        fillStyle: "hachure",
        hachureAngle: -45,
        hachureGap: 3.5,
      }),
    ),
  )

  return shapes
}

/**
 * A speed gauge with pencil shading and needle for real-time speed.
 */
export function speedGauge(gen: RoughGenerator, w: number, h: number, o: Pen): Drawable[] {
  const shapes: Drawable[] = []
  const cx = w / 2
  const cy = h - 14
  const r = 24

  // Arc path with soft colored pencil fill
  const arcPts = arcPoints(cx, cy, r, 0, 180, 12)
  const arcD = `M${arcPts[0][0]},${arcPts[0][1]} ` + arcPts.slice(1).map((p) => `L${p[0]},${p[1]}`).join(" ") + " Z"
  shapes.push(
    gen.path(
      arcD,
      pencilOptions(o.factor, {
        seed: o.seed,
        strokeWidth: 1.4,
        fill: "color-mix(in srgb, var(--accent) 15%, transparent)",
        fillStyle: "hachure",
        hachureAngle: -30,
        hachureGap: 5,
      }),
    ),
  )

  // Gauge ticks
  for (const deg of [15, 50, 90, 130, 165]) {
    const a = (deg * Math.PI) / 180
    const tickLen = deg === 90 ? 7 : 4
    shapes.push(
      gen.line(
        cx + Math.cos(a) * (r - tickLen),
        cy - Math.sin(a) * (r - tickLen),
        cx + Math.cos(a) * r,
        cy - Math.sin(a) * r,
        inkOptions(o.factor, { seed: o.seed + deg, strokeWidth: 1.2 }),
      ),
    )
  }

  // Pivot circle
  shapes.push(
    gen.circle(
      cx,
      cy,
      5,
      pencilOptions(o.factor, {
        seed: o.seed + 20,
        strokeWidth: 1.3,
        fill: "var(--ink)",
        fillStyle: "solid",
      }),
    ),
  )

  // Needle pointing up-right
  const needleAngle = (50 * Math.PI) / 180
  shapes.push(
    gen.line(
      cx,
      cy,
      cx + Math.cos(needleAngle) * (r - 4),
      cy - Math.sin(needleAngle) * (r - 4),
      inkOptions(o.factor, { seed: o.seed + 21, strokeWidth: 1.8, stroke: "var(--accent)" }),
    ),
  )

  return shapes
}
