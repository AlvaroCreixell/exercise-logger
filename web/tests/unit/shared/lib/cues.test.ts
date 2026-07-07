import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  primeAudioCue,
  playRestCue,
  __resetAudioCueForTests,
} from "@/shared/lib/cues";

function makeFakeAudioContext(state: AudioContextState = "running") {
  const osc = {
    type: "sine",
    frequency: { value: 0 },
    connect: vi.fn(() => gain),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = {
    gain: { value: 0 },
    connect: vi.fn(),
  };
  const ctx = {
    state,
    currentTime: 1,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
    createOscillator: vi.fn(() => osc),
    createGain: vi.fn(() => gain),
  };
  return { ctx, osc, gain };
}

describe("cues", () => {
  let vibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetAudioCueForTests();
    vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });
  });

  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).vibrate;
    delete (window as unknown as Record<string, unknown>).AudioContext;
    __resetAudioCueForTests();
  });

  it("vibrates with the rest pattern when haptic is on", () => {
    playRestCue({ haptic: true, sound: false });
    expect(vibrate).toHaveBeenCalledWith([200, 100, 200]);
  });

  it("does not vibrate when haptic is off", () => {
    playRestCue({ haptic: false, sound: false });
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("is a no-op without the Vibration API", () => {
    delete (navigator as unknown as Record<string, unknown>).vibrate;
    expect(() => playRestCue({ haptic: true, sound: false })).not.toThrow();
  });

  it("plays a short beep only after the context was primed by a gesture", () => {
    const { ctx, osc } = makeFakeAudioContext("running");
    // Regular function: `new` must work (arrow functions aren't constructors).
    (window as unknown as Record<string, unknown>).AudioContext = function () {
      return ctx;
    };

    // Not primed yet → no sound, no crash.
    playRestCue({ haptic: false, sound: true });
    expect(osc.start).not.toHaveBeenCalled();

    primeAudioCue();
    playRestCue({ haptic: false, sound: true });
    expect(osc.start).toHaveBeenCalledTimes(1);
    expect(osc.stop).toHaveBeenCalled();
  });

  it("resumes a suspended context on prime", () => {
    const { ctx } = makeFakeAudioContext("suspended");
    (window as unknown as Record<string, unknown>).AudioContext = function () {
      return ctx;
    };
    primeAudioCue();
    expect(ctx.resume).toHaveBeenCalled();
  });

  it("does not beep when sound is off", () => {
    const { ctx, osc } = makeFakeAudioContext("running");
    (window as unknown as Record<string, unknown>).AudioContext = function () {
      return ctx;
    };
    primeAudioCue();
    playRestCue({ haptic: false, sound: false });
    expect(osc.start).not.toHaveBeenCalled();
  });

  it("prime is a silent no-op without AudioContext", () => {
    expect(() => primeAudioCue()).not.toThrow();
  });
});
