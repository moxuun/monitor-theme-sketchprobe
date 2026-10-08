/**
 * The colored-pencil shading, as real SVG `<pattern>` tiles.
 *
 * A tile is a solid ground plus a set of long, slightly bowed strokes at
 * varying weight and opacity. Three things make that read as pencil rather than
 * as a hatch filter:
 *
 *  - the passes run edge to edge, so a tile's stroke joins its neighbour's into
 *    one line and no tile boundary shows; the variation has to come from weight
 *    and darkness instead. Strokes that stop short of the edge read as a dotted
 *    lattice rather than as hatching.
 *  - the strokes differ in weight and darkness, and a couple of them re-stroke
 *    a line already there at low opacity, which is what uneven pressure looks
 *    like once it has dried
 *  - a couple of passes cross the others at a shallow angle, so a large country
 *    reads as a second layer of pencil rather than as a single combed direction
 *
 * The land's ground is part of its tile rather than a separate rect underneath,
 * which is what lets a whole country be one `<path>` with a pattern fill. It is
 * a wash rather than a fill, so the page's ruling and grain keep showing through
 * the pencil the way they do through a card's hatching -- an opaque ground would
 * cut a rectangle out of the paper and put the map on a second sheet.
 *
 * The sea has no ground of its own. This map is drawn on the panel's own paper,
 * which already carries the page's ruling and grain: painting an opaque sea over
 * it would put the map on a second sheet and cut a rectangle out of the first.
 * So the sea is a wash and a light pencil over whatever the page is
 * showing, and the coastline does the rest.
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
  [0, 1.2, LAND_TILE, 1.2, 12, 1.65, 0.9, 0.4],
  [0, 4.3, LAND_TILE, 4.3, 12, 3.95, 0.65, 0.24],
  [0, 7.9, LAND_TILE, 7.9, 12, 8.3, 0.95, 0.35],
  [0, 10.9, LAND_TILE, 10.9, 12, 10.55, 0.6, 0.21],
  [0, 14.4, LAND_TILE, 14.4, 12, 14.8, 0.85, 0.38],
  [0, 17.5, LAND_TILE, 17.5, 12, 17.2, 0.65, 0.22],
  [0, 21, LAND_TILE, 21, 12, 21.4, 0.9, 0.33],
  // Re-strokes, over lines already in the tile: the doubled line is what uneven
  // pressure looks like once it has dried.
  [0, 15.1, LAND_TILE, 15.1, 12, 14.7, 0.8, 0.16],
  [0, 7.4, LAND_TILE, 7.4, 12, 7.8, 0.7, 0.14],
  // And twice across, so a country the size of Russia is not one direction.
  [6.2, 0, 6.2, LAND_TILE, 5.8, 12, 0.6, 0.13],
  [17.4, 0, 17.4, LAND_TILE, 17.8, 12, 0.55, 0.1],
]

const SEA_TILE = 20

/**
 * Quieter than the land, and thinner: this is the ground the land sits on, and
 * pencil at the land's weight over every ocean would fight every coastline on
 * the map. It still has to be there, or the sea is a flat tint and the map stops
 * reading as drawn.
 */
const SEA_PASSES: readonly Pass[] = [
  [0, 1.1, SEA_TILE, 1.1, 10, 1.45, 0.75, 0.34],
  [0, 4.9, SEA_TILE, 4.9, 10, 4.6, 0.55, 0.22],
  [0, 8.7, SEA_TILE, 8.7, 10, 9.05, 0.7, 0.3],
  [0, 12.5, SEA_TILE, 12.5, 10, 12.2, 0.5, 0.18],
  [0, 16.3, SEA_TILE, 16.3, 10, 16.65, 0.65, 0.26],
  [0, 16.8, SEA_TILE, 16.8, 10, 16.5, 0.55, 0.15],
]

export function PencilDefs({ scale }: { scale: number }) {
  // A zero scale happens on the first render, before anything has been
  // measured. One is a valid tile size and is replaced before paint.
  const k = scale > 0 ? 1 / scale : 1
  const sea = `rotate(-34) scale(${k.toFixed(4)})`
  const land = `rotate(28) scale(${k.toFixed(4)})`

  return (
    <defs>
      <pattern id="map-sea" patternUnits="userSpaceOnUse" width={SEA_TILE} height={SEA_TILE} patternTransform={sea}>
        <g fill="none" stroke="var(--map-sea-ink)" strokeLinecap="round">
          {SEA_PASSES.map((p, i) => (
            <path key={i} d={pass(p)} strokeWidth={p[6]} opacity={p[7]} />
          ))}
        </g>
      </pattern>

      <pattern id="map-land" patternUnits="userSpaceOnUse" width={LAND_TILE} height={LAND_TILE} patternTransform={land}>
        <rect width={LAND_TILE} height={LAND_TILE} fill="var(--map-land)" />
        <g fill="none" stroke="var(--map-land-ink)" strokeLinecap="round">
          {LAND_PASSES.map((p, i) => (
            <path key={i} d={pass(p)} strokeWidth={p[6]} opacity={p[7]} />
          ))}
        </g>
      </pattern>
    </defs>
  )
}
