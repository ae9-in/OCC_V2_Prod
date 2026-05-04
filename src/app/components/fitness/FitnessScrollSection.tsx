"use client";
import React, { useEffect, useRef } from "react";
import { useFitnessPhysics } from "../../../hooks/useFitnessPhysics";
import { setFrameSequenceDecodeHint } from "../../../lib/loadFrameSequence";
import { FitnessCanvas } from "./FitnessCanvas";
import {
  FITNESS_TOTAL_FRAMES,
  FITNESS_FRAMES_PATH,
  FITNESS_FRAME_PREFIX,
} from "./fitnessConstants";
import { motion } from "motion/react";

interface FitnessScrollProps {
  frames: HTMLImageElement[];
  loaded: boolean;
}

export function FitnessScrollSection({ frames, loaded }: FitnessScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { playhead, playheadCanvasRef } = useFitnessPhysics(containerRef, FITNESS_TOTAL_FRAMES);

  useEffect(() => {
    const leadFrame = playhead.currentFrame + 10;
    setFrameSequenceDecodeHint(
      FITNESS_FRAMES_PATH,
      FITNESS_TOTAL_FRAMES,
      leadFrame,
      FITNESS_FRAME_PREFIX,
    );
  }, [playhead.currentFrame]);

  return (
    <section
      ref={containerRef}
      className="relative h-[800vh] w-full bg-black"
      style={{ contain: "layout style paint" }}
    >
      <div
        className="sticky top-0 relative isolate z-10 h-[100dvh] w-full overflow-hidden"
        style={{ willChange: "transform" }}
      >
        {/* Canvas reads from ref -- zero re-renders */}
        <FitnessCanvas
          frames={frames}
          totalFrames={FITNESS_TOTAL_FRAMES}
          playheadRef={playheadCanvasRef}
        />

        <div className="relative z-20 flex h-full items-center justify-center pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-center"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.5em] text-[#CCFF00] mb-4 block">Peak Performance</span>
            <h2 className="text-[clamp(3rem,10vw,8rem)] font-black uppercase text-white leading-none tracking-wide" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              Silent <span className="text-[#CCFF00] italic">Sunset.</span>
            </h2>
          </motion.div>
        </div>

        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full transition-all duration-500"
              style={{
                background: playhead.playheadProgress > (i / 6) ? "#CCFF00" : "rgba(255,255,255,0.2)",
                transform: playhead.playheadProgress > (i / 6) ? "scale(1.5)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
