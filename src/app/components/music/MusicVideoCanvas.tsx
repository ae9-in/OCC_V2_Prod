import React, { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { MusicVideoPlayhead } from "../../../hooks/useMusicVideoPhysics";

const FPS = 30;

interface Props {
  /** Kept for API compat -- ignored; canvas draws from videoRef directly */
  frames?: ImageBitmap[];
  totalFrames: number;
  /** Live reference to the HTMLVideoElement loaded by useMusicVideoFrames */
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  /** Ref updated every rAF tick by the physics hook -- zero re-renders */
  playheadRef: MutableRefObject<MusicVideoPlayhead>;
  flashOpacityRef: MutableRefObject<number>;
}

function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  W: number,
  H: number,
  floatY: number,
  tiltDeg: number,
  effectiveScale: number,
) {
  const fa = video.videoWidth / video.videoHeight;
  const ca = W / H;
  let dW: number, dH: number;
  if (ca < fa) { dH = H * effectiveScale; dW = dH * fa; }
  else { dW = W * effectiveScale; dH = dW / fa; }
  const dx = (W - dW) / 2;
  const dy = (H - dH) / 2;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((tiltDeg * Math.PI) / 180);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(video, dx, dy + floatY, dW, dH);
  ctx.restore();
}

export const MusicVideoCanvas = React.memo(function MusicVideoCanvas({
  totalFrames,
  videoRef,
  playheadRef,
  flashOpacityRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const videoReady = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (W === 0 || H === 0) return;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const ph = playheadRef.current;
    const fo = flashOpacityRef.current;
    const { currentFrame, floatY, tiltDeg, scaleVal, zoomVal } = ph;

    ctx.fillStyle = "#060606";
    ctx.fillRect(0, 0, W, H);

    const video = videoRef.current;
    if (video && video.readyState >= 2 && video.videoWidth > 0) {
      videoReady.current = true;
      // Scrub: map physics frame index → video time
      const targetTime = (currentFrame / Math.max(1, totalFrames - 1)) * video.duration;
      if (Math.abs(video.currentTime - targetTime) > 1 / FPS / 2) {
        video.currentTime = targetTime;
      }
      drawVideoFrame(ctx, video, W, H, floatY, tiltDeg, scaleVal * zoomVal);
    }

    if (fo > 0.01) {
      ctx.globalAlpha = fo;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }, [totalFrames, videoRef, playheadRef, flashOpacityRef]);

  useEffect(() => {
    const loop = () => { draw(); rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 block h-full w-full min-h-0 min-w-0"
      style={{
        background: "#060606",
        opacity: 1,
        willChange: "transform",
        contain: "strict",
      }}
    />
  );
});
