import { ArrowRight, ArrowUpRight, ArrowUp } from "lucide-react";
import { Link } from "react-router-dom";
import "./LandingClosing.css";

export default function LandingClosing() {
  return <div className="landing-closing">
    <section id="get-started" className="closing-invitation" aria-labelledby="closing-title">
      <div className="closing-invitation__mark" aria-hidden="true"><img src="/logo.png" alt="" /></div>
      <h2 id="closing-title">Your people. Your progress.<br /><span>Bring it all together.</span></h2>
      <p>A clearer view of your team’s social activity starts here.<br />{" "}Sign in to your SociHR workspace.</p>
      <Link id="cta-launch" className="closing-invitation__button" to="/login">Open your workspace <ArrowRight size={17} /></Link>
      <small>Need access? Speak to your organisation’s administrator.</small>
    </section>
    <footer className="closing-footer">
      <div className="closing-footer__main">
        <div className="closing-footer__identity">
          <a href="#top" className="closing-footer__brand" aria-label="SociHR, back to top"><img src="/logo.png" alt="" /><span>SociHR</span></a>
          <p>Connecting social activity<br />to a clearer team picture.</p>
        </div>
        <nav aria-label="Footer navigation" className="closing-footer__nav">
          <div><span>Explore</span><a href="#capabilities">Capabilities</a><a href="#introduction">Product demo</a><a href="#workflow">How it works</a><a href="#technology">Our technology</a><a href="#governance">Security & governance</a></div>
          <div><span>Workspace</span><Link to="/login">Sign in <ArrowUpRight size={13} /></Link><a href="#top">Back to top <ArrowUp size={13} /></a></div>
        </nav>
      </div>
      <div className="closing-footer__bottom"><span>© {new Date().getFullYear()} SociHR. All rights reserved.</span><span>Designed & developed by <strong>@syaakiirr</strong></span></div>
    </footer>
  </div>;
}
