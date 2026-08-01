import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

interface Holding {
  ticker: string;
  qty: number;
  price: number;
}

export default function Landing() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hero section animation states
  const [heroDonutActive, setHeroDonutActive] = useState(false);
  const [heroGaugeScore, setHeroGaugeScore] = useState(0);
  const [heroGaugeOffset, setHeroGaugeOffset] = useState(126); // initial max stroke-dashoffset
  const [heroNeedleAngle, setHeroNeedleAngle] = useState(-90);

  // Showcase section animation states
  const [showcaseScore, setShowcaseScore] = useState(0);
  const [showcaseGaugeOffset, setShowcaseGaugeOffset] = useState(251); // initial max stroke-dashoffset
  const [showcaseNeedleAngle, setShowcaseNeedleAngle] = useState(-90);
  const [showcaseLabelActive, setShowcaseLabelActive] = useState(false);
  const [componentsAnimated, setComponentsAnimated] = useState(false);

  // Component progress bar targets & active states
  const [componentVals, setComponentVals] = useState({
    sharpe: 0,
    volatility: 0,
    diversification: 0,
    sector: 0,
    beta: 0
  });

  // How It Works: Interactive Demo State
  const [demoStep, setDemoStep] = useState(1);
  const [demoHoldings, setDemoHoldings] = useState<Holding[]>([
    { ticker: 'INFY', qty: 10, price: 1420 },
    { ticker: 'TCS', qty: 15, price: 3850 }
  ]);
  const [newTicker, setNewTicker] = useState('INFY');
  const [newQty, setNewQty] = useState(10);
  const [newPrice, setNewPrice] = useState(1420);

  // Sliders for step 3
  const [sliderInfy, setSliderInfy] = useState(25);
  const [sliderTcs, setSliderTcs] = useState(33);
  const [sliderHdfc, setSliderHdfc] = useState(42);
  const [simulatedSharpe, setSimulatedSharpe] = useState(1.12);

  // Refs for Scroll Observation
  const showcaseRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Helper function to animate numeric values in state
  const animateValue = (
    setter: (val: number | ((prev: number) => number)) => void,
    start: number,
    end: number,
    duration: number,
    decimals: number = 0
  ) => {
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const value = start + progress * (end - start);
      setter(parseFloat(value.toFixed(decimals)));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  };

  // Scroll listener for Sticky Header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Canvas particle background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particlesArray: Particle[] = [];

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };

    window.addEventListener('resize', resize);
    resize();

    class Particle {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      alpha: number;

      constructor() {
        this.x = Math.random() * (canvas?.width || 800);
        this.y = Math.random() * (canvas?.height || 600) + (canvas?.height || 600);
        this.size = Math.random() * 2.5 + 0.5;
        this.speedY = -(Math.random() * 0.4 + 0.15);
        this.speedX = (Math.random() * 0.2 - 0.1);
        this.alpha = Math.random() * 0.5 + 0.1;
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;
        if (canvas && this.y < 0) {
          this.y = canvas.height;
          this.x = Math.random() * canvas.width;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = `rgba(96, 165, 250, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const init = () => {
      const num = Math.min(Math.floor((canvas.width || 800) / 15), 80);
      particlesArray = [];
      for (let i = 0; i < num; i++) {
        particlesArray.push(new Particle());
      }
    };
    init();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesArray.forEach(p => {
        p.update();
        p.draw();
      });
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Hero Section Load Animations
  useEffect(() => {
    // 1. Donut animation trigger
    setHeroDonutActive(true);

    // 2. Risk Score Gauge trigger
    // Target 36.3: offset = 126 - (36.3/100 * 126) = 80.26
    setHeroGaugeOffset(80.26);
    // Angle = -90 + (36.3 * 1.8) = -24.66
    setHeroNeedleAngle(-24.66);

    // Count score up
    animateValue(setHeroGaugeScore, 0, 36.3, 1800, 1);
  }, []);

  // Intersection Observer for scroll-triggered animations
  useEffect(() => {
    const observerOptions = {
      root: null,
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px'
    };

    const generalElements = document.querySelectorAll('.lp-fade-up');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');

          if (entry.target.id === 'risk-analysis') {
            // Trigger showcase gauge
            // Target 36.3: offset = 251 - (36.3/100 * 251) = 159.87
            setShowcaseGaugeOffset(159.87);
            // Angle = -90 + (36.3 * 1.8) = -24.66
            setShowcaseNeedleAngle(-24.66);
            animateValue(setShowcaseScore, 0, 36.3, 2000, 1);
            setTimeout(() => setShowcaseLabelActive(true), 1000);
          }

          if (entry.target.classList.contains('lp-risk-components')) {
            // Trigger component progress bars
            setComponentsAnimated(true);
            animateValue((val) => setComponentVals(prev => ({ ...prev, sharpe: val as number })), 0, 0, 1800);
            animateValue((val) => setComponentVals(prev => ({ ...prev, volatility: val as number })), 0, 65, 1800);
            animateValue((val) => setComponentVals(prev => ({ ...prev, diversification: val as number })), 0, 20, 1800);
            animateValue((val) => setComponentVals(prev => ({ ...prev, sector: val as number })), 0, 42, 1800);
            animateValue((val) => setComponentVals(prev => ({ ...prev, beta: val as number })), 0, 98, 1800);
          }
        }
      });
    }, observerOptions);

    generalElements.forEach(el => observer.observe(el));
    if (showcaseRef.current) observer.observe(showcaseRef.current);
    if (componentsRef.current) observer.observe(componentsRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Demo step 1: Add Holding handler
  const handleAddHolding = () => {
    if (!newTicker || !newQty || !newPrice) return;
    setDemoHoldings(prev => [
      ...prev,
      { ticker: newTicker.toUpperCase(), qty: newQty, price: newPrice }
    ]);
    setNewTicker('');
    setNewQty(0);
    setNewPrice(0);
  };

  // Demo step 3: Slider Simulation calculator
  const handleSliderChange = (asset: string, val: number) => {
    let wInfy = sliderInfy;
    let wTcs = sliderTcs;
    let wHdfc = sliderHdfc;

    if (asset === 'infy') {
      wInfy = val;
      setSliderInfy(val);
    } else if (asset === 'tcs') {
      wTcs = val;
      setSliderTcs(val);
    } else if (asset === 'hdfc') {
      wHdfc = val;
      setSliderHdfc(val);
    }

    const total = wInfy + wTcs + wHdfc;
    if (total === 0) return;

    const pInfy = wInfy / total;
    const pTcs = wTcs / total;
    const pHdfc = wHdfc / total;

    // Sharpe optimization logic
    let calculated = 1.82 - Math.abs(pHdfc - 0.6) * 1.2 - Math.abs(pInfy - pTcs) * 0.4;
    if (calculated < 0.6) calculated = 0.6;
    if (calculated > 1.95) calculated = 1.95;

    setSimulatedSharpe(parseFloat(calculated.toFixed(2)));
  };

  const getSharpeColor = (val: number) => {
    if (val >= 1.5) return 'var(--lp-color-green-light)';
    if (val >= 1.1) return '#60a5fa';
    return 'var(--lp-color-red-light)';
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(prev => !prev);
  };

  const getBarClass = (value: number) => {
    if (value > 70) return 'fill-green';
    if (value >= 45) return 'fill-amber';
    return 'fill-red';
  };

  return (
    <div className="landing-wrapper">
      {/* ==========================================
           STICKY NAVBAR
           ========================================== */}
      <header className={`lp-header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="lp-container lp-nav-container">
          <a href="#hero" className="lp-logo-container">
            <svg className="lp-logo-icon" viewBox="0 0 24 24">
              <path d="M4 18h3V8H4v10zm5 0h3V5H9v13zm5 0h3v-7h-3v7zm5 0h3v-4h-3v4z" />
            </svg>
            <span className="lp-logo-text">Quantfolio</span>
          </a>

          <ul className="lp-nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#risk-analysis">Risk Score</a></li>
          </ul>

          <div className="lp-nav-cta">
            <button onClick={() => navigate('/login')} className="lp-nav-cta-btn ghost">Log In</button>
            <button onClick={() => navigate('/register')} className="lp-nav-cta-btn primary">Get started free</button>
          </div>

          <button
            className={`lp-mobile-menu-btn ${mobileMenuOpen ? 'active' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Toggle Menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div className={`lp-mobile-overlay ${mobileMenuOpen ? 'active' : ''}`}>
        <ul className="lp-nav-links">
          <li><a href="#features" onClick={toggleMobileMenu}>Features</a></li>
          <li><a href="#how-it-works" onClick={toggleMobileMenu}>How It Works</a></li>
          <li><a href="#risk-analysis" onClick={toggleMobileMenu}>Risk Score</a></li>
        </ul>
        <div className="lp-nav-cta">
          <button onClick={() => { toggleMobileMenu(); navigate('/login'); }} className="lp-nav-cta-btn ghost">Log In</button>
          <button onClick={() => { toggleMobileMenu(); navigate('/register'); }} className="lp-nav-cta-btn primary">Get started free</button>
        </div>
      </div>

      {/* ==========================================
           HERO SECTION
           ========================================== */}
      <section id="hero" className="lp-hero-section">
        <canvas id="lp-hero-particles" ref={canvasRef}></canvas>
        <div className="lp-hero-glow-1"></div>
        <div className="lp-hero-glow-2"></div>

        <div className="lp-container lp-hero-grid">
          <div className="lp-hero-content">
            <div className="lp-hero-badge">
              <span className="pulse"></span>
              AI-powered portfolio intelligence
            </div>
            <h1 className="lp-hero-title">
              Your portfolio.<br />
              <span className="highlight">Analysed like a fund manager.</span>
            </h1>
            <p className="lp-hero-description">
              Real-time P&L, AI-driven risk scoring, news sentiment, and what-if simulations — all in one platform built for Indian markets.
            </p>
            <div className="lp-hero-actions">
              <button onClick={() => navigate('/register')} className="lp-btn lp-btn-primary">Get started free</button>
              <a href="#how-it-works" className="lp-btn lp-btn-secondary">See how it works</a>
            </div>
          </div>

          <div className="lp-hero-mockup-container">
            <div className="lp-mockup-card">
              <div className="lp-mockup-header">
                <span className="lp-mockup-brand">My Portfolio</span>
                <div className="lp-mockup-live">
                  <span className="lp-mockup-live-dot"></span>
                  Live NSE feed
                </div>
              </div>

              <div className="lp-mockup-metrics-grid">
                {/* Allocation Donut */}
                <div className="lp-mockup-metric-box">
                  <span className="lp-metric-label">Allocation</span>
                  <div className="lp-donut-container">
                    <div className={`lp-donut-chart ${heroDonutActive ? 'active' : ''}`}>
                      <div className="lp-donut-hole">3 Assets</div>
                    </div>
                  </div>
                </div>

                {/* Risk Score Gauge */}
                <div className="lp-mockup-metric-box">
                  <span className="lp-metric-label">Risk Rating</span>
                  <div className="lp-mockup-gauge-container">
                    <svg viewBox="0 0 100 60" style={{ width: '100%', height: 'auto' }}>
                      <defs>
                        <linearGradient id="mini-gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stop-color="#16a34a" />
                          <stop offset="50%" stop-color="#eab308" />
                          <stop offset="100%" stop-color="#dc2626" />
                        </linearGradient>
                      </defs>
                      <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
                      <path
                        d="M10 50 A40 40 0 0 1 90 50"
                        fill="none"
                        stroke="url(#mini-gauge-grad)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray="126"
                        strokeDashoffset={heroGaugeOffset}
                        style={{ transition: 'stroke-dashoffset 2s cubic-bezier(0.25, 1, 0.5, 1)' }}
                      />
                      <polygon
                        points="49,50 50,12 51,50"
                        fill="#f8fafc"
                        style={{
                          transform: `rotate(${heroNeedleAngle}deg)`,
                          transformOrigin: '50px 50px',
                          transition: 'transform 2s cubic-bezier(0.25, 1, 0.5, 1)'
                        }}
                      />
                      <circle cx="50" cy="50" r="3" fill="#cbd5e1" />
                    </svg>
                  </div>
                  <span className="lp-mockup-gauge-score">{heroGaugeScore.toFixed(1)}</span>
                  <span className="lp-mockup-gauge-label">High Risk</span>
                </div>
              </div>

              {/* Table */}
              <div className="lp-mockup-table-container">
                <table className="lp-mockup-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Weight</th>
                      <th style={{ textAlign: 'right' }}>Return (1Y)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="ticker">INFY</td>
                      <td>25%</td>
                      <td style={{ textAlign: 'right' }}><span className="neg-return">↓ -18.1%</span></td>
                    </tr>
                    <tr>
                      <td className="ticker">TCS</td>
                      <td>33%</td>
                      <td style={{ textAlign: 'right' }}><span className="neg-return">↓ -43.4%</span></td>
                    </tr>
                    <tr>
                      <td className="ticker">HDFCBANK</td>
                      <td>42%</td>
                      <td style={{ textAlign: 'right' }}><span className="neg-return">↓ -53.5%</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
           STATS BAR
           ========================================== */}
      <div className="lp-stats-bar">
        <div className="lp-container lp-stats-grid">
          <div className="lp-stats-item">
            <span className="lp-stats-val">6 months</span>
            <span className="lp-stats-label">of NSE data</span>
          </div>
          <div className="lp-stats-item">
            <span className="lp-stats-val">5 risk metrics</span>
            <span className="lp-stats-label">computed</span>
          </div>
          <div className="lp-stats-item">
            <span className="lp-stats-val">Real-time</span>
            <span className="lp-stats-label">NIFTY 50 benchmark</span>
          </div>
        </div>
      </div>

      {/* ==========================================
           FEATURES SECTION
           ========================================== */}
      <section id="features" className="lp-features-section lp-section-padding">
        <div className="lp-container">
          <div className="lp-section-header lp-fade-up">
            <span className="lp-section-tagline">Comprehensive Analytics</span>
            <h2 className="lp-section-title">Everything a fund manager uses. Built for you.</h2>
            <p className="lp-section-subtitle">Professional-grade indicators simplified into actionable insights, helping you navigate market volatility.</p>
          </div>

          <div className="lp-features-grid">
            <div className="lp-feature-card lp-fade-up lp-delay-1">
              <div className="lp-feature-icon-wrapper">📊</div>
              <h3 className="lp-feature-title">Live P&L Tracking</h3>
              <p className="lp-feature-desc">Real NSE prices. See your actual gains and losses updated live with zero lag.</p>
            </div>
            <div className="lp-feature-card lp-fade-up lp-delay-2">
              <div className="lp-feature-icon-wrapper">🎯</div>
              <h3 className="lp-feature-title">Portfolio Risk Score</h3>
              <p className="lp-feature-desc">A single 0-100 score built from Sharpe ratio, beta, VaR, and sector concentration metrics.</p>
            </div>
            <div className="lp-feature-card lp-fade-up lp-delay-3">
              <div className="lp-feature-icon-wrapper">🤖</div>
              <h3 className="lp-feature-title">AI Advisor</h3>
              <p className="lp-feature-desc">Get 3 personalised rebalancing recommendations based on your actual holdings and goals.</p>
            </div>
            <div className="lp-feature-card lp-fade-up lp-delay-1">
              <div className="lp-feature-icon-wrapper">📰</div>
              <h3 className="lp-feature-title">News Sentiment</h3>
              <p className="lp-feature-desc">Latest headlines for every holding, automatically scored positive or negative by Gemini.</p>
            </div>
            <div className="lp-feature-card lp-fade-up lp-delay-2">
              <div className="lp-feature-icon-wrapper">🔄</div>
              <h3 className="lp-feature-title">What-if Simulator</h3>
              <p className="lp-feature-desc">Drag sliders to rebalance and instantly see how Sharpe ratio changes before submitting trades.</p>
            </div>
            <div className="lp-feature-card lp-fade-up lp-delay-3">
              <div className="lp-feature-icon-wrapper">🏆</div>
              <h3 className="lp-feature-title">vs NIFTY 50</h3>
              <p className="lp-feature-desc">See your alpha. Plot your portfolio performance against India's benchmark index.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
           HOW IT WORKS SECTION
           ========================================== */}
      <section id="how-it-works" className="lp-how-it-works-section lp-section-padding">
        <div className="lp-container">
          <div className="lp-section-header lp-fade-up">
            <span className="lp-section-tagline">Seamless Workflow</span>
            <h2 className="lp-section-title">Analyse your holdings in seconds</h2>
            <p className="lp-section-subtitle">No broker connection required. Maintain complete privacy over your financial data.</p>
          </div>

          <div className="lp-how-grid">
            <div className="lp-how-left lp-fade-up">
              <div className="lp-steps-container">
                <div className="lp-steps-line"></div>

                <div className={`lp-step-item ${demoStep === 1 ? 'active' : ''}`} onClick={() => setDemoStep(1)}>
                  <div className="lp-step-badge">1</div>
                  <div className="lp-step-content">
                    <h3 className="lp-step-title">Add your holdings</h3>
                    <p className="lp-step-desc">Enter ticker symbols (e.g. RELIANCE, TCS), quantities, and average buy price securely.</p>
                  </div>
                </div>

                <div className={`lp-step-item ${demoStep === 2 ? 'active' : ''}`} onClick={() => setDemoStep(2)}>
                  <div className="lp-step-badge">2</div>
                  <div className="lp-step-content">
                    <h3 className="lp-step-title">Get instant analysis</h3>
                    <p className="lp-step-desc">AI computes risk score, Sharpe ratio, Value-at-Risk (VaR), and sector concentrations.</p>
                  </div>
                </div>

                <div className={`lp-step-item ${demoStep === 3 ? 'active' : ''}`} onClick={() => setDemoStep(3)}>
                  <div className="lp-step-badge">3</div>
                  <div className="lp-step-content">
                    <h3 className="lp-step-title">Make smarter decisions</h3>
                    <p className="lp-step-desc">Use the interactive what-if simulator and AI advice to optimize and rebalance weights.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-how-right lp-fade-up lp-delay-2">
              <div className="lp-demo-panel">
                <div className="lp-demo-header">
                  <span className="lp-demo-title">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--lp-color-primary)">
                      {demoStep === 1 ? (
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                      ) : demoStep === 2 ? (
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                      ) : (
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                      )}
                    </svg>
                    {demoStep === 1
                      ? 'Step 1: Input holdings'
                      : demoStep === 2
                      ? 'Step 2: Instant risk score'
                      : 'Step 3: What-if simulator'}
                  </span>
                  <span className="lp-mockup-live">Live Simulator</span>
                </div>

                <div className="lp-demo-content-slot">
                  {/* Step 1 Slide */}
                  <div className={`lp-demo-slide ${demoStep === 1 ? 'active' : ''}`}>
                    <div className="lp-ticker-input-group">
                      <input
                        type="text"
                        className="lp-demo-input lp-demo-input-ticker"
                        placeholder="RELIANCE"
                        value={newTicker}
                        onChange={(e) => setNewTicker(e.target.value)}
                      />
                      <input
                        type="number"
                        className="lp-demo-input lp-demo-input-qty"
                        placeholder="Qty"
                        value={newQty || ''}
                        onChange={(e) => setNewQty(parseInt(e.target.value) || 0)}
                      />
                      <input
                        type="number"
                        className="lp-demo-input lp-demo-input-price"
                        placeholder="Price"
                        value={newPrice || ''}
                        onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <button className="lp-demo-add-btn" onClick={handleAddHolding}>
                      Add to Portfolio
                    </button>

                    <div className="lp-demo-holdings-list">
                      {demoHoldings.map((h, i) => (
                        <div key={i} className="lp-demo-holding-row">
                          <span className="lp-demo-holding-ticker">{h.ticker}</span>
                          <span className="lp-demo-holding-details">
                            {h.qty} shares @ ₹{h.price}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="lp-demo-action-row">
                      <button className="lp-btn lp-btn-dark" style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }} onClick={() => setDemoStep(2)}>
                        Analyze Portfolio →
                      </button>
                    </div>
                  </div>

                  {/* Step 2 Slide */}
                  <div className={`lp-demo-slide ${demoStep === 2 ? 'active' : ''}`}>
                    <div className="lp-analysis-score-container">
                      <span className="lp-analysis-score-large">36.3</span>
                      <div className="lp-analysis-score-meta">
                        <span className="lp-analysis-score-label">Risk Scoring</span>
                        <span className="lp-analysis-score-desc" style={{ color: 'var(--lp-color-red)' }}>
                          High Portfolio Risk
                        </span>
                      </div>
                    </div>

                    <div className="lp-analysis-metrics-grid">
                      <div className="lp-analysis-metric-item">
                        <span className="lp-analysis-metric-name">Sharpe Ratio</span>
                        <span className="lp-analysis-metric-val">1.12</span>
                      </div>
                      <div className="lp-analysis-metric-item">
                        <span className="lp-analysis-metric-name">Portfolio Beta</span>
                        <span className="lp-analysis-metric-val">1.28</span>
                      </div>
                      <div className="lp-analysis-metric-item">
                        <span className="lp-analysis-metric-name">Diversification</span>
                        <span className="lp-analysis-metric-val" style={{ color: 'var(--lp-color-red)' }}>
                          Concentrated
                        </span>
                      </div>
                      <div className="lp-analysis-metric-item">
                        <span className="lp-analysis-metric-name">Estimated VaR</span>
                        <span className="lp-analysis-metric-val">₹4,250</span>
                      </div>
                    </div>

                    <div className="lp-demo-action-row" style={{ justifyContent: 'space-between' }}>
                      <button
                        className="lp-btn lp-btn-secondary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', color: 'var(--lp-color-navy-dark)', borderColor: 'var(--lp-color-gray-300)' }}
                        onClick={() => setDemoStep(1)}
                      >
                        ← Back
                      </button>
                      <button className="lp-btn lp-btn-dark" style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }} onClick={() => setDemoStep(3)}>
                        Rebalance Simulation →
                      </button>
                    </div>
                  </div>

                  {/* Step 3 Slide */}
                  <div className={`lp-demo-slide ${demoStep === 3 ? 'active' : ''}`}>
                    <div className="lp-simulator-card">
                      <div className="lp-simulator-sharpe-row">
                        <span>Simulated Sharpe Ratio</span>
                        <span className="lp-sim-sharpe-num" style={{ color: getSharpeColor(simulatedSharpe) }}>
                          {simulatedSharpe.toFixed(2)}
                        </span>
                      </div>

                      <div className="lp-sim-slider-group">
                        <div className="lp-sim-slider-row">
                          <div className="lp-sim-slider-label">
                            <span>INFY (IT)</span>
                            <span>{sliderInfy}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={sliderInfy}
                            className="lp-sim-slider"
                            onChange={(e) => handleSliderChange('infy', parseInt(e.target.value))}
                          />
                        </div>
                        <div className="lp-sim-slider-row">
                          <div className="lp-sim-slider-label">
                            <span>TCS (IT)</span>
                            <span>{sliderTcs}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={sliderTcs}
                            className="lp-sim-slider"
                            onChange={(e) => handleSliderChange('tcs', parseInt(e.target.value))}
                          />
                        </div>
                        <div className="lp-sim-slider-row">
                          <div className="lp-sim-slider-label">
                            <span>HDFCBANK (Financials)</span>
                            <span>{sliderHdfc}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={sliderHdfc}
                            className="lp-sim-slider"
                            onChange={(e) => handleSliderChange('hdfc', parseInt(e.target.value))}
                          />
                        </div>
                      </div>

                      <div className="lp-advisor-tip-box">
                        <span style={{ fontWeight: 700 }}>💡 AI Rebalancing Tip:</span>
                        <span>
                          IT sector concentration is {sliderInfy + sliderTcs}%. Increase allocation to HDFCBANK to optimize Sharpe.
                        </span>
                      </div>
                    </div>

                    <div className="lp-demo-action-row" style={{ justifyContent: 'flex-start', marginTop: '1rem' }}>
                      <button
                        className="lp-btn lp-btn-secondary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', color: 'var(--lp-color-navy-dark)', borderColor: 'var(--lp-color-gray-300)' }}
                        onClick={() => setDemoStep(2)}
                      >
                        ← Back
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
           RISK SCORE SHOWCASE SECTION
           ========================================== */}
      <section id="risk-analysis" className="lp-risk-showcase-section lp-section-padding" ref={showcaseRef}>
        <div className="lp-container">
          <div className="lp-risk-grid">
            <div className="lp-risk-left lp-fade-up">
              <span className="lp-section-tagline" style={{ color: 'var(--lp-color-primary-light)' }}>Deep Risk Intelligence</span>
              <h2 className="lp-risk-title">Know your risk.<br />Before the market tells you.</h2>
              <p className="lp-risk-desc">
                Quantfolio runs historical covariance matrix mathematics and monte-carlo scenarios against your holdings to calculate real structural risks.
              </p>
              <button onClick={() => navigate('/register')} className="lp-btn lp-btn-primary">Start analysing free</button>
            </div>

            <div className="lp-risk-right lp-fade-up lp-delay-2">
              <div className="lp-gauge-wrapper">
                <svg className="lp-gauge-svg" viewBox="0 0 200 120">
                  <defs>
                    <linearGradient id="gauge-gradient-react" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#16a34a" />
                      <stop offset="35%" stop-color="#22c55e" />
                      <stop offset="70%" stop-color="#eab308" />
                      <stop offset="100%" stop-color="#dc2626" />
                    </linearGradient>
                  </defs>
                  {/* Track */}
                  <path d="M 20 110 A 80 80 0 0 1 180 110" fill="none" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
                  {/* Progress */}
                  <path
                    d="M 20 110 A 80 80 0 0 1 180 110"
                    fill="none"
                    stroke="url(#gauge-gradient-react)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray="251"
                    strokeDashoffset={showcaseGaugeOffset}
                    style={{ transition: 'stroke-dashoffset 2.2s cubic-bezier(0.25, 1, 0.5, 1)' }}
                  />

                  {/* Scale Labels */}
                  <text x="18" y="118" fill="#64748b" fontSize="7" fontWeight="600" textAnchor="middle">0</text>
                  <text x="100" y="22" fill="#64748b" fontSize="7" fontWeight="600" textAnchor="middle">50</text>
                  <text x="182" y="118" fill="#64748b" fontSize="7" fontWeight="600" textAnchor="middle">100</text>

                  {/* Needle */}
                  <g
                    className="lp-gauge-needle"
                    style={{
                      transform: `rotate(${showcaseNeedleAngle}deg)`,
                      transformOrigin: '100px 110px',
                      transition: 'transform 2.2s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                  >
                    <polygon points="97,110 100,24 103,110" fill="#f8fafc" />
                    <circle cx="100" cy="110" r="6" fill="#cbd5e1" />
                    <circle cx="100" cy="110" r="2" fill="#0f172a" />
                  </g>
                </svg>

                <div className="lp-gauge-score-value">{showcaseScore}</div>
                <div className={`lp-gauge-score-label ${showcaseLabelActive ? 'active' : ''}`}>High Risk</div>
              </div>
            </div>
          </div>

          {/* Component Bars */}
          <div className="lp-risk-components" ref={componentsRef}>
            <div className="lp-component-bar-container">
              <div className="lp-component-label-row">
                <span>Sharpe Ratio Quality</span>
                <span>{componentVals.sharpe}%</span>
              </div>
              <div className="lp-component-bar-bg">
                <div
                  className={`lp-component-bar-fill ${getBarClass(componentVals.sharpe)}`}
                  style={{ width: `${componentsAnimated ? componentVals.sharpe : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="lp-component-bar-container">
              <div className="lp-component-label-row">
                <span>Volatility Suppression</span>
                <span>{componentVals.volatility}%</span>
              </div>
              <div className="lp-component-bar-bg">
                <div
                  className={`lp-component-bar-fill ${getBarClass(componentVals.volatility)}`}
                  style={{ width: `${componentsAnimated ? componentVals.volatility : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="lp-component-bar-container">
              <div className="lp-component-label-row">
                <span>Diversification Index</span>
                <span>{componentVals.diversification}%</span>
              </div>
              <div className="lp-component-bar-bg">
                <div
                  className={`lp-component-bar-fill ${getBarClass(componentVals.diversification)}`}
                  style={{ width: `${componentsAnimated ? componentVals.diversification : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="lp-component-bar-container">
              <div className="lp-component-label-row">
                <span>Sector Balance</span>
                <span>{componentVals.sector}%</span>
              </div>
              <div className="lp-component-bar-bg">
                <div
                  className={`lp-component-bar-fill ${getBarClass(componentVals.sector)}`}
                  style={{ width: `${componentsAnimated ? componentVals.sector : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="lp-component-bar-container">
              <div className="lp-component-label-row">
                <span>Market Sensitivity (Beta)</span>
                <span>{componentVals.beta}%</span>
              </div>
              <div className="lp-component-bar-bg">
                <div
                  className={`lp-component-bar-fill ${getBarClass(componentVals.beta)}`}
                  style={{ width: `${componentsAnimated ? componentVals.beta : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
           SOCIAL PROOF / CREDIBILITY BAR
           ========================================== */}
      <section className="lp-social-proof-bar">
        <div className="lp-container">
          <div className="lp-social-proof-title">Built with industry-grade infrastructure</div>
          <div className="lp-social-proof-grid">
            <div className="lp-social-badge">FastAPI</div>
            <div className="lp-social-badge">React</div>
            <div className="lp-social-badge">PostgreSQL</div>
            <div className="lp-social-badge">Yahoo Finance</div>
            <div className="lp-social-badge">NewsAPI</div>
          </div>
        </div>
      </section>

      {/* ==========================================
           FINAL CTA SECTION
           ========================================== */}
      <section className="lp-final-cta-section lp-section-padding">
        <div className="lp-final-cta-glow"></div>
        <div className="lp-container lp-final-cta-content lp-fade-up">
          <h2 className="lp-final-cta-title">Start tracking your portfolio in 2 minutes.</h2>
          <div className="lp-final-cta-btn-wrapper">
            <button
              onClick={() => navigate('/register')}
              className="lp-btn lp-final-cta-button"
            >
              Create free account →
            </button>
          </div>
          <p className="lp-final-cta-sub">No credit card. No broker access needed. Just your holdings.</p>
        </div>
      </section>

      {/* ==========================================
           FOOTER
           ========================================== */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-grid">
          <div className="lp-footer-brand">
            <a href="#hero" className="lp-footer-logo">
              <svg className="lp-logo-icon" viewBox="0 0 24 24" style={{ fill: 'var(--lp-color-primary)' }}>
                <path d="M4 18h3V8H4v10zm5 0h3V5H9v13zm5 0h3v-7h-3v7zm5 0h3v-4h-3v4z" />
              </svg>
              <span className="lp-footer-logo-text">Quantfolio</span>
            </a>
          </div>

          <div className="lp-footer-copyright">
            &copy; 2026 Quantfolio. All rights reserved.
          </div>

          <div className="lp-footer-right">
            <div className="lp-footer-credits" style={{ marginBottom: '0.5rem', textAlign: 'right', fontSize: '0.8125rem' }}>
              by <span className="lp-accent" style={{ color: 'var(--lp-color-white)', fontWeight: 500 }}>Preetha Arul</span>
            </div>
            <ul className="lp-footer-links">
              <li><a href="#features">Features</a></li>
              <li><a href="#how-it-works">How it Works</a></li>
              <li><a href="#risk-analysis">Risk Score</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}