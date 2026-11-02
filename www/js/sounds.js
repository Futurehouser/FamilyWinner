// FamilyWinner - efectos de sonido sintetizados con Web Audio (sin archivos externos)
(function () {
  'use strict';
  const MUTE_KEY = 'fw-muted';
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* nada */ }

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const hz = n => 440 * Math.pow(2, (n - 69) / 12); // nota MIDI -> frecuencia

  // Una nota con envolvente sencilla; opcionalmente con vibrato y filtro paso bajo
  function tone(ac, out, { note, start, dur, type = 'triangle', vol = 0.25, vibrato = 0, slide = 0, lowpass = 0 }) {
    const t0 = ac.currentTime + start;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz(note), t0);
    if (slide) osc.frequency.linearRampToValueAtTime(hz(note + slide), t0 + dur);
    if (vibrato) {
      const lfo = ac.createOscillator();
      const lg = ac.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = hz(note) * 0.03 * vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.setValueAtTime(vol, t0 + Math.max(0.03, dur - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc.connect(g);
    if (lowpass) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      node = node.connect(f);
    }
    node.connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function master(ac, vol) {
    const m = ac.createGain();
    m.gain.value = vol;
    m.connect(ac.destination);
    return m;
  }

  // Fanfarria ascendente que termina en acorde mayor
  function victory() {
    const ac = !muted && audio();
    if (!ac) return;
    const out = master(ac, 0.8);
    const seq = [67, 72, 76, 79]; // Sol4 Do5 Mi5 Sol5
    seq.forEach((n, i) => {
      tone(ac, out, { note: n, start: i * 0.11, dur: 0.14, type: 'square', vol: 0.09 });
      tone(ac, out, { note: n, start: i * 0.11, dur: 0.14, type: 'triangle', vol: 0.18 });
    });
    [72, 76, 79, 84].forEach(n => { // acorde de Do mayor final
      tone(ac, out, { note: n, start: 0.46, dur: 0.75, type: 'triangle', vol: 0.14, vibrato: 0.3 });
      tone(ac, out, { note: n, start: 0.46, dur: 0.75, type: 'square', vol: 0.04 });
    });
  }

  // "Trombón triste": cuatro notas descendentes, la última larga y temblorosa
  function failure() {
    const ac = !muted && audio();
    if (!ac) return;
    const out = master(ac, 0.9);
    const seq = [[55, 0.0, 0.32], [54, 0.36, 0.32], [53, 0.72, 0.32], [52, 1.08, 0.95]]; // Sol3 Fa#3 Fa3 Mi3
    seq.forEach(([n, start, dur], i) => {
      const last = i === seq.length - 1;
      tone(ac, out, { note: n, start, dur, type: 'sawtooth', vol: 0.22, lowpass: 900, vibrato: last ? 1 : 0, slide: last ? -1 : -0.3 });
    });
  }

  function setMuted(v) {
    muted = !!v;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* nada */ }
  }

  window.FWSounds = { victory, failure, setMuted, isMuted: () => muted, unlock: audio };
})();
