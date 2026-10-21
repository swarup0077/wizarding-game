// Calls back once per new camera frame (FR-2: detection runs per video frame, on the
// camera's schedule, not the render loop's). Browser-only and thin.
//
// `requestVideoFrameCallback` fires when a new frame reaches the compositor, with a count of
// presented frames that serves as the frame's id. Where it's missing, a rAF loop polls the
// video's own frame count instead; the detect scheduler then drops the repeats.

/** Starts watching `video`; `onFrame` gets each new frame's id. Returns a stop function. */
export function watchVideoFrames(
  video: HTMLVideoElement,
  onFrame: (frameId: number) => void,
): () => void {
  let stopped = false;

  if (typeof video.requestVideoFrameCallback === 'function') {
    let handle = 0;
    const tick: VideoFrameRequestCallback = (_now, metadata) => {
      if (stopped) return;
      // Ask for the next frame first, so a throwing listener can't end the loop.
      handle = video.requestVideoFrameCallback(tick);
      onFrame(metadata.presentedFrames);
    };
    handle = video.requestVideoFrameCallback(tick);
    return () => {
      stopped = true;
      video.cancelVideoFrameCallback(handle);
    };
  }

  let raf = 0;
  const poll = (): void => {
    if (stopped) return;
    raf = requestAnimationFrame(poll);
    const id = frameCount(video);
    if (id !== null) onFrame(id);
  };
  raf = requestAnimationFrame(poll);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

/** The video's decoded-frame count (or its time, which also changes per frame); null before the first frame. */
function frameCount(video: HTMLVideoElement): number | null {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
  return video.getVideoPlaybackQuality().totalVideoFrames || video.currentTime;
}
