import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { Drawable } from "roughjs/bin/core"
import type { RoughGenerator } from "roughjs/bin/generator"

import { cx } from "@/lib/cx"
import { generator, seedOf, toPaths, wobbleFactor } from "@/sketch/core"
import { bar, frame, penCircle, rule } from "@/sketch/shapes"

const WobbleContext = createContext(2)

/** Carries the operator's `wobble` setting down to every shape. */
export function SketchProvider({ wobble, children }: { wobble: number; children: ReactNode }) {
  return <WobbleContext.Provider value={wobble}>{children}</WobbleContext.Provider>
}

/** The wobble multiplier for the shapes in this subtree. */
export const usePenFactor = () => wobbleFactor(useContext(WobbleContext))

/**
 * The random sequence a shape draws from.
 *
 * Without a key a shape gets a sequence of its own, fixed for as long as it is
 * mounted -- so two identical badges differ, which is what hand-drawn means, but
 * a badge does not redraw itself differently every time its parent re-renders.
 * With a key it is derived from that key instead, so the same card draws the
 * same border after a remount as before it.
 */
export function useSketchSeed(key?: string): number {
  const own = useRef(0)
  if (!own.current) own.current = Math.floor(Math.random() * 2 ** 31) || 1
  return key === undefined ? own.current : seedOf(key)
}

/**
 * An element's laid-out size, to half a pixel.
 *
 * A rough shape is generated at the size it is drawn at, so the wobble stays the
 * same width on a wide card and a narrow one; scaling a nominal viewBox instead
 * would stretch the stroke and the bowing with the box.
 */
export function useBoxSize<T extends Element>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<[number, number]>([0, 0])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      const w = Math.round(rect.width * 2) / 2
      const h = Math.round(rect.height * 2) / 2
      // Rounded to half a pixel and compared before setting: a fractional layout
      // width would otherwise report a new size on every observation and redraw
      // every rough shape on the page for a difference nothing can see.
      setSize((s) => (s[0] === w && s[1] === h ? s : [w, h]))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}

export type SketchRender = (
  gen: RoughGenerator,
  w: number,
  h: number,
  seed: number,
) => Drawable | Drawable[] | null | undefined

/**
 * An SVG that fills its container with hand-drawn shapes.
 *
 * The shapes are built as drawables and turned into `<path>` elements, so this
 * is an ordinary React render: no imperative DOM work, and the paths are
 * recomputed only when the size, the seed, or what the caller names in
 * `revision` changes.
 */
export function SketchSvg({
  render,
  revision,
  seed,
  className,
}: {
  render: SketchRender
  /** Any value that changes what is drawn: a percentage, a colour, a threshold. */
  revision?: unknown
  seed?: number
  className?: string
}) {
  const [ref, size] = useBoxSize<SVGSVGElement>()
  const latest = useRef(render)
  latest.current = render
  const own = useSketchSeed()
  const sequence = seed ?? own

  const paths = useMemo(
    () => {
      const [w, h] = size
      if (w <= 0 || h <= 0) return []
      const drawn = latest.current(generator, w, h, sequence)
      return (Array.isArray(drawn) ? drawn : drawn ? [drawn] : []).flatMap(toPaths)
    },
    // `latest` is a ref, not `render`: a caller writes its draw function inline,
    // and on a card that re-renders every two seconds that is a new closure each
    // time. The inputs that can change the drawing are the size, the seed, and
    // whatever the caller names in `revision`.
    [size, sequence, revision],
  )

  return (
    <svg ref={ref} className={cx("sketch-layer", className)} viewBox={`0 0 ${size[0]} ${size[1]}`} aria-hidden="true" focusable="false">
      {paths.map((p, i) => (
        // Inline style rather than attributes: the palette reaches the shape as
        // `var(--ok)` or `currentColor`, and a custom property in a presentation
        // attribute is not resolved by every browser, while in a style it is.
        <path key={i} d={p.d} style={{ stroke: p.stroke, strokeWidth: String(p.strokeWidth), fill: p.fill }} />
      ))}
    </svg>
  )
}

export type SketchBoxProps = {
  children?: ReactNode
  className?: string
  /** Fixes the shape's random sequence to this key, so it survives a remount. */
  seedKey?: string
  radius?: number
  dashed?: boolean
  /** Shade the box with pencil strokes in this colour. */
  fill?: string
  stroke?: string
  strokeWidth?: number
  revision?: unknown
}

/**
 * A hand-drawn box, sized by what it contains.
 *
 * The children are laid out by the box itself, with no wrapper between them, so
 * a `grid` or `flex` class on the box arranges them the way it would on any
 * other element. The drawing sits behind them: the layer carries `z-index: -1`
 * and the box `isolation: isolate`, which puts the SVG above the box's own
 * background and below its content, without letting it escape behind the page.
 */
export function SketchBox({
  children,
  className,
  seedKey,
  radius,
  dashed,
  fill,
  stroke,
  strokeWidth,
  revision,
}: SketchBoxProps) {
  const factor = usePenFactor()
  const seed = useSketchSeed(seedKey)
  return (
    <div className={cx("sketch-box", className)}>
      <SketchSvg
        seed={seed}
        revision={`${radius ?? ""}|${dashed ? 1 : 0}|${fill ?? ""}|${stroke ?? ""}|${strokeWidth ?? ""}|${revision ?? ""}`}
        render={(gen, w, h, s) => frame(gen, w, h, { factor, seed: s, radius, dashed, fill, stroke, strokeWidth })}
      />
      {children}
    </div>
  )
}

/** A meter: an empty track with a value shaded into it in pencil. */
export function SketchBar({
  value,
  color,
  seedKey,
  className,
  height = 10,
}: {
  value: number
  color: string
  seedKey?: string
  className?: string
  height?: number
}) {
  const factor = usePenFactor()
  const seed = useSketchSeed(seedKey)
  return (
    <div className={cx("sketch-bar", className)} style={{ height }}>
      <SketchSvg
        seed={seed}
        revision={value}
        render={(gen, w, h, s) => bar(gen, w, h, value, { factor, seed: s, color })}
      />
    </div>
  )
}

/** A horizontal rule. */
export function SketchRule({ className, dashed, strokeWidth, seedKey }: { className?: string; dashed?: boolean; strokeWidth?: number; seedKey?: string }) {
  const factor = usePenFactor()
  const seed = useSketchSeed(seedKey)
  return (
    <div className={cx("sketch-rule", className)}>
      <SketchSvg
        seed={seed}
        revision={`${dashed ? 1 : 0}|${strokeWidth ?? ""}`}
        render={(gen, w, _h, s) => rule(gen, w, { factor, seed: s, dashed, strokeWidth })}
      />
    </div>
  )
}

/** Wraps its children in a circle drawn around them, as a pen would. */
export function SketchRing({ children, className, seedKey }: { children: ReactNode; className?: string; seedKey?: string }) {
  const factor = usePenFactor()
  const seed = useSketchSeed(seedKey)
  return (
    <div className={cx("sketch-ring", className)}>
      <SketchSvg seed={seed} render={(gen, w, h, s) => penCircle(gen, w, h, { factor, seed: s })} />
      {children}
    </div>
  )
}
