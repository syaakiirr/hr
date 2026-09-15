---
timestamp: 2026-09-10T07-47-18Z
slug: socihr-frontend-src-pages-landingpage-tsx
---
# Kage-style rebuild — LandingPage + World.tsx (2026-09-10)

Method: dual-agent (A: concept validation · B: detector + live browser, 5 chapters).

## Concept (VALIDATED)
Scrollytelling malam sinematik: kamera WebGL terbang melalui district 5 bar data sebenar (77.8/76/73.4/69.9/69.5, semantik hijau/amber, paksi 50–100 dilabel), kabus, grid, bulan, bara partikel, bintang. Tipografi editorial + nav titik + pause motion. Bukan hiasan — data sebagai geometri.

## Implemented
- landing3d/World.tsx: DataDistrict, Motes (170), Stars (220), moon + halo, indigo/emerald lights, grid, fog, 5-waypoint CameraRig (skrol + parallax ±, tiada auto-orbit), reduced-motion freeze, <640px null, dpr ≤1.5.
- LandingPage.tsx: 5 bab (view/monitor/track/report/govern), salinan jujur (angka sebenar dilabel sampel), legenda kadar dalam bab 3, nav titik + Pause motion + vignette + skrim teks, mobile gelap tanpa canvas.
- P esteem: corner-peek decorative solids dibuang; bar group + lookAt dilaras supaya teks tidak bertindan (3 lelaran).

## Verify
tsc bersih; 0 console errors; 5/5 bab screenshot (ch1 bersih, track/track-legend, report pullback, govern fit); mobile tiada overflow; CTA → /login.
