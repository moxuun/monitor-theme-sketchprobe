import { useCallback, useEffect, useMemo, useState } from "react"

import { api, groupsOf, useNodes } from "@/lib/api"
import { FIELDS, loadConfig } from "@/lib/config"
import { Link, useNodeRoute } from "@/lib/route"
import { useLatencies } from "@/lib/latency"
import { Icon } from "@/components/Icon"
import { NodeCard } from "@/components/NodeCard"
import { NodeDetail } from "@/components/NodeDetail"
import { Summary } from "@/components/Summary"
import { WorldMap } from "@/map/WorldMap"
import { SketchBox, SketchProvider, SketchRing, SketchRule } from "@/sketch/Sketch"

type Me = { authed: boolean; github: boolean; site_name: string; public_page: boolean; history_days: number }

type Theme = "light" | "dark"
const THEME_KEY = "sketchprobe:theme"

function useTheme() {
  // `null` is "follow the system", which is not the same as a stored "light".
  // The two are kept apart so that merely opening the page does not freeze the
  // OS preference into storage: a visitor who never touches the toggle should
  // keep following their desktop into dark mode at dusk.
  const [chosen, setChosen] = useState<Theme | null>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === "light" || saved === "dark" ? saved : null
  })
  const [system, setSystem] = useState<Theme>(() =>
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  )
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)")
    const update = () => setSystem(query.matches ? "dark" : "light")
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  const theme = chosen ?? system
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const choose = (next: Theme) => {
    setChosen(next)
    localStorage.setItem(THEME_KEY, next)
  }
  return [theme, choose] as const
}

