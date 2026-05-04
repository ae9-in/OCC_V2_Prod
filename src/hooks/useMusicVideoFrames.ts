import { useState, useEffect, useCallback, useRef } from "react";

/**
 * --- VIDEO -> ImageBitmap[] EXTRACTOR ----------------------------
 * Loads an mp4, seeks through every frame, and captures each as an
 * ImageBitmap stored in memory.  Once done the array can be drawn
 * on a canvas identically to the photography section's
 * HTMLImageElement[] -- giving the same buttery-smooth scroll feel.
 *
 * Frames are captured at a capped resolution (max 19201080) to
 * keep GPU memory sane while still looking sharp on retina screens.
 */

const MAX_CAPTURE_W = 1920;
const MAX_CAPTURE_H = 1080;

export interface MusicVideoFramesResult {
  frames: ImageBitmap[];
  loaded: boolean;
  progress: number;
  totalFrames: number;
}

/** Dedupe / cache so Strict-Mode remounts don't re-extract. */
const _cache = new Map<string, ImageBitmap[]>();
const _inflight = new Map<string, Promise<ImageBitmap[]>>();

function extractFrames(
  videoSrc: string,
  onProgress: (p: number) => void,
): Promise<ImageBitmap[]> {
  const cached = _cache.get(videoSrc);
  if (cached) {
    onProgress(1);
    return Promise.resolve(cached);
  }
  const existing = _inflight.get(videoSrc);
  if (existing) return existing;

  const promise = extractFramesInternal(videoSrc, onProgress).then((bitmaps) => {
    _cache.set(videoSrc, bitmaps);
    _inflight.delete(videoSrc);
    return bitmaps;
  });
  _inflight.set(videoSrc, promise);
  return promise;
}

async function extractFramesInternal(
  videoSrc: string,
  onProgress: (p: number) => void,
): Promise<ImageBitmap[]> {
  // 1. Load video ---------------------------------------------
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.src = videoSrc;

  await new Promise<void>((resolve, reject) => {
    video.oncanplaythrough = () => resolve();
    video.onerror = () => reject(new Error("Video load failed"));
    video.load();
  });

  const duration = video.duration;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  // Use actual video fps -- we know 30fps from metadata; compute from duration
  // to be safe: aim for one frame every ~33.33ms
  const fps = 30;
  const totalFrames = Math.round(duration * fps);

  // 2. Compute capture resolution (fit within MAX keeping aspect) --
  const aspect = vw / vh;
  let capW = vw;
  let capH = vh;
  if (capW > MAX_CAPTURE_W) {
    capW = MAX_CAPTURE_W;
    capH = Math.round(capW / aspect);
  }
  if (capH > MAX_CAPTURE_H) {
    capH = MAX_CAPTURE_H;
    capW = Math.round(capH * aspect);
  }

  // 3. Offscreen canvas for capture --------------------------
  const offscreen = document.createElement("canvas");
  offscreen.width = capW;
  offscreen.height = capH;
  const octx = offscreen.getContext("2d", { alpha: false })!;

  // 4. Seek-and-capture loop ---------------------------------
  const bitmaps: ImageBitmap[] = new Array(totalFrames);
  let extracted = 0;

  // Batch strategy: extract first ~60 frames eagerly for fast initial paint,
  // then the rest.  This mirrors the photography loader's priority ordering.
  const order: number[] = [];
  const FIRST_WINDOW = Math.min(60, totalFrames);
  for (let i = 0; i < FIRST_WINDOW; i++) order.push(i);
  // Spread-sample the rest of the timeline
  const spreadCount = Math.min(80, totalFrames);
  const seen = new Set(order);
  for (let i = 0; i < spreadCount; i++) {
    const idx = Math.round((i / Math.max(1, spreadCount - 1)) * (totalFrames - 1));
    if (!seen.has(idx)) { seen.add(idx); order.push(idx); }
  }
  // Fill remaining
  for (let i = 0; i < totalFrames; i++) {
    if (!seen.has(i)) order.push(i);
  }

  for (const idx of order) {
    const time = idx / fps;

    // Wait for the seek to complete -- register listener BEFORE setting currentTime
    // to avoid missing a synchronous seeked event.
    await new Promise<void>((resolve) => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      const onSeeked = () => done();
      video.addEventListener("seeked", onSeeked);
      video.currentTime = Math.min(time, duration - 0.001);
      // Safety timeout to avoid hanging if seeked never fires (e.g. already there)
      setTimeout(() => done(), 200);
    });

    // Draw to offscreen canvas & create bitmap
    octx.drawImage(video, 0, 0, capW, capH);
    const bitmap = await createImageBitmap(offscreen);
    bitmaps[idx] = bitmap;

    extracted++;
    onProgress(extracted / totalFrames);
  }

  // Clean up video element
  video.src = "";
  video.load();

  return bitmaps;
}

export function useMusicVideoFrames(videoSrc: string): MusicVideoFramesResult {
  const [frames, setFrames] = useState<ImageBitmap[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const startedRef = useRef(false);

  const onProgress = useCallback((p: number) => {
    setProgress(p);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    extractFrames(videoSrc, onProgress).then((bitmaps) => {
      setFrames(bitmaps);
      setTotalFrames(bitmaps.length);
      setLoaded(true);
    });
  }, [videoSrc, onProgress]);

  return { frames, loaded, progress, totalFrames };
}
