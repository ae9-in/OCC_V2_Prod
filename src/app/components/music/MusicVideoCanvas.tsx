import React, { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { MusicVideoPlayhead } from "../../../hooks/useMusicVideoPhysics";

interface Props {
  frames: ImageBitmap[];
  totalFrames: number;
  /** Ref updated every rAF tick by the physics hook -- zero re-renders */
  playheadRef: MutableRefObject<MusicVideoPlayhead>;
  flashOpacityRef: MutableRefObject<number>;
}

function drawSingleFrame(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap | undefined,
  W: number,
  H: number,
  floatY: number,
  tiltDeg: number,
  effectiveScale: number,
): boolean {
  if (!bmp || bmp.width === 0) return false;
  const fa = bmp.width / bmp.height;
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
  ctx.drawImage(bmp, dx, dy + floatY, dW, dH);
  ctx.restore();
  return true;
}

function drawFrameBlend(
  ctx: CanvasRenderingContext2D,
  frames: ImageBitmap[],
  total: number,
  floatIndex: number,
  W: number,
  H: number,
  floatY: number,
  tiltDeg: number,
  effectiveScale: number,
) {
  const frameA = Math.floor(floatIndex);
  const frameB = Math.min(frameA + 1, total - 1);
  const blend = floatIndex - frameA;
  ctx.globalAlpha = 1;
  const okA = drawSingleFrame(ctx, frames[frameA], W, H, floatY, tiltDeg, effectiveScale);
  if (!okA) {
    for (let offset = 1; offset < 10; offset++) {
      const fallback = Math.max(0, frameA - offset);
      if (drawSingleFrame(ctx, frames[fallback], W, H, floatY, tiltDeg, effectiveScale)) break;
    }
  }
  if (blend > 0.005 && frameB !== frameA && frames[frameB]) {
    ctx.globalAlpha = blend;
    drawSingleFrame(ctx, frames[frameB], W, H, floatY, tiltDeg, effectiveScale);
  }
}

export const MusicVideoCanvas = React.memo(function MusicVideoCanvas({
  frames,
  totalFrames,
  playheadRef,
  flashOpacityRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

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

    // Read directly from refs -- no React re-render needed
    const ph = playheadRef.current;
    const fo = flashOpacityRef.current;
    const { currentFrame, floatY, tiltDeg, scaleVal, zoomVal } = ph;

    ctx.fillStyle = "#060606";
    ctx.fillRect(0, 0, W, H);
    if (frames.length > 0) {
      drawFrameBlend(ctx, frames, totalFrames, currentFrame, W, H, floatY, tiltDeg, scaleVal * zoomVal);
    }
    if (fo > 0.01) {
      ctx.globalAlpha = fo;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }, [frames, totalFrames, playheadRef, flashOpacityRef]);

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
        opacity: frames.length > 0 ? 1 : 0,
        transition: "opacity 0.6s ease",
        willChange: "transform",
        contain: "strict",
      }}
    />
  );
});
