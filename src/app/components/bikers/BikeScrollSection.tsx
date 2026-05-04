import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { useBikersPhysics } from "../../../hooks/useBikersPhysics";
import { setFrameSequenceDecodeHint } from "../../../lib/loadFrameSequence";
import { BikersCanvas } from "./BikersCanvas";
import { ChapterText } from "./ChapterText";
import { SpeedLines } from "./SpeedLines";
import {
  TOTAL_FRAMES,
  FRAMES_PATH,
  SCROLL_HEIGHT_VH,
  SCROLL_CHAPTERS,
  COLORS,
} from "./constants";

const HERO_FADE_END = 0.1;

interface Props {
  frames: HTMLImageElement[];
  loaded?: boolean;
}

export function BikeScrollSection({ frames, loaded = true }: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const { playhead, playheadCanvasRef } = useBikersPhysics(containerRef, TOTAL_FRAMES);
  const p = playhead.playheadProgress;

  const [flashOpacity, setFlashOpacity] = useState(0);
  const flashFired = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (p >= 0.74 && p <= 0.78 && !flashFired.current) {
      flashFired.current = true;
      setFlashOpacity(0.55);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashOpacity(0), 280);
    }
    if (p < 0.68) flashFired.current = false;
  }, [p]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const heroScrollOpacity = Math.max(0, 1 - p / HERO_FADE_END);
  const heroLift = (p / HERO_FADE_END) * 28;
  const heroVisible = loaded && heroScrollOpacity > 0.02;

  useEffect(() => {
    const leadFrame = Math.min(
      TOTAL_FRAMES - 1,
      Math.ceil(playheadCanvasRef.current.currentFrame + 32),
    );
    setFrameSequenceDecodeHint(FRAMES_PATH, TOTAL_FRAMES, leadFrame);
  }, [playhead.currentFrame, playheadCanvasRef]);

  return (
    <section
      ref={containerRef}
      className="relative"
      style={{
        height: `${SCROLL_HEIGHT_VH}vh`,
        background: "#080808",
        contain: "layout style paint",
      }}
    >
      <div
        className="sticky top-0 relative isolate h-[100dvh] w-full overflow-hidden"
        style={{ background: "#080808", willChange: "transform" }}
      >
        <BikersCanvas
          frames={frames}
          totalFrames={TOTAL_FRAMES}
          playheadCanvasRef={playheadCanvasRef}
          flashOpacity={flashOpacity}
        />

        <SpeedLines intensity={playhead.speedIntensity} />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-[rgba(8,8,8,0.3)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(8,8,8,0.35)] via-transparent to-transparent" />

        <div
          className="pointer-events-none absolute inset-0 z-[24]"
          style={{
            background: "rgba(8,8,8,0.5)",
            opacity: heroScrollOpacity * 0.85,
          }}
        />

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
                style={{ color: COLORS.accent }}
              >
                OCC . Off-Campus Clubs
              </p>
              <h1 className="font-headline text-5xl font-light leading-[1.05] tracking-wide sm:text-6xl md:text-7xl lg:text-8xl">
                Mountain
                <br />
                <em className="font-accent not-italic" style={{ color: COLORS.accent }}>
                  Antigravity
                </em>
              </h1>
              <p
                className="mx-auto mt-8 max-w-md text-sm leading-relaxed md:text-base"
                style={{ color: COLORS.muted }}
              >
                Scroll -- the same ride scrubs beneath you. One viewport, no second page.
              </p>
            </motion.div>
            <motion.p
              className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.4em] uppercase"
              style={{ color: COLORS.muted, opacity: heroScrollOpacity }}
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            >
              Scroll to begin 
            </motion.p>
          </div>
        ) : null}

        {SCROLL_CHAPTERS.map((ch) => (
          <ChapterText key={ch.id} chapter={ch} scrollProgress={p} />
        ))}

        <div className="pointer-events-none absolute top-1/2 right-4 z-[40] flex -translate-y-1/2 flex-col items-center md:right-6">
          <div className="relative h-24 w-px" style={{ background: "#222" }}>
            <div
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${p * 100}%`,
                background: "#C8A96E",
                transition: "none",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
