export interface SphereLogo { name: string; src: string }
export interface SphereSettings {
  count: number; size: number; depth: number; perspective: number; speed: number;
  tilt: number; direction: number; layout: "spiral" | "rings"; surface: string;
  wireframe: boolean; autoRotate: boolean; showSurface: boolean;
}
export interface SphereComposition { logos: SphereLogo[]; settings: SphereSettings }
export const DEFAULT_LOGOS: SphereLogo[] = [
  { name: "SociHR", src: "/logo.png" },
  ...[
    ["Render", "render"], ["Supabase", "supabase"], ["GitHub", "github"],
    ["React", "react"], ["ASP.NET Core", "dotnet"], ["TypeScript", "typescript"],
    ["Vite", "vite"], ["PostgreSQL", "postgresql"], ["Docker", "docker"], ["Tailwind CSS", "tailwindcss"],
  ].map(([name, slug]) => ({ name, src: `/logos/stack/${slug}.svg` })),
];
export const DEFAULT_SETTINGS: SphereSettings = { count: 54, size: .58, depth: .035, perspective: 38, speed: .12, tilt: -12, direction: 1, layout: "spiral", surface: "#ffffff", wireframe: false, autoRotate: true, showSurface: false };
export const STORAGE_KEY = "socihr.stack-sphere.v2";
export function readComposition(): SphereComposition {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.logos) && saved.logos.length > 0 && saved.logos.length <= 16) {
      const logos = saved.logos.filter((l: SphereLogo) => typeof l.name === "string" && typeof l.src === "string" && (l.src.startsWith("data:image/") || DEFAULT_LOGOS.some(d => d.src === l.src)));
      if (logos.length) {
        const s = saved.settings || {};
        const number = (key: keyof SphereSettings, min: number, max: number) => typeof s[key] === "number" && Number.isFinite(s[key]) ? Math.min(max, Math.max(min, s[key])) : DEFAULT_SETTINGS[key] as number;
        return { logos, settings: { ...DEFAULT_SETTINGS, count: Math.round(number("count", 8, 100)), size: number("size", .16, .65), depth: number("depth", .005, .22), perspective: number("perspective", 25, 65), speed: number("speed", .02, .6), tilt: number("tilt", -45, 45), direction: s.direction === -1 ? -1 : 1, layout: s.layout === "rings" ? "rings" : "spiral", surface: /^#[\da-f]{6}$/i.test(s.surface) ? s.surface : DEFAULT_SETTINGS.surface, wireframe: s.wireframe === true, autoRotate: s.autoRotate !== false, showSurface: s.showSurface === true } };
      }
    }
  } catch { /* A blocked or corrupt browser store falls back to the shipped composition. */ }
  return { logos: DEFAULT_LOGOS, settings: { ...DEFAULT_SETTINGS } };
}
