import manifest from "../../theme.json"
import { api } from "@/lib/api"

/**
 * The operator's settings over the defaults declared in theme.json, which the
 * hub does not store. A saved value of another type -- left by an older version
 * of this theme -- counts as unsaved. Any failure, a hub predating settings (404)
 * included, renders the defaults rather than an error.
 */
export function loadConfig(): Promise<Record<string, unknown>> {
  // Unlike the type-only check this replaces, a number outside its declared
  // range and a select value that is not one of the options are both rejected
  // here: the panel writes whatever an operator types, and `wobble: 40` would
  // reach rough.js and draw every border as a scribble.
  const valid = (field: Field, saved: unknown): boolean => {
    if (typeof saved !== typeof field.default) return false
    if (field.type === "number" && typeof saved === "number") {
      return (field.min === undefined || saved >= field.min) && (field.max === undefined || saved <= field.max)
    }
    if (field.type === "select") return field.options.some((o) => o.value === saved)
    return true
  }
  const pick = (saved: Record<string, unknown>) =>
    Object.fromEntries(FIELDS.map((f) => [f.key, valid(f, saved[f.key]) ? saved[f.key] : f.default]))
  return api<Record<string, unknown>>(`/themes/${manifest.short}/config`).then(pick).catch(() => pick({}))
}

type Field = {
  key: string
  type: "string" | "text" | "number" | "boolean" | "select"
  default: string | number | boolean
  min?: number
  max?: number
  options: { value: string | number | boolean; label: string }[]
}

/** The settings that hold a value: a `title` row is a heading and stores nothing. */
export const FIELDS = manifest.config.filter((f): f is (typeof manifest.config)[number] & Field => "key" in f)
