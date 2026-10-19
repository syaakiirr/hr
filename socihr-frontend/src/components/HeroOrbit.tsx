import { useEffect, useRef, useState } from "react";
import { Music2 } from "lucide-react";
import RotatingEarth from "./ui/wireframe-dotted-globe";
import "./HeroOrbit.css";

export default function HeroOrbit() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let inView = false;
    const update = () => setActive(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    if (ref.current) observer.observe(ref.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div ref={ref} className="hero-orbit" data-active={active}>
      <svg className="hero-orbit__paths" viewBox="0 0 560 520" aria-hidden="true">
        <ellipse className="hero-orbit__track" cx="280" cy="260" rx="268" ry="176" transform="rotate(-26 280 260)" />
        <ellipse className="hero-orbit__track hero-orbit__track--secondary" cx="280" cy="260" rx="253" ry="205" transform="rotate(30 280 260)" />
        <ellipse className="hero-orbit__signal" cx="280" cy="260" rx="268" ry="176" transform="rotate(-26 280 260)" pathLength="100" />
        <ellipse className="hero-orbit__signal hero-orbit__signal--secondary" cx="280" cy="260" rx="253" ry="205" transform="rotate(30 280 260)" pathLength="100" />
      </svg>
      <RotatingEarth width={560} height={520} themeColor="indigo" className="hero-orbit__globe" />
      <div className="hero-orbit__platform hero-orbit__platform--instagram">
        <span className="hero-orbit__icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg></span>
        <span>Instagram</span>
      </div>
      <div className="hero-orbit__platform hero-orbit__platform--facebook">
        <span className="hero-orbit__icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 21v-8h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.5A26 26 0 0 0 15 1c-3 0-5 1.8-5 5v3H7v4h3v8z" /></svg></span>
        <span>Facebook</span>
      </div>
      <div className="hero-orbit__platform hero-orbit__platform--tiktok">
        <span className="hero-orbit__icon"><Music2 size={19} strokeWidth={1.7} /></span>
        <span>TikTok</span>
      </div>
      <div className="hero-orbit__caption"><span /> Three platforms. One view.</div>
    </div>
  );
}
