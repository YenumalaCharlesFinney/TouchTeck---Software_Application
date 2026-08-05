import React, { useState, useEffect } from 'react';
import AnimatedLogo from './AnimatedLogo';
import { playBeeps } from '../audioUtility';
import {
  Shield,
  Zap,
  Tv,
  Database,
  Volume2,
  FileText,
  ChevronDown,
  ChevronUp,
  LogIn,
  LogOut,
  CheckCircle2,
  Lock,
  Mail,
  Award,
  ArrowDown,
  ArrowRight,
  Activity,
  Sparkles,
  X,
  Cpu,
  HelpCircle,
  UserPlus,
  User,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface LandingPageProps {
  onLogin: (email: string) => void;
  onLogout?: () => void;
  onNavigateToTab: (tabId: 'scoreboard' | 'operator' | 'system-check' | 'meet-setup') => void;
  isLoggedIn: boolean;
  userEmail: string;
}

export default function LandingPage({
  onLogin,
  onLogout,
  onNavigateToTab,
  isLoggedIn,
  userEmail
}: LandingPageProps) {
  // Modal Popup State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Login & Sign Up Form State (Auto-Restored from LocalStorage)
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('touchteck_saved_email') || 'operator@touchteck.com';
    }
    return 'operator@touchteck.com';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('touchteck_remember_me') !== 'false';
    }
    return true;
  });
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Accordion FAQ State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Hero Full-Bleed Wallpaper Carousel State
  const [heroBgIdx, setHeroBgIdx] = useState(0);

  // Segmented Pill Navigation State
  const [activeNavSection, setActiveNavSection] = useState<'overview' | 'capabilities' | 'faq'>('overview');

  const heroWallpapers = [
    { img: '/omega_rio_blocks.jpg', label: 'Rio 2016 Olympic Arena Blocks' },
    { img: '/omega_phelps_fist_pump.jpg', label: 'Phelps OMEGA Wall Celebration' },
    { img: '/omega_phelps_london_2012.jpg', label: 'Phelps London 2012 Victory' },
    { img: '/omega_phelps_touchpad_look.jpg', label: 'Phelps Scoreboard Sync' },
    { img: '/omega_phelps_london_hd.png', label: 'Phelps London 2012 Victory Block' },
    { img: '/omega_hero_bg.jpg', label: 'Tokyo 2020 OMEGA Touchpad Wall' }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroBgIdx((prev) => (prev + 1) % heroWallpapers.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [heroWallpapers.length]);

  // Login Submission with Auto-Save Password and LocalStorage Persistence
  const handleSubmitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) {
      setLoginError('Please enter a valid email address.');
      return;
    }
    if (!passwordInput || passwordInput.length < 4) {
      setLoginError('Password must be at least 4 characters.');
      return;
    }
    if (authMode === 'signup' && passwordInput !== confirmPasswordInput) {
      setLoginError('Passwords do not match. Please verify your password.');
      return;
    }

    // Remember the email for convenience only — the password is never persisted.
    if (rememberMe) {
      localStorage.setItem('touchteck_saved_email', emailInput);
      localStorage.setItem('touchteck_remember_me', 'true');
    } else {
      localStorage.removeItem('touchteck_saved_email');
      localStorage.setItem('touchteck_remember_me', 'false');
    }

    setLoginError('');
    setLoginSuccess(true);
    playBeeps(1, 880, 0.1);
    setTimeout(() => {
      setIsLoginModalOpen(false);
      onLogin(emailInput);
    }, 600);
  };

  const handleGuestLogin = () => {
    setLoginError('');
    setLoginSuccess(true);
    playBeeps(2, 600, 0.08);
    setTimeout(() => {
      setIsLoginModalOpen(false);
      onLogin('operator@touchteck.com');
    }, 500);
  };

  return (
    <div className="landing-hero-bg landing-grid-pattern min-h-screen text-slate-100 flex flex-col items-center w-full font-sans bg-black overflow-x-hidden">
      {/* Fixed Glassmorphism Header Navbar with Gradient Blend */}
      <header className="glass-header fixed top-0 inset-x-0 z-50 w-full px-6 sm:px-12 transition-all" style={{ paddingTop: '20px', paddingBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
          <AnimatedLogo size="md" showText={true} />

          {/* Center Quick Navigation */}
          <nav className="hidden lg:flex items-center justify-center gap-8 text-sm font-bold tracking-wide text-slate-200">
            <a href="#hero" className="hover:text-[#fff500] transition-colors flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#fff500]" />
              <span>Overview</span>
            </a>
            <a href="#features" className="hover:text-[#fff500] transition-colors flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#fff500]" />
              <span>Capabilities</span>
            </a>
            <a href="#specs" className="hover:text-[#fff500] transition-colors flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#fff500]" />
              <span>Specifications</span>
            </a>
            <a href="#faq" className="hover:text-[#fff500] transition-colors flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#fff500]" />
              <span>FAQ</span>
            </a>
          </nav>

          {/* Right CTA / Auth Status */}
          <div className="flex items-center gap-5">
            {/* 1. OPERATOR CONSOLE BUTTON (FIRST - SMOOTH SCROLLS TO HERO PRESENTATION) */}
            <a
              href="#hero-text"
              className="bg-[#fff500] hover:bg-[#e6dc00] text-black rounded-full font-black text-xs uppercase tracking-wider shadow-xl flex items-center gap-3 transition-all transform hover:scale-105 cursor-pointer whitespace-nowrap"
              style={{ paddingTop: '12px', paddingBottom: '12px', paddingLeft: '36px', paddingRight: '36px' }}
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span>Operator Console</span>
            </a>

            {isLoggedIn ? (
              <div className="flex items-center gap-4">
                {/* 2. PROFILE BADGE BUTTON (SECOND) */}
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="hidden sm:flex items-center gap-3 rounded-full bg-slate-900 border border-[#fff500]/50 text-xs font-mono text-[#fff500] hover:bg-slate-800 transition-all cursor-pointer shadow-md"
                  title="Signed In Operator"
                  style={{ paddingTop: '12px', paddingBottom: '12px', paddingLeft: '28px', paddingRight: '28px' }}
                >
                  <div className="w-6 h-6 rounded-full bg-[#fff500] text-black flex items-center justify-center font-black text-[11px] shrink-0">
                    {userEmail ? userEmail[0].toUpperCase() : 'O'}
                  </div>
                  <span className="font-semibold text-slate-200 text-xs whitespace-nowrap">
                    {userEmail || 'operator@touchteck.com'}
                  </span>
                </button>

                {/* 3. LOGOUT BUTTON (THIRD) */}
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-2.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30 transition-all cursor-pointer shadow-md whitespace-nowrap"
                    title="Log Out of TouchTeck system"
                    style={{ paddingTop: '12px', paddingBottom: '12px', paddingLeft: '28px', paddingRight: '28px' }}
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>Logout</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="flex items-center gap-2.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-[#fff500]/60 text-[#fff500] hover:text-white text-xs font-extrabold transition-all cursor-pointer shadow-md"
                style={{ paddingTop: '12px', paddingBottom: '12px', paddingLeft: '28px', paddingRight: '28px' }}
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* PAGE 1: 16:9 VIEWPORT 1 — 100% FULL-BLEED CAROUSEL (EXACT HEIGHT) */}
      {/* ------------------------------------------------------------- */}
      <section
        id="hero"
        className="h-screen min-h-screen flex flex-col items-center justify-between text-center w-full pt-28 pb-6 relative overflow-hidden bg-black group"
      >
        {/* Full 100vw Edge-to-Edge Dynamic 4K Wallpaper Image */}
        <div
          className="absolute inset-0 hero-wallpaper-4k transition-all duration-1000"
          style={{ backgroundImage: `url('${heroWallpapers[heroBgIdx].img}')` }}
        />

        {/* Ambient Dark Overlay for Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />

        {/* Minimal Subtle Bottom Edge Blend */}
        <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-b from-transparent to-black/50 pointer-events-none z-10" />

        {/* Transparent Left Arrow Button */}
        <button
          onClick={() => setHeroBgIdx((prev) => (prev === 0 ? heroWallpapers.length - 1 : prev - 1))}
          className="absolute left-6 top-1/2 -translate-y-1/2 w-13 h-13 rounded-full bg-black/30 hover:bg-black/60 border border-white/30 hover:border-[#fff500] text-white hover:text-[#fff500] flex items-center justify-center transition-all cursor-pointer z-20 shadow-2xl backdrop-blur-md"
          title="Previous Photo"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>

        {/* Transparent Right Arrow Button */}
        <button
          onClick={() => setHeroBgIdx((prev) => (prev + 1) % heroWallpapers.length)}
          className="absolute right-6 top-1/2 -translate-y-1/2 w-13 h-13 rounded-full bg-black/30 hover:bg-black/60 border border-white/30 hover:border-[#fff500] text-white hover:text-[#fff500] flex items-center justify-center transition-all cursor-pointer z-20 shadow-2xl backdrop-blur-md"
          title="Next Photo"
        >
          <ChevronRight className="w-7 h-7" />
        </button>

        {/* TOP GRADIENT FADE (Smoothly blends top edge from black header bar down into wallpaper) */}
        <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-black via-black/60 to-transparent pointer-events-none z-10" />

        {/* Empty Spacer */}
        <div />

        {/* Bottom Scroll Prompt Button */}
        <div className="relative z-20 flex flex-col items-center gap-4 pb-2">
          {/* Perfectly Balanced Scroll Prompt Button with Start and End Text Clearance */}
          <a
            href="#hero-text"
            className="inline-flex items-center gap-6 bg-black/65 hover:bg-black/85 text-white hover:text-[#fff500] py-4 rounded-full border-2 border-white/40 hover:border-[#fff500] font-extrabold text-sm tracking-wider shadow-2xl items-center justify-center transition-all animate-bounce backdrop-blur-md cursor-pointer uppercase"
            style={{ paddingLeft: '70px', paddingRight: '55px' }}
          >
            <span style={{ paddingLeft: '20px', paddingRight: '20px' }}>Scroll to Explore Overview</span>
            <ArrowDown className="w-4 h-4 text-[#fff500] shrink-0" />
          </a>
        </div>
      </section>

      {/* MAIN CENTERED CONTAINER FOR TEXT & CONTENT */}
      <main style={{ width: '100%', maxWidth: '1200px', padding: '0 1.5rem', paddingTop: '160px' }}>

        {/* ------------------------------------------------------------- */}
        {/* HERO TEXT PRESENTATION SECTION (BELOW FULL-BLEED WALLPAPER)   */}
        {/* ------------------------------------------------------------- */}
        <section
          id="hero-text"
          className="min-h-screen flex flex-col items-center justify-center text-center w-full pb-32 scroll-mt-28"
        >
          {/* Centered Headline Quote - Starts Directly with CHAMPIONS Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-tight mb-6">
            <span className="text-white block">EVERY MILLISECOND DEFINES CHAMPIONS.</span>
            <span className="text-[#fff500] block mt-1">
              PRECISION TIMING.
            </span>
            <span className="text-[#fff500] block mt-1">
              ZERO LATENCY.
            </span>
          </h1>

          {/* Hero Action Buttons - Thick, Bold & Substantial (Not Slim) */}
          <div className="flex flex-wrap justify-center items-center gap-6 w-full max-w-[960px] mb-24 sm:mb-32" style={{ marginTop: '48px' }}>
            <button
              onClick={() => onNavigateToTab('scoreboard')}
              className="rounded-full bg-[#fff500] hover:bg-[#e6dc00] text-black font-black text-base sm:text-lg uppercase tracking-wider shadow-2xl flex items-center justify-center gap-3.5 transition-all transform hover:-translate-y-1 cursor-pointer whitespace-nowrap"
              style={{ paddingTop: '22px', paddingBottom: '22px', paddingLeft: '65px', paddingRight: '55px' }}
            >
              <Tv className="w-6 h-6 shrink-0" />
              <span style={{ paddingLeft: '10px', paddingRight: '10px' }}>Launch Arena Scoreboard</span>
            </button>

            <button
              onClick={() => onNavigateToTab('operator')}
              className="rounded-full bg-black/90 hover:bg-black text-[#fff500] border-2 border-[#fff500] font-black text-base sm:text-lg uppercase tracking-wider shadow-2xl flex items-center justify-center gap-3.5 transition-all transform hover:-translate-y-1 cursor-pointer whitespace-nowrap"
              style={{ paddingTop: '22px', paddingBottom: '22px', paddingLeft: '65px', paddingRight: '55px' }}
            >
              <Activity className="w-6 h-6 text-[#fff500] shrink-0" />
              <span style={{ paddingLeft: '10px', paddingRight: '10px' }}>Operator Console</span>
            </button>
          </div>

          {/* Swimming Pool Horizontal Yellow Lane Line with End 'T' Markings (No Glow) */}
          <div
            className="flex items-center justify-center w-full mx-auto relative z-20 pointer-events-none"
            style={{ marginTop: '160px', marginBottom: '180px' }}
          >
            {/* Left 'T' Cross Bar */}
            <div className="w-1.5 h-12 bg-[#fff500] rounded-full shrink-0" />
            {/* Horizontal Pool Lane Line */}
            <div className="flex-1 h-1.5 bg-[#fff500]" />
            {/* Right 'T' Cross Bar */}
            <div className="w-1.5 h-12 bg-[#fff500] rounded-full shrink-0" />
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* PAGE 3: CORE CAPABILITIES */}
        {/* ------------------------------------------------------------- */}
        <section
          id="features"
          className="flex flex-col items-center justify-center pt-6 sm:pt-10 pb-24 w-full text-center mb-28 scroll-mt-36"
        >
          <div className="text-center mb-8 mt-2">
            {/* Logo + Brand above heading */}
            <div className="flex flex-col items-center mb-16">
              <div style={{ transform: 'scale(2.5)', transformOrigin: 'center', display: 'inline-flex', marginTop: '3rem', marginBottom: '5rem' }}>
                <AnimatedLogo size="xl" showText={true} />
              </div>
            </div>
            {/* Headline Quote - Max 2 lines */}
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              <span className="text-white block">BUILT FOR THE DECK.</span>
              <span className="text-[#fff500] block mt-1">READY FOR THE RACE.</span>
            </h2>
          </div>

          {/* Feature Cards Grid - High-End Spacious Glass Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full text-left mb-16" style={{ marginTop: '48px' }}>
            <div className="glass-card rounded-3xl p-9 sm:p-10 border border-white/10 transition-all hover:-translate-y-1 hover:border-[#fff500]/60 bg-slate-950 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-black border border-[#fff500]/40 text-[#fff500] flex items-center justify-center shadow-md">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-extrabold text-white tracking-tight mt-8 mb-4">Touch the Wall. See Your Time.</h3>
              <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-normal">
                The moment your hand hits the touchpad, your finish time is locked — down to a thousandth of a second. No delays, no guesswork, no missed touches.
              </p>
            </div>

            <div className="glass-card rounded-3xl p-9 sm:p-10 border border-white/10 transition-all hover:-translate-y-1 hover:border-[#fff500]/60 bg-slate-950 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-black border border-[#fff500]/40 text-[#fff500] flex items-center justify-center shadow-md">
                <Tv className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-extrabold text-white tracking-tight mt-8 mb-4">Your Race, Live on the Big Screen.</h3>
              <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-normal">
                Lane positions, split times, and your name on the scoreboard — instantly. Coaches in the stands see exactly what you see the moment you finish.
              </p>
            </div>

            <div className="glass-card rounded-3xl p-9 sm:p-10 border border-white/10 transition-all hover:-translate-y-1 hover:border-[#fff500]/60 bg-slate-950 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-black border border-[#fff500]/40 text-[#fff500] flex items-center justify-center shadow-md">
                <Database className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-extrabold text-white tracking-tight mt-8 mb-4">Your Times Are Never Lost.</h3>
              <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-normal">
                Every heat, every split, every personal best is saved locally — no internet needed. Whether the pool deck has signal or not, your results are always safe.
              </p>
            </div>

            <div className="glass-card rounded-3xl p-9 sm:p-10 border border-white/10 transition-all hover:-translate-y-1 hover:border-[#fff500]/60 bg-slate-950 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-black border border-[#fff500]/40 text-[#fff500] flex items-center justify-center shadow-md">
                <Volume2 className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-extrabold text-white tracking-tight mt-8 mb-4">A Clean Start, Every Race.</h3>
              <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-normal">
                The starter horn sounds exactly the same every time — precise, consistent, and fair. Every swimmer gets the same signal, every heat, every round.
              </p>
            </div>

            <div className="glass-card rounded-3xl p-9 sm:p-10 border border-white/10 transition-all hover:-translate-y-1 hover:border-[#fff500]/60 bg-slate-950 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-black border border-[#fff500]/40 text-[#fff500] flex items-center justify-center shadow-md">
                <Award className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-extrabold text-white tracking-tight mt-8 mb-4">Did You Hit Your Qualifying Standard?</h3>
              <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-normal">
                The moment you finish, the system checks your time against district, state, and national qualifying standards — and tells you instantly if you hit the mark.
              </p>
            </div>

            <div className="glass-card rounded-3xl p-9 sm:p-10 border border-white/10 transition-all hover:-translate-y-1 hover:border-[#fff500]/60 bg-slate-950 shadow-2xl">
              <div className="w-14 h-14 rounded-2xl bg-black border border-[#fff500]/40 text-[#fff500] flex items-center justify-center shadow-md">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-extrabold text-white tracking-tight mt-8 mb-4">Official Results, Ready to Share.</h3>
              <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-normal">
                When the meet ends, a full official results sheet is generated in one click — formatted, signed off, and ready to email to coaches, parents, and officials.
              </p>
            </div>
          </div>

          {/* Technical Specs Cards */}
          <div id="specs" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 font-mono text-xs w-full mb-16 scroll-mt-32" style={{ marginTop: '120px' }}>
            <div className="bg-slate-950 py-12 px-8 min-h-[220px] flex flex-col justify-center rounded-3xl border border-white/10 space-y-4 text-center shadow-xl transition-all hover:border-[#fff500]/50">
              <span className="text-slate-200 font-bold tracking-wider uppercase block">Your Finish Time</span>
              <span className="text-[#fff500] text-xl font-black block">1/1000th Second</span>
              <span className="text-slate-100 block">Captured the instant you hit the wall</span>
            </div>

            <div className="bg-slate-950 py-12 px-8 min-h-[220px] flex flex-col justify-center rounded-3xl border border-white/10 space-y-4 text-center shadow-xl transition-all hover:border-[#fff500]/50">
              <span className="text-slate-200 font-bold tracking-wider uppercase block">Wall to Clock</span>
              <span className="text-[#fff500] text-xl font-black block">Zero Missed Touches</span>
              <span className="text-slate-100 block">Direct hardware connection, no signal loss</span>
            </div>

            <div className="bg-slate-950 py-12 px-8 min-h-[220px] flex flex-col justify-center rounded-3xl border border-white/10 space-y-4 text-center shadow-xl transition-all hover:border-[#fff500]/50">
              <span className="text-slate-200 font-bold tracking-wider uppercase block">Stadium Screen</span>
              <span className="text-[#fff500] text-xl font-black block">Updates Instantly</span>
              <span className="text-slate-100 block">Your lane goes live the moment you finish</span>
            </div>

            <div className="bg-slate-950 py-12 px-8 min-h-[220px] flex flex-col justify-center rounded-3xl border border-white/10 space-y-4 text-center shadow-xl transition-all hover:border-[#fff500]/50">
              <span className="text-slate-200 font-bold tracking-wider uppercase block">No Internet Needed</span>
              <span className="text-[#fff500] text-xl font-black block">100% Pool Deck Ready</span>
              <span className="text-slate-100 block">Works in any pool, any venue, anywhere</span>
            </div>
          </div>

          {/* Swimming Pool Horizontal Yellow Lane Line with End 'T' Markings (No Glow) */}
          <div
            className="flex items-center justify-center w-full mx-auto relative z-20 pointer-events-none"
            style={{ marginTop: '160px', marginBottom: '180px' }}
          >
            {/* Left 'T' Cross Bar */}
            <div className="w-1.5 h-12 bg-[#fff500] rounded-full shrink-0" />
            {/* Horizontal Pool Lane Line */}
            <div className="flex-1 h-1.5 bg-[#fff500]" />
            {/* Right 'T' Cross Bar */}
            <div className="w-1.5 h-12 bg-[#fff500] rounded-full shrink-0" />
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* PAGE 4: 16:9 VIEWPORT 4 — FAQ & FOOTER (TEXT <= 2 LINES)      */}
        {/* ------------------------------------------------------------- */}
        <section
          id="faq"
          className="flex flex-col items-center justify-between pb-36 w-full text-center scroll-mt-36"
        >
          <div className="w-full flex flex-col items-center">
            <div className="text-center space-y-4" style={{ marginBottom: '120px' }}>
              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
                CLEAR ANSWERS FOR MEET DIRECTORS.
              </h2>
            </div>

            <div className="w-full text-left max-w-4xl flex flex-col gap-3" style={{ marginBottom: '120px' }}>
              {[
                {
                  q: 'How does TouchTeck connect to physical swim touchpads?',
                  a: 'TouchTeck utilizes the browser-native Web Serial API to establish direct RS-232/USB communication with timing console hardware and finish wall touchpads.'
                },
                {
                  q: 'Can I operate TouchTeck completely offline at the pool deck?',
                  a: 'Yes! TouchTeck uses an offline-first IndexedDB database powered by Dexie.js to store all meet data, swimmer entries, and heat results locally on your computer.'
                },
                {
                  q: 'How does the Arena Scoreboard work on external TV screens?',
                  a: 'Simply open the Scoreboard tab in a separate browser window and drag it onto your LED stadium display. State syncs instantaneously via the browser BroadcastChannel API.'
                },
                {
                  q: 'Do I need credentials or internet access to use TouchTeck?',
                  a: 'No internet access or subscription key is required. TouchTeck operates 100% locally on your computer for maximum pool deck reliability.'
                }
              ].map((item, idx) => (
                <div 
                  key={idx} 
                  className="glass-card overflow-hidden w-full bg-slate-950 rounded-2xl border border-white/15 transition-all hover:bg-slate-900 hover:border-[#fff500]/40 shadow-xl"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full px-7 py-8 text-left font-bold text-white flex items-center justify-between gap-4 hover:text-[#fff500] transition-colors cursor-pointer"
                  >
                    <span className="text-base sm:text-lg">{item.q}</span>
                    {openFaq === idx ? <ChevronUp className="w-6 h-6 text-[#fff500] flex-shrink-0" /> : <ChevronDown className="w-6 h-6 text-slate-400 flex-shrink-0" />}
                  </button>
                  {openFaq === idx && (
                    <div className="px-7 pb-7 text-sm text-slate-300 leading-relaxed border-t border-slate-800/80 pt-5 font-normal">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER - High-End E-Commerce Style with Luxurious Spacious Gaps */}
          <footer className="mt-40 sm:mt-56 w-full border-t border-white/10 bg-black pt-28 pb-36 px-8 sm:px-16 text-slate-400 font-sans">
            <div className="max-w-7xl mx-auto" style={{ gap: '60px' }}>
              {/* Top Row: Logo & Newsletter Signup Box */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-white/15" style={{ paddingBottom: '60px', marginBottom: '60px' }}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-6" style={{ marginBottom: '32px' }}>
                  <AnimatedLogo size="md" showText={true} />
                  <p className="text-sm sm:text-base text-slate-200 font-medium leading-relaxed">
                    Receive the Latest Updates & Releases from TouchTeck system
                  </p>
                </div>

                {/* Newsletter Input Box & Logout Option */}
                <div className="flex flex-col items-end gap-2 w-full max-w-md" style={{ marginTop: '24px', marginBottom: '24px' }}>
                  <form onSubmit={(e) => e.preventDefault()} className="relative w-full">
                    <input
                      type="email"
                      placeholder="Email Address"
                      className="w-full rounded-full bg-slate-950 border border-white/25 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-[#fff500] transition-all shadow-inner tracking-wider"
                      style={{
                        paddingTop: '16px',
                        paddingBottom: '16px',
                        paddingLeft: '48px',
                        paddingRight: '80px',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="submit"
                      className="rounded-full bg-[#fff500] hover:bg-[#e6dc00] text-black flex items-center justify-center transition-all cursor-pointer shadow-lg"
                      style={{
                        position: 'absolute',
                        right: '16px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '36px',
                        height: '36px'
                      }}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>

                  {/* Explicit Logout Option directly under Email Address form */}
                  <div className="w-full flex items-center justify-between px-2 pt-2 text-xs font-mono">
                    {isLoggedIn ? (
                      <span className="text-slate-400 flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        <span className="truncate">Signed in: <strong className="text-slate-200">{userEmail || 'operator'}</strong></span>
                      </span>
                    ) : (
                      <button
                        onClick={() => setIsLoginModalOpen(true)}
                        className="text-[#fff500] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Sign In</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (onLogout) onLogout();
                      }}
                      className="text-rose-400 hover:text-rose-300 hover:underline font-mono flex items-center gap-1.5 transition-colors cursor-pointer bg-rose-500/10 hover:bg-rose-500/20 rounded-full border border-rose-500/30"
                      style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '8px', paddingBottom: '8px' }}
                      title="Log Out of TouchTeck system"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Center Grid Columns (3 Columns - Explicit 24px Gap After Every Line & Centered Alignment) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-16 sm:gap-20 text-xs text-center" style={{ marginBottom: '60px' }}>
                {/* Column 1: Timing Modules */}
                <div className="text-center">
                  <h4 className="font-mono text-xs font-bold text-slate-200 uppercase tracking-widest border-b border-white/10 text-center" style={{ paddingBottom: '14px', marginBottom: '32px' }}>
                    TIMING MODULES
                  </h4>
                  <ul className="font-medium text-sm text-center">
                    <li style={{ marginBottom: '24px' }}><button onClick={() => onNavigateToTab('operator')} className="hover:text-[#fff500] transition-colors cursor-pointer text-center w-full block">0.001s Touchpad Serial Driver</button></li>
                    <li style={{ marginBottom: '24px' }}><button onClick={() => onNavigateToTab('scoreboard')} className="hover:text-[#fff500] transition-colors cursor-pointer text-center w-full block">Multi-Tab Arena Scoreboard</button></li>
                    <li style={{ marginBottom: '24px' }}><button onClick={() => onNavigateToTab('operator')} className="hover:text-[#fff500] transition-colors cursor-pointer text-center w-full block">Acoustic Starter Horn System</button></li>
                    <li style={{ marginBottom: '24px' }}><button onClick={() => onNavigateToTab('operator')} className="hover:text-[#fff500] transition-colors cursor-pointer text-center w-full block">Automated PDF & CSV Reports</button></li>
                  </ul>
                </div>

                {/* Column 2: System Capabilities */}
                <div className="text-center">
                  <h4 className="font-mono text-xs font-bold text-slate-200 uppercase tracking-widest border-b border-white/10 text-center" style={{ paddingBottom: '14px', marginBottom: '32px' }}>
                    SYSTEM CAPABILITIES
                  </h4>
                  <ul className="font-medium text-sm text-center">
                    <li style={{ marginBottom: '24px' }}><button onClick={() => onNavigateToTab('operator')} className="hover:text-[#fff500] transition-colors cursor-pointer text-center w-full block">Dexie Offline Storage Engine</button></li>
                    <li style={{ marginBottom: '24px' }}><button onClick={() => onNavigateToTab('scoreboard')} className="hover:text-[#fff500] transition-colors cursor-pointer text-center w-full block">BroadcastChannel Tab Synchronization</button></li>
                    <li style={{ marginBottom: '24px' }}><button onClick={() => onNavigateToTab('operator')} className="hover:text-[#fff500] transition-colors cursor-pointer text-center w-full block">Qualifying Standard Badge System</button></li>
                    <li style={{ marginBottom: '24px' }}><button onClick={() => onNavigateToTab('operator')} className="hover:text-[#fff500] transition-colors cursor-pointer text-center w-full block">Millisecond Precision Finish Logging</button></li>
                  </ul>
                </div>

                {/* Column 3: Operator Quick Access */}
                <div className="text-center">
                  <h4 className="font-mono text-xs font-bold text-slate-200 uppercase tracking-widest border-b border-white/10 text-center" style={{ paddingBottom: '14px', marginBottom: '32px' }}>
                    QUICK ACCESS & CONSOLE
                  </h4>
                  <ul className="font-medium text-sm text-center">
                    <li style={{ marginBottom: '24px' }}><button onClick={() => onNavigateToTab('operator')} className="hover:text-[#fff500] transition-colors cursor-pointer text-center w-full block">Launch Operator Console</button></li>
                    <li style={{ marginBottom: '24px' }}><button onClick={() => onNavigateToTab('scoreboard')} className="hover:text-[#fff500] transition-colors cursor-pointer text-center w-full block">Launch Arena Stadium Scoreboard</button></li>
                    <li style={{ marginBottom: '24px' }}><button onClick={() => onNavigateToTab('operator')} className="hover:text-[#fff500] transition-colors cursor-pointer text-center w-full block">RS-232 / USB Web Serial Driver</button></li>
                    <li style={{ marginBottom: '24px' }}><button onClick={() => onNavigateToTab('operator')} className="hover:text-[#fff500] transition-colors cursor-pointer text-center w-full block">100% Offline Database Local Mode</button></li>
                  </ul>
                </div>
              </div>

              {/* Bottom Footer Bar with Segmented Controls */}
              <div className="pt-16 border-t border-white/15 flex flex-col md:flex-row items-center justify-between gap-8 text-xs font-mono">
                <div className="flex items-center justify-center gap-4 text-xs font-mono flex-wrap">
                  <span className="text-[#fff500] font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#fff500] animate-pulse" />
                    SYSTEM READY - FOR OMEGA
                  </span>
                  <span className="hidden sm:inline text-slate-700">|</span>
                  <span className="text-slate-400 font-medium">© 2026 TOUCHTECK FOR OMEGA</span>
                  <span className="hidden sm:inline text-slate-700">|</span>
                  <span className="text-slate-300 font-medium flex items-center gap-2">
                    Made by <img src="/signature.png" alt="Yenumala Charles Finney" className="h-7 sm:h-9 object-contain inline-block filter drop-shadow-[0_0_8px_rgba(224,255,43,0.5)]" />
                  </span>
                </div>
              </div>
            </div>
          </footer>
        </section>
      </main>

      {/* SIGN IN & LOG IN MODAL POPUP */}
      {isLoginModalOpen && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setIsLoginModalOpen(false)}
        >
          <div
            className="glass-card rounded-3xl p-10 sm:p-14 relative overflow-hidden border-2 border-[#fff500]/40 shadow-2xl bg-slate-950 w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-7 right-7 text-slate-400 hover:text-white p-2.5 rounded-full hover:bg-slate-800 transition-colors cursor-pointer z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Ambient Yellow Background Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#fff500]/15 rounded-full blur-3xl pointer-events-none" />

            {/* Modal Header */}
            <div style={{ marginBottom: '24px' }}>
              {/* Title */}
              <div className="flex items-center gap-3.5 flex-wrap" style={{ marginBottom: '16px' }}>
                <h3 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                  {authMode === 'signin' ? (
                    <>
                      <Lock className="w-7 h-7 text-[#fff500] shrink-0" />
                      <span>Operator Sign In</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-7 h-7 text-[#fff500] shrink-0" />
                      <span>Create Operator Account</span>
                    </>
                  )}
                </h3>
              </div>

              {/* Subtitle */}
              <p className="text-sm sm:text-base text-slate-400 font-mono tracking-wide" style={{ marginTop: '14px', marginBottom: '24px' }}>
                {authMode === 'signin' 
                  ? 'Access aquatic timing console for Omega' 
                  : 'Register a new official operator account for Omega system'}
              </p>
            </div>

            {/* Distinct Horizontal Line */}
            <div style={{ width: '100%', height: '1px', backgroundColor: 'rgba(255,255,255,0.15)', marginTop: '24px', marginBottom: '32px' }} />

            {/* Form Fields */}
            <form onSubmit={handleSubmitLogin} className="flex flex-col gap-8">
              {loginError && (
                <div className="p-4.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center gap-3 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping shrink-0" />
                  {loginError}
                </div>
              )}

              {loginSuccess && (
                <div className="p-4.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-center gap-3 font-mono mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  {authMode === 'signin' ? 'Authentication successful! Launching console...' : 'Account created successfully! Launching console...'}
                </div>
              )}

              {/* Full Name Input (Sign Up Mode Only) */}
              {authMode === 'signup' && (
                <div className="flex flex-col gap-3.5" style={{ marginTop: '8px' }}>
                  <label className="text-sm sm:text-base font-bold text-slate-200 flex items-center gap-3 tracking-wide" style={{ marginBottom: '10px', paddingLeft: '14px' }}>
                    <User className="w-5 h-5 text-[#fff500]" />
                    Full Operator Name
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Yenumala Charles Finney"
                    className="w-full bg-black border-2 border-slate-800 focus:border-[#fff500] rounded-2xl py-4.5 text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#fff500]/30 font-mono transition-all shadow-inner min-h-[56px]"
                    style={{ paddingLeft: '32px', paddingRight: '24px' }}
                    required
                  />
                </div>
              )}

              {/* Email Input */}
              <div className="flex flex-col gap-3.5" style={{ marginTop: '8px' }}>
                <label className="text-sm sm:text-base font-bold text-slate-200 flex items-center gap-3 tracking-wide" style={{ marginBottom: '10px', paddingLeft: '14px' }}>
                  <Mail className="w-5 h-5 text-[#fff500]" />
                  Official Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  autoComplete="username email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="operator@touchteck.com"
                  className="w-full bg-black border-2 border-slate-800 focus:border-[#fff500] rounded-2xl py-4.5 text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#fff500]/30 font-mono transition-all shadow-inner min-h-[56px]"
                  style={{ paddingLeft: '32px', paddingRight: '24px' }}
                  required
                  autoFocus
                />
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-3.5" style={{ marginTop: '8px' }}>
                <label className="text-sm sm:text-base font-bold text-slate-200 flex items-center gap-3 tracking-wide" style={{ marginBottom: '10px', paddingLeft: '14px' }}>
                  <Lock className="w-5 h-5 text-[#fff500]" />
                  Console Password
                </label>
                <input
                  type="password"
                  name="password"
                  autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black border-2 border-slate-800 focus:border-[#fff500] rounded-2xl py-4.5 text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#fff500]/30 transition-all shadow-inner min-h-[56px]"
                  style={{ paddingLeft: '32px', paddingRight: '24px' }}
                  required
                />
              </div>

              {/* Confirm Password Input (Sign Up Mode Only) */}
              {authMode === 'signup' && (
                <div className="flex flex-col gap-3.5" style={{ marginTop: '8px' }}>
                  <label className="text-sm sm:text-base font-bold text-slate-200 flex items-center gap-3 tracking-wide" style={{ marginBottom: '10px', paddingLeft: '14px' }}>
                    <ShieldCheck className="w-5 h-5 text-[#fff500]" />
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black border-2 border-slate-800 focus:border-[#fff500] rounded-2xl py-4.5 text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#fff500]/30 transition-all shadow-inner min-h-[56px]"
                    style={{ paddingLeft: '32px', paddingRight: '24px' }}
                    required
                  />
                </div>
              )}

              {/* Remember Password & Auto-Save Checkbox */}
              <div className="flex items-center justify-between flex-wrap gap-2" style={{ paddingLeft: '14px', paddingRight: '14px' }}>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-black border-2 border-slate-700 checked:bg-[#fff500] checked:border-[#fff500] text-black focus:ring-0 cursor-pointer transition-all"
                  />
                  <span className="text-xs sm:text-sm text-slate-300 font-mono group-hover:text-[#fff500] transition-colors">
                    Remember password & auto-save login
                  </span>
                </label>
                <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5 shrink-0">
                  <ShieldCheck className="w-4 h-4" /> Auto-Saved
                </span>
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-5 rounded-full bg-[#fff500] hover:bg-[#e6dc00] text-black font-black shadow-2xl shadow-[#fff500]/30 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] cursor-pointer text-base sm:text-lg tracking-wider min-h-[60px]"
                >
                  {authMode === 'signin' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                  <span>{authMode === 'signin' ? 'Sign In to Console' : 'Register & Launch Console'}</span>
                </button>
              </div>

              {/* Toggle Prompt */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                    setLoginError('');
                  }}
                  className="text-xs sm:text-sm text-slate-400 hover:text-[#fff500] font-mono hover:underline cursor-pointer transition-colors"
                >
                  {authMode === 'signin' 
                    ? "Don't have an operator account? Click here to Sign Up" 
                    : "Already registered? Click here to Sign In"}
                </button>
              </div>

              {/* Clean Non-Overlapping Divider */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <span className="relative z-10 bg-slate-950 px-5 py-1.5 text-xs uppercase font-mono text-slate-400 font-extrabold tracking-widest rounded-full border border-slate-800">
                  Or Quick Access
                </span>
              </div>

              {/* Guest Login Trigger */}
              <div>
                <button
                  type="button"
                  onClick={handleGuestLogin}
                  className="w-full py-4.5 rounded-full bg-slate-900 hover:bg-slate-800 border-2 border-[#fff500]/40 hover:border-[#fff500] text-slate-100 font-extrabold text-sm sm:text-base flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg min-h-[56px]"
                >
                  <Sparkles className="w-5 h-5 text-[#fff500]" />
                  <span>1-Click Guest Operator Login</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
