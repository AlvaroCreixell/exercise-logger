/**
 * Rest-complete cues (spec §4.2 of the in-gym hardening plan).
 *
 * Both cues are guarded, fire-and-forget, and only meaningful while the page
 * is visible — the caller checks `document.visibilityState` at fire time.
 * The wake lock (useWakeLock) makes "visible" the designed state during a
 * session; screen-off delivery is an explicit non-goal for a local-first PWA.
 */

type AudioContextCtor = new () => AudioContext;

let audioCtx: AudioContext | null = null;

function getAudioContextCtor(): AudioContextCtor | undefined {
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext;
}

/**
 * Create/resume the shared AudioContext from within a user gesture (a Save
 * tap) so the autoplay policy allows a later timer callback to start a sound.
 * Call whenever the sound cue is enabled; safe to call repeatedly.
 */
export function primeAudioCue(): void {
  try {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    audioCtx = audioCtx ?? new Ctor();
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
  } catch {
    // No audio — never block the save path.
  }
}

/**
 * Fire the rest-complete cue: vibration pattern and/or a ~200 ms square-wave
 * beep. The beep only plays if `primeAudioCue()` ran from a gesture earlier
 * (autoplay policy). Vibration needs sticky user activation — trivially
 * present mid-workout — and is ignored by the platform on hidden pages.
 */
export function playRestCue(opts: { haptic: boolean; sound: boolean }): void {
  if (opts.haptic && "vibrate" in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // Never let a cue failure surface.
    }
  }

  if (opts.sound && audioCtx && audioCtx.state === "running") {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      osc.start(t);
      osc.stop(t + 0.2);
    } catch {
      // Never let a cue failure surface.
    }
  }
}

/** Test-only: drop the shared context so suites are independent. */
export function __resetAudioCueForTests(): void {
  audioCtx = null;
}
