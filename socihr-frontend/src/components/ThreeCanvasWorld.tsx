import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeCanvasWorldProps {
  onFpsUpdate?: (fps: number) => void;
}

export default function ThreeCanvasWorld({ onFpsUpdate }: ThreeCanvasWorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stateRef = useRef({
    scrollProgress: 0,
    mouseX: 0,
    mouseY: 0,
    targetMouseX: 0,
    targetMouseY: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Scene
    const scene = new THREE.Scene();
    // Very light fog — preserves light-mode feel, adds depth
    scene.fog = new THREE.FogExp2(0xf8fafc, 0.018);

    // Camera positioned to frame the right side at desktop
    const camera = new THREE.PerspectiveCamera(
      38,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(2.2, 0.4, 8.5);
    camera.lookAt(1.8, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // --- LIGHTING ---
    // Sky fill — cool, airy
    scene.add(new THREE.AmbientLight(0xdde4f2, 1.4));

    // Primary key — warm overhead, sharp highlights on the crystal
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(4, 10, 8);
    scene.add(sun);

    // Cool fill — from lower-left, fills shadows with blue-violet tint
    const fill = new THREE.DirectionalLight(0xc7d2fe, 1.0);
    fill.position.set(-8, -4, -5);
    scene.add(fill);

    // Animated cursor light — tracks mouse, creates life
    const cursorLight = new THREE.PointLight(0x818cf8, 3.5, 18);
    cursorLight.position.set(2, 2, 5);
    scene.add(cursorLight);

    // Secondary warm accent light from behind — rim glow
    const rimLight = new THREE.PointLight(0xa5b4fc, 2.0, 12);
    rimLight.position.set(-2, 0, -3);
    scene.add(rimLight);

    // --- MAIN CRYSTAL SHOWPIECE ---
    // Positioned at x=1.8 — fills the right half of the hero
    const showpiece = new THREE.Group();
    showpiece.position.set(1.8, 0, 0);
    scene.add(showpiece);

    // Primary large crystal — Octahedron for geometric authority
    const coreGeo = new THREE.OctahedronGeometry(1.8, 2);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0.31, 0.29, 0.9),   // indigo-500
      emissive: new THREE.Color(0.2, 0.15, 0.6),
      emissiveIntensity: 0.15,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transmission: 0.55,
      thickness: 2.0,
      ior: 1.62,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    showpiece.add(coreMesh);

    // Outer angular cage shell — gives lattice depth
    const cageGeo = new THREE.IcosahedronGeometry(2.05, 0);
    const cageMat = new THREE.MeshBasicMaterial({
      color: 0xa5b4fc,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    });
    showpiece.add(new THREE.Mesh(cageGeo, cageMat));

    // Inner pulsing nucleus — glowing core
    const nucleusGeo = new THREE.SphereGeometry(0.65, 32, 32);
    const nucleusMat = new THREE.MeshStandardMaterial({
      color: 0xdde4ff,
      emissive: 0x6366f1,
      emissiveIntensity: 0.8,
      roughness: 0.1,
    });
    const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
    showpiece.add(nucleus);

    // --- THREE PRECISION ORBITAL RINGS ---
    function makeRing(radius: number, tube: number, color: number, rx: number, rz: number) {
      const g = new THREE.Group();
      g.rotation.x = rx;
      g.rotation.z = rz;
      const geo = new THREE.TorusGeometry(radius, tube, 16, 128);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.3,
        metalness: 0.9,
        roughness: 0.1,
      });
      g.add(new THREE.Mesh(geo, mat));
      return g;
    }

    const ring1 = makeRing(2.6, 0.018, 0x6366f1, Math.PI / 3.5, 0.22);
    const ring2 = makeRing(3.1, 0.015, 0x818cf8, -Math.PI / 4.2, -0.28);
    const ring3 = makeRing(3.65, 0.012, 0xa5b4fc, Math.PI / 2.1, 0.48);
    showpiece.add(ring1, ring2, ring3);

    // --- 4 ORBITING DATA NODES ---
    interface Node { group: THREE.Group; radius: number; speed: number; angle: number; lift: number }
    const nodes: Node[] = [];

    const nodeColors = [0xe1306c, 0x00c8ff, 0x10b981, 0xf59e0b];
    nodeColors.forEach((color, i) => {
      const g = new THREE.Group();
      const baseRadius = 2.5 + i * 0.55;

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 16, 16),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.2 })
      );
      g.add(sphere);

      // Halo disc
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.009, 12, 36),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 })
      );
      halo.rotation.x = Math.PI / 2;
      g.add(halo);

      showpiece.add(g);
      nodes.push({
        group: g,
        radius: baseRadius,
        speed: (i % 2 === 0 ? 0.38 : -0.32) + i * 0.03,
        angle: (i / 4) * Math.PI * 2,
        lift: (i % 2 === 0 ? 0.28 : -0.28),
      });
    });

    // --- GROUND LATTICE PLANE ---
    // Subtle grid that becomes visible as user scrolls, grounds the scene
    const gridSize = 20;
    const step = 0.9;
    const half = (gridSize * step) / 2;
    const gridPts: number[] = [];

    for (let i = 0; i <= gridSize; i++) {
      const c = -half + i * step;
      gridPts.push(-half, -2.8, c, half, -2.8, c);
      gridPts.push(c, -2.8, -half, c, -2.8, half);
    }

    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridPts, 3));
    const gridMesh = new THREE.LineSegments(
      gridGeo,
      new THREE.LineBasicMaterial({ color: 0xc7d2fe, transparent: true, opacity: 0.0 })
    );
    scene.add(gridMesh);

    // --- STARDUST FIELD ---
    const starCount = 200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 18;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      starPos[i * 3 + 2] = -2 + (Math.random() - 0.5) * 6;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0x818cf8, size: 0.06, transparent: true, opacity: 0.55, sizeAttenuation: true })
    );
    scene.add(stars);

    // --- EVENT LISTENERS ---
    const onScroll = () => {
      const sy = window.scrollY || window.pageYOffset;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      stateRef.current.scrollProgress = Math.min(1, Math.max(0, sy / max));
    };

    const onMouse = (e: MouseEvent) => {
      stateRef.current.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      stateRef.current.targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("resize", onResize);
    onScroll();

    // --- ANIMATION LOOP ---
    let raf: number;
    let lastT = performance.now();
    let frames = 0;
    let fpsTimer = 0;
    const lookTarget = new THREE.Vector3(1.8, 0, 0);

    const animate = (t: number) => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.1, (t - lastT) / 1000);
      lastT = t;

      // FPS
      frames++;
      fpsTimer += dt;
      if (fpsTimer >= 0.5) {
        if (onFpsUpdate) onFpsUpdate(Math.round(frames / fpsTimer));
        frames = 0;
        fpsTimer = 0;
      }

      // Smooth mouse
      stateRef.current.mouseX += (stateRef.current.targetMouseX - stateRef.current.mouseX) * 0.055;
      stateRef.current.mouseY += (stateRef.current.targetMouseY - stateRef.current.mouseY) * 0.055;

      // Cursor light tracks mouse elegantly
      cursorLight.position.x = 2 + stateRef.current.mouseX * 5;
      cursorLight.position.y = stateRef.current.mouseY * 4;

      const p = stateRef.current.scrollProgress;
      const mx = stateRef.current.mouseX;
      const my = stateRef.current.mouseY;

      // Core crystal idle rotation + mouse tilt (subtle parallax)
      coreMesh.rotation.y = t * 0.00032 + mx * 0.18;
      coreMesh.rotation.x = Math.sin(t * 0.00018) * 0.1 + my * 0.12;

      // Cage counter-rotates
      showpiece.children[1].rotation.y = -t * 0.00025;
      showpiece.children[1].rotation.z = t * 0.00012;

      // Nucleus breathes
      const pulse = 1.0 + Math.sin(t * 0.003) * 0.06;
      nucleus.scale.setScalar(pulse);

      // Rings sweep
      ring1.rotation.y = t * 0.00042;
      ring2.rotation.y = -t * 0.00035;
      ring3.rotation.z = t * 0.00028;

      // Orbiting nodes
      nodes.forEach((n) => {
        n.angle += n.speed * dt * 0.9;
        n.group.position.x = Math.cos(n.angle) * n.radius;
        n.group.position.z = Math.sin(n.angle) * n.radius;
        n.group.position.y = Math.sin(n.angle * 2) * 0.22 + n.lift;
        n.group.rotation.y += 0.022;
      });

      // Stars slow drift
      stars.rotation.y = t * 0.000025;

      // Grid fade in as user scrolls
      (gridMesh.material as THREE.LineBasicMaterial).opacity = Math.min(0.25, p * 0.5);

      // Scroll-driven camera: gentle pan left-down as user scrolls
      const targetCamX = THREE.MathUtils.lerp(2.2, 0.5, p);
      const targetCamY = THREE.MathUtils.lerp(0.4, -1.0, p);
      const targetCamZ = THREE.MathUtils.lerp(8.5, 7.2, p);

      camera.position.x += (targetCamX + mx * 0.35 - camera.position.x) * 0.05;
      camera.position.y += (targetCamY + my * 0.25 - camera.position.y) * 0.05;
      camera.position.z += (targetCamZ - camera.position.z) * 0.05;

      // Showpiece drifts slightly on scroll
      showpiece.position.y = THREE.MathUtils.lerp(0, -0.6, p);

      lookTarget.set(
        THREE.MathUtils.lerp(1.8, 0.8, p),
        THREE.MathUtils.lerp(0, -0.5, p),
        0
      );
      camera.lookAt(lookTarget);

      renderer.render(scene, camera);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      [coreGeo, cageGeo, nucleusGeo, gridGeo, starGeo].forEach(g => g.dispose());
    };
  }, [onFpsUpdate]);

  return (
    <canvas
      ref={canvasRef}
      id="three-canvas"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        display: "block",
      }}
    />
  );
}
