import rough from "roughjs"
import type { Drawable, Options, PathInfo } from "roughjs/bin/core"

/**
 * A self-contained copy of the pen the theme draws with.
 *
 * Deliberately not imported from `src/sketch/`: this prototype is built beside
 * a theme that is still moving, and it should not break when that layer does.
 * What is here is the whole of it -- seeds, stroke options, and the two shapes
 * this map needs -- so the file can be deleted once the real component lands.
 */

/** One generator for the page. It holds no context, so it is safe to call from render. */
export const generator = rough.generator()

/**
 * A stable 31-bit seed from a string.
 *
 * A live panel re-renders on every pushed frame, and an unseeded rough shape
 * picks new randomness each time -- the borders would twitch twice a second.
 * Seeded from the node id, a marker is drawn once and stays drawn.
 */
export function seedOf(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 1) || 1
}

/**
 * `generator.toPaths`, with the option it drops applied.
 *
 * rough.js resolves `fixedDecimalPlaceDigits` but `toPaths` calls `opsToPath`
 * without it, so coordinates keep every digit the float has. Everything here is
 * laid out in CSS pixels, where a hundredth is past what the screen resolves.
 */
export function toPaths(drawable: Drawable): PathInfo[] {
  const decimals = drawable.options.fixedDecimalPlaceDigits
  const sets = drawable.sets ?? []
  return sets.map((set) => {
    const d = generator.opsToPath(set, decimals)
    const o = drawable.options
    if (set.type === "fillSketch") {
      return { d, stroke: o.fill ?? "none", strokeWidth: o.fillWeight < 0 ? o.strokeWidth / 2 : o.fillWeight, fill: "none" }
    }
    if (set.type === "fillPath") return { d, stroke: "none", strokeWidth: 0, fill: o.fill ?? "none" }
    return { d, stroke: o.stroke, strokeWidth: o.strokeWidth, fill: "none" }
  })
}

/** The theme's default wobble setting, 2, as the multiplier the pen wants. */
export const PEN = 0.45 + 0.275 * 2

/**
 * Stroke options for a shape. `currentColor` on purpose: the palette stays in
 * CSS, so dark mode is a variable swap and needs no second drawing.
 */
export function inkOptions(opts: Options = {}): Options {
  return {
    stroke: "currentColor",
    strokeWidth: 1.5,
    roughness: 1.15 * PEN,
    bowing: 1.0 * PEN,
    maxRandomnessOffset: 2 * PEN,
    fixedDecimalPlaceDigits: 2,
    ...opts,
  }
}

/**
 * The outline of a box, sized to the element it is drawn over.
 *
 * `generator.rectangle` rather than a path: it strokes the four sides
 * separately, which is what lets each corner run past the one it meets -- the
 * thing that reads as drawn rather than as a border. As a single path the four
 * sides become one curve, and rough.js spends the whole of the wobble bowing
 * the long edges inwards until a rectangle looks like a warped banner.
 *
 * Drawn a few pixels inside: a rough stroke overshoots its geometry, and at the
 * very edge the browser clips it, which reads as a border broken in places.
 */
export function penFrame(gen: typeof generator, w: number, h: number, o: { seed: number; strokeWidth?: number; dashed?: boolean; inset?: number; rough?: number }): Drawable {
  const inset = o.inset ?? 3
  const rough = o.rough ?? 1
  const x = Math.min(inset, w / 2)
  const y = Math.min(inset, h / 2)
  return gen.rectangle(x, y, Math.max(0, w - 2 * x), Math.max(0, h - 2 * y), inkOptions({
    seed: o.seed,
    strokeWidth: o.strokeWidth ?? 1.7,
    roughness: 1.2 * PEN * rough,
    bowing: 1.1 * PEN * rough,
    maxRandomnessOffset: 2.2 * PEN * rough,
    ...(o.dashed ? { strokeLineDash: [8, 5] } : {}),
  }))
}

/**
 * A circle drawn around something, for a node marker.
 *
 * Looser than a frame on purpose: this reads as a pen circling a spot on the
 * map, which overshoots and does not close neatly. The dot inside stays exact.
 */
export function penCircle(gen: typeof generator, cx: number, cy: number, r: number, o: { seed: number; strokeWidth?: number; loose?: number }): Drawable {
  const loose = o.loose ?? 1
  return gen.ellipse(cx, cy, r * 2, r * 2, inkOptions({
    seed: o.seed,
    strokeWidth: o.strokeWidth ?? 1.5,
    roughness: 1.5 * loose * PEN,
    bowing: 0.9 * loose * PEN,
    maxRandomnessOffset: 1.6 * loose * PEN,
    curveStepCount: 12,
  }))
}

/** A straight line, for a leader from a marker to its label. */
export function penLine(gen: typeof generator, x1: number, y1: number, x2: number, y2: number, o: { seed: number; dashed?: boolean; strokeWidth?: number }): Drawable {
  return gen.line(x1, y1, x2, y2, inkOptions({
    seed: o.seed,
    strokeWidth: o.strokeWidth ?? 1.2,
    roughness: 0.9 * PEN,
    bowing: 0.6 * PEN,
    ...(o.dashed ? { strokeLineDash: [4, 4] } : {}),
  }))
}
