import { useId } from "react"

import { SketchBox } from "@/sketch/Sketch"

/**
 * Every flag in the package, as URLs, resolved once at build time.
 *
 * The package also exports a React component per country, but only through a
 * per-country subpath: reaching one that way means 250 dynamic-import branches,
 * and reaching one through a top-level import means the whole set in the entry
 * chunk. A glob over the raw SVGs gives one URL per country, emitted as its own
 * file, with a synchronous lookup.
 *
 * The path is relative and walks through node_modules because Vite resolves a
 * glob pattern as a path, not as a module specifier.
 */
const URLS = import.meta.glob("../../node_modules/country-flag-icons/3x2/*.svg", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>

const PREFIX = "../../node_modules/country-flag-icons/3x2/"

/**
 * A country's flag, drawn as though coloured in with a pencil.
 *
 * The flag itself is the package's SVG rather than a set of hand-drawn shapes:
 * there is no hand-drawn set of two hundred flags to reach for, and at this size
 * the detail inside one would not survive being redrawn. What makes it read as
 * drawn is the noise its edges are displaced by -- the outline wanders the way a
 * pencil's does -- and the colour held back far enough that the paper shows
 * through it.
 *
 * The box is wider than the flag by the room the frame needs: the drawing sits
 * two pixels in from the edge and wanders two more either way, so a flag that
 * filled its box would cover the line.
 */
export function Flag({ country, className }: { country: string; className?: string }) {
  const code = country.trim().toUpperCase()
  const url = code ? URLS[`${PREFIX}${code}.svg`] : undefined
  // React's own ids carry colons, which a `url(#...)` will not take unquoted.
  const filter = `flag-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  if (!url) return null
  return (
    <SketchBox className={className} seedKey={`flag-${code}`} radius={3} strokeWidth={1.2}>
      <svg className="flag-ink" viewBox="0 0 24 16" preserveAspectRatio="none" aria-hidden="true">
        <filter id={filter} x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06 0.09" numOctaves="2" seed="11" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <image href={url} width="24" height="16" filter={`url(#${filter})`} />
      </svg>
    </SketchBox>
  )
}
