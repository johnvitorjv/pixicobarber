import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, Menu, X, Phone, MapPin } from 'lucide-react';
import serviceStore from './stores/serviceStore';
import { isSupabaseConfigured } from './lib/supabase';
import { useSupabaseServices } from './hooks/useSupabase';
import { useStoreSync } from './hooks/useStore';
import InstallPrompt from './components/InstallPrompt';

function formatPreco(v) { return `R$ ${Number(v || 0).toFixed(0)}`; }

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════
   PIXICO BARBER — Barbearia Premium em Salvador
   ═══════════════════════════════════════════════════ */

const IMAGES = {
  hero: "/hero_bg.png",
  sobre: "/pixico_owner_about.png",
  galeria: [
    "/galeria/1.jpg",
    "/galeria/2.jpg",
    "/galeria/3.jpg",
    "/galeria/4.jpg",
    "/galeria/5.jpg",
  ],
};

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Sobre', href: '#sobre' },
  { label: 'Serviços', href: '#servicos' },
  { label: 'Galeria', href: '#galeria' },
  { label: 'Contato', href: '#contato' },
];

// Variantes visuais para cards do home (cicla entre light, dark, accent)
const CARD_VARIANTS = ['light', 'dark', 'accent'];
const CARD_LABELS = { corte: 'Precisão', barba: 'Definição', combo: 'Completo', complemento: 'Detalhe', tratamento: 'Premium' };
const CARD_FALLBACK_IMGS = ['/galeria/1.jpg', '/galeria/4.jpg', '/galeria/5.jpg'];

function getCardsServicos(servicos) {
  return servicos.slice(0, 3).map((s, i) => ({
    ref: `PX-${String(i + 1).padStart(2, '0')}`,
    num: String(i + 1).padStart(2, '0'),
    label: CARD_LABELS[s.categoria] || s.categoria,
    title: s.nome,
    description: s.descricaoDetalhada || s.descricaoCurta || s.nome,
    preco: s.precoPromocional || s.preco,
    variant: CARD_VARIANTS[i % CARD_VARIANTS.length],
    imagem: s.imagemUrl || CARD_FALLBACK_IMGS[i % CARD_FALLBACK_IMGS.length],
  }));
}

/* ─────────────────────────────────────────────────
   NAVBAR
   ───────────────────────────────────────────────── */
function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(navRef.current, {
        y: -40, opacity: 0, duration: 1.2, ease: 'power3.out', delay: 0.5,
      });
    }, navRef);
    return () => ctx.revert();
  }, []);

  return (
    <nav ref={navRef} className="fixed top-0 left-0 w-full z-[100]" style={{ mixBlendMode: 'difference', pointerEvents: 'none' }}>
      <div className="max-w-[1920px] mx-auto flex items-center justify-between p-6 md:p-10">
        <a href="#home" className="flex items-center" style={{ pointerEvents: 'auto' }}>
          <span className="font-display font-bold text-3xl tracking-tighter uppercase">Pixico</span>
        </a>

        <div className="hidden lg:flex items-center gap-12 text-[9px] font-bold uppercase tracking-[0.6em]" style={{ pointerEvents: 'auto' }}>
          {NAV_LINKS.map(link => (
            <a key={link.label} href={link.href} className="hover:text-primary transition-all duration-500 relative group">
              {link.label}
              <span className="absolute -bottom-2 left-0 w-0 h-[1px] bg-primary group-hover:w-full transition-all duration-500" />
            </a>
          ))}
        </div>

        <Link
          to="/agendar"
          className="hidden lg:block relative overflow-hidden bg-white text-black px-10 py-4 text-[10px] font-bold uppercase tracking-widest group"
          style={{ pointerEvents: 'auto' }}
        >
          <span className="relative z-10 group-hover:text-white transition-colors duration-500">Agendar</span>
          <div className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]" />
        </Link>

        <button className="lg:hidden" style={{ mixBlendMode: 'normal', position: 'relative', zIndex: 110, pointerEvents: 'auto' }} onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden fixed inset-0 bg-black/98 backdrop-blur-xl flex flex-col items-center justify-center gap-10 transition-all duration-700 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ mixBlendMode: 'normal', zIndex: 105 }}
      >
        {NAV_LINKS.map(link => (
          <a key={link.label} href={link.href} className="text-3xl font-display font-bold uppercase tracking-wider text-white hover:text-primary transition-colors" onClick={() => setMobileOpen(false)}>
            {link.label}
          </a>
        ))}
        <Link to="/agendar" className="mt-8 bg-primary text-black px-12 py-5 text-sm font-bold uppercase tracking-widest" onClick={() => setMobileOpen(false)}>
          Agendar
        </Link>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────────
   HERO
   ───────────────────────────────────────────────── */
