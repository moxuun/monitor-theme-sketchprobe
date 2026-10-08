import type { ReactNode } from "react"

import { cx } from "@/lib/cx"
import { SketchBox } from "@/sketch/Sketch"

export type Tone = "ok" | "warn" | "bad" | "off"

/** A status pill. The frame is drawn, the word inside it is not. */
export function Badge({ tone, children, dot }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <SketchBox
      className={cx("badge", tone)}
      seedKey={`badge-${tone}-${typeof children === "string" ? children : ""}`}
      // A pill: the radius is clamped to half the height, so any large number
      // gives the same capsule.
      radius={99}
      strokeWidth={1.15}
      dashed={tone === "off"}
    >
      {dot ? <span className="dot" /> : null}
      {children}
    </SketchBox>
  )
}
