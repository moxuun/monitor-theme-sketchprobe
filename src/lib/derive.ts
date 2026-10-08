import type { Node } from "@/lib/api"
import { daysUntil, sinceSeen } from "@/lib/format"

/**
 * How long ago, in the largest unit that still says something: "8 分钟" rather
 * than "0.13 小时". Deliberately without a trailing "前" -- callers read it as
 * "离线 8 分钟".
 */
export function ago(seconds: number): string {
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} 秒`
  if (seconds < 5400) return `${Math.round(seconds / 60)} 分钟`
  if (seconds < 172_800) return `${Math.round(seconds / 3600)} 小时`
  return `${Math.round(seconds / 86_400)} 天`
}

export type Status = {
  tone: "ok" | "off"
  text: string
  dot: boolean
  /**
   * A drawn mark for the two states a glance can miss: a word that says a node
   * is down reads the same as one that says it is up when both are grey text of
   * the same length. Null for a healthy node, where the status dot already says
   * it and a mark would be one more thing on every card.
   */
  mark: "timeout" | "probe" | null
}

export function statusOf(node: Node): Status {
  if (node.online) return { tone: "ok", text: "在线", dot: true, mark: null }
  const gone = sinceSeen(node)
  // A node that has never reported has no interval to report: it is waiting to
  // be connected, not down, and "离线 0 秒" would say neither.
  if (node.last_seen_ago === null || gone <= 0) return { tone: "off", text: "待接入", dot: false, mark: "probe" }
  // Grey, like the state above: the red this theme has is spent on the readings
  // someone can act on, and the mark and the word already carry the difference.
  return { tone: "off", text: `离线 ${ago(gone)}`, dot: false, mark: "timeout" }
}

/**
 * An expiry worth putting on a card: within the week, or already past. Anything
 * further off is noise on a page of nine nodes, and stays on the node's own
 * page.
 */
export function expiryOf(node: Node): { tone: "warn" | "bad"; text: string } | null {
  const days = node.expires_in ?? daysUntil(node.expires_at)
  if (days === null || days === undefined) return null
  if (days < 0) return { tone: "bad", text: `已过期 ${-days} 天` }
  if (days <= 7) return { tone: "warn", text: days === 0 ? "今天到期" : `剩 ${days} 天` }
  return null
}

/**
 * The colour a load meter is shaded in.
 *
 * One colour for everything normal, so a page of nine cards reads as one palette
 * and the eye is caught only by the meters that matter. A different colour per
 * resource would look livelier and would also put three colours on every healthy
 * card, which is exactly the noise a status page is for removing.
 */
export function loadColor(pct: number, base = "var(--accent)"): string {
  if (pct >= 92) return "var(--bad)"
  if (pct >= 80) return "var(--warn)"
  return base
}
