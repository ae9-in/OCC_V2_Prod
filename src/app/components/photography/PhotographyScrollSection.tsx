import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { usePhotographyPhysics } from "../../../hooks/usePhotographyPhysics";
import { setFrameSequenceDecodeHint } from "../../../lib/loadFrameSequence";
import { usePhotographyProgress } from "../../../hooks/usePhotographyProgress";
import { PhotographyCanvas } from "./PhotographyCanvas";
import { PhotographyLightLeaks } from "./PhotographyLightLeaks";
import { PhotographyFocusRing } from "./PhotographyFocusRing";
import { PhotographyFilmGrainBurst } from "./PhotographyFilmGrainBurst";
import { PhotographyChapterText } from "./PhotographyChapterText";
import { playShutterClick } from "./playShutterClick";
import {
  PHOTO_TOTAL_FRAMES,
  PHOTO_FRAMES_PATH,
  PHOTO_SCROLL_HEIGHT_VH,
  PHOTO_CHAPTERS,
  PC,
} from "./photographyConstants";

/** Scroll progress (0->1) over which the intro title fades -- then chapters take over. */
const HERO_FADE_END = 0.1;

interface Props {
  frames: HTMLImageElement[];
  /** When false, intro stays hidden until frames are ready. */
  loaded?: boolean;
}

export function PhotographyScrollSection({ frames, loaded = true }: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const { playhead, playheadCanvasRef } = usePhotographyPhysics(
    containerRef,
    PHOTO_TOTAL_FRAMES,
  );
  const p = playhead.playheadProgress;
  const { inCaptured, grainBurstT, baseFrequency } = usePhotographyProgress(p);

  const [flashOpacity, setFlashOpacity] = useState(0);
  const shutterFired = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (p >= 0.65 && p <= 0.68 && !shutterFired.current) {
      shutterFired.current = true;
      playShutterClick();
      setFlashOpacity(0.85);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashOpacity(0), 280);
    }
    if (p < 0.6) shutterFired.current = false;
  }, [p]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const trackerVisible = p >= 0.15 && p <= 0.8;

  // Intro sits on frame 0; fades out as user scrolls (same viewport, one continuous scene).
  const heroScrollOpacity = Math.max(0, 1 - p / HERO_FADE_END);
  const heroLift = (p / HERO_FADE_END) * 28;
  const heroVisible = loaded && heroScrollOpacity > 0.02;

  useEffect(() => {
    const leadFrame = Math.min(
      PHOTO_TOTAL_FRAMES - 1,
      Math.ceil(playheadCanvasRef.current.currentFrame + 32),
    );
    setFrameSequenceDecodeHint(PHOTO_FRAMES_PATH, PHOTO_TOTAL_FRAMES, leadFrame);
  }, [playhead.currentFrame, playheadCanvasRef]);

  return (
    <section
      ref={containerRef}
      id="photography-section"
      className="relative"
      style={{
        height: `${PHOTO_SCROLL_HEIGHT_VH}vh`,
        background: "#0a0a0a",
        contain: "layout style paint",
      }}
    >
      <div
        className="sticky top-0 relative isolate h-[100dvh] w-full overflow-hidden"
        style={{ background: "#0a0a0a", willChange: "transform" }}
      >
        <PhotographyCanvas
          frames={frames}
          totalFrames={PHOTO_TOTAL_FRAMES}
          playheadCanvasRef={playheadCanvasRef}
          flashOpacity={flashOpacity}
        />

        <PhotographyLightLeaks intensity={playhead.speedIntensity} />
        <PhotographyFocusRing scrollProgress={p} visible={trackerVisible} />
        <PhotographyFilmGrainBurst
          visible={inCaptured}
          baseFrequency={baseFrequency}
          intensity={grainBurstT}
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-[rgba(10,10,10,0.28)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(10,10,10,0.35)] via-transparent to-transparent" />

        {/* Extra read legibility on first frame -- eases off as you scroll */}
        <div
          className="pointer-events-none absolute inset-0 z-[24]"
          style={{
            background: "rgba(10,10,10,0.45)",
            opacity: heroScrollOpacity * 0.85,
          }}
        />

        {/* Darkroom Cinema -- same sticky view as the sequence; scroll = scrub + fade intro */}
        {heroVisible ? (
          <div
            className="pointer-events-none absolute inset-0 z-[30] flex flex-col items-center justify-center px-6 text-center"
            style={{
              opacity: heroScrollOpacity,
              transform: `translateY(${-heroLift}px)`,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={loaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: 1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <p
                className="mb-6 text-[10px] tracking-[0.5em] uppercase"
                style={{ color: PC.accent }}
              >
                OCC . Photography Club
              </p>
              <h1 className="font-headline text-5xl font-light leading-[1.0] tracking-wide sm:text-6xl md:text-7xl lg:text-8xl">
                Darkroom
                <br />
                <span style={{ color: PC.secondary }}>Cinema</span>
              </h1>
              <p
                className="mx-auto mt-8 max-w-md text-sm leading-relaxed md:text-base"
                style={{ color: PC.muted }}
              >
                Scroll -- the same frame sequence scrubs beneath you. No second page.
              </p>
            </motion.div>
            <motion.p
              className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.4em] uppercase"
              style={{ color: PC.muted, opacity: heroScrollOpacity }}
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            >
              Scroll to begin 
            </motion.p>
          </div>
        ) : null}

        {PHOTO_CHAPTERS.map((ch) => (
          <PhotographyChapterText
            key={ch.id}
            chapter={ch}
            scrollProgress={p}
          />
        ))}

        <div className="pointer-events-none absolute top-1/2 right-4 z-[40] flex -translate-y-1/2 flex-col items-center md:right-6">
          <div className="relative h-24 w-px" style={{ background: "#222" }}>
            <div
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${p * 100}%`,
                background: "#FFD700",
                transition: "none",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
