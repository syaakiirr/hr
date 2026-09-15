import { getCompanyBrand, companyInitials } from "../utils/companyLogos";

interface Props {
  name: string;
  size?: number;
  radius?: number;
  /** Ranking position — rendered as a corner badge so the row keeps one left anchor. */
  rank?: number;
}

// Shape rule for this surface: cards 16px · logo tiles 12px · buttons pill-sm.
// Tile is fixed-size so portrait (firearms), landscape (razia, pinky) and the
// rimba banner (center-cropped via cover) share one rhythm. Monogram is
// deliberately neutral slate — brand hues stay out of a surface where
// green/amber/red carry compliance meaning. No animation (MOTION 3).
export default function CompanyLogo({ name, size = 46, radius = 12, rank }: Props) {
  const brand = getCompanyBrand(name);

  const tile: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    background: "#fff",
    border: "1px solid var(--line, #e2e8f0)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
    position: "relative",
  };

  const badge =
    rank === undefined ? null : (
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -7,
          left: -7,
          minWidth: 22,
          height: 22,
          padding: "0 5px",
          borderRadius: 999,
          background: "var(--text-1, #0f172a)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontVariantNumeric: "tabular-nums",
          boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        }}
      >
        {rank}
      </span>
    );

  if (!brand.logo) {
    return (
      <div role="img" aria-label={`${name} logo`} style={tile}>
        <span
          aria-hidden="true"
          style={{
            color: "var(--text-2, #475569)",
            background: "var(--surface, #f1f5f9)",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: Math.round(size * 0.36),
            letterSpacing: "-0.02em",
          }}
        >
          {companyInitials(name)}
        </span>
        {badge}
      </div>
    );
  }

  return (
    <div role="img" aria-label={`${name} logo`} style={{ ...tile, padding: 4 }}>
      <img
        src={brand.logo}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: brand.fit, objectPosition: "center", display: "block" }}
        onError={(e) => {
          // File missing (e.g. stale deploy) — swap to the same neutral
          // monogram the no-logo path renders, never a broken icon.
          const el = e.currentTarget;
          el.style.display = "none";
          const parent = el.parentElement;
          if (parent) {
            parent.style.padding = "0";
            const span = document.createElement("span");
            span.setAttribute("aria-hidden", "true");
            span.style.cssText = `color:var(--text-2,#475569);background:var(--surface,#f1f5f9);width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${Math.round(size * 0.36)}px;letter-spacing:-0.02em;`;
            span.textContent = companyInitials(name);
            parent.appendChild(span);
          }
        }}
      />
      {badge}
    </div>
  );
}
