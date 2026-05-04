import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { stickySectionScrollProgress } from "../lib/frameImage";

/**
 * Photography-grade smoothing for Football scroll-cinema.
 * dt-compensated exponential lerp, throttled React state (~75fps),
 * ref-based playhead for canvas (every rAF tick, zero re-renders).
 */
const EASE = 0.015;
const SLACK = 0.25;
const SCROLL_VEL_GAIN = 38;
const VEL_DECAY = 0.952;
const MAX_NORM = 1.35;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export interface FootballPlayhead {
  currentFrame: number;
  playheadProgress: number;
  floatY: number;
  tiltDeg: number;
  scaleVal: number;
  zoomVal: number;
  speedIntensity: number;
}

export interface FootballPhysics {
  playhead: FootballPlayhead;
  playheadRef: MutableRefObject<FootballPlayhead>;
}

const INITIAL: FootballPlayhead = {
  currentFrame: 0,
  playheadProgress: 0,
  floatY: 0,
  tiltDeg: 0,
  scaleVal: 1.15,
  zoomVal: 1,
  speedIntensity: 0,
};

export function useFootballPhysics(
  containerRef: React.RefObject<HTMLElement | null>,
  totalFrames: number,
): FootballPhysics {
  const playheadRef = useRef<FootballPlayhead>({ ...INITIAL });
  const physicsFrame = useRef(0);
  const prevTarget = useRef(0);
  const scrollVel = useRef(0);
  const ag = useRef({
    floatY: 0,
    tiltDeg: 0,
    scaleVal: 1.15,
    zoomVal: 1,
    speedIntensity: 0,
  });
  const lastTs = useRef<number | null>(null);

  const [state, setState] = useState<FootballPlayhead>({ ...INITIAL });
  const lastEmitTs = useRef(0);
  const lastEmittedFrame = useRef(0);
  const lastEmittedProgress = useRef(0);

  useEffect(() => {
    let raf = 0;
    const loop = (ts: number) => {
      const prev = lastTs.current ?? ts;
      const dt = clamp((ts - prev) / (1000 / 60), 0.5, 2);
      lastTs.current = ts;

      const el = containerRef.current;
      if (el) {
        const rawProgress = stickySectionScrollProgress(el);
        const targetFrame = rawProgress * (totalFrames - 1);
        const deltaTarget = targetFrame - prevTarget.current;

        const frameEase = 1 - Math.pow(1 - EASE, dt);
        let pf = physicsFrame.current + (targetFrame - physicsFrame.current) * frameEase;

        if (targetFrame > prevTarget.current) {
          pf = Math.min(pf, targetFrame + SLACK);
        } else if (targetFrame < prevTarget.current) {
          pf = Math.max(pf, targetFrame - SLACK);
        }

        pf = clamp(pf, 0, totalFrames - 1);
        physicsFrame.current = pf;
        prevTarget.current = targetFrame;

        scrollVel.current += deltaTarget * SCROLL_VEL_GAIN * dt;
        scrollVel.current *= Math.pow(VEL_DECAY, dt);
        if (Math.abs(scrollVel.current) < 0.001) scrollVel.current = 0;

        const nv = clamp(scrollVel.current / 4, -MAX_NORM, MAX_NORM);
        const absNv = Math.abs(nv);

        const microEase = 1 - Math.pow(1 - 0.06, dt);
        const zoomEase = 1 - Math.pow(1 - 0.05, dt);
        const intensityEase = 1 - Math.pow(1 - 0.08, dt);

        ag.current.floatY = lerp(ag.current.floatY, clamp(-nv * 32, -32, 16), microEase);
        ag.current.tiltDeg = lerp(ag.current.tiltDeg, clamp(-nv * 2.2, -2.2, 2.2), microEase);
        ag.current.scaleVal = lerp(ag.current.scaleVal, 1.15 + absNv * 0.014, microEase);
        ag.current.zoomVal = lerp(ag.current.zoomVal, 1 + absNv * 0.02, zoomEase);
        ag.current.speedIntensity = lerp(ag.current.speedIntensity, Math.min(absNv * 1.1, 1), intensityEase);

        const nextProgress = physicsFrame.current / Math.max(1, totalFrames - 1);

        playheadRef.current = {
          currentFrame: physicsFrame.current,
          playheadProgress: nextProgress,
          floatY: ag.current.floatY,
          tiltDeg: ag.current.tiltDeg,
          scaleVal: ag.current.scaleVal,
          zoomVal: ag.current.zoomVal,
          speedIntensity: ag.current.speedIntensity,
        };

        const shouldEmit =
          ts - lastEmitTs.current >= 1000 / 75 ||
          Math.abs(physicsFrame.current - lastEmittedFrame.current) >= 0.15 ||
          Math.abs(nextProgress - lastEmittedProgress.current) >= 0.0008;

        if (shouldEmit) {
          lastEmitTs.current = ts;
          lastEmittedFrame.current = physicsFrame.current;
          lastEmittedProgress.current = nextProgress;
          setState({ ...playheadRef.current });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [containerRef, totalFrames]);

  return { playhead: state, playheadRef };
}
