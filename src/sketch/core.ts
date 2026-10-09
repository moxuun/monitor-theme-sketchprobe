import rough from "roughjs"
import type { Drawable, Options, PathInfo } from "roughjs/bin/core"

/**
 * One generator for the whole page. It holds no drawing context, so it can be
 * called from a render function and its output turned into `<path>` elements by
 * React -- no measuring, no effect, no imperative DOM work, and nothing to go
 * stale between renders.
 */
export const generator = rough.generator()

/**
 * A drawn set, ready for a `<path>`: `PathInfo` plus the dash pattern rough.js
 * would have applied itself had it been the one writing the element.
 */
export type SketchPath = PathInfo & { strokeLineDash?: number[] }

/**
 * A stable 31-bit seed from a string, for rough.js's `seed` option.
 *
 * Two reasons this exists rather than leaving the seed out. A live panel
 * re-renders every two seconds, and an unseeded shape picks new randomness each
 * time, so every border would twitch as new metrics arrive -- rough.js's own
 * issue #27, which is why the option was added. And a seed derived from the node
 * id is stable across a remount, so switching group tabs redraws the same card
 * rather than a slightly different one.
 *
 * Shifted down to 31 bits and forced non-zero: rough.js documents the range as
 * 1 to 2^31 and treats 0, or anything absent, as "no seed at all".
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
 * `generator.toPaths`, with the option it ignores applied.
 *
 * rough.js resolves `fixedDecimalPlaceDigits` but `toPaths` calls `opsToPath`
 * without passing it, so coordinates keep every digit the float has. Every path
 * here is laid out in CSS pixels at a known size, where a hundredth is already
 * past what the screen resolves: rounding cuts a card's path data by about half.
 *
 * The dash pattern is carried out for the same reason: `strokeLineDash` is read
 * by rough.js's own renderer, which drawing the sets as React `<path>` elements
 * bypasses, so a dashed gridline would come out solid.
 */
export function toPaths(drawable: Drawable): SketchPath[] {
  const decimals = drawable.options.fixedDecimalPlaceDigits
  const sets = drawable.sets ?? []
  return sets.map((set) => {
    const d = generator.opsToPath(set, decimals)
    const o = drawable.options
    if (set.type === "fillSketch") {
      // A hachure or zigzag fill arrives as strokes rather than a wash, so it is
      // drawn in the fill colour at the fill's own weight.
      return { d, stroke: o.fill ?? "none", strokeWidth: o.fillWeight < 0 ? o.strokeWidth / 2 : o.fillWeight, fill: "none" }
    }
    if (set.type === "fillPath") return { d, stroke: "none", strokeWidth: 0, fill: o.fill ?? "none" }
    return { d, stroke: o.stroke, strokeWidth: o.strokeWidth, fill: "none", strokeLineDash: o.strokeLineDash }
  })
}

/**
 * The inline style for a drawn path -- one place, rather than the same three
 * properties written out again at every SVG site in the app.
 *
 * That copying is how the dash went missing: a chart gridline asked rough.js for
 * `[5, 6]` and came out solid, because the site drawing it never read the option
 * back off the path.
 */
export function pathStyle(p: SketchPath): { stroke: string; strokeWidth: string; fill?: string; strokeDasharray?: string } {
  return {
    stroke: p.stroke,
    strokeWidth: String(p.strokeWidth),
    fill: p.fill,
    // `undefined` rather than "none", so a solid path carries no dash attribute.
    strokeDasharray: p.strokeLineDash?.join(" "),
  }
}

/**
 * A rounded rectangle as a path, since rough.js has no rounded rectangle.
 *
 * Cards and buttons in a hand-drawn sketch are rectangles with soft corners; a
 * hard corner reads as a wireframe. The radius is clamped so a small badge
 * cannot produce a bulging shape.
 */
export function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  return (
    `M${x + rad},${y}` +
    `L${x + w - rad},${y}` +
    `Q${x + w},${y} ${x + w},${y + rad}` +
    `L${x + w},${y + h - rad}` +
    `Q${x + w},${y + h} ${x + w - rad},${y + h}` +
    `L${x + rad},${y + h}` +
    `Q${x},${y + h} ${x},${y + h - rad}` +
    `L${x},${y + rad}` +
    `Q${x},${y} ${x + rad},${y}` +
    "Z"
  )
}

/**
 * The wobble dial, 0 to 4 as the operator sets it, as a multiplier.
 *
 * `roughness` and `bowing` carry the look: roughness jitters the path, bowing
 * bends a straight line into an arc. Both scale together; the offset at the low
 * end keeps 1 reading as a drawn line rather than a ruler, and 0 is left exactly
 * 0 so an operator who wants clean geometry gets it.
 */
export function wobbleFactor(wobble: number): number {
  const w = Math.max(0, Math.min(4, wobble))
  return w === 0 ? 0 : 0.45 + 0.275 * w
}

/**
 * The stroke options for a shape.
 *
 * `stroke: "currentColor"` is deliberate: a rough shape is drawn inside an SVG
 * that inherits the colour of its container, so the palette stays in CSS and a
 * dark mode needs no second drawing and no re-render.
 */
export function inkOptions(factor: number, opts: Options = {}): Options {
  return {
    stroke: "currentColor",
    strokeWidth: 1.5,
    roughness: 1.15 * factor,
    bowing: 1.0 * factor,
    maxRandomnessOffset: 2 * factor,
    fixedDecimalPlaceDigits: 2,
    ...opts,
  }
}

/**
 * The same, for a shape filled with pencil shading rather than a flat wash.
 *
 * Two strokes over every path, which is what makes a line read as pencil rather
 * than as a vector, and a hachure fill for the colour.
 */
export function pencilOptions(factor: number, opts: Options = {}): Options {
  return inkOptions(factor, {
    fillStyle: "hachure",
    hachureAngle: -41,
    hachureGap: 6,
    fillWeight: 1.4,
    // The fill's own jitter is damped: a hachure at full roughness spills past
    // the stroke meant to contain it, which on a 10px meter looks like a smear.
    fillShapeRoughnessGain: 0.4,
    ...opts,
  })
}
