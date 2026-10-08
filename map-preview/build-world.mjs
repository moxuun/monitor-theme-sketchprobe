/**
 * Turns Natural Earth's country polygons into the `world.ts` this prototype
 * draws.
 *
 * Run it only when the geography has to change:
 *
 *     node map-preview/build-world.mjs
 *
 * Inputs are the public-domain Natural Earth vector files, cached under
 * `map-preview/.cache/` (gitignored) so a rerun needs no network. They are
 * never shipped: what ships is the generated module, which is a few tens of
 * kilobytes of already-projected path data.
 *
 *   ne_110m_admin_0_countries  the polygons, and the label point of every
 *                              country big enough to have one
 *   ne_50m_admin_0_countries   label points for the rest -- 110m has no
 *                              feature at all for Hong Kong, Singapore, Macao
 *                              and 60 other small territories, and a node in
 *                              one of those still has to land somewhere
 *
 * Projection: equirectangular, cropped to the band that has nodes in it. The
 * graticule then falls on a plain rectangle, which is what an engineer draws
 * on graph paper, and the arithmetic is one multiply per axis. The crop is
 * what makes it usable: full-range plate carree spends a sixth of its height
 * on Antarctica, where nothing is monitored, and 360x180 leaves a map four
 * times as wide as it is tall.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE = join(HERE, ".cache")

const SOURCES = [
  { file: "ne_110m_admin_0_countries.geojson", url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson" },
  { file: "ne_50m_admin_0_countries.geojson", url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson" },
]

// The crop, in degrees. The north edge clears Greenland's 83.6 N; the south
// edge clears Cape Horn's 55.9 S and cuts Antarctica off entirely, so the map
// carries no geometry the frame does not show.
const LAT_TOP = 84
const LAT_BOTTOM = -56
const LON_LEFT = -180
const LON_RIGHT = 180

// The width of the map in its own units. Everything else is derived from it.
const WIDTH = 1000
const HEIGHT = Math.round((WIDTH * (LAT_TOP - LAT_BOTTOM)) / (LON_RIGHT - LON_LEFT))

/**
 * How far a point may sit off a straight line and still be dropped, in map
 * units. At the ~1 px per unit the map is displayed at, this is a point that
 * lands inside the pixel the line already covers.
 */
const TOLERANCE = 0.55

// Antarctica: no nodes, and it is the one feature the crop cannot hold.
const DROP = new Set(["ATA"])

const project = ([lon, lat]) => [
  ((lon - LON_LEFT) / (LON_RIGHT - LON_LEFT)) * WIDTH,
  ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * HEIGHT,
]

