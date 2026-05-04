import { useState, useEffect, useRef, type MutableRefObject } from "react";

/**
 * --- VIDEO SCRUB (single-request, no frame extraction) -----------
 * Loads an mp4 once, then on every rAF tick the canvas reads
 * video.currentTime directly.  This uses exactly 1 HTTP request
 * instead of ~600 range requests, eliminating the 429 rate-limit
 * and the long pre-extraction wait.
 */

const FPS = 30;

export interface MusicVideoFramesResult {
  /** Kept for API compat -- empty; canvas draws from videoRef directly */
  frames: ImageBitmap[];
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  loaded: boolean;
  progress: number;
  totalFrames: number;
}

/** Singleton video element cache so Strict-Mode remounts don't reload. */
const _videoCache = new Map<string, HTMLVideoElement>();

export function useMusicVideoFrames(videoSrc: string): MusicVideoFramesResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Reuse existing element if already loaded for this src
    if (_videoCache.has(videoSrc)) {
      const cached = _videoCache.get(videoSrc)!;
      videoRef.current = cached;
      if (cached.readyState >= 3) {
        setTotalFrames(Math.round(cached.duration * FPS));
        setProgress(1);
        setLoaded(true);
      }
      return;
    }

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.src = videoSrc;
    videoRef.current = video;
    _videoCache.set(videoSrc, video);

    const onCanPlay = () => {
      setTotalFrames(Math.round(video.duration * FPS));
      setProgress(1);
      setLoaded(true);
    };
    const onProgress = () => {
      if (video.duration > 0 && video.buffered.length > 0) {
        const buf = video.buffered.end(video.buffered.length - 1) / video.duration;
        setProgress(Math.min(buf, 0.99));
      }
    };
    const onError = () =>
      console.error("[useMusicVideoFrames] Failed to load:", videoSrc);

    video.addEventListener("canplaythrough", onCanPlay);
    video.addEventListener("progress", onProgress);
    video.addEventListener("error", onError);
    video.load();

    return () => {
      video.removeEventListener("canplaythrough", onCanPlay);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("error", onError);
    };
  }, [videoSrc]);

  return { frames: [], videoRef, loaded, progress, totalFrames };
}
