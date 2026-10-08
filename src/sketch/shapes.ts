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
