import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pause, Play, SlidersHorizontal } from "lucide-react";
import { readComposition } from "./model";
import "./logo-sphere.css";
const LogoSphere = lazy(() => import("./LogoSphere"));

export default function LandingLogoSphere() {
  const [composition, setComposition] = useState(readComposition);
  const [paused, setPaused] = useState(() => !composition.settings.autoRotate);
  useEffect(() => {
    const update = () => { const saved = readComposition(); setComposition(saved); setPaused(!saved.settings.autoRotate); };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);
  return <div className="landing-logo-sphere">
    <Suspense fallback={<div className="logo-sphere-stage logo-sphere-loading">Loading logo sphere…</div>}>
      <LogoSphere logos={composition.logos} settings={{ ...composition.settings, autoRotate: !paused }} />
    </Suspense>
    <div className="landing-logo-sphere__caption"><span /> The tools behind the workspace.</div>
    <div className="landing-logo-sphere__actions">
      <span>Drag to explore</span>
      <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Resume sphere rotation" : "Pause sphere rotation"}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
      <Link to="/logo-sphere"><SlidersHorizontal size={14} /> Customise sphere</Link>
    </div>
  </div>;
}
