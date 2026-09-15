// Per-company brand assets. Logos live in `public/logos/` (transparent PNG, HD).
// Companies without a logo file (e.g. Skytrack Billboard) resolve to null
// and render as a neutral monogram via <CompanyLogo/> — never a broken icon.
//
// HOW TO ADD A LOGO for a new company:
//   1. Drop a transparent-background PNG into `socihr-frontend/public/logos/`
//      (short kebab-case name, ~1200-1600px wide is plenty for ≤54px tiles).
//   2. Add one entry to BRANDS below with lowercase match aliases.
//   3. Wide banners (like rimba) should use fit: "cover"; standard marks "contain".

export interface CompanyBrand {
  /** Public path to the logo, or null when no file exists (monogram fallback). */
  logo: string | null;
  /** "contain" for standard marks, "cover" for wide banners cropped to center. */
  fit: "contain" | "cover";
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Longest keys first — "rimba razia" must win before a bare "razia" check.
const BRANDS: { match: string[]; logo: string | null; fit: CompanyBrand["fit"] }[] = [
  {
    match: ["rimba razia", "rimba", "terengganu petting zoo"],
    logo: "/logos/rimba-razia.png",
    fit: "cover",
  },
  {
    match: ["razia village"],
    logo: "/logos/razia-village.png",
    fit: "contain",
  },
  {
    match: ["committed firearms", "commited firearms", "firearms"],
    logo: "/logos/committed-firearms.png",
    fit: "contain",
  },
  {
    match: ["sweet pinky beauty house", "sweet pinky", "pinky"],
    logo: "/logos/sweet-pinky.png",
    fit: "contain",
  },
  {
    match: ["skytrack billboard", "skytrack"],
    logo: null,
    fit: "contain",
  },
];

export function getCompanyBrand(companyName: string): CompanyBrand {
  const n = ` ${normalize(companyName)} `;
  for (const b of BRANDS) {
    if (b.match.some((k) => n.includes(` ${k} `) || n.includes(k))) {
      return { logo: b.logo, fit: b.fit };
    }
  }
  return { logo: null, fit: "contain" };
}

export function companyInitials(companyName: string): string {
  const words = companyName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
