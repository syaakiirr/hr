import { lazy, Suspense, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, RotateCcw, Pause, Play, Check, X } from "lucide-react";
import { DEFAULT_LOGOS, DEFAULT_SETTINGS, STORAGE_KEY, readComposition } from "../components/logo-sphere/model";
import type { SphereSettings, SphereLogo } from "../components/logo-sphere/model";
import "../components/logo-sphere/logo-sphere.css";
const LogoSphere = lazy(() => import("../components/logo-sphere/LogoSphere"));

async function readLogo(file: File): Promise<SphereLogo> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error(`${file.name}: use PNG, JPG or WebP.`);
  if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name}: maximum file size is 5 MB.`);
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 256 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { name: file.name.replace(/\.[^.]+$/, ""), src: canvas.toDataURL("image/png") };
  } finally { image.close(); }
}

export default function LogoSphereStudio() {
  const [initial] = useState(readComposition);
  const [logos, setLogos] = useState(initial.logos);
  const [settings, setSettings] = useState(initial.settings);
  const [resetKey, setResetKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const update = <K extends keyof SphereSettings>(key: K, value: SphereSettings[K]) => { setSettings(s => ({ ...s, [key]: value })); setSaved(false); };
  const upload = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    setBusy(true); setNotice(""); setSaved(false);
    const available = 16 - logos.length;
    const chosen = Array.from(files).slice(0, available);
    const results = await Promise.allSettled(chosen.map(readLogo));
    const accepted = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
    const errors = results.flatMap(result => result.status === "rejected" ? [String(result.reason.message || "An image could not be read.")] : []);
    if (files.length > available) errors.push("Up to 16 source logos are supported. Remove a logo to make room.");
    setLogos(previous => [...previous, ...accepted]);
    setNotice(errors.join(" ") || `${accepted.length} logo${accepted.length === 1 ? "" : "s"} added.`);
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
  };
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ logos, settings })); setSaved(true); setNotice("Saved for the landing page in this browser. Other visitors are not affected."); }
    catch { setNotice("Browser storage is unavailable or full. Your current preview is still available; remove some logos and try again."); }
  };
  const slider = (key: "count" | "size" | "depth" | "perspective" | "speed" | "tilt", label: string, min: number, max: number, step: number, value: string) => <label className="sphere-control" key={key} htmlFor={`sphere-${key}`}>
    <span>{label}<output>{value}</output></span><input id={`sphere-${key}`} type="range" min={min} max={max} step={step} value={settings[key]} onChange={e => update(key, Number(e.target.value))} />
  </label>;

  return <main className="sphere-studio">
    <header className="sphere-studio__header">
      <Link to="/" className="sphere-studio__brand"><img src="/logo.png" alt="" />SociHR <span>/ Logo Sphere Studio</span></Link>
      <Link to="/" className="sphere-studio__back"><ArrowLeft size={15} /> Landing page</Link>
    </header>
    <div className="sphere-studio__workspace">
      <section className="sphere-studio__preview" aria-label="Sphere preview">
        <div className="sphere-studio__intro"><h1>The stack behind<br />your workspace.</h1><p>Explore the technology that powers SociHR.<br />Shape your animated capabilities sphere.</p></div>
        <Suspense fallback={<div className="logo-sphere-stage logo-sphere-loading">Loading studio…</div>}><LogoSphere logos={logos} settings={settings} resetKey={resetKey} /></Suspense>
        <div className="sphere-studio__toolbar">
          <span>Drag to rotate · Arrow keys to explore</span>
          <button type="button" onClick={() => update("autoRotate", !settings.autoRotate)} aria-label={settings.autoRotate ? "Pause rotation" : "Play rotation"}>{settings.autoRotate ? <Pause size={16} /> : <Play size={16} />}</button>
          <button type="button" onClick={() => setResetKey(v => v + 1)} aria-label="Reset viewing angle"><RotateCcw size={16} /></button>
        </div>
        <p className="sphere-studio__note">Interactive visual demo · Your images stay in this browser</p>
      </section>
      <section className="sphere-studio__controls" aria-label="Sphere controls">
        <div className="sphere-studio__control-title"><h2>Make it yours</h2><button type="button" onClick={() => { setSettings({ ...DEFAULT_SETTINGS }); setLogos(DEFAULT_LOGOS); setResetKey(v => v + 1); setSaved(false); setNotice("Default composition restored. Save to apply it to your landing page preview."); }}>Reset all</button></div>
        <section className="sphere-control-section">
          <h3>Logos <span>{logos.length}/16</span></h3>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={e => void upload(e.target.files)} />
          <button className="sphere-upload" type="button" disabled={busy || logos.length >= 16} onClick={() => fileInput.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files); }}><Upload size={20} /><strong>{busy ? "Preparing images…" : "Upload your logos"}</strong><span>Drop files or browse · PNG, JPG, WebP · 5 MB each</span></button>
          <div className="sphere-logo-list">{logos.map((logo, index) => <div key={`${index}-${logo.name}`} title={logo.name}><img src={logo.src} alt={logo.name} /><button type="button" disabled={logos.length === 1 || busy} aria-label={`Remove ${logo.name}`} onClick={() => { setLogos(list => list.filter((_, i) => i !== index)); setSaved(false); }}><X size={12} /></button></div>)}</div>
          <p className="sphere-control-help">Logos repeat across the sphere. Transparent images work best.</p>
        </section>
        <section className="sphere-control-section"><h3>Composition</h3>
          <label className="sphere-control"><span>Arrangement</span><select value={settings.layout} onChange={e => update("layout", e.target.value as SphereSettings["layout"])}><option value="spiral">Even spiral</option><option value="rings">Latitude rings</option></select></label>
          {slider("count", "Logo count", 8, 100, 1, String(settings.count))}
          {slider("size", "Logo size", .16, .65, .01, `${Math.round(settings.size * 100)}%`)}
          {slider("depth", "Surface lift", .005, .22, .005, settings.depth.toFixed(3))}
          {settings.size * settings.size * settings.count > 24 && <p className="sphere-control-help">This combination may overlap logos. Reduce size or count for more space.</p>}
        </section>
        <section className="sphere-control-section"><h3>View & surface</h3>
          {slider("perspective", "Field of view", 25, 65, 1, `${settings.perspective}°`)}
          {slider("tilt", "Axis tilt", -45, 45, 1, `${settings.tilt}°`)}
          <label className="sphere-color-control">Sphere colour<input type="color" value={settings.surface} onChange={e => update("surface", e.target.value)} /></label>
          <label className="sphere-toggle"><span>Show sphere surface</span><input type="checkbox" checked={settings.showSurface} onChange={e => update("showSurface", e.target.checked)} /></label>
          <label className="sphere-toggle"><span>Wireframe surface</span><input type="checkbox" checked={settings.wireframe} onChange={e => update("wireframe", e.target.checked)} /></label>
        </section>
        <section className="sphere-control-section"><h3>Movement</h3>
          <label className="sphere-toggle"><span>Automatic rotation</span><input type="checkbox" checked={settings.autoRotate} onChange={e => update("autoRotate", e.target.checked)} /></label>
          {slider("speed", "Rotation speed", .02, .6, .01, `${settings.speed.toFixed(2)} rad/s`)}
          <label className="sphere-control"><span>Direction</span><select value={settings.direction} onChange={e => update("direction", Number(e.target.value))}><option value={1}>Left to right</option><option value={-1}>Right to left</option></select></label>
          <p className="sphere-control-help">Automatic motion respects your device’s reduced-motion setting.</p>
        </section>
        <div className="sphere-studio__save"><button type="button" onClick={save} disabled={busy}>{saved ? <Check size={16} /> : null}{saved ? "Saved to this browser" : "Use on my landing page"}</button><p role="status" aria-live="polite">{notice || "Saves this composition for your local landing page preview."}</p></div>
      </section>
    </div>
  </main>;
}
