// Short notification sounds made with the browser (WebAudio, no audio files). Browsers only allow sound after a tap or key press,
// so the first one anywhere on the page unlocks it. The "Sounds" switch in Settings > Notifications turns them all off.
const KEY = "snd_off";
let ac = null;
export const soundsOn = () => { try { return localStorage.getItem(KEY) !== "1"; } catch { return true; } };
export const setSounds = (on) => { try { on ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, "1"); } catch {} };
const ctx = () => { try { ac ||= new (window.AudioContext || window.webkitAudioContext)(); return ac; } catch { return null; } };
const unlock = () => { const c = ctx(); if (c && c.state === "suspended") c.resume().catch(() => {}); if (c && c.state === "running") ["pointerdown", "keydown", "touchend"].forEach((e) => removeEventListener(e, unlock, true)); };
["pointerdown", "keydown", "touchend"].forEach((e) => addEventListener(e, unlock, true));

const note = (c, f, t, d, v, type = "sine") => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.05); };
// message: two soft rising notes. staff: a three-note sparkle. callEnd: two lower, falling notes (distinct from both).
const SOUNDS = {
  message: (c, t) => { note(c, 659.25, t, 0.16, 0.07); note(c, 880, t + 0.11, 0.24, 0.07); },
  staff: (c, t) => { note(c, 523.25, t, 0.14, 0.06); note(c, 659.25, t + 0.1, 0.14, 0.06); note(c, 987.77, t + 0.2, 0.3, 0.06); },
  callEnd: (c, t) => { note(c, 440, t, 0.2, 0.09, "triangle"); note(c, 293.66, t + 0.17, 0.34, 0.09, "triangle"); },
};
const last = {};
// Plays one sound. Quietly does nothing when sounds are off, the browser hasn't allowed audio yet, or the same sound just played.
export function playSound(kind) {
  try {
    if (!soundsOn() || !SOUNDS[kind]) return;
    const now = Date.now(); if (now - (last[kind] || 0) < 800) return; last[kind] = now;
    const c = ctx(); if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
    if (c.state === "closed") return;
    SOUNDS[kind](c, c.currentTime + 0.02);
  } catch {}
}
