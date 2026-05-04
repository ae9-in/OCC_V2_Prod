import React, { useRef, useEffect, type MutableRefObject } from "react";
import { motion } from "motion/react";
import { useMusicVideoPhysics } from "../../../hooks/useMusicVideoPhysics";
import { MusicVideoCanvas } from "./MusicVideoCanvas";
import { MusicSpeedLines } from "./MusicSpeedLines";
import { MusicBallTracker } from "./MusicBallTracker";
import { MusicCrowdDots } from "./MusicCrowdDots";
import { MusicChapterText } from "./MusicChapterText";
import {
  MUSIC_SCROLL_HEIGHT_VH,
  MUSIC_CHAPTERS,
  FC,
} from "./MusicConstants";

const HERO_FADE_END = 0.1;

interface Props {
  frames?: ImageBitmap[];
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  totalFrames: number;
  loaded?: boolean;
}

export function MusicScrollSection({ videoRef, totalFrames, loaded = true }: Props) {
  const containerRef = useRef<HTMLElement>(null);

  // Physics -- playheadCanvasRef updates every rAF (for canvas), playhead throttled ~75fps (for React overlays)
  const { playhead, playheadCanvasRef } = useMusicVideoPhysics(containerRef, totalFrames);

  // -- Flash (ref-based so canvas reads it without re-renders) ---
  const flashOpacityRef = useRef(0);
  const goalFlashFired = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const p = playhead.playheadProgress;
    if (p >= 0.65 && p <= 0.68 && !goalFlashFired.current) {
      goalFlashFired.current = true;
      flashOpacityRef.current = 0.8;
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => { flashOpacityRef.current = 0; }, 300);
    }
    if (p < 0.6) goalFlashFired.current = false;
  }, [playhead.playheadProgress]);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  // -- Derived booleans (from throttled React state -- fine for overlays) ---
  const p = playhead.playheadProgress;
  const trackerVisible = p >= 0.15 && p <= 0.8;
  const crowdVisible = p >= 0.65 && p <= 0.82;
  const crowdIntensity = crowdVisible ? Math.min(1, (p - 0.65) / 0.08) : 0;

  const heroScrollOpacity = Math.max(0, 1 - p / HERO_FADE_END);
  const heroLift = (p / HERO_FADE_END) * 28;
  const heroVisible = loaded && heroScrollOpacity > 0.02;

  return (
    <section
      ref={containerRef}
      id="Music-section"
      className="relative"
      style={{
        height: `${MUSIC_SCROLL_HEIGHT_VH}vh`,
        background: "#060606",
        contain: "layout style paint",
      }}
    >
      <div
        className="sticky top-0 relative isolate h-[100dvh] w-full overflow-hidden"
        style={{ background: "#060606", willChange: "transform" }}
      >
        {/* Canvas reads from refs -- ZERO re-renders during scroll */}
        <MusicVideoCanvas
          videoRef={videoRef}
          totalFrames={totalFrames}
          playheadRef={playheadCanvasRef}
          flashOpacityRef={flashOpacityRef}
        />

        <MusicSpeedLines intensity={playhead.speedIntensity} />
        <MusicBallTracker scrollProgress={p} visible={trackerVisible} />
        <MusicCrowdDots visible={crowdVisible} intensity={crowdIntensity} />

        {/* Gradient vignettes */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060606] via-transparent to-[rgba(6,6,6,0.25)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(6,6,6,0.3)] via-transparent to-transparent" />

        <div
          className="pointer-events-none absolute inset-0 z-[24]"
          style={{ background: "rgba(6,6,6,0.45)", opacity: heroScrollOpacity * 0.85 }}
        />

        {heroVisible ? (
          <div
            className="pointer-events-none absolute inset-0 z-[30] flex flex-col items-center justify-center px-6 text-center"
            style={{ opacity: heroScrollOpacity, transform: `translateY(${-heroLift}px)` }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={loaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: 1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="mb-6 text-[10px] tracking-[0.5em] uppercase" style={{ color: FC.accent }}>
                OCC Music Club
              </p>
              <h1 className="font-headline text-5xl font-light leading-[1.0] tracking-wide sm:text-6xl md:text-7xl lg:text-8xl">
                Music<br />
                <span style={{ color: FC.accent }}>Vortex</span>
              </h1>
              <p className="mx-auto mt-8 max-w-md text-sm leading-relaxed md:text-base" style={{ color: FC.muted }}>
                Scroll -- the same sequence scrubs beneath you. One viewport, no second page.
              </p>
            </motion.div>
            <motion.p
              className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.4em] uppercase"
              style={{ color: FC.muted, opacity: heroScrollOpacity }}
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            >
              Scroll to begin
            </motion.p>
          </div>
        ) : null}

        {MUSIC_CHAPTERS.map((ch) => (
          <MusicChapterText key={ch.id} chapter={ch} scrollProgress={p} />
        ))}

        <div className="pointer-events-none absolute top-1/2 right-4 z-[40] flex -translate-y-1/2 flex-col items-center md:right-6">
          <div className="relative h-24 w-px" style={{ background: "#1a1a1a" }}>
            <div
              className="absolute top-0 left-0 w-full"
              style={{ height: `${p * 100}%`, background: FC.accent, transition: "none" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