function HeroSection() {
  const heroRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.hero-coords', { y: 30, opacity: 0, duration: 0.8, delay: 0.8 })
        .from('.hero-title-anim', { y: 60, opacity: 0, duration: 1.2, stagger: 0.08 }, '-=0.4')
        .from('.hero-desc', { y: 30, opacity: 0, duration: 0.8 }, '-=0.6')
        .from('.hero-cta', { y: 20, opacity: 0, duration: 0.6 }, '-=0.4')
        .from('.hero-line', { scaleX: 0, duration: 0.8 }, '-=0.8');
    }, heroRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={heroRef} id="home" className="relative h-screen w-full flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] right-[-5%] w-1/2 h-full bg-zinc-900/40 clip-diagonal -rotate-12 scale-110" />
        <div className="absolute bottom-[-10%] left-[-5%] w-1/3 h-1/2 border border-white/5 clip-abstract rotate-45" />
        <img className="w-full h-full object-cover grayscale opacity-40 mix-blend-luminosity scale-110" src={IMAGES.hero} alt="Pixico Barber" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-transparent to-transparent" />
      </div>

      <div className="relative z-10 w-full px-6 md:px-12 flex flex-col items-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center pointer-events-none">
          <span className="text-outline font-display font-bold opacity-10 text-[20vw] leading-none tracking-tighter uppercase whitespace-nowrap">PIXICO</span>
        </div>

        <div className="max-w-7xl w-full">
          <div className="hero-coords flex flex-col md:flex-row items-end justify-between mb-12">
            <span className="font-modern text-primary text-[10px] uppercase tracking-[1em] mb-4 md:mb-0 block">Salvador — Itacaranha</span>
            <div className="hero-line w-32 h-[1px] bg-primary/30 origin-left" />
          </div>

          <h1 className="hero-title font-display font-bold uppercase tracking-tightest perspective-text">
            <span className="hero-title-anim inline-block">PIXICO</span>
            <br />
            <span className="hero-title-anim inline-block relative">
              BARBER
              <span className="absolute -right-4 top-0 text-[1rem] font-modern font-light tracking-normal text-white/40 rotate-90">001</span>
            </span>
          </h1>

          <div className="mt-20 flex flex-col md:flex-row items-start md:items-end gap-12 max-w-4xl">
            <div className="hero-desc relative">
              <div className="absolute -left-6 top-0 w-[2px] h-full bg-primary" />
              <p className="text-lg md:text-xl text-white font-modern font-light leading-tight tracking-tight max-w-lg">
                Transformando a barbearia tradicional em uma experiência visual marcante. Aqui, cada detalhe importa, cada corte comunica presença e cada atendimento valoriza seu estilo.
              </p>
            </div>
            <div className="hero-cta flex flex-col sm:flex-row gap-4">
              <Link to="/agendar" className="group relative flex items-center gap-6 px-10 py-6 bg-primary text-black hover:scale-[1.03] transition-all duration-500 shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-[0.5em]">Agendar</span>
                <ArrowUpRight className="group-hover:rotate-45 transition-transform duration-500" size={20} />
              </Link>
              <a href="#servicos" className="group relative flex items-center gap-6 px-10 py-6 border border-white/20 hover:border-primary bg-white/5 backdrop-blur-sm transition-all duration-700 hover:scale-[1.03] shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-[0.5em]">Ver serviços</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────
   SOBRE
   ───────────────────────────────────────────────── */
