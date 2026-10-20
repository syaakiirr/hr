import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowRight, ChartNoAxesCombined, Check, FileSpreadsheet, ListFilter, Radar } from "lucide-react";
import { motion } from "motion/react";
import "./CapabilitiesShowcase.css";

const VIEWS = [
  { name: "Monitor activity", icon: Radar, title: "Every post.\nA clearer picture.", description: "Bring Instagram, TikTok and Facebook activity into named monitoring sessions. See who has engaged, and where a follow-up is needed.", details: ["Track activity across three platforms", "Keep each session organised", "Review completed and missed engagement"] },
  { name: "Understand your team", icon: ChartNoAxesCombined, title: "See the people\nbehind the activity.", description: "Look beyond individual posts. Compare engagement across your staff, departments and companies, using the same date range.", details: ["Compare teams in one view", "Explore individual staff activity", "Keep a snapshot of your results"] },
  { name: "Share the results", icon: FileSpreadsheet, title: "Less compiling.\nMore clarity.", description: "Turn the activity you monitor into a report your team can use. Choose the sections you need and export to Excel or PDF.", details: ["Choose what goes into your report", "Export Excel and PDF files", "Keep status changes in an audit trail"] },
];

function Preview({ view }: { view: number }) {
  if (view === 1) return <>
    <div className="cap-preview__heading"><div><span>Team engagement</span><h4>A shared view of progress.</h4></div><ChartNoAxesCombined size={22} /></div>
    <div className="cap-insights">{[["Marketing", 84, "21 of 25"], ["People & Culture", 72, "18 of 25"], ["Operations", 60, "15 of 25"]].map(([name, percent, detail]) => <div className="cap-insights__row" key={name}><div><strong>{name}</strong><span>{detail} completed</span></div><div className="cap-insights__track"><motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: .45 }} style={{ width: `${percent}%` }} /></div><b>{percent}%</b></div>)}</div>
    <div className="cap-preview__foot"><span>Same period. Every department.</span><span>Completion rate</span></div>
  </>;
  if (view === 2) return <>
    <div className="cap-preview__heading"><div><span>Report builder</span><h4>The right details, ready to share.</h4></div><ArrowDownToLine size={22} /></div>
    <div className="cap-report">
      <div className="cap-report__document"><FileSpreadsheet size={30} strokeWidth={1.3} /><strong>Engagement overview</strong><span>Selected reporting period</span><div /><div /><div /><small>SociHR / Team report</small></div>
      <div className="cap-report__contents"><span>Included in this preview</span>{["Engagement summary", "Staff ranking", "Platform breakdown", "Daily activity"].map(label => <div key={label}><Check size={14} />{label}</div>)}<p><b>XLSX</b><b>PDF</b></p></div>
    </div>
    <div className="cap-preview__foot"><span>Your reporting workflow, simplified.</span><span>Ready for review</span></div>
  </>;
  return <>
    <div className="cap-preview__heading"><div><span>Monitoring session</span><h4>A campaign. Every contribution.</h4></div><ListFilter size={20} /></div>
    <div className="cap-monitor" role="table" aria-label="Illustrative monitoring session">
      <div className="cap-monitor__labels" role="row"><span role="columnheader">Team member</span><span role="columnheader">Platform</span><span role="columnheader">Engagement</span></div>
      {[["AN", "Aina Noor", "Marketing", "Instagram", true], ["DL", "Daniel Lee", "Operations", "TikTok", true], ["SA", "Sara Ahmad", "People & Culture", "Facebook", false]].map(([initials, name, team, platform, done]) => <div className="cap-monitor__row" role="row" key={String(name)}><div role="cell"><span className="cap-avatar">{initials}</span><span><strong>{name}</strong><small>{team}</small></span></div><span role="cell">{platform}</span><span className={done ? "cap-status cap-status--complete" : "cap-status"} role="cell">{done ? <Check size={12} /> : <span className="cap-status__dot" />}{done ? "Completed" : "Pending"}</span></div>)}
    </div>
    <div className="cap-preview__foot"><span>One session. Three platforms.</span><span>Activity, organised.</span></div>
  </>;
}

export default function CapabilitiesShowcase() {
  const [view, setView] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = VIEWS[view];
  return <section id="capabilities" className="cap-showcase" aria-labelledby="cap-showcase-title">
    <div className="cap-showcase__intro"><h2 id="cap-showcase-title">A connected team.<br /><span>A clearer picture.</span></h2><p>From everyday social activity to a useful team overview. Everything you need to keep the picture in focus.</p></div>
    <div className="cap-showcase__tabs" role="tablist" aria-label="Explore SociHR capabilities">{VIEWS.map((item, index) => <button key={item.name} ref={el => { tabs.current[index] = el; }} type="button" id={`cap-tab-${index}`} role="tab" aria-selected={view === index} aria-controls="cap-feature-panel" tabIndex={view === index ? 0 : -1} onClick={() => setView(index)} onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (view + (event.key === "ArrowRight" ? 1 : -1) + 3) % 3;
      setView(next); tabs.current[next]?.focus();
    }}><item.icon size={18} strokeWidth={1.6} />{item.name}<ArrowRight className="cap-tab-arrow" size={16} /></button>)}</div>
    <div id="cap-feature-panel" role="tabpanel" aria-labelledby={`cap-tab-${view}`} className="cap-showcase__panel">
      <div className="cap-showcase__story"><h3>{current.title.split("\n").map(line => <span key={line}>{line}</span>)}</h3><p>{current.description}</p><ul>{current.details.map(detail => <li key={detail}><Check size={15} />{detail}</li>)}</ul><Link to="/login">Explore your workspace <ArrowRight size={16} /></Link></div>
      <div className="cap-showcase__demo"><div className="cap-preview__label"><span className="cap-preview__brand"><img src="/logo.png" alt="" />SociHR</span><span>Product preview · Sample data</span></div><motion.div key={view} className="cap-preview" initial={{ opacity: .5 }} animate={{ opacity: 1 }} transition={{ duration: .2 }}><Preview view={view} /></motion.div></div>
    </div>
  </section>;
}
