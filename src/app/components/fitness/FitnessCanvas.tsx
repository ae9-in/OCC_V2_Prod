"use client";
import React, { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { FitnessPlayhead } from "../../../hooks/useFitnessPhysics";

interface FitnessCanvasProps {
  frames: HTMLImageElement[];
  totalFrames: number;
  playheadRef: MutableRefObject<FitnessPlayhead>;
}

function drawSingleFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  W: number, H: number,
  floatY: number, tiltDeg: number, effectiveScale: number,
): boolean {
  if (!img || !img.complete || !img.naturalWidth) return false;
  const fa = img.naturalWidth / img.naturalHeight;
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
  ctx.drawImage(img, dx, dy + floatY, dW, dH);
  ctx.restore();
  return true;
}

function drawFrameBlend(
  ctx: CanvasRenderingContext2D,
  frames: HTMLImageElement[],
  total: number,
  floatIndex: number,
  W: number, H: number,
  floatY: number, tiltDeg: number, effectiveScale: number,
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
  if (blend > 0.005 && frameB !== frameA && frames[frameB]?.complete) {
    ctx.globalAlpha = blend;
    drawSingleFrame(ctx, frames[frameB], W, H, floatY, tiltDeg, effectiveScale);
  }
}

export const FitnessCanvas = React.memo(function FitnessCanvas({
  frames,
  totalFrames,
  playheadRef,
}: FitnessCanvasProps) {
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

    const ph = playheadRef.current;
    const { currentFrame, floatY, tiltDeg, scaleVal, zoomVal } = ph;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
    if (frames.length > 0) {
      drawFrameBlend(ctx, frames, totalFrames, currentFrame, W, H, floatY, tiltDeg, scaleVal * zoomVal);
    }
  }, [frames, totalFrames, playheadRef]);

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
        background: "#000",
        opacity: frames.length > 0 ? 1 : 0,
        transition: "opacity 0.6s ease",
        willChange: "transform",
        contain: "strict",
      }}
    />
  );
});
