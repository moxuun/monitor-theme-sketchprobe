import { SketchBar } from "@/sketch/Sketch"

/** One labelled meter: a name, a hand-drawn track, and the figure it reads. */
export function Meter({
  name,
  pct,
  color,
  label,
  seedKey,
}: {
  name: string
  /** 0-100. Capped for drawing, printed uncapped, so a plan over quota shows it. */
  pct: number
  color: string
  label: string
  seedKey?: string
}) {
  return (
    <div className="meter-row">
      <span className="meter-name">{name}</span>
      <SketchBar value={pct / 100} color={color} seedKey={seedKey} height={10} />
      <span className="meter-value">{label}</span>
    </div>
  )
}
