import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { setApiQuiet } from "@/services/api"

// #region ink
// Pure geometry: a star-shaped ink blot whose rim is fractal noise plus thin
// tendrils, with droplets that land just ahead of the front and get swallowed.
// No React, no DOM: the test lifts this region and runs it.

export type InkShape = {
  harmonics: number[][] // [frequency, amplitude, phase, drift]
  tendrils: number[][] // [angle, width (rad), length (x R), delay (0..1)]
  drops: number[][] // [angle, distance (x Rend), size (x Rend), stretch]
  dip: number // deepest the rim can fall below R, as a fraction of R
}

const TAU = Math.PI * 2
const FREQS = [3, 5, 8, 13, 21, 34, 55, 89, 144, 233]
const ROUGH = 0.22 // summed rim amplitude, as a fraction of R

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeInk(seed: number): InkShape {
  const r = mulberry32(seed)
  // a fractal rim: every octave keeps a fair share, so the edge reads as ink, not as a wobbly circle
  const harmonics = FREQS.map((k) => [k, (0.6 + r() * 0.8) / Math.pow(k, 0.55), r() * TAU, (r() - 0.5) * 9])
  let sum = 0
  for (const h of harmonics) sum += h[1]
  for (const h of harmonics) h[1] *= ROUGH / sum
  const tendrils: number[][] = []
  // many hairline fingers and a few long runs
  for (let i = 0; i < 70; i++) tendrils.push([r() * TAU, 0.005 + r() * 0.018, 0.015 + Math.pow(r(), 1.6) * 0.14, r() * 0.7])
  for (let i = 0; i < 9; i++) tendrils.push([r() * TAU, 0.014 + r() * 0.03, 0.12 + r() * 0.22, r() * 0.45])
  const drops: number[][] = []
  for (let i = 0; i < 130; i++) drops.push([r() * TAU, 0.05 + r() * 1.0, 0.0012 + Math.pow(r(), 2.6) * 0.009, 1 + r() * 2.2])
  return { harmonics, tendrils, drops, dip: ROUGH }
}

function wrap(a: number) {
  a = a % TAU
  return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a
}

/** Rim radius at angle `a` for a blot of nominal radius R at progress p. */
export function rimAt(ink: InkShape, a: number, R: number, p: number) {
  let n = 0
  for (const h of ink.harmonics) n += h[1] * Math.sin(h[0] * a + h[2] + h[3] * p)
  let spike = 0
  for (const t of ink.tendrils) {
    const grow = Math.min(1, Math.max(0, (p - t[3]) / 0.3))
    if (grow <= 0) continue
    const d = wrap(a - t[0]) / t[1]
    if (d > 3 || d < -3) continue
    spike += t[2] * grow * Math.exp(-d * d)
  }
  return R * (1 + n + spike)
}

/** The radius that guarantees every corner of a w x h box is inked from (ox, oy). */
export function coverRadius(ink: InkShape, ox: number, oy: number, w: number, h: number) {
  const far = Math.max(Math.hypot(ox, oy), Math.hypot(w - ox, oy), Math.hypot(ox, h - oy), Math.hypot(w - ox, h - oy))
  return (far / (1 - ink.dip)) * 1.02
}

export function easeSpill(p: number) {
  const out = 1 - Math.pow(1 - p, 3)
  const smooth = p * p * (3 - 2 * p)
  return out * 0.55 + smooth * 0.45
}

/** An SVG/CSS path for the blot plus its droplets, all wound clockwise. */
export function inkPath(ink: InkShape, ox: number, oy: number, Rend: number, p: number, steps = 320) {
  const R = Rend * easeSpill(p)
  if (R <= 0.5) return ""
  // Build into an array instead of growing a string 320× per frame (less GC + less jank).
  const parts: string[] = []
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU
    const r = rimAt(ink, a, R, p)
    parts.push((i ? "L" : "M") + (ox + r * Math.cos(a)).toFixed(1) + " " + (oy + r * Math.sin(a)).toFixed(1))
  }
  parts.push("Z")
  // droplets land just ahead of the front, stretched along the direction of travel
  for (const k of ink.drops) {
    const dist = k[1] * Rend
    const born = (R - dist * 0.8) / (dist * 0.12)
    if (born <= 0) continue
    const ry = Math.max(0.6, k[2] * Rend * Math.min(1, born))
    const rx = ry * k[3]
    const c = Math.cos(k[0])
    const s = Math.sin(k[0])
    const x = ox + dist * c
    const y = oy + dist * s
    const rot = ((k[0] * 180) / Math.PI).toFixed(1)
    const head = (x + rx * c).toFixed(1) + " " + (y + rx * s).toFixed(1)
    const tail = (x - rx * c).toFixed(1) + " " + (y - rx * s).toFixed(1)
    const radii = rx.toFixed(1) + " " + ry.toFixed(1) + " " + rot
    parts.push("M" + head + "A" + radii + " 1 1 " + tail + "A" + radii + " 1 1 " + head + "Z")
  }
  return parts.join("")
}
// #endregion

export type InkTheme = "light" | "dark"

export type InkSpillContext = {
  theme: InkTheme
  /** Flip the theme. Pass the element the ink should spill from (usually the toggle). */
  toggle: (from?: Element | null) => void
  spilling: boolean
}

export type InkSpillThemeSwitchProps = {
  /** Render your page for the given theme. It is called twice while ink is spilling. */
  children: (ctx: InkSpillContext) => ReactNode
  defaultTheme?: InkTheme
  /** Spill length in ms. */
  duration?: number
  height?: string | number
  onThemeChange?: (theme: InkTheme) => void
  className?: string
  style?: CSSProperties
}