function SobreSection() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.phil-image', {
        x: -80, opacity: 0, duration: 1.2, ease: 'power3.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', toggleActions: 'play none none none' },
      });
      gsap.from('.phil-heading span', {
        y: 60, opacity: 0, stagger: 0.08, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: '.phil-heading', start: 'top 80%', toggleActions: 'play none none none' },
      });
      gsap.from('.phil-text', {
        y: 30, opacity: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: '.phil-text', start: 'top 85%', toggleActions: 'play none none none' },
      });
      gsap.from('.phil-stat', {
        y: 40, opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: '.phil-stat', start: 'top 85%', toggleActions: 'play none none none' },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-32 md:py-48 bg-background-dark overflow-hidden" id="sobre">
      <div className="absolute left-0 top-1/4 w-full h-px bg-white/5 -rotate-6" />
      <div className="absolute left-0 top-1/3 w-full h-px bg-white/5 -rotate-6" />

      <div className="max-w-[1600px] mx-auto px-6 md:px-8">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div className="phil-image relative group">
            <div className="absolute inset-0 bg-primary/20 translate-x-4 translate-y-4 group-hover:translate-x-8 group-hover:translate-y-8 transition-transform duration-700 clip-diagonal" />
            <div className="relative aspect-[4/5] overflow-hidden clip-diagonal border border-white/10">
              <img className="w-full h-full object-cover grayscale brightness-90 transition-all duration-1000 scale-100 group-hover:scale-110 group-hover:rotate-2" src={IMAGES.sobre} alt="Pixico Barber - Sobre" loading="lazy" />
            </div>
            <div className="absolute -bottom-12 -left-12 vertical-text font-display text-7xl font-bold opacity-5 pointer-events-none hidden lg:block">PRESENÇA</div>
          </div>

          <div className="relative">
            <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-12 block">Sobre / Quem Somos</span>

            <h2 className="phil-heading text-5xl md:text-6xl lg:text-8xl font-display font-bold uppercase leading-[0.8] mb-12 tracking-tightest">
              <span className="inline-block">Precisão </span><br />
              <span className="inline-block text-outline">é nossa</span> <br />
              <span className="inline-block">linguagem.</span>
            </h2>

            <div className="grid md:grid-cols-2 gap-12 lg:gap-16 mt-16 lg:mt-20">
              <div className="phil-text space-y-6">
                <p className="text-zinc-400 font-modern text-lg leading-relaxed">
                  A Pixico Barber nasceu com o propósito de elevar a experiência de quem valoriza presença, cuidado e identidade. Mais do que um corte, entregamos atenção aos detalhes, acabamento preciso e um atendimento que respeita o seu estilo.
                </p>
                <p className="text-zinc-500 font-modern text-base leading-relaxed">
                  Em Salvador, construímos uma proposta visual forte, atual e alinhada com quem busca resultado de verdade.
                </p>
                <div className="h-1 w-12 bg-primary" />
              </div>

              <div className="flex flex-col justify-end gap-12">
                <Link to="/admin" className="phil-stat flex items-baseline gap-4 group cursor-pointer" title="Área administrativa">
                  <span className="text-6xl font-display font-bold group-hover:text-primary transition-colors duration-500">12</span>
                  <span className="text-[9px] uppercase tracking-[0.4em] text-zinc-500 group-hover:text-primary/60 transition-colors duration-500">Anos de<br />experiência</span>
                </Link>
                <div className="phil-stat flex items-baseline gap-4">
                  <span className="text-6xl font-display font-bold">5K+</span>
                  <span className="text-[9px] uppercase tracking-[0.4em] text-zinc-500">Clientes<br />atendidos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────
   CARD DE SERVIÇO
   ───────────────────────────────────────────────── */
function ServiceCard({ service, index }) {
  const cardRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const variants = {
    light: {
      container: 'bg-white text-black hover:bg-zinc-100',
      arrow: 'border-white/10 group-hover:bg-primary group-hover:text-black',
      border: 'border-t border-black/10',
      descColor: 'text-zinc-600',
    },
    dark: {
      container: 'bg-zinc-900 text-white hover:bg-zinc-800 border border-white/10',
      arrow: 'border-white/10 group-hover:bg-primary group-hover:text-black',
      border: 'border-t border-white/10',
      descColor: 'text-zinc-400',
    },
    accent: {
      container: 'bg-primary text-black',
      arrow: 'border-black/20 bg-black text-white',
      border: 'border-t border-black/20',
      descColor: 'opacity-80',
    },
  };
  const v = variants[service.variant];
  const yOffset = index === 0 ? 'translate-y-6 md:translate-y-12' : index === 2 ? '-translate-y-6 md:-translate-y-12' : '';
  const delay = `${index * 150}ms`;

  return (
    <div
      ref={cardRef}
      style={{ transitionDelay: visible ? delay : '0ms' }}
      className={`service-card group relative ${v.container} p-0 aspect-auto md:aspect-[4/5] flex flex-col justify-between ${yOffset} z-20 overflow-hidden transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0 hover:-translate-y-4' : 'opacity-0 translate-y-16'
        }`}
    >
      {/* Imagem estilo Sobre — grayscale to color on hover */}
      {service.imagem && (
        <div className="relative w-full aspect-[4/3] overflow-hidden">
          <div className="absolute inset-0 bg-primary/10 translate-x-2 translate-y-2 group-hover:translate-x-4 group-hover:translate-y-4 transition-transform duration-700 z-0" />
          <img
            className="relative z-10 w-full h-full object-cover grayscale brightness-75 transition-all duration-1000 scale-100 group-hover:scale-110 group-hover:grayscale-0 group-hover:brightness-100 group-hover:rotate-1"
            src={service.imagem}
            alt={service.title}
            loading="lazy"
          />
        </div>
      )}
      <div className="absolute top-0 right-0 p-4 font-modern text-[10px] opacity-20 z-20">REF: {service.ref}</div>
      <div className="p-8 md:p-10 flex-1 flex flex-col justify-between relative z-10">
        <div>
          <span className="text-[9px] font-bold tracking-[0.5em] uppercase opacity-40 mb-6 block">{service.num} / {service.label}</span>
          <h3 className="text-2xl md:text-3xl font-display font-bold uppercase mb-4 leading-tight whitespace-pre-line">{service.title}</h3>
          <p className={`text-sm font-modern leading-relaxed ${v.descColor}`}>{service.description}</p>
        </div>
        <div className={`flex items-end justify-between ${v.border} pt-6 mt-6`}>
          <span className="text-2xl md:text-3xl font-display font-bold">{formatPreco(service.preco)}</span>
          <Link to="/agendar" className={`w-10 h-10 flex items-center justify-center border ${v.arrow} transition-all`}>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   SEÇÃO SERVIÇOS
   ───────────────────────────────────────────────── */
function ServicosSection() {
  const sectionRef = useRef(null);
  const sb = isSupabaseConfigured();
  const { services: sbServices, getVisiveis } = useSupabaseServices();

  // Fonte de verdade: Supabase (se configurado) ou localStorage
  const servicosVisiveis = sb ? getVisiveis('home') : serviceStore.getVisiveis('home');
  const cards = getCardsServicos(servicosVisiveis);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.menu-title', {
        y: 80, opacity: 0, duration: 1.2, ease: 'power3.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', toggleActions: 'play none none none' },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-black py-24 md:py-40 px-6 md:px-8 relative overflow-hidden" id="servicos">
      <div className="absolute right-0 top-0 w-1/3 h-full bg-primary/5 clip-shard z-0" />
      <div className="max-w-[1600px] mx-auto relative z-10">
        <div className="flex flex-col md:flex-row items-baseline justify-between mb-20 md:mb-32 border-b border-white/10 pb-12">
          <h2 className="menu-title text-6xl md:text-8xl lg:text-[12rem] font-display font-bold uppercase leading-none tracking-tightest perspective-text">
            SER<br />VIÇOS
          </h2>
          <div className="max-w-xs text-right mt-8 md:mt-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-500 leading-relaxed">
              Atendimento pensado para quem valoriza acabamento, presença e estilo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0">
          {cards.map((service, i) => (
            <ServiceCard key={service.ref} service={service} index={i} />
          ))}
        </div>

        {/* Link para ver todos */}
        <div className="mt-16 text-center">
          <Link to="/agendar" className="inline-flex items-center gap-3 text-primary font-modern text-sm hover:underline group">
            Ver todos os serviços e agendar
            <ArrowUpRight size={16} className="group-hover:rotate-45 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────
   GALERIA
   ───────────────────────────────────────────────── */
function GaleriaSection() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const mm = gsap.matchMedia();

    const ctx = gsap.context(() => {
      gsap.from('.gallery-item', {
        y: 40, opacity: 0, stagger: 0.1, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', toggleActions: 'play none none none' },
      });

      mm.add("(max-width: 767px)", () => {
        gsap.utils.toArray('.gallery-item').forEach(item => {
          ScrollTrigger.create({
            trigger: item,
            start: 'top 65%',
            end: 'bottom 35%',
            toggleClass: { targets: item, className: 'is-revealed' }
          });
        });
      });
    }, sectionRef);

    return () => {
      ctx.revert();
      mm.revert();
    };
  }, []);

  const clipClasses = ['clip-shard', 'clip-diagonal', '', 'clip-abstract', ''];

  return (
    <section ref={sectionRef} className="py-20 bg-background-dark" id="galeria">
      <div className="max-w-[1600px] mx-auto px-6 md:px-8 mb-12">
        <span className="text-[10px] font-bold uppercase tracking-[1em] text-primary mb-4 block">Resultados</span>
        <h2 className="text-4xl md:text-6xl font-display font-bold uppercase tracking-tightest">Galeria</h2>
        <p className="text-zinc-500 font-modern mt-4 max-w-lg">Cada corte é pensado para valorizar seu visual, sua presença e sua identidade.</p>
      </div>
      <div className="max-w-full mx-auto px-4 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {IMAGES.galeria.map((src, i) => (
            <div key={i} className={`gallery-item ${i === 0 ? 'aspect-[2/3]' : i === 1 ? 'aspect-square md:col-span-2' : i === 2 ? 'aspect-video' : i === 3 ? 'aspect-square' : 'aspect-[3/4]'
              } overflow-hidden ${clipClasses[i] || ''} group`}>
              <img className="w-full h-full object-cover grayscale brightness-50 md:group-hover:brightness-100 md:group-hover:grayscale-0 md:group-hover:scale-110 group-[.is-revealed]:brightness-100 group-[.is-revealed]:grayscale-0 group-[.is-revealed]:scale-110 transition-all duration-1000" src={src} alt={`Pixico Galeria ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────
   CONTATO
   ───────────────────────────────────────────────── */
function ContatoSection() {
  const sectionRef = useRef(null);
  const whatsappLink = "https://wa.me/5571994096863?text=Ol%C3%A1!%20Quero%20agendar%20um%20hor%C3%A1rio%20na%20Pixico%20Barber.";

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.contact-address', {
        x: -60, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', toggleActions: 'play none none none' },
      });
      gsap.from('.contact-cta', {
        x: 60, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: '.contact-cta', start: 'top 75%', toggleActions: 'play none none none' },
      });
      gsap.from('.contact-info a', {
        y: 20, opacity: 0, stagger: 0.1, duration: 0.6, ease: 'power3.out',
        scrollTrigger: { trigger: '.contact-info', start: 'top 85%', toggleActions: 'play none none none' },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-32 md:py-48 px-6 md:px-8 lg:px-24 bg-black relative" id="contato">
      <div className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-full bg-gradient-to-b from-primary/50 to-transparent hidden lg:block" />

      <div className="max-w-[1400px] mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-32">
          <div className="contact-address space-y-16 md:space-y-24">
            <div>
              <h4 className="text-[9px] font-bold uppercase tracking-[1em] text-primary mb-12">Localização</h4>
              <p className="text-3xl md:text-4xl lg:text-6xl font-display font-bold uppercase leading-tight tracking-tightest">
                R. Ten. Aragão,<br />121 — Itacaranha<br />Salvador — BA
              </p>
            </div>

            <div className="contact-info grid grid-cols-2 gap-12 pt-12 border-t border-white/10">
              <div>
                <h4 className="text-[9px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-6">Contato</h4>
                <div className="flex flex-col gap-3 font-modern text-lg">
                  <a className="hover:text-primary transition-colors underline decoration-primary/30" href="https://wa.me/5571994096863" target="_blank" rel="noopener">
                    (71) 99409-6863
                  </a>
                </div>
              </div>
              <div>
                <h4 className="text-[9px] font-bold uppercase tracking-[0.5em] text-zinc-500 mb-6">Social</h4>
                <div className="flex flex-col gap-3 font-modern text-lg">
                  <a className="hover:text-primary transition-colors underline decoration-primary/30" href="https://www.instagram.com/pixicobarber02/" target="_blank" rel="noopener">
                    @pixicobarber02
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="contact-cta relative bg-zinc-900 p-8 md:p-12 lg:p-20 clip-diagonal border border-white/5">
            <h4 className="text-[9px] font-bold uppercase tracking-[1em] text-primary mb-12">Agendamento</h4>
            <h2 className="text-4xl md:text-5xl lg:text-7xl font-display font-bold uppercase leading-none mb-10">
              Pronto pra<br />evoluir?
            </h2>
            <p className="text-zinc-400 font-modern text-lg mb-8 max-w-sm">
              Reserve seu horário pelo nosso sistema online. Vagas limitadas para garantir atendimento de qualidade.
            </p>
            <div className="flex flex-col gap-4">
              <Link
                to="/agendar"
                className="w-full group relative overflow-hidden bg-primary text-black py-7 md:py-8 font-display font-bold uppercase tracking-[0.5em] text-xs text-center hover:scale-[1.02] transition-transform"
              >
                <span className="relative z-10 group-hover:text-white transition-colors duration-500">Agendar pelo Site</span>
                <div className="absolute inset-0 bg-black translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              </Link>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full group relative overflow-hidden bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] py-7 md:py-8 font-display font-bold uppercase tracking-[0.5em] text-xs text-center hover:bg-[#25D366] hover:text-white transition-all duration-500 hover:scale-[1.02]"
              >
                <span className="relative z-10">Falar pelo WhatsApp</span>
              </a>
            </div>
            <p className="text-zinc-600 font-modern text-[10px] mt-4 tracking-wide">
              Agendamentos são realizados pelo site. Use o WhatsApp para dúvidas e suporte.
            </p>

            <div className="absolute bottom-4 md:bottom-6 right-4 md:right-6 flex items-center gap-2 opacity-30">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse-dot" />
              <span className="text-[8px] font-modern uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────
   RODAPÉ
   ───────────────────────────────────────────────── */
function Rodape() {
  return (
    <footer className="py-12 px-6 md:px-8 bg-black border-t border-white/5 overflow-hidden">
      <div className="max-w-[1600px] mx-auto">
        {/* Top Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12 pb-12 border-b border-white/5">
          {/* Brand */}
          <div className="md:col-span-2">
            <span className="font-display font-bold text-2xl uppercase tracking-tighter block mb-4">Pixico</span>
            <p className="text-zinc-500 font-modern text-sm max-w-sm">
              Pixico Barber — estilo, precisão e presença em cada detalhe.
            </p>
          </div>

          {/* Nav */}
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-[0.5em] text-zinc-600 mb-4">Navegação</h4>
            <div className="flex flex-col gap-2">
              {NAV_LINKS.map(link => (
                <a key={link.label} href={link.href} className="text-zinc-500 hover:text-primary transition-colors font-modern text-sm">
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Contato */}
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-[0.5em] text-zinc-600 mb-4">Contato</h4>
            <div className="flex flex-col gap-2 font-modern text-sm text-zinc-500">
              <a href="https://wa.me/5571994096863" target="_blank" rel="noopener" className="hover:text-primary transition-colors">
                WhatsApp: (71) 99409-6863
              </a>
              <a href="https://www.instagram.com/pixicobarber02/" target="_blank" rel="noopener" className="hover:text-primary transition-colors">
                @pixicobarber02
              </a>
              <span className="text-zinc-600">
                R. Ten. Aragão, 121<br />Itacaranha, Salvador - BA
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <span className="text-[9px] font-bold uppercase tracking-[0.5em] text-zinc-700">
            © 2026 Pixico Barber. Todos os direitos reservados.
          </span>
          <div className="relative">
            <span className="text-outline font-display text-3xl md:text-4xl opacity-10 tracking-[1em]">PIXICO</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────
   APP
   ───────────────────────────────────────────────── */
export default function App() {
  useEffect(() => {
    ScrollTrigger.refresh();
  }, []);

  return (
    <div className="font-sans antialiased">
      <Navbar />
      <HeroSection />
      <SobreSection />
      <ServicosSection />
      <GaleriaSection />
      <ContatoSection />
      <Rodape />
      <InstallPrompt />
    </div>
  );
}
