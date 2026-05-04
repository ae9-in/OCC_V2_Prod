"use client";

import React, { useEffect } from "react";
import { Link } from "@/lib/router-compat";
import { motion, AnimatePresence } from "motion/react";
import { useMusicVideoFrames } from "../../../hooks/useMusicVideoFrames";
import { FC } from "./MusicConstants";
import { MusicScrollSection } from "./MusicScrollSection";

/* -- Loading Screen -- */
function MusicLoadingScreen({ progress, loaded }: { progress: number; loaded: boolean }) {
  return (
    <AnimatePresence>
      {!loaded && (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
          style={{ background: FC.bg }}
          exit={{ opacity: 0, filter: "blur(12px)" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="mb-8 text-6xl"
          >
            MU
          </motion.div>
          <h1 className="font-headline mb-8 text-2xl tracking-[0.4em] md:text-3xl" style={{ color: FC.text }}>
            SYNCING MUSIC CLUB
          </h1>
          <div className="w-72">
            <div className="h-px w-full" style={{ background: "#1a1a1a" }}>
              <div
                className="h-full transition-all duration-75"
                style={{ width: `${progress * 100}%`, background: FC.accent }}
              />
            </div>
            <p className="mt-3 text-center text-xs tracking-[0.3em]" style={{ color: FC.muted }}>
              {Math.round(progress * 100)}%
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -- Custom Cursor -- */
function MusicCursor() {
  const dotRef = React.useRef<HTMLDivElement>(null);
  const ringRef = React.useRef<HTMLDivElement>(null);
  const mouse = React.useRef({ x: 0, y: 0 });
  const ring = React.useRef({ x: 0, y: 0 });
  const hover = React.useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      hover.current = !!(t.closest("a") || t.closest("button") || t.closest("[role=button]"));
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);
    let raf = 0;
    const loop = () => {
      ring.current.x += (mouse.current.x - ring.current.x) * 0.12;
      ring.current.y += (mouse.current.y - ring.current.y) * 0.12;
      if (dotRef.current)
        dotRef.current.style.transform = `translate(${mouse.current.x - 6}px, ${mouse.current.y - 6}px)`;
      const rs = hover.current ? 60 : 40;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ring.current.x - rs / 2}px, ${ring.current.y - rs / 2}px)`;
        ringRef.current.style.width = `${rs}px`;
        ringRef.current.style.height = `${rs}px`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseover", onOver); };
  }, []);

  return (
    <>
      <div ref={dotRef} className="pointer-events-none fixed top-0 left-0 z-[9999] hidden h-3 w-3 rounded-full mix-blend-difference md:block" style={{ background: "#FFFFFF" }} />
      <div ref={ringRef} className="pointer-events-none fixed top-0 left-0 z-[9998] hidden rounded-full border mix-blend-difference transition-[width,height] duration-200 md:block" style={{ borderColor: "#FFFFFF" }} />
    </>
  );
}

/* -- Grain Overlay -- */
function GrainOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[9997] opacity-[0.022]">
      <svg className="h-[200%] w-[200%] animate-grain">
        <filter id="fg"><feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="3" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#fg)" />
      </svg>
    </div>
  );
}

/* -- Post -- */
const P = {
  bg: "#060606", card: "#111111", elevated: "#1A1A1A",
  border: "rgba(255,255,255,0.08)", borderHover: "rgba(139,92,246,0.35)",
  text: "#FFFFFF", muted: "#888888", dim: "#333333",
  accent: "#8B5CF6",
} as const;

/* -- Open Mic Masonry Section -- */
const B = {
  bg: "#08080C", // Deep Navy-Black
  card: "rgba(18, 18, 24, 0.4)",
  border: "rgba(255, 255, 255, 0.05)",
  accent: "#8B5CF6", // Electric Purple
  muted: "rgba(255, 255, 255, 0.4)",
};

const MicIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
);
const StudioIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M10 9a3 3 0 1 0 0 6"/><path d="M14 15a3 3 0 1 0 0-6"/></svg>
);
const GuitarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="m18 12-4 10H6L2 12V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8Z"/><path d="M2 8h20"/><path d="M6 12v10"/><path d="M18 12v10"/></svg>
);
const HeadphonesIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>
);
const VinylIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 12h.01"/></svg>
);
const ConnectIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
);

function OpenMicExperienceSection({ userId }: { userId?: string | null }) {
  const cards = [
    { 
      icon: <MicIcon />, 
      title: "Open Mic Nights", 
      desc: "Every Tuesday. Any genre. Any level. Just bring your voice.",
      height: "mid",
      image: "/music/live.png"
    },
    { 
      icon: <StudioIcon />, 
      title: "Studio Sessions", 
      desc: "Book 2-hour slots in the OCC recording studio with industry-grade hardware.",
      height: "tall",
      image: "/music/studio.png"
    },
    { 
      icon: <GuitarIcon />, 
      title: "Live Gig Opportunities", 
      desc: "Members get booked for high-level campus events and city festivals.",
      height: "short",
    },
    { 
      icon: <HeadphonesIcon />, 
      title: "Music Theory Labs", 
      desc: "Master the foundation of harmony, sound design, and modern production.",
      height: "short",
    },
    { 
      icon: <VinylIcon />, 
      title: "Listening Circles", 
      desc: "Curated analysis of the albums that defined generations.",
      height: "mid",
      image: "/music/studio.png" // Changed to diversify
    },
    { 
      icon: <ConnectIcon />, 
      title: "Collaboration Boards", 
      desc: "Find your band, your producer, or your muse across 50 campuses.",
      height: "short",
    },
  ];

  return (
    <section className="relative w-full overflow-hidden" style={{ background: B.bg }}>
      {/* -- Background Glow Overlay -- */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[60rem] h-[60rem] bg-violet-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] bg-indigo-600/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 mx-auto max-w-[84rem] px-6 py-24 md:px-12 md:py-32">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
          <motion.div
             initial={{ opacity: 0, x: -20 }}
             whileInView={{ opacity: 1, x: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
             className="max-w-2xl"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.6em] text-violet-400 mb-6 block">Vibe Check</span>
            <h2 className="text-[clamp(2.4rem,6vw,4.5rem)] font-black leading-[0.9] tracking-tight uppercase" style={{ color: "white", fontFamily: "'Bebas Neue', 'Impact', sans-serif" }}>
              The Open Mic <span className="text-violet-500">Experience</span>
            </h2>
            <p className="mt-8 text-lg leading-relaxed max-w-xl" style={{ color: B.muted }}>
              Our stage is your playground. From basement beats to festival spotlights, we build the bridge between passion and performance.
            </p>
          </motion.div>
          <motion.div
             initial={{ opacity: 0, scale: 0.95 }}
             whileInView={{ opacity: 1, scale: 1 }}
             viewport={{ once: true }}
             className="hidden md:block"
          >
            <div className="px-6 py-3 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Curated by OCC Artist Guild</p>
            </div>
          </motion.div>
        </div>

        {/* -- Masonry Grid -- */}
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="relative group break-inside-avoid w-full rounded-2xl overflow-hidden border transition-all duration-500 hover:scale-[1.01]"
              style={{ 
                background: B.card, 
                borderColor: B.border,
                minHeight: card.height === "tall" ? "420px" : card.height === "mid" ? "340px" : "260px"
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.4)";
                e.currentTarget.style.boxShadow = "0 20px 40px -10px rgba(0,0,0,0.5), 0 0 20px rgba(139, 92, 246, 0.1)";
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.borderColor = B.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* -- Image Background for specific cards -- */}
              {card.image && (
                <div className="absolute inset-0 z-0 overflow-hidden opacity-35 group-hover:opacity-55 transition-opacity duration-1000">
                  <img src={card.image} alt="" className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-1200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08080C] via-transparent to-transparent opacity-60" />
                </div>
              )}

              {/* -- Card Content Overlay -- */}
              <div className="relative z-10 p-8 h-full flex flex-col justify-between">
                <div>
                  <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 transition-transform duration-500 group-hover:scale-110 group-hover:bg-violet-600/20 group-hover:border-violet-500/30">
                    <span className="text-white/80 group-hover:text-violet-400 group-hover:animate-pulse">
                      {card.icon}
                    </span>
                  </div>
                  <h3 className="mb-4 text-2xl font-black uppercase tracking-tight italic" style={{ color: "white", fontFamily: "'Bebas Neue', 'Impact', sans-serif" }}>
                    {card.title}
                  </h3>
                  <p className="text-sm leading-[1.7] font-medium" style={{ color: B.muted }}>
                    {card.desc}
                  </p>
                </div>
                
                <div className="mt-8 border-t border-white/5 pt-6 opacity-100 transition-opacity duration-500 md:opacity-0 md:group-hover:opacity-100">
                  <Link
                    to={userId ? "/clubs/music?welcome=true" : "/login"}
                    className="inline-flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400 hover:text-violet-300"
                  >
                    Explore Details
                    <span className="h-px w-8 bg-violet-400/50" />
                  </Link>
                </div>
              </div>

              {/* -- Decorative Corner Light -- */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GigOpportunitiesSection() {
  const gigs = [
    { link: "Campus Event Performer", rate: "Rs 800-2,000 / show" },
    { link: "Studio Session Musician", rate: "Rs 600-1,200 / hour" },
    { link: "Social Media Music Content", rate: "Rs 2,000-3,500 / month" },
    { link: "Open Mic Host", rate: "Rs 500-1,000 / night" },
    { link: "College Fest Main Act", rate: "Rs 5,000-15,000 / show" },
  ];

  return (
    <section className="w-full px-6 py-24 md:px-12 md:py-32" style={{ background: P.bg }}>
      <div className="mx-auto max-w-[76rem]">
        <div className="mb-16 h-px w-full" style={{ background: P.border }} />

        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8 }}
            className="lg:max-w-md"
          >
            <h2 className="text-[clamp(1.8rem,5vw,3.2rem)] font-black leading-[1.08] tracking-tight uppercase" style={{ color: P.text, fontFamily: "'Bebas Neue', 'Impact', sans-serif" }}>
              Gig Opportunities
            </h2>
            <p className="mt-4 text-sm leading-[1.8]" style={{ color: P.muted }}>
              Don't just play in your bedroom. Start earning from your craft while still in college. Members get exclusive access to paid gigs across the city.
            </p>
          </motion.div>

          <div className="w-full lg:max-w-2xl">
            {gigs.map((item, i) => (
              <motion.div
                key={item.link}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="group flex flex-col justify-between border-b py-5 sm:flex-row sm:items-center"
                style={{ borderColor: P.border }}
              >
                <h3 className="text-base font-bold transition-colors group-hover:text-purple-400" style={{ color: P.text }}>
                  {item.link}
                </h3>
                <div className="mt-2 text-sm font-mono tracking-wider sm:mt-0" style={{ color: P.accent }}>
                  {item.rate}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function JoinMusicSection({ userId }: { userId?: string | null }) {
  return (
    <section
      className="relative overflow-hidden px-6 py-32 md:px-12 md:py-44"
      style={{ background: `radial-gradient(ellipse 60% 50% at 50% 100%, rgba(139,92,246,0.06) 0%, transparent 70%), ${P.bg}` }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${P.border}, transparent)` }} />
      <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center font-headline text-[30vw] font-black leading-none tracking-[0.05em] opacity-[0.03]" style={{ color: P.text, fontFamily: "'Bebas Neue', 'Impact', sans-serif" }} aria-hidden>
        OCC
      </div>
      <motion.div
        initial={{ opacity: 0, y: 44 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mx-auto max-w-2xl text-center"
      >
        <p className="font-mono mb-6 text-[11px] tracking-[0.5em] uppercase" style={{ color: P.muted }}>OCC Music Club</p>
        <h2 className="font-headline text-[clamp(2.5rem,8vw,5.5rem)] leading-[0.92] tracking-[0.04em]" style={{ color: P.text, fontFamily: "'Bebas Neue', 'Impact', sans-serif" }}>READY TO</h2>
        <h2 className="font-editorial mt-2 text-[clamp(3.5rem,10vw,7rem)] leading-[0.92] italic pr-4" style={{ color: P.accent }}>Play?</h2>
        <p className="mx-auto mt-8 max-w-[520px] text-[16px] leading-[1.8]" style={{ color: P.muted, fontFamily: "'DM Sans', sans-serif" }}>
          Join OCC Music Club - where artists find their stage, create together, and build a name in the local scene.
        </p>
        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            to={userId ? "/clubs/music?welcome=true" : "/login"}
            className="font-mono px-10 py-[18px] text-[11px] tracking-[0.2em] uppercase transition-all duration-300 hover:scale-[1.02]"
            style={{ background: P.accent, color: P.bg, borderRadius: "2px" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = P.accent; e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${P.accent}`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = P.accent; e.currentTarget.style.color = P.bg; e.currentTarget.style.boxShadow = "none"; }}
          >
            Join Now
          </Link>
          <Link
            to={userId ? "/clubs" : "/login"}
            className="font-mono px-10 py-[18px] text-[11px] tracking-[0.2em] uppercase transition-all duration-300 hover:scale-[1.02]"
            style={{ color: P.accent, boxShadow: `inset 0 0 0 1px ${P.accent}`, borderRadius: "2px" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = P.accent; e.currentTarget.style.color = P.bg; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = P.accent; }}
          >
            Explore Clubs
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

/* -- Main Page -- */
/** Video source for the scroll-cinema section.
 *  Uses NEXT_PUBLIC_FRAMES_CDN_BASE (or VITE_FRAMES_CDN_BASE) when set,
 *  otherwise falls back to the local /music/ path for dev. */
const VIDEO_SRC = (() => {
  const raw = String(
    process.env.NEXT_PUBLIC_FRAMES_CDN_BASE ??
    process.env.VITE_FRAMES_CDN_BASE ??
    "",
  ).trim();
  const base = (!raw || raw === "undefined" || raw === "null") ? "" : raw.replace(/\/$/, "");
  return base ? `${base}/Music_Update/mus-occ.mp4` : "/music/mus-occ.mp4";
})();

export function MusicPage({
  hideLoader = false,
  userId
}: {
  hideLoader?: boolean;
  userId?: string | null;
} = {}) {
  const { frames, loaded, progress, totalFrames } = useMusicVideoFrames(VIDEO_SRC);

  return (
    <div className="cursor-none" style={{ background: FC.bg, color: FC.text }}>
      {!hideLoader && <MusicLoadingScreen progress={progress} loaded={loaded} />}
      <MusicCursor />
      <GrainOverlay />

      <header className="pointer-events-none fixed top-0 right-0 left-0 z-[100] flex items-center justify-between px-6 py-6 mix-blend-difference md:px-12">
        <Link to="/" className="pointer-events-auto text-[10px] tracking-[0.4em] uppercase transition-colors" style={{ color: FC.text }}>
          {"<- OCC"}
        </Link>
        <span className="font-headline text-lg tracking-[0.15em] md:text-xl" style={{ color: FC.text }}>OCC</span>
        <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: FC.muted }}>Music</span>
      </header>

      <MusicScrollSection frames={frames} totalFrames={totalFrames} loaded={loaded} />

      <OpenMicExperienceSection userId={userId} />
      <GigOpportunitiesSection />
      <JoinMusicSection userId={userId} />

      <footer className="border-t px-6 py-12 text-center" style={{ borderColor: P.border, background: P.bg }}>
        <p className="font-mono-label text-xs tracking-[0.2em]" style={{ color: P.muted }}>
          OCC Music |{" "}
          <Link to="/" className="transition-colors hover:underline" style={{ color: P.accent }}>Return home</Link>
        </p>
      </footer>
    </div>
  );
}
