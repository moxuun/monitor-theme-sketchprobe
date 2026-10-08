/**
 * The colored-pencil shading, as real SVG `<pattern>` tiles.
 *
 * A tile is a solid ground plus a set of long, slightly bowed strokes at
 * varying weight and opacity. Three things make that read as pencil rather than
 * as a hatch filter:
 *
 *  - the passes run edge to edge, so a tile's stroke joins its neighbour's into
 *    one line and no tile boundary shows; the variation has to come from weight
 *    and darkness instead. Strokes that stop short of the edge were the first
 *    thing tried, and at this spacing they read as a dotted lattice rather than
 *    as hatching.
 *  - the strokes differ in weight and darkness, and a couple of them re-stroke
 *    a line already there at low opacity, which is what uneven pressure looks
 *    like once it has dried
 *  - a couple of passes cross the others at a shallow angle, so a large country
 *    reads as a second layer of pencil rather than as a single combed direction
 *
 * The land's ground is part of its tile rather than a separate rect underneath,
 * which is what lets a whole country be one `<path>` with a pattern fill. The
 * sea's ground is the map element's own background instead: the world repeats
 * east-west, so the ocean gets drawn twice at the seam, and a ground inside the
 * tile would double up there into a visible band.
 *
 * `patternTransform` scales the tile by 1/scale. The geometry underneath is in
 * map units and the whole group is scaled to fit, so without this the hatching
 * would grow with the map and a phone would get a wash where a desktop gets
 * pencil; with it, the texture stays the size of the pencil at every zoom. That
 * is deliberate: zooming in shows more of the map, it does not sharpen the
 * coastline, and a texture that scaled up would only advertise the difference.
 */
type Pass = readonly [x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, width: number, opacity: number]

/** A pass as a quadratic: the middle pair is the control point, so it bows. */
const pass = ([x0, y0, x1, y1, cx, cy]: Pass) => `M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`

const LAND_TILE = 24

/**
 * Spacing is uneven and the weight varies: an even comb at an even weight is
 * what makes a hatch read as a halftone screen instead of as a hand.
 */
const LAND_PASSES: readonly Pass[] = [
  [0, 1.2, LAND_TILE, 1.2, 12, 1.65, 0.8, 0.27],
  [0, 4.3, LAND_TILE, 4.3, 12, 3.95, 0.55, 0.15],
  [0, 7.9, LAND_TILE, 7.9, 12, 8.3, 0.85, 0.23],
  [0, 10.9, LAND_TILE, 10.9, 12, 10.55, 0.5, 0.13],
  [0, 14.4, LAND_TILE, 14.4, 12, 14.8, 0.75, 0.25],
  [0, 17.5, LAND_TILE, 17.5, 12, 17.2, 0.55, 0.14],
  [0, 21, LAND_TILE, 21, 12, 21.4, 0.8, 0.21],
  // Re-strokes, over lines already in the tile: the doubled line is what uneven
  // pressure looks like once it has dried.
  [0, 15.1, LAND_TILE, 15.1, 12, 14.7, 0.7, 0.1],
  [0, 7.4, LAND_TILE, 7.4, 12, 7.8, 0.6, 0.09],
  // And twice across, so a country the size of Russia is not one direction.
  [6.2, 0, 6.2, LAND_TILE, 5.8, 12, 0.5, 0.08],
  [17.4, 0, 17.4, LAND_TILE, 17.8, 12, 0.45, 0.06],
]

const OCEAN_TILE = 20

const OCEAN_PASSES: readonly Pass[] = [
  [0, 1.1, OCEAN_TILE, 1.1, 10, 1.45, 0.7, 0.17],
  [0, 4.9, OCEAN_TILE, 4.9, 10, 4.6, 0.5, 0.11],
  [0, 8.7, OCEAN_TILE, 8.7, 10, 9.05, 0.65, 0.15],
  [0, 12.5, OCEAN_TILE, 12.5, 10, 12.2, 0.45, 0.09],
  [0, 16.3, OCEAN_TILE, 16.3, 10, 16.65, 0.6, 0.12],
  [0, 16.8, OCEAN_TILE, 16.8, 10, 16.5, 0.5, 0.07],
]

export function PencilDefs({ scale }: { scale: number }) {
  // A zero scale happens on the first render, before anything has been
  // measured. One is a valid tile size and is replaced before paint.
  const k = scale > 0 ? 1 / scale : 1
  const ocean = `rotate(-34) scale(${k.toFixed(4)})`
  const land = `rotate(28) scale(${k.toFixed(4)})`

  return (
    <defs>
      {/* Water: quieter than the land. It is the ground the land sits on, and
          pencil over the whole sea would fight every coastline on the map. */}
      <pattern id="mp-ocean" patternUnits="userSpaceOnUse" width={OCEAN_TILE} height={OCEAN_TILE} patternTransform={ocean}>
        <g fill="none" stroke="var(--mp-ocean-ink)" strokeLinecap="round">
          {OCEAN_PASSES.map((p, i) => (
            <path key={i} d={pass(p)} strokeWidth={p[6]} opacity={p[7]} />
          ))}
        </g>
      </pattern>

      <pattern id="mp-land" patternUnits="userSpaceOnUse" width={LAND_TILE} height={LAND_TILE} patternTransform={land}>
        <rect width={LAND_TILE} height={LAND_TILE} fill="var(--mp-land)" />
        <g fill="none" stroke="var(--mp-land-ink)" strokeLinecap="round">
          {LAND_PASSES.map((p, i) => (
            <path key={i} d={pass(p)} strokeWidth={p[6]} opacity={p[7]} />
          ))}
        </g>
      </pattern>
    </defs>
  )
}