async function source({ file, url }) {
  const path = join(CACHE, file)
  if (!existsSync(path)) {
    process.stdout.write(`fetching ${file} ... `)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`)
    await mkdir(CACHE, { recursive: true })
    await writeFile(path, Buffer.from(await res.arrayBuffer()))
    process.stdout.write("ok\n")
  }
  return JSON.parse(await readFile(path, "utf8"))
}

/**
 * Ramer-Douglas-Peucker, iterative so a long coastline cannot blow the stack.
 *
 * The ring's repeated closing point is dropped first: GeoJSON repeats it, and
 * with both ends of the baseline on the same spot every distance measures zero,
 * so the pass would throw the whole ring away and keep only its two ends.
 */
function simplify(points, tolerance) {
  const closed = points.length > 1 && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]
  const open = closed ? points.slice(0, -1) : points
  if (open.length < 3) return points
  const keep = new Uint8Array(open.length)
  keep[0] = keep[open.length - 1] = 1
  const stack = [[0, open.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()
    const [ax, ay] = open[first]
    const [bx, by] = open[last]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy)
    let worst = -1
    let at = -1
    for (let i = first + 1; i < last; i++) {
      const [x, y] = open[i]
      // Perpendicular distance, scaled by the segment length so the division
      // only happens once for the winner.
      //
      // A ring that repeats its first point leaves the baseline with no
      // direction, and the perpendicular distance to a zero-length segment is
      // zero for every point -- so the pass would keep none of them and the
      // ring would be dropped for being degenerate. Alaska is such a ring: it
      // is the only one in 110m, and losing it loses the whole state. Measure
      // to the point itself when the baseline has no length.
      const d = len > 0 ? Math.abs((x - ax) * dy - (y - ay) * dx) / len : Math.hypot(x - ax, y - ay)
      if (d > worst) {
        worst = d
        at = i
      }
    }
    if (worst > tolerance) {
      keep[at] = 1
      stack.push([first, at], [at, last])
    }
  }
  const kept = open.filter((_, i) => keep[i])
  return closed ? [...kept, points[points.length - 1]] : kept
}

/** A ring as one `d` subpath, rounded to whole map units, degenerate runs dropped. */
function ringPath(ring, tolerance) {
  const projected = ring.map(project)
  const simplified = simplify(projected, tolerance)
  const out = []
  let last = null
  for (const [x, y] of simplified) {
    const px = Math.round(x)
    const py = Math.round(y)
    if (last && px === last[0] && py === last[1]) continue
    out.push(`${px} ${py}`)
    last = [px, py]
  }
  // A shape needs three corners to be a shape.
  if (out.length < 3) return ""
  return `M${out.join(" ")}Z`
}

/**
 * Every ring of every polygon of a feature, in one `d`.
 *
 * Rings are concatenated rather than merged: the fill rule is `evenodd`, so a
 * lake inside a country is punched out by the ring that follows it without any
 * of this having to know which ring is a hole.
 */
function featurePath(feature) {
  const { type, coordinates } = feature.geometry
  const polygons = type === "Polygon" ? [coordinates] : coordinates
  let d = ""
  let points = 0
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const part = ringPath(ring, TOLERANCE)
      if (part) {
        d += part
        points += part.length
      }
    }
  }
  return { d, points }
}

/** The ISO 3166-1 alpha-2 code, or "" where Natural Earth has none. */
const isoOf = (p) => {
  for (const key of ["ISO_A2_EH", "ISO_A2", "WB_A2"]) {
    const value = String(p[key] ?? "").trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(value)) return value
  }
  return ""
}

const nameOf = (p) => String(p.NAME_ZH || p.NAME || p.ADMIN || "").trim()

/**
 * Every segment that jumps more than half the world in longitude, which is how
 * a polygon that is not split at the antimeridian shows up: drawn as a line
 * straight across the map. Natural Earth splits its geometry, so this is a
 * check on the input rather than a fix, and it has to stay quiet.
 */
function antimeridianJumps(feature) {
  const { type, coordinates } = feature.geometry
  const polygons = type === "Polygon" ? [coordinates] : coordinates
  let jumps = 0
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (let i = 1; i < ring.length; i++) {
        if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) jumps++
      }
    }
  }
  return jumps
}

const coarse = await source(SOURCES[0])
const fine = await source(SOURCES[1])

const countries = []
const places = new Map()
let points = 0
let dropped = 0
let jumps = 0
let belowCrop = 0

for (const feature of coarse.features) {
  const p = feature.properties
  const id = isoOf(p)
  if (DROP.has(String(p.ADM0_A3))) {
    dropped++
    continue
  }
  const { d, points: n } = featurePath(feature)
  if (!d) continue
  points += n
  jumps += antimeridianJumps(feature)
  if (id) countries.push({ id, name: nameOf(p), d })
  else countries.push({ id: "", name: nameOf(p), d })
  if (id) {
    const [x, y] = project([Number(p.LABEL_X), Number(p.LABEL_Y)])
    places.set(id, { id, name: nameOf(p), x: Math.round(x), y: Math.round(y) })
  }
  for (const ring of feature.geometry.type === "Polygon" ? feature.geometry.coordinates : feature.geometry.coordinates.flat()) {
    for (const [, lat] of ring) if (lat < LAT_BOTTOM) belowCrop++
  }
}

// The territories 110m has no polygon for. Their polygons are dropped and only
// the label point is kept: a node needs a place to sit, not an outline, and
// pulling in 50m coastlines for 63 specks would multiply the shipped data for
// shapes a few pixels across.
let added = 0
for (const feature of fine.features) {
  const p = feature.properties
  const id = isoOf(p)
  if (!id || places.has(id)) continue
  const [x, y] = project([Number(p.LABEL_X), Number(p.LABEL_Y)])
  if (!Number.isFinite(x) || !Number.isFinite(y)) continue
  places.set(id, { id, name: nameOf(p), x: Math.round(x), y: Math.round(y) })
  added++
}

const list = [...places.values()].filter((p) => p.y >= 0 && p.y <= HEIGHT && p.x >= 0 && p.x <= WIDTH).sort((a, b) => a.id.localeCompare(b.id))

const report = [
  `${countries.length} countries, ${list.length} places (${added} from 50m, ${places.size - list.length} outside the crop)`,
  `${points} map units of path data`,
  `dropped ${dropped} feature(s), ${belowCrop} point(s) below the crop`,
  `antimeridian jumps: ${jumps}${jumps ? "  <-- BAD" : ""}`,
]
process.stdout.write(report.join("\n") + "\n")
if (jumps) throw new Error("input geometry crosses the antimeridian; split it before generating")

const module = `// GENERATED by map-preview/build-world.mjs -- do not edit by hand.
//
// Natural Earth 1:110m admin 0 countries (polygons) and 1:50m (label points for
// the territories 110m omits). Public domain: https://www.naturalearthdata.com/
//
// Equirectangular, cropped to ${LAT_TOP}N..${LAT_BOTTOM}S. One unit is one pixel
// at the width this is drawn at, which is what lets the coordinates stay
// integers. \`d\` uses \`evenodd\`, so a hole is a ring that follows the ring it
// is punched out of.

export const WORLD = { w: ${WIDTH}, h: ${HEIGHT}, top: ${LAT_TOP}, bottom: ${LAT_BOTTOM} } as const

export type Country = { id: string; name: string; d: string }

/** A place a node can be pinned to: a country's label point, in map units. */
export type Place = { id: string; name: string; x: number; y: number }

export const COUNTRIES: Country[] = [
${countries.map((c) => `  { id: ${JSON.stringify(c.id)}, name: ${JSON.stringify(c.name)}, d: ${JSON.stringify(c.d)} },`).join("\n")}
]

export const PLACES: Record<string, Place> = {
${list.map((p) => `  ${p.id}: { id: ${JSON.stringify(p.id)}, name: ${JSON.stringify(p.name)}, x: ${p.x}, y: ${p.y} },`).join("\n")}
}
`

await writeFile(join(HERE, "world.ts"), module)
process.stdout.write(`wrote map-preview/world.ts (${(module.length / 1024).toFixed(1)} KiB)\n`)
