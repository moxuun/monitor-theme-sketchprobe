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
  // dense weave, and at 11 px the lines stay far enough apart to read as strokes
  // drawn one at a time rather than as a woven texture.
  return o.fill
    ? gen.path(d, pencilOptions(o.factor, { ...common, fill: o.fill, hachureGap: 11, fillWeight: 1.4 }))
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
export function dial(gen: RoughGenerator, w: number, h: number, o: Pen & { frac: number | null; color?: string }): Drawable[] {
  const shapes: Drawable[] = []
  const cy = h - 20
  const cx = w - 24
  const r = 19

  shapes.push(gen.path(roundRect(4, cy - 13, 22, 26, 3), inkOptions(o.factor, { seed: o.seed, strokeWidth: 1.3 })))
  for (let i = 0; i < 3; i++) {
    const y = cy - 8 + i * 8
    const seed = o.seed + 1 + i * 2
    shapes.push(gen.line(4, y, -1, y, inkOptions(o.factor, { seed, strokeWidth: 1.1 })))
    shapes.push(gen.line(26, y, 31, y, inkOptions(o.factor, { seed: seed + 1, strokeWidth: 1.1 })))
  }

  shapes.push(gen.curve(arcPoints(cx, cy, r, 0, 180, 10), inkOptions(o.factor, { seed: o.seed + 8, strokeWidth: 1.4 })))
  for (const deg of [0, 90, 180]) {
    const a = (deg * Math.PI) / 180
    shapes.push(
      gen.line(
        cx + Math.cos(a) * (r - 5),
        cy - Math.sin(a) * (r - 5),
        cx + Math.cos(a) * r,
        cy - Math.sin(a) * r,
        inkOptions(o.factor, { seed: o.seed + 9 + deg, strokeWidth: 1.2 }),
      ),
    )
  }
  shapes.push(gen.circle(cx, cy, 3, inkOptions(o.factor, { seed: o.seed + 13, strokeWidth: 1.2 })))
  if (o.frac !== null) {
    const a = Math.PI * (1 - o.frac)
    shapes.push(
      gen.line(cx, cy, cx + Math.cos(a) * (r - 3), cy - Math.sin(a) * (r - 3), inkOptions(o.factor, { seed: o.seed + 14, strokeWidth: 1.6, stroke: o.color ?? "var(--ink)" })),
    )
  }
  return shapes
}

/**
 * In and out of a container, for the day's throughput.
 *
 * The two arrows carry the directions the theme already colours: in is the blue,
 * out is the plum, the same pairing as the io marks beside them.
 */
export function flow(gen: RoughGenerator, w: number, h: number, o: Pen): Drawable[] {
  const shapes: Drawable[] = []
  const cx = w / 2
  shapes.push(
    gen.path(roundRect(cx - 19, h - 24, 38, 20, 3), pencilOptions(o.factor, { seed: o.seed, strokeWidth: 1.3, fill: "var(--rule)", hachureGap: 5 })),
  )
  const arrows: [number, number, number, string][] = [
    [cx - 12, 6, h - 30, "var(--accent)"],
    [cx + 12, h - 30, 6, "var(--plum)"],
  ]
  arrows.forEach(([x, from, to, color], i) => {
    const seed = o.seed + 1 + i * 4
    const dir = to > from ? 1 : -1
    shapes.push(gen.line(x, from, x, to, inkOptions(o.factor, { seed, strokeWidth: 1.4, stroke: color })))
    shapes.push(
      gen.path(`M${x - 4},${to - dir * 6} L${x},${to} L${x + 4},${to - dir * 6}`, inkOptions(o.factor, { seed: seed + 1, strokeWidth: 1.4, stroke: color })),
    )
  })
  return shapes
}

/**
 * A two-way link with its signal, for the live-rate tile.
 *
 * The same pairing again: out on the blue, back on the plum.
 */
export function link(gen: RoughGenerator, w: number, h: number, o: Pen): Drawable[] {
  const shapes: Drawable[] = []
  const out = h * 0.35
  const back = h * 0.65
  const end = w * 0.6
  const mid = h / 2
  shapes.push(gen.line(6, out, end, out, inkOptions(o.factor, { seed: o.seed, strokeWidth: 1.4, stroke: "var(--accent)" })))
  shapes.push(gen.path(`M${end - 6},${out - 5} L${end},${out} L${end - 6},${out + 5}`, inkOptions(o.factor, { seed: o.seed + 1, strokeWidth: 1.4, stroke: "var(--accent)" })))
  shapes.push(gen.line(end, back, 6, back, inkOptions(o.factor, { seed: o.seed + 2, strokeWidth: 1.4, stroke: "var(--plum)" })))
  shapes.push(gen.path(`M12,${back - 5} L6,${back} L12,${back + 5}`, inkOptions(o.factor, { seed: o.seed + 3, strokeWidth: 1.4, stroke: "var(--plum)" })))
  const cx = w * 0.75
  for (let i = 0; i < 2; i++) {
    const r = 8 + i * 7
    shapes.push(gen.curve(arcPoints(cx, mid, r, -40, 40, 6), inkOptions(o.factor, { seed: o.seed + 4 + i, strokeWidth: 1.3 })))
  }
  return shapes
}
