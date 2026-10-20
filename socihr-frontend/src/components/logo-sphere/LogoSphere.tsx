import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SphereLogo, SphereSettings } from "./model";
import "./logo-sphere.css";

interface Props { logos: SphereLogo[]; settings: SphereSettings; resetKey?: number }

// Subdivide each image and project every vertex onto the sphere, keeping the UVs intact.
export function curvedLogoGeometry(size: number, radius: number) {
  const geometry = new THREE.PlaneGeometry(size, size, 14, 14);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) / 1.5;
    const y = positions.getY(i) / 1.5;
    positions.setXYZ(i, Math.sin(x) * Math.cos(y) * radius, Math.sin(y) * radius, Math.cos(x) * Math.cos(y) * radius);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export default function LogoSphere({ logos, settings, resetKey = 0 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef(settings);
  live.current = settings;
  const engine = useRef<{ group: THREE.Group; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; render: () => void } | null>(null);
  const [ready, setReady] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
    catch { setError("This browser cannot display 3D. Try a browser with WebGL enabled."); setLoading(false); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 50);
    camera.position.set(0, 0, 6.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.dampingFactor = .08;
    controls.rotateSpeed = .65;
    const group = new THREE.Group();
    scene.add(group, new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(-3, 5, 6);
    scene.add(light);
    const render = () => renderer.render(scene, camera);
    engine.current = { group, scene, camera, controls, render };
    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    });
    resize.observe(container);
    let visible = true;
    let dragging = false;
    let frame = 0;
    let last = performance.now();
    let motionTime = 0;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, .05);
      last = now;
      if (visible && !document.hidden) {
        if (live.current.autoRotate && !reduce.matches && !dragging) {
          motionTime += delta;
          group.rotation.y += delta * live.current.speed * live.current.direction;
          group.children.forEach(child => {
            if (typeof child.userData.floatPhase === "number") child.scale.setScalar(1 + Math.sin(motionTime * .8 + child.userData.floatPhase) * .012);
          });
        }
        controls.update();
        render();
      }
      frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(container);
    controls.addEventListener("start", () => { dragging = true; });
    controls.addEventListener("end", () => { dragging = false; });
    const key = (event: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      group.rotation.y += event.key === "ArrowLeft" ? -.15 : event.key === "ArrowRight" ? .15 : 0;
      group.rotation.x += event.key === "ArrowUp" ? -.15 : event.key === "ArrowDown" ? .15 : 0;
      render();
    };
    container.addEventListener("keydown", key);
    const lost = (event: Event) => { event.preventDefault(); setError("3D rendering was interrupted. Reload this page to restore the sphere."); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    frame = requestAnimationFrame(tick);
    setReady(v => v + 1);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect(); controls.dispose();
      container.removeEventListener("keydown", key);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.dispose(); renderer.domElement.remove(); engine.current = null;
    };
  }, []);

  useEffect(() => {
    const current = engine.current;
    if (!current) return;
    let cancelled = false;
    const meshes: THREE.Mesh[] = [];
    const textures: THREE.Texture[] = [];
    setLoading(true); setError("");
    const surface = new THREE.Mesh(new THREE.SphereGeometry(1.5, 64, 48), new THREE.MeshBasicMaterial({ color: settings.surface, colorWrite: settings.showSurface || settings.wireframe, wireframe: settings.wireframe }));
    meshes.push(surface); current.group.add(surface);
    const loader = new THREE.TextureLoader();
    Promise.all(logos.map(async logo => {
      const source = await loader.loadAsync(logo.src);
      if (cancelled) { source.dispose(); return null; }
      const img = source.image as HTMLImageElement;
      const makeTexture = (tile: boolean) => {
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
        const ctx = canvas.getContext("2d")!;
        if (tile) {
          ctx.shadowColor = "rgba(30, 32, 35, .28)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 15; ctx.shadowOffsetX = 3;
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(24, 18, 208, 208, 30); ctx.fill();
          ctx.shadowColor = "transparent";
        }
        const scale = (tile ? 116 : 208) / Math.max(img.width, img.height);
        ctx.drawImage(img, (256 - img.width * scale) / 2, (244 - img.height * scale) / 2, img.width * scale, img.height * scale);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        textures.push(texture); return texture;
      };
      const pair = { tile: makeTexture(true), bare: makeTexture(false) };
      source.dispose();
      return pair;
    })).then(loaded => {
      if (cancelled) return;
      const maps = loaded.filter((t): t is { tile: THREE.CanvasTexture; bare: THREE.CanvasTexture } => !!t);
      if (!maps.length) { setLoading(false); return; }
      const rows = Math.max(3, Math.round(Math.sqrt(settings.count / 2)));
      for (let i = 0; i < settings.count; i++) {
        let y: number, angle: number;
        if (settings.layout === "rings") {
          const row = i % rows;
          const slots = Math.ceil((settings.count - row) / rows);
          y = 1 - 2 * (row + .5) / rows;
          angle = Math.floor(i / rows) * Math.PI * 2 / slots + row * .3;
        } else { y = 1 - 2 * (i + .5) / settings.count; angle = i * Math.PI * (3 - Math.sqrt(5)); }
        const normal = new THREE.Vector3(Math.sqrt(1 - y * y) * Math.cos(angle), y, Math.sqrt(1 - y * y) * Math.sin(angle));
        const tile = i % 3 === 0;
        const mesh = new THREE.Mesh(curvedLogoGeometry(settings.size * (tile ? 1.28 : .55), 1.5 + settings.depth), new THREE.MeshBasicMaterial({ map: maps[i % maps.length][tile ? "tile" : "bare"], transparent: true, alphaTest: .005, side: THREE.FrontSide, depthWrite: false }));
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        mesh.userData.floatPhase = i * 1.7;
        const worldNormal = new THREE.Vector3();
        const viewDirection = new THREE.Vector3();
        mesh.onBeforeRender = () => {
          worldNormal.copy(normal).transformDirection(current.group.matrixWorld);
          viewDirection.copy(current.camera.position).normalize();
          const facing = worldNormal.dot(viewDirection);
          mesh.material.opacity = THREE.MathUtils.smoothstep(facing, .02, .65) * (tile ? 1 : .85);
        };
        current.group.add(mesh); meshes.push(mesh);
      }
      setLoading(false); current.render();
    }).catch(() => { if (!cancelled) { setError("A logo could not be loaded. Remove it or upload a PNG, JPG or WebP image."); setLoading(false); } });
    return () => {
      cancelled = true;
      meshes.forEach(mesh => { current.group.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); });
      textures.forEach(texture => texture.dispose());
    };
  }, [ready, logos, settings.count, settings.size, settings.depth, settings.layout, settings.surface, settings.wireframe, settings.showSurface]);

  useEffect(() => {
    const current = engine.current;
    if (!current) return;
    current.camera.fov = settings.perspective;
    current.camera.position.setLength(2.15 / Math.tan(THREE.MathUtils.degToRad(settings.perspective / 2)));
    current.camera.updateProjectionMatrix();
    current.group.rotation.z = THREE.MathUtils.degToRad(settings.tilt);
  }, [ready, settings.perspective, settings.tilt]);
  useEffect(() => { engine.current?.controls.reset(); if (engine.current) { engine.current.group.rotation.x = 0; engine.current.group.rotation.y = 0; } }, [resetKey]);

  return <div className="logo-sphere-stage">
    <div ref={host} className="logo-sphere-canvas" tabIndex={0} role="group" aria-label="Interactive logo sphere. Drag or use arrow keys to rotate." />
    {loading && !error && <span className="logo-sphere-status" role="status">Preparing logos…</span>}
    {error && <div className="logo-sphere-error" role="alert">{error}</div>}
  </div>;
}
