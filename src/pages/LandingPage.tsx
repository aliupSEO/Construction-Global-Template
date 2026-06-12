import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, APP_ID } from '../lib/firebase';
import {
  HardHat,
  ClipboardList,
  Users,
  MapPin,
  TrendingUp,
  Shield,
  Zap,
  Globe,
  ChevronRight,
  CheckCircle2,
  BarChart3,
  Calendar,
  FileText,
  ArrowRight,
  Star,
  Building2,
  Clock,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Reusable hook – triggers a class once the element enters the viewport
   ───────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ─────────────────────────────────────────────
   Animated counter — fires on scroll into view
   Root of old bug: ref was on an inline <span> (zero height)
   so IntersectionObserver fired immediately on mount.
   Fix: ref on a block <div> with real dimensions.
   ───────────────────────────────────────────── */
function Counter({
  target,
  suffix = '',
  prefix = '',
  duration = 2200,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const startRef = useRef<number | undefined>(undefined);

  // Observe the block-level div — fires when truly scrolled into view
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 }  // 40% of the card must be visible
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Run animation only after the observer has fired
  useEffect(() => {
    if (!started) return;
    startRef.current = undefined;

    const tick = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const progress = Math.min((timestamp - startRef.current) / duration, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(progress < 1 ? Math.floor(eased * target) : target);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [started, target, duration]);

  const format = (n: number) => {
    if (target >= 1000 && suffix !== '%') {
      return (n / 1000).toFixed(n >= target && target % 1000 === 0 ? 0 : 1) + 'K';
    }
    return n.toLocaleString();
  };

  // Block div — IntersectionObserver works correctly on block elements
  return (
    <div ref={ref} style={{ display: 'inherit' }}>
      {prefix}{format(count)}{suffix}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────── */
export function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Fetch company logo from Firestore (same source as Dashboard)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'apps', APP_ID, 'metadata', 'company_profile'),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().logoBase64) {
          setLogoUrl(docSnap.data().logoBase64);
        } else {
          setLogoUrl(null);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  // Sticky nav shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const features = [
    {
      icon: <ClipboardList className="w-6 h-6" />,
      title: 'Tages- & Wochenberichte',
      desc: 'Erstellen Sie professionelle Bauberichte in Sekunden. Fortschritt verfolgen, Probleme erfassen und sofort mit Beteiligten teilen.',
      color: 'from-red-500 to-red-700',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Mitarbeiterverwaltung',
      desc: 'Verwalten Sie Ihre gesamte Belegschaft – Rollen, Urlaubsanträge und Einsätze – in einem einzigen leistungsstarken Dashboard.',
      color: 'from-slate-700 to-slate-900',
    },
    {
      icon: <MapPin className="w-6 h-6" />,
      title: 'Baustellenverfolgung',
      desc: 'Überwachen Sie mehrere Baustellen in Echtzeit. Teams einteilen, Meilensteine verfolgen und Zeitpläne einhalten.',
      color: 'from-amber-500 to-orange-600',
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Analyse-Dashboard',
      desc: 'Visuelle KPIs, Produktivitätskennzahlen und Projektindikatoren liefern Ihnen auf einen Blick verwertbare Erkenntnisse.',
      color: 'from-red-500 to-rose-700',
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      title: 'Urlaubsverwaltung',
      desc: 'Vereinfachen Sie Urlaubsanträge und Genehmigungen mit automatisierten Workflows, die Ihr Team stets auf dem gleichen Stand halten.',
      color: 'from-slate-600 to-slate-800',
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: 'Druckfertige Dokumente',
      desc: 'Exportieren Sie professionelle PDF-Berichte und Dokumente, genau so formatiert, wie es Kunden und Behörden erwarten.',
      color: 'from-amber-600 to-red-600',
    },
  ];

  const benefits = [
    'Sparen Sie über 5 Stunden pro Woche bei der manuellen Berichterstellung',
    'Missverständnisse auf der Baustelle um 80 % reduzieren',
    'Echtzeit-Überblick für Führungskräfte und Eigentümer',
    'Rollenbasierter Zugriff für das gesamte Team',
    'Funktioniert offline – synchronisiert bei Verbindung',
    'DSGVO-konforme Datenspeicherung in Europa',
  ];

  const stats = [
    { label: 'Aktive Projekte', value: 2400, suffix: '+' },
    { label: 'Generierte Berichte', value: 48000, suffix: '+' },
    { label: 'Verwaltete Mitarbeiter', value: 12000, suffix: '+' },
    { label: 'Monatlich gesparte Stunden', value: 95, suffix: '%' },
  ];

  const testimonials = [
    {
      name: 'Markus Bauer',
      role: 'Bauleiter, Wien',
      text: 'Allein die Berichtsfunktion spart uns jede Woche einen halben Tag. Glasklare Dashboards, schnell und auf dem Handy perfekt nutzbar.',
      stars: 5,
    },
    {
      name: 'Elena Müller',
      role: 'Projektleiterin, Graz',
      text: 'Endlich ein Baumanagementsystem, das so funktioniert, wie wir wirklich arbeiten. Unser gesamtes Team hat es innerhalb einer Woche übernommen.',
      stars: 5,
    },
    {
      name: 'Thomas Huber',
      role: 'Geschäftsführer, Huber Bau GmbH',
      text: 'Das Analyse-Dashboard gibt mir einen Echtzeitüberblick, den ich vorher nie hatte. Absolut wegweisend für unser Unternehmen.',
      stars: 5,
    },
  ];

  const navLinks = [
    { label: 'Funktionen', href: '#features' },
    { label: 'Vorteile', href: '#benefits' },
    { label: 'Kennzahlen', href: '#stats' },
    { label: 'Referenzen', href: '#testimonials' },
  ];

  return (
    <div className="bg-white text-gray-900 font-sans overflow-x-hidden">

      {/* ── NAVBAR ── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-[#101010]/95 backdrop-blur-xl shadow-2xl shadow-black/40' : 'bg-transparent'
        }`}
        style={{ fontFamily: 'Barlow, sans-serif' }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between h-20">
          {/* Logo */}
          <a href="#hero" className="flex items-center gap-3 group" aria-label="Home">
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg shadow-red-700/40 group-hover:scale-105 transition-transform duration-200 bg-red-600 flex items-center justify-center">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
              ) : (
                <HardHat className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <span className="text-white font-bold text-lg leading-none tracking-wide block">Construction</span>
              <span className="text-red-500 text-xs font-semibold uppercase tracking-[0.2em]">Management Suite</span>
            </div>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-slate-300 hover:text-white text-sm font-medium transition-colors relative group"
              >
                {l.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-red-500 group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button
              id="lp-nav-login"
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 text-sm font-semibold text-white border border-white/20 rounded-xl hover:border-white/40 hover:bg-white/5 transition-all duration-200"
            >
              Anmelden
            </button>
            <button
              id="lp-nav-cta"
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-500 transition-all duration-200 shadow-lg shadow-red-600/30 hover:shadow-red-500/40 hover:-translate-y-0.5"
            >
              Kostenlos starten
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            id="lp-mobile-menu-toggle"
            className="md:hidden text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <div className="space-y-1.5">
              <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </div>
          </button>
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden bg-[#101010]/98 backdrop-blur-xl border-t border-white/10 transition-all duration-300 overflow-hidden ${
            mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-6 py-4 space-y-3">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-slate-300 hover:text-white py-2 text-sm font-medium transition-colors"
              >
                {l.label}
              </a>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <button onClick={() => navigate('/login')} className="w-full py-3 text-sm font-semibold text-white border border-white/20 rounded-xl hover:bg-white/5 transition-all">Anmelden</button>
              <button onClick={() => navigate('/login')} className="w-full py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-500 transition-all shadow-lg shadow-red-600/30">Kostenlos starten</button>
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section
        id="hero"
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#101010]"
        style={{ fontFamily: 'Barlow, sans-serif' }}
      >
        {/* Construction photo background */}
        <div className="absolute inset-0">
          <img
            src="/hero-construction.png"
            alt="Construction site at sunset"
            className="w-full h-full object-cover object-center"
          />
          {/* Multi-layer overlay: strong on left for text legibility, fade to visible on right */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#101010]/95 via-[#101010]/75 to-[#101010]/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#101010]/80 via-transparent to-[#101010]/50" />
        </div>

        {/* Red glow accent on left */}
        <div className="absolute top-1/3 left-0 w-72 h-72 bg-red-600/20 rounded-full blur-[90px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-28 pb-20 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left copy */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-600/10 border border-red-500/20 rounded-full mb-8">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 text-xs font-semibold uppercase tracking-widest">Intelligente Bau-Management-Plattform</span>
            </div>

            <h1 className="text-5xl sm:text-6xl xl:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6" style={{ fontFamily: 'Arial, sans-serif' }}>
              Klüger bauen.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-400 to-amber-400">
                Besser verwalten.
              </span>
            </h1>

            <p className="text-lg lg:text-xl text-slate-400 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-10">
              Die All-in-One-Baumanagementsoftware für moderne Teams.
              Berichte, Mitarbeiter, Baustellen und Analysen – vereint in einem leistungsstarken Dashboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button
                id="lp-hero-cta-primary"
                onClick={() => navigate('/login')}
                className="group px-8 py-4 bg-red-600 text-white font-bold rounded-2xl shadow-2xl shadow-red-600/30 hover:bg-red-500 hover:shadow-red-500/40 hover:-translate-y-1 transition-all duration-200 flex items-center justify-center gap-2 text-base"
              >
                Jetzt kostenlos starten
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#features"
                id="lp-hero-cta-secondary"
                className="px-8 py-4 border border-white/20 text-white font-semibold rounded-2xl hover:border-white/40 hover:bg-white/5 transition-all duration-200 flex items-center justify-center gap-2 text-base"
              >
                Funktionen entdecken
                <ChevronDown className="w-4 h-4" />
              </a>
            </div>

            {/* Trust signals */}
            <div className="mt-12 flex items-center gap-6 justify-center lg:justify-start">
              <div className="flex -space-x-2">
                {['#dc2626', '#b91c1c', '#7f1d1d', '#1e293b', '#0f172a'].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-[#101010] flex items-center justify-center text-xs text-white font-bold" style={{ backgroundColor: c }}>
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <div className="text-sm text-slate-400">
                <span className="text-white font-semibold">2.400+</span> Teams vertrauen uns weltweit
              </div>
            </div>
          </div>

          {/* Right – floating dashboard mockup */}
          <div className="relative flex justify-center lg:justify-end">
            {/* Main card */}
            <div className="relative w-full max-w-md">
              {/* Glow */}
              <div className="absolute -inset-4 bg-gradient-to-r from-red-600/20 to-amber-500/10 rounded-3xl blur-2xl" />

              <div className="relative bg-[#1a1a1a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                {/* Card header */}
                <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <HardHat className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Tagesbericht</p>
                    <p className="text-red-200 text-xs">Baustelle A — Wien Mitte</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-white text-xs font-semibold">Heute</p>
                    <p className="text-red-200 text-xs">09 Jun 2026</p>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-6 space-y-4">
                  {[
                    { label: 'Arbeiter vor Ort', value: '24', icon: <Users className="w-4 h-4 text-red-400" />, delta: '+3' },
                    { label: 'Aufgaben erledigt', value: '18 / 22', icon: <CheckCircle2 className="w-4 h-4 text-green-400" />, delta: '82%' },
                    { label: 'Gebuchte Stunden', value: '192h', icon: <Clock className="w-4 h-4 text-amber-400" />, delta: 'Im Plan' },
                    { label: 'Offene Probleme', value: '2', icon: <AlertTriangle className="w-4 h-4 text-orange-400" />, delta: '↓ 1' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">{row.icon}</div>
                        <span className="text-slate-400 text-sm">{row.label}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold text-sm">{row.value}</p>
                        <p className="text-green-400 text-xs">{row.delta}</p>
                      </div>
                    </div>
                  ))}

                  {/* Mini progress */}
                  <div className="pt-2">
                    <div className="flex justify-between text-xs text-slate-500 mb-2">
                      <span>Gesamtfortschritt</span>
                      <span className="text-white font-semibold">68%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full w-[68%] bg-gradient-to-r from-red-600 to-amber-500 rounded-full relative">
                        <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" style={{ animationDuration: '2s' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge cards */}
              <div className="absolute -top-4 -right-4 bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-2 animate-bounce" style={{ animationDuration: '3s' }}>
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-white text-xs font-semibold">+24% Effizienz</span>
              </div>

              <div className="absolute -bottom-4 -left-4 bg-red-600 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-2" style={{ animation: 'float 4s ease-in-out infinite 1.5s' }}>
                <Shield className="w-4 h-4 text-white" />
                <span className="text-white text-xs font-semibold">DSGVO-konform</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50">
          <span className="text-white text-xs uppercase tracking-widest">Scrollen</span>
          <div className="w-px h-10 bg-gradient-to-b from-white to-transparent" />
        </div>
      </section>

      {/* ── LOGO BAR ── */}
      <section className="bg-[#0a0a0a] border-y border-white/5 py-8" style={{ fontFamily: 'Barlow, sans-serif' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <p className="text-center text-slate-600 text-xs uppercase tracking-widest mb-8">Vertraut von Bauteams in ganz Europa</p>
          <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-14">
            {['Bau AG', 'Huber Bau', 'Wien Construct', 'Alpine Build', 'ProBau GmbH', 'StadtBau'].map((company) => (
              <div key={company} className="text-slate-600 font-bold text-sm tracking-wide hover:text-slate-400 transition-colors cursor-default flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {company}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-28 bg-white" style={{ fontFamily: 'Barlow, sans-serif' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <FadeIn>
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-full mb-6">
                <Zap className="w-4 h-4 text-red-600" />
                <span className="text-red-700 text-xs font-semibold uppercase tracking-widest">Plattform-Funktionen</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-5 tracking-tight" style={{ fontFamily: 'Arial, sans-serif' }}>
                Alles, was Ihr Team braucht –<br />
                <span className="text-red-600">nichts, was es nicht braucht.</span>
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                Speziell für die Baubranche entwickelt – von kleinen Handwerksbetrieben bis hin zu großen Projektentwicklern.
              </p>
            </div>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 80}>
                <FeatureCard {...f} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT SHOWCASE ── */}
      <section className="py-28 bg-[#101010] relative overflow-hidden" style={{ fontFamily: 'Barlow, sans-serif' }}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent" />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[100px]" />

        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-16 items-center relative z-10">
          {/* Left side – feature list */}
          <FadeIn>
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-600/10 border border-red-500/20 rounded-full mb-8">
                <Globe className="w-4 h-4 text-red-400" />
                <span className="text-red-400 text-xs font-semibold uppercase tracking-widest">Skalierbar entwickelt</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-6 leading-tight tracking-tight" style={{ fontFamily: 'Arial, sans-serif' }}>
                Eine Plattform.<br />
                <span className="text-red-500">Jede Baustelle.</span>
              </h2>
              <p className="text-slate-400 text-lg mb-10 leading-relaxed">
                Egal ob Sie 2 oder 200 Baustellen verwalten – unsere Plattform wächst mit Ihrem Unternehmen. Mehrere Rollen, Echtzeit-Synchronisation und Unternehmenssicherheit inklusive.
              </p>

              <div className="space-y-4">
                {[
                  { icon: <Shield className="w-5 h-5 text-red-400" />, text: 'Unternehmensgerechte Sicherheit mit rollenbasierter Zugriffskontrolle' },
                  { icon: <Zap className="w-5 h-5 text-amber-400" />, text: 'Echtzeit-Synchronisation auf allen Geräten – Handy, Tablet, Desktop' },
                  { icon: <Globe className="w-5 h-5 text-blue-400" />, text: 'Mehrsprachige Unterstützung für internationale Bauteams' },
                  { icon: <TrendingUp className="w-5 h-5 text-green-400" />, text: 'KI-gestützte Berichterstellung spart Stunden pro Woche' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                    <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center shrink-0">{item.icon}</div>
                    <p className="text-slate-300 text-sm leading-relaxed pt-1">{item.text}</p>
                  </div>
                ))}
              </div>

              <button
                id="lp-showcase-cta"
                onClick={() => navigate('/login')}
                className="mt-10 group px-8 py-4 bg-red-600 text-white font-bold rounded-2xl shadow-2xl shadow-red-600/30 hover:bg-red-500 hover:-translate-y-1 transition-all duration-200 flex items-center gap-2"
              >
                Plattform erkunden
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </FadeIn>

          {/* Right – Sites card mockup */}
          <FadeIn delay={120}>
            <div className="relative">
              <div className="absolute -inset-6 bg-gradient-to-br from-red-600/10 to-transparent rounded-3xl blur-2xl" />
              <div className="relative bg-[#1a1a1a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-red-500" />
                    <span className="text-white font-semibold text-sm">Aktive Baustellen</span>
                  </div>
                  <span className="text-xs text-slate-500 bg-white/5 px-3 py-1 rounded-full">Live</span>
                </div>
                {/* Sites list */}
                <div className="p-6 space-y-3">
                  {[
                    { name: 'Wien Mitte Tower', progress: 78, status: 'Im Plan', color: 'text-green-400', workers: 34 },
                    { name: 'Graz Süd Wohnbau', progress: 45, status: 'Im Plan', color: 'text-green-400', workers: 21 },
                    { name: 'Linz Brücke Phase 2', progress: 92, status: 'Abschlussphase', color: 'text-amber-400', workers: 12 },
                    { name: 'Salzburg Office Hub', progress: 18, status: 'Startphase', color: 'text-blue-400', workers: 8 },
                  ].map((site) => (
                    <div key={site.name} className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-red-500/20 transition-all group">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-white text-sm font-semibold">{site.name}</p>
                          <p className={`text-xs font-medium mt-0.5 ${site.color}`}>{site.status}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-400 text-xs">{site.workers} Arbeiter</p>
                          <p className="text-white text-sm font-bold">{site.progress}%</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-600 to-amber-500 rounded-full"
                          style={{ width: `${site.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── STATS ── */}
      <section id="stats" className="py-24 bg-gradient-to-b from-white to-slate-50" style={{ fontFamily: 'Barlow, sans-serif' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight" style={{ fontFamily: 'Arial, sans-serif' }}>
                Bewährte Ergebnisse in der gesamten Branche
              </h2>
              <p className="text-gray-500 text-lg">Echte Zahlen von echten Bauteams</p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { value: '2.400+', label: 'Aktive Projekte' },
              { value: '48.000+', label: 'Generierte Berichte' },
              { value: '12.000+', label: 'Verwaltete Mitarbeiter' },
              { value: '95%', label: 'Monatlich gesparte Stunden' },
            ].map((s, i) => (
              <FadeIn key={s.label} delay={i * 120}>
                <div className="bg-white rounded-3xl p-8 text-center shadow-xl shadow-slate-200/60 border border-slate-100 hover:border-red-200 hover:shadow-red-100/40 transition-all duration-300">
                  <div className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-red-600 to-red-800 mb-2 tabular-nums" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {s.value}
                  </div>
                  <p className="text-gray-500 text-sm font-medium">{s.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section id="benefits" className="py-28 bg-slate-50" style={{ fontFamily: 'Barlow, sans-serif' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-20 items-center">
          {/* Left visual */}
          <FadeIn>
            <div className="relative">
              {/* Background card */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-[#101010] rounded-3xl transform -rotate-3 opacity-20" />
              <div className="relative bg-[#101010] rounded-3xl p-8 shadow-2xl border border-white/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-red-600 shadow-md shadow-red-600/40 flex items-center justify-center">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
                    ) : (
                      <HardHat className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">BM Construction Suite</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />)}
                      <span className="text-slate-500 text-xs ml-1">5.0</span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-4">
                  {[
                    { time: '08:00', event: 'Tagesbericht eingereicht', type: 'success' },
                    { time: '09:15', event: 'Neuer Mitarbeiter Baustelle B zugewiesen', type: 'info' },
                    { time: '10:30', event: 'Urlaubsantrag genehmigt', type: 'success' },
                    { time: '11:45', event: 'Wöchentliches PDF exportiert & gesendet', type: 'primary' },
                    { time: '13:00', event: 'Meilenstein erreicht: 75%', type: 'warn' },
                  ].map((ev) => (
                    <div key={ev.time} className="flex items-start gap-4">
                      <span className="text-slate-500 text-xs w-12 shrink-0 pt-0.5">{ev.time}</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          ev.type === 'success' ? 'bg-green-400' :
                          ev.type === 'primary' ? 'bg-red-500' :
                          ev.type === 'warn' ? 'bg-amber-400' : 'bg-blue-400'
                        }`} />
                        <p className="text-slate-300 text-xs leading-relaxed">{ev.event}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom stat bar */}
                <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-3 gap-4">
                  {[
                    { label: 'Berichte', value: '12' },
                    { label: 'Baustellen', value: '4' },
                    { label: 'Arbeiter', value: '68' },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-white font-extrabold text-xl">{s.value}</p>
                      <p className="text-slate-500 text-xs">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Right copy + benefits list */}
          <FadeIn delay={100}>
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-full mb-8">
                <CheckCircle2 className="w-4 h-4 text-red-600" />
                <span className="text-red-700 text-xs font-semibold uppercase tracking-widest">Warum Teams uns wählen</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight leading-tight" style={{ fontFamily: 'Arial, sans-serif' }}>
                Schluss mit dem<br />
                <span className="text-red-600">Papierchaos.</span>
              </h2>
              <p className="text-gray-500 text-lg mb-10 leading-relaxed">
                Unsere Plattform ersetzt Tabellenkalkulationen, Papierformulare und verstreute WhatsApp-Nachrichten durch eine einzige verlässliche Informationsquelle für Ihren gesamten Baubetrieb.
              </p>

              <ul className="space-y-4">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-4 group">
                    <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center shrink-0 shadow-lg shadow-red-600/30 mt-0.5 group-hover:scale-110 transition-transform">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-700 text-base leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>

              <button
                id="lp-benefits-cta"
                onClick={() => navigate('/login')}
                className="mt-10 group px-8 py-4 bg-[#101010] text-white font-bold rounded-2xl hover:bg-[#1a1a1a] transition-all duration-200 flex items-center gap-2 text-sm shadow-xl"
              >
                Plattform in Aktion erleben
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className="py-28 bg-white" style={{ fontFamily: 'Barlow, sans-serif' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <FadeIn>
            <div className="text-center mb-20">
              <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-5 tracking-tight" style={{ fontFamily: 'Arial, sans-serif' }}>
                Geliebt von Bauprofis
              </h2>
              <p className="text-gray-500 text-lg">Überzeugen Sie sich selbst</p>
            </div>
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <FadeIn key={t.name} delay={i * 100}>
                <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:border-red-200 hover:shadow-xl hover:shadow-red-50 transition-all duration-300 group relative">
                  {/* Quote mark */}
                  <div className="text-red-100 text-7xl font-serif leading-none absolute top-6 right-6 select-none group-hover:text-red-200 transition-colors">"</div>

                  <div className="flex gap-1 mb-4">
                    {[...Array(t.stars)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed mb-6 relative z-10">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-gray-900 font-semibold text-sm">{t.name}</p>
                      <p className="text-gray-400 text-xs">{t.role}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="py-28 bg-[#101010] relative overflow-hidden" style={{ fontFamily: 'Barlow, sans-serif' }}>
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(255,0,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,0,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-red-600/15 rounded-full blur-[80px]" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-10 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-600/10 border border-red-500/20 rounded-full mb-8">
              <HardHat className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-xs font-semibold uppercase tracking-widest">Bereit, klüger zu bauen?</span>
            </div>

            <h2 className="text-4xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight" style={{ fontFamily: 'Arial, sans-serif' }}>
              Verwalten Sie Ihre Baustellen<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-400">
                ab heute wie ein Profi.
              </span>
            </h2>

            <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
              Schließen Sie sich Tausenden von Bauprofis an, die ihren Betrieb bereits digitalisiert haben. Die Einrichtung dauert weniger als 5 Minuten.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                id="lp-final-cta"
                onClick={() => navigate('/login')}
                className="group px-10 py-5 bg-red-600 text-white font-bold rounded-2xl shadow-2xl shadow-red-600/30 hover:bg-red-500 hover:shadow-red-500/40 hover:-translate-y-1 transition-all duration-200 flex items-center justify-center gap-3 text-base"
              >
                <HardHat className="w-5 h-5" />
                Zur Plattform
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <p className="text-slate-600 text-sm mt-6">Keine Kreditkarte erforderlich · DSGVO-konform · Jederzeit kündbar</p>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0a0a0a] border-t border-white/5 py-12" style={{ fontFamily: 'Barlow, sans-serif' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-red-600 shadow-md shadow-red-600/40 flex items-center justify-center">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
              ) : (
                <HardHat className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <p className="text-white font-bold text-sm">Construction Management Suite</p>
              <p className="text-slate-600 text-xs">Von der Branche, für die Branche.</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {['Datenschutz', 'AGB', 'Kontakt', 'Support'].map((l) => (
              <a key={l} href="#" className="text-slate-600 hover:text-slate-400 text-sm transition-colors">{l}</a>
            ))}
          </div>

          <p className="text-slate-700 text-xs text-center md:text-right">
            © 2026 BM Construction Suite. Alle Rechte vorbehalten.
          </p>
        </div>
      </footer>

      {/* Global keyframe for float */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FadeIn wrapper
   ───────────────────────────────────────────── */
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      style={{
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Feature card
   ───────────────────────────────────────────── */
function FeatureCard({
  icon,
  title,
  desc,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <div className="group bg-white border border-slate-100 rounded-3xl p-7 hover:border-red-200 hover:shadow-2xl hover:shadow-red-50 transition-all duration-300 cursor-default">
      <div className={`w-12 h-12 bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center text-white mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>
      <h3 className="text-gray-900 font-bold text-lg mb-2 tracking-tight" style={{ fontFamily: 'Arial, sans-serif' }}>{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