export function App() {
  const { nodes, error, closed } = useNodes()
  const [me, setMe] = useState<Me | null>(null)
  const [meError, setMeError] = useState("")
  const [config, setConfig] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, f.default])),
  )
  const [group, setGroup] = useState<string | null>(null)
  const [theme, setTheme] = useTheme()
  const openId = useNodeRoute()

  const loadMe = useCallback(
    () =>
      api<Me>("/me")
        .then((next) => {
          setMe(next)
          setMeError("")
        })
        .catch((e: Error) => setMeError(e.message)),
    [],
  )

  useEffect(() => {
    void loadMe()
    loadConfig().then(setConfig)
  }, [loadMe])

  // The status page was closed while this tab was open: ask again, so the gate
  // below can send an anonymous visitor to the panel rather than leave them on a
  // list that stopped updating.
  useEffect(() => {
    if (closed) void loadMe()
  }, [closed, loadMe])

  // Closed to anonymous callers. Nothing here is theirs to read, and the panel is
  // where the login is.
  useEffect(() => {
    if (me && !me.public_page && !me.authed) location.href = "/admin/"
  }, [me])

  // Written to the body rather than a wrapper, since the ruling is painted on the
  // page's own background.
  useEffect(() => {
    document.body.dataset.paper = String(config.paper ?? "grid")
  }, [config.paper])

  const open = openId === null ? undefined : nodes?.find((n) => n.id === openId)

  // The node's name first, as a tab among many: which node is open matters more
  // than which hub it came from.
  useEffect(() => {
    document.title = [open?.name, me?.site_name || "Monitor"].filter(Boolean).join(" · ")
  }, [open?.name, me])

  const groups = useMemo(() => groupsOf(nodes ?? []), [nodes])
  const tabs = useMemo(() => {
    const list = [{ key: null as string | null, label: "全部" }, ...groups.map((g) => ({ key: g as string | null, label: g }))]
    // Offered only when a node actually carries no group, so a fleet that uses
    // groups throughout does not grow an empty tab.
    if ((nodes ?? []).some((n) => !n.group)) list.push({ key: "", label: "未分组" })
    return list
  }, [groups, nodes])

  // A group can disappear while it is the one being shown -- the operator
  // regroups its last node -- and an empty page with a tab selected for nothing
  // reads as a failure rather than as a change.
  useEffect(() => {
    if (!tabs.some((t) => t.key === group)) setGroup(null)
  }, [group, tabs])

  const shown = useMemo(
    () => (nodes ?? []).filter((n) => group === null || (n.group ?? "") === group),
    [nodes, group],
  )

  const latencies = useLatencies(openId === null && !closed ? shown.filter((n) => n.online).map((n) => n.id) : [])

  const wobble = typeof config.wobble === "number" ? config.wobble : 2
  const notice = typeof config.notice === "string" ? config.notice : ""
  const showSummary = config.show_summary !== false
  const showCredit = config.show_credit !== false

  return (
    <SketchProvider wobble={wobble}>
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            {/* The title is the most obvious way home, so it has to be one. */}
            <Link className="brand-mark" href="/">
              {me?.site_name || "Monitor"}
              <SketchRule className="brand-rule" seedKey="brand" />
            </Link>
          </div>
          <nav className="nav">
            <Link className="nav-item" href="/" aria-current={openId === null ? "page" : undefined}>
              {openId === null ? <SketchRing seedKey="nav-nodes">节点</SketchRing> : "节点"}
            </Link>
            {/* The panel is a separate app built into the hub, so this is a
                navigation rather than a route. */}
            <a className="nav-item" href="/admin/">
              {me?.authed ? "面板" : "登录"}
            </a>
            <button
              className="icon-btn"
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "切换到浅色" : "切换到深色"}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            {/* The node page's way back sits at the far right of the bar, not
                buried in the detail card, where it read as one more chip. */}
            {openId !== null ? (
              <Link className="nav-item with-icon" href="/">
                <Icon name="back" size={12} />
                节点列表
              </Link>
            ) : null}
          </nav>
        </header>

        {notice ? (
          <SketchBox className="notice" seedKey="notice">
            <span className="notice-tag with-icon">
              <Icon name="note" size={13} />
              公告
            </span>
            {notice}
          </SketchBox>
        ) : null}

        {error ? (
          <SketchBox className="notice" seedKey="error">
            <span className="error">
              <Icon name="alert" size={14} /> {error}
            </span>
          </SketchBox>
        ) : null}

        {meError ? (
          <SketchBox className="notice" seedKey="me-error">
            <span className="error">
              <Icon name="alert" size={14} /> {meError}
            </span>
            <button className="nav-item" type="button" onClick={() => void loadMe()}>
              重试
            </button>
          </SketchBox>
        ) : null}

        {closed ? <SketchBox className="notice" seedKey="closed">状态页已对匿名访问关闭。</SketchBox> : null}

        {nodes === null ? (
          <div className="loading">正在读取节点…</div>
        ) : open ? (
          <NodeDetail node={open} historyDays={me?.history_days ?? 30} />
        ) : openId !== null ? (
          <div className="empty">找不到这个节点。</div>
        ) : (
          <div className="stack">
            {showSummary ? <Summary nodes={shown} group={group} /> : null}

            {/* Scoped to the tab, like the tiles above it: the whole page is
                showing one group, and a map still showing the fleet would
                contradict the cards underneath it. */}
            <WorldMap nodes={shown} />

            {tabs.length > 2 ? (
              <div className="tabs">
                {tabs.map((t) => (
                  <button
                    key={t.key ?? "*"}
                    className="tab"
                    type="button"
                    aria-pressed={t.key === group}
                    onClick={() => setGroup(t.key)}
                  >
                    {t.key === group ? <SketchRing seedKey={`tab-${t.key ?? "*"}`}>{t.label}</SketchRing> : t.label}
                  </button>
                ))}
              </div>
            ) : null}

            {shown.length ? (
              <div className="grid">
                {shown.map((n) => (
                  <NodeCard key={n.id} node={n} latency={latencies[n.id]} />
                ))}
              </div>
            ) : (
              <div className="empty">这个分组下还没有节点。</div>
            )}
          </div>
        )}

        {/* Both pages run to two or three screens and the bar scrolls away with
            them, so the two ends are reachable without dragging the scrollbar.
            The targets are read when a button is pressed rather than when the
            page was drawn: the fleet keeps arriving underneath it. */}
        <div className="jump">
          <button
            className="icon-btn"
            type="button"
            aria-label="回到顶部"
            title="回到顶部"
            onClick={() => scrollTo(0, 0)}
          >
            <Icon name="up" size={14} />
          </button>
          <button
            className="icon-btn"
            type="button"
            aria-label="跳到底部"
            title="跳到底部"
            onClick={() => scrollTo(0, document.documentElement.scrollHeight)}
          >
            <Icon name="down" size={14} />
          </button>
        </div>

        {showCredit ? (
          <footer className="footer">
            <a
              className="credit"
              href="https://github.com/moxuun/monitor-theme-sketchprobe"
              target="_blank"
              rel="noreferrer"
            >
              Theme by moxuun
            </a>
          </footer>
        ) : null}
      </div>
    </SketchProvider>
  )
}
