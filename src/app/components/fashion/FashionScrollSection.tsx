import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { useFashionPhysics } from "../../../hooks/useFashionPhysics";
import { setFrameSequenceDecodeHint } from "../../../lib/loadFrameSequence";
import { useFashionProgress } from "../../../hooks/useFashionProgress";
import { FashionCanvas } from "./FashionCanvas";
import { FashionRunwayStreaks } from "./FashionRunwayStreaks";
import { FashionSpotlightRing } from "./FashionSpotlightRing";
import { FashionGrainBurst } from "./FashionGrainBurst";
import { FashionChapterText } from "./FashionChapterText";
import {
  FASHION_TOTAL_FRAMES,
  FASHION_FRAMES_PATH,
  FASHION_SCROLL_HEIGHT_VH,
  FASHION_CHAPTERS,
  FAC,
} from "./fashionConstants";

const HERO_FADE_END = 0.1;

interface Props {
  frames: HTMLImageElement[];
  loaded?: boolean;
}

export function FashionScrollSection({ frames, loaded = true }: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const { playhead, playheadCanvasRef } = useFashionPhysics(
    containerRef,
    FASHION_TOTAL_FRAMES,
  );
  const p = playhead.playheadProgress;
  const { inShow, burstT, baseFrequency } = useFashionProgress(p);

  const [flashOpacity, setFlashOpacity] = useState(0);
  const flashFired = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (p >= 0.68 && p <= 0.72 && !flashFired.current) {
      flashFired.current = true;
      setFlashOpacity(0.72);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashOpacity(0), 320);
    }
    if (p < 0.62) flashFired.current = false;
  }, [p]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const trackerVisible = p >= 0.12 && p <= 0.78;
  const heroScrollOpacity = Math.max(0, 1 - p / HERO_FADE_END);
  const heroLift = (p / HERO_FADE_END) * 28;
  const heroVisible = loaded && heroScrollOpacity > 0.02;

  useEffect(() => {
    const leadFrame = Math.min(
      FASHION_TOTAL_FRAMES - 1,
      Math.ceil(playheadCanvasRef.current.currentFrame + 32),
    );
    setFrameSequenceDecodeHint(FASHION_FRAMES_PATH, FASHION_TOTAL_FRAMES, leadFrame);
  }, [playhead.currentFrame, playheadCanvasRef]);

  return (
    <section
      ref={containerRef}
      id="fashion-section"
      className="relative"
      style={{
        height: `${FASHION_SCROLL_HEIGHT_VH}vh`,
        background: FAC.bg,
        contain: "layout style paint",
      }}
    >
      <div
        className="sticky top-0 relative isolate h-[100dvh] w-full overflow-hidden"
        style={{ background: FAC.bg, willChange: "transform" }}
      >
        <FashionCanvas
          frames={frames}
          totalFrames={FASHION_TOTAL_FRAMES}
          playheadCanvasRef={playheadCanvasRef}
          flashOpacity={flashOpacity}
        />

        <FashionRunwayStreaks intensity={playhead.speedIntensity} />
        <FashionSpotlightRing scrollProgress={p} visible={trackerVisible} />
        <FashionGrainBurst
          visible={inShow}
          baseFrequency={baseFrequency}
          intensity={burstT}
        />

        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[rgba(5,5,5,0.32)]"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[rgba(5,5,5,0.42)] via-transparent to-[rgba(201,169,98,0.06)]"
        />

        <div
          className="pointer-events-none absolute inset-0 z-[24]"
          style={{
            background: "rgba(5,5,5,0.4)",
            opacity: heroScrollOpacity * 0.82,
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
              transition={{ duration: 1, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            >
              <p
                className="mb-6 text-[10px] tracking-[0.5em] uppercase"
                style={{ color: FAC.accent }}
              >
                OCC . Fashion Club
              </p>
              <h1 className="font-headline text-5xl font-light leading-[1.0] tracking-wide sm:text-6xl md:text-7xl lg:text-8xl">
                Runway
                <br />
                <span style={{ color: FAC.secondary }}>Cinema</span>
              </h1>
              <p
                className="mx-auto mt-8 max-w-md text-sm leading-relaxed md:text-base"
                style={{ color: FAC.muted }}
              >
                Scroll -- the sequence scrubs beneath you. One viewport, editorial motion.
              </p>
            </motion.div>
            <motion.p
              className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.4em] uppercase"
              style={{ color: FAC.muted, opacity: heroScrollOpacity }}
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            >
              Scroll to begin 
            </motion.p>
          </div>
        ) : null}

        {FASHION_CHAPTERS.map((ch) => (
          <FashionChapterText key={ch.id} chapter={ch} scrollProgress={p} />
        ))}

        <div className="pointer-events-none absolute top-1/2 right-4 z-[40] flex -translate-y-1/2 flex-col items-center md:right-6">
          <div className="relative h-24 w-px" style={{ background: "#2a2825" }}>
            <div
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${p * 100}%`,
                background: FAC.accent,
                transition: "none",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