type Spill = { to: InkTheme; x: number; y: number; w: number; h: number; seed: number }

const CSS =
  ".ist-stage{position:relative;overflow:hidden;isolation:isolate;width:100%}" +
  ".ist-layer{position:absolute;inset:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain}" +
  ".ist-layer[data-theme=dark]{color-scheme:dark}" +
  ".ist-layer[data-theme=light]{color-scheme:light}" +
  ".ist-top{z-index:1;pointer-events:none;will-change:clip-path}" +
  "@media (prefers-reduced-motion:reduce){.ist-top{display:none}}"

export default function InkSpillThemeSwitch({
  children,
  defaultTheme = "light",
  duration = 2200,
  height = "100svh",
  onThemeChange,
  className,
  style,
}: InkSpillThemeSwitchProps) {
  const [theme, setTheme] = useState(defaultTheme as InkTheme)
  const [spill, setSpill] = useState(null as Spill | null)
  const stageRef = useRef(null as HTMLDivElement | null)
  const baseRef = useRef(null as HTMLDivElement | null)
  const topRef = useRef(null as HTMLDivElement | null)
  const live = useRef({ theme: defaultTheme as InkTheme, busy: false })
  const changed = useRef(onThemeChange)

  useEffect(() => {
    changed.current = onThemeChange
  }, [onThemeChange])

  const toggle = useCallback((from?: Element | null) => {
    const stage = stageRef.current
    if (!stage || live.current.busy) return
    const next: InkTheme = live.current.theme === "light" ? "dark" : "light"
    const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (still) {
      live.current.theme = next
      setTheme(next)
      changed.current?.(next)
      return
    }
    // one measurement per click: where the toggle sits inside the stage
    const s = stage.getBoundingClientRect()
    let x = s.width - 48
    let y = 40
    if (from) {
      const b = from.getBoundingClientRect()
      x = b.left + b.width / 2 - s.left
      y = b.top + b.height / 2 - s.top
    }
    live.current.busy = true
    // The top layer re-mounts the page tree, so its effect-driven fetches would
    // re-fire every request. Serve those from the api cache during the spill.
    setApiQuiet(true)
    setSpill({ to: next, x, y, w: s.width, h: s.height, seed: (Math.random() * 2 ** 31) | 0 })
  }, [])

  useEffect(() => {
    if (!spill) return
    // Re-assert here too: StrictMode re-runs effects (and the cleanup above
    // clears the flag) before the replica's own effects settle.
    setApiQuiet(true)
    const ink = makeInk(spill.seed)
    const Rend = coverRadius(ink, spill.x, spill.y, spill.w, spill.h)
    const start = performance.now()
    let raf = 0
    let done = false
    const finish = () => {
      if (done) return
      done = true
      cancelAnimationFrame(raf)
      setApiQuiet(false)
      live.current.theme = spill.to
      live.current.busy = false
      setTheme(spill.to)
      setSpill(null)
      changed.current?.(spill.to)
    }
    const frame = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const d = inkPath(ink, spill.x, spill.y, Rend, p)
      const top = topRef.current
      const base = baseRef.current
      if (top) {
        if (base && top.scrollTop !== base.scrollTop) top.scrollTop = base.scrollTop
        top.style.clipPath = d ? 'path("' + d + '")' : "circle(0px)"
      }
      if (p < 1) {
        raf = requestAnimationFrame(frame)
        return
      }
      finish()
    }
    raf = requestAnimationFrame(frame)
    // Safety net: if rAF stalls (background tab), never leave the app stuck
    // with the replica mounted or api traffic suppressed.
    const safety = window.setTimeout(finish, duration + 800)
    return () => {
      done = true
      cancelAnimationFrame(raf)
      clearTimeout(safety)
      setApiQuiet(false)
    }
  }, [spill, duration])

  const noop = useCallback(() => {}, [])

  return (
    <div
      ref={stageRef}
      className={"ist-stage" + (className ? " " + className : "")}
      data-theme={theme}
      style={{ height, ...style }}
    >
      <style>{CSS}</style>
      <div ref={baseRef} className="ist-layer" data-theme={theme}>
        {children({ theme, toggle, spilling: !!spill })}
      </div>
      {spill && (
        <div
          ref={topRef}
          className="ist-layer ist-top"
          data-theme={spill.to}
          aria-hidden="true"
          inert
          style={{ clipPath: "circle(0px at " + spill.x + "px " + spill.y + "px)" }}
        >
          {children({ theme: spill.to, toggle: noop, spilling: true })}
        </div>
      )}
    </div>
  )
}

/** A small sun/moon button that spills the ink from itself. */
export function InkThemeToggle({
  theme,
  toggle,
  className,
  style,
}: {
  theme: InkTheme
  toggle: (from?: Element | null) => void
  className?: string
  style?: CSSProperties
}) {
  const dark = theme === "dark"
  return (
    <button
      type="button"
      onClick={(e) => toggle(e.currentTarget)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      className={
        "inline-flex size-9 items-center justify-center rounded-full border border-current/20 transition-transform hover:scale-105 active:scale-95 motion-reduce:transition-none " +
        (className ?? "")
      }
      style={style}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
          </>
        ) : (
          <path d="M20 14.6A8.4 8.4 0 0 1 9.4 4a8.4 8.4 0 1 0 10.6 10.6Z" />
        )}
      </svg>
    </button>
  )
}
