import { useEffect, useState, type ComponentProps } from "react"

/**
 * `/node/{id}` names a node; anything else is the list. Paths rather than a
 * hash: the hub answers any path it has no file for with index.html, so a
 * reload and a link pasted into a chat both land on the same page, and the
 * address bar reads as one address rather than two.
 */
const read = () => {
  const match = location.pathname.match(/^\/node\/(\d+)/)
  return match ? Number(match[1]) : null
}

/** The node `/node/{id}` names, or null on the list. */
export function useNodeRoute() {
  const [id, setId] = useState(read)
  useEffect(() => {
    const sync = () => setId(read())
    addEventListener("popstate", sync)
    return () => removeEventListener("popstate", sync)
  }, [])
  return id
}

/**
 * Announced as a popstate, so every `useNodeRoute` hears it the way it hears
 * back. A link to the page already shown adds no entry, or each click on it
 * would cost one more press of back.
 */
export function navigate(href: string) {
  if (location.pathname + location.search + location.hash !== href) history.pushState({}, "", href)
  dispatchEvent(new PopStateEvent("popstate"))
  scrollTo(0, 0)
}

/**
 * A real anchor, so a middle or modified click still opens a new tab and the
 * card carries a URL a browser can offer; only a plain click is kept in the
 * page.
 */
export function Link({ href, onClick, ...props }: ComponentProps<"a"> & { href: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        navigate(href)
      }}
      {...props}
    />
  )
}
