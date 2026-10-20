import { ArrowRight, Check, ChevronDown, FileSpreadsheet, Fingerprint, History, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import "./WorkflowGovernance.css";

const SECURITY = [
  { icon: Users, title: "The right access for each role", summary: "Permissions that follow responsibility.", body: "Role-based permissions govern access to administrative features. Department-scoped views help keep everyday work focused on the relevant team." },
  { icon: Fingerprint, title: "An extra step at sign-in", summary: "Optional two-factor authentication.", body: "Enable authenticator-based two-factor authentication for an account. When enabled, sign-in requires a time-based verification code after the password is checked." },
  { icon: History, title: "A record you can return to", summary: "Activity with context, not guesswork.", body: "Review recorded engagement status changes in the audit trail. Security audit records also capture sign-in events, giving administrators context when reviewing account activity." },
];

export default function WorkflowGovernance() {
  return <>
    <section id="workflow" className="work-story" aria-labelledby="work-story-title">
      <div className="work-story__header"><div><h2 id="work-story-title">From the first name.<br /><span>To the full picture.</span></h2></div><p>A simple rhythm for your team’s social activity.<br />Set it up, keep track, and share what matters.</p></div>
      <ol className="work-story__steps">
        <li>
          <div className="work-story__milestone"><span>01</span><span>Bring your team together</span><ArrowRight size={18} /></div>
          <div className="work-story__scene work-story__scene--directory" aria-label="Illustrative staff directory">
            <div className="work-story__scene-title"><Users size={17} /><span>Your team directory</span></div>
            <div className="work-directory"><span>AN</span><div><strong>Aina Noor</strong><small>Marketing</small></div><Check size={14} /></div>
            <div className="work-directory"><span>DL</span><div><strong>Daniel Lee</strong><small>Operations</small></div><Check size={14} /></div>
            <div className="work-directory"><span>SA</span><div><strong>Sara Ahmad</strong><small>People & Culture</small></div><Check size={14} /></div>
          </div>
          <h3>Start with your people.</h3><p>Add staff, organise departments and link social handles. Give every activity a person and a place.</p>
        </li>
        <li>
          <div className="work-story__milestone"><span>02</span><span>Follow the activity</span><ArrowRight size={18} /></div>
          <div className="work-story__scene work-story__scene--session" aria-label="Illustrative monitoring session">
            <div className="work-story__scene-title"><span className="work-session-dot" /><span>Campaign monitoring</span></div>
            <div className="work-session"><span>Instagram</span><div><i /><i /><i /><i /></div><Check size={14} /></div>
            <div className="work-session"><span>TikTok</span><div><i /><i /><i /><i className="work-session__pending" /></div><span>3 / 4</span></div>
            <div className="work-session"><span>Facebook</span><div><i /><i /><i /><i /></div><Check size={14} /></div>
          </div>
          <h3>Keep the activity in view.</h3><p>Create a monitoring session, add campaign posts and review staff engagement across your platforms.</p>
        </li>
        <li>
          <div className="work-story__milestone"><span>03</span><span>Make it useful</span><Check size={18} /></div>
          <div className="work-story__scene work-story__scene--report" aria-label="Illustrative report export">
            <div className="work-export"><FileSpreadsheet size={27} strokeWidth={1.4} /><strong>Team engagement</strong><span>Summary · Activity · Staff ranking</span><div><span>XLSX</span><span>PDF</span></div></div>
          </div>
          <h3>Share a clearer summary.</h3><p>Review the results, save a snapshot or export a report. Keep everyone working from the same picture.</p>
        </li>
      </ol>
      <div className="work-story__footer"><span>Illustrative workflow · Sample data</span><Link to="/login">Start in your workspace <ArrowRight size={16} /></Link></div>
    </section>

    <section id="governance" className="trust-story" aria-labelledby="trust-story-title">
      <div className="trust-story__inner">
        <div className="trust-story__intro"><div className="trust-story__signature"><ShieldCheck size={21} strokeWidth={1.5} /><span>Security & governance</span></div><h2 id="trust-story-title">Clear boundaries.<br />Thoughtful safeguards.</h2><p>Your team’s activity deserves careful handling. SociHR brings access controls, account protection and a reviewable history into the workspace.</p><div className="trust-story__note"><LockKeyhole size={15} /><span>Designed around accountable access.</span></div></div>
        <div className="trust-story__details">{SECURITY.map((item, index) => <details key={item.title} className="trust-detail" open={index === 0 ? true : undefined} name="socihr-security"><summary><item.icon size={20} strokeWidth={1.5} /><span><strong>{item.title}</strong><small>{item.summary}</small></span><ChevronDown size={17} className="trust-detail__chevron" /></summary><div className="trust-detail__body"><p>{item.body}</p></div></details>)}</div>
      </div>
      <div className="trust-story__footer"><span>Access with purpose. Activity with context.</span><Link to="/login">Open your workspace <ArrowRight size={16} /></Link></div>
    </section>
  </>;
}
