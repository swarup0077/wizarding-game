// Calls back once per new camera frame (FR-2: detection runs per video frame, on the
// camera's schedule, not the render loop's). Browser-only and thin.
//
// `requestVideoFrameCallback` fires when a new frame reaches the compositor, with a count of
// presented frames that serves as the frame's id, and the time the camera captured it
// (`captureTime`, on the page's performance.now clock). Results are stamped with that capture
// time rather than their arrival time, so the trail and skeleton line up with what the camera
// saw (T4). Where rVFC or its capture time is missing, the best stand-in is used: the
// expected display time, or now. A rAF loop polls the video's own frame count when rVFC is
// missing entirely; the detect scheduler then drops the repeats.

/** Starts watching `video`; `onFrame` gets each new frame's id and capture time (ms). Returns a stop function. */
export function watchVideoFrames(
  video: HTMLVideoElement,
  onFrame: (frameId: number, captureTime: number) => void,
): () => void {
  let stopped = false;

  if (typeof video.requestVideoFrameCallback === 'function') {
    let handle = 0;
    const tick: VideoFrameRequestCallback = (now, metadata) => {
      if (stopped) return;
      // Ask for the next frame first, so a throwing listener can't end the loop.
      handle = video.requestVideoFrameCallback(tick);
      onFrame(
        metadata.presentedFrames,
        metadata.captureTime ?? metadata.expectedDisplayTime ?? now,
      );
    };
    handle = video.requestVideoFrameCallback(tick);
    return () => {
      stopped = true;
      video.cancelVideoFrameCallback(handle);
    };
  }

  let raf = 0;
  const poll = (now: number): void => {
    if (stopped) return;
    raf = requestAnimationFrame(poll);
    const id = frameCount(video);
    if (id !== null) onFrame(id, now);
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
