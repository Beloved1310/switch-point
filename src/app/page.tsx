import Image from "next/image";
import Link from "next/link";

const steps = [
  ["01", "Pick your usual", "Choose the coffee you would reach for first."],
  ["02", "Explore the offer", "See how price, promotions and trust shape choice."],
  ["03", "Tell us why", "Your anonymous answers help make better offers."],
];

export default function Home() {
  return (
    <main className="landing-page">
      <nav className="site-nav" aria-label="Main navigation">
        <Link className="wordmark" href="/" aria-label="SwitchPoint home"><span className="wordmark-mark">S</span> switchpoint<span className="wordmark-period">.</span></Link>
        <div className="nav-actions">
          <span className="nav-note"><span className="live-dot" /> A little research, a better cup
          </span>
          <Link className="nav-link" href="/dashboard">Retailer dashboard <span aria-hidden>↗</span></Link>
        </div>
      </nav>

      <section className="hero-shell">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> THE EVERYDAY CHOICE STUDY · NO. 01</p>
          <h1>What makes<br />you <em>switch?</em></h1>
          <p className="hero-deck">A small, thoughtful experiment about the choices we make in the coffee aisle. Your instincts are the interesting part.</p>
          <div className="hero-actions">
            <Link href="/experiment" className="button-primary">Take the 3-minute study <span aria-hidden>↗</span></Link>
            <span className="privacy-note"><span aria-hidden>◉</span> Anonymous by design</span>
          </div>
          <div className="hero-footnote"><span className="footnote-rule" /> No right answers. Just your real choice.</div>
        </div>
        <div className="hero-art" aria-label="Illustration of two coffee bags being compared">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="art-index">FIELD STUDY<br /><b>01 / 07</b></div>
          <Image className="hero-bag hero-bag-back" src="/coffee-ridgeline.svg" alt="Ridgeline medium roast coffee bag" width={240} height={390} priority />
          <Image className="hero-bag hero-bag-front" src="/coffee-hearth.svg" alt="Hearth Roast medium roast coffee bag" width={240} height={390} priority />
          <div className="art-caption"><span>THE QUESTION</span><br />What tips the balance?</div>
          <div className="art-sparkle" aria-hidden>✳</div>
        </div>
      </section>

      <section className="study-strip" aria-label="Study details">
        <div><span className="strip-icon">◷</span><b>3 minutes</b><span>easy, considered choices</span></div>
        <div><span className="strip-icon">◎</span><b>100% anonymous</b><span>no name or email needed</span></div>
        <div><span className="strip-icon">✳</span><b>Your choice counts</b><span>one real-world reward draw</span></div>
      </section>

      <section className="how-section">
        <div className="section-heading"><p className="eyebrow">A SIMPLE LITTLE STUDY</p><h2>Three steps. One more<br className="desktop-break" /> interesting cup of coffee.</h2></div>
        <div className="steps-grid">{steps.map(([n, title, detail]) => <article className="step-card" key={n}><span className="step-number">{n}</span><h3>{title}</h3><p>{detail}</p><span className="step-arrow" aria-hidden>↗</span></article>)}</div>
      </section>

      <footer className="landing-footer"><span className="wordmark footer-wordmark"><span className="wordmark-mark">S</span> switchpoint<span className="wordmark-period">.</span></span><span>Curious about what people really choose.</span><Link href="/dashboard">Researcher access ↗</Link></footer>
    </main>
  );
}
