/* =========================================================
   Animated project visuals (canvas)
   - aurewas : PLC conveyor sorting simulation
   - vision  : AI camera detection HUD (AI-REWAS)
   - database: FIFO inventory queue
   ========================================================= */
(function () {
  'use strict';

  const C = {
    ink: '#0a1324', ink2: '#26344d', muted: '#7a8aa3', line: '#d6dfeb', soft: '#eef3fa',
    accent: '#0a5cff', accent2: '#00b8ff', ok: '#12b886', amber: '#f59f00', red: '#ef4444',
    metal: '#8795a8', plastic: '#2f9bff', paper: '#d9b77a'
  };
  const MONO = '"JetBrains Mono", ui-monospace, monospace';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  const ease = t => 1 - Math.pow(1 - t, 3);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** Generic runner: handles DPR, resize, visibility and the RAF loop. */
  function run(canvas, scene) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, raf = 0, last = 0, visible = false;
    const state = scene.init();

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.layout && scene.layout(state, W, H);
      if (!visible || reduceMotion) draw(0);
    }
    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      scene.frame(ctx, state, W, H, dt);
    }
    function loop(t) {
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      draw(dt);
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && !reduceMotion) { last = 0; raf = requestAnimationFrame(loop); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      visible && !document.hidden ? start() : stop();
    }, { threshold: 0.05 }).observe(canvas);
    document.addEventListener('visibilitychange', () => (document.hidden || !visible) ? stop() : start());
    resize();
    if (reduceMotion) {
      // render a few simulated seconds so the static frame is meaningful
      for (let i = 0; i < 160; i++) { ctx.clearRect(0, 0, W, H); scene.frame(ctx, state, W, H, 1 / 30); }
    }
  }

  /* ------------------------------------------------------------------
     AUREWAS — top-down view of the sorting conveyor
     ------------------------------------------------------------------ */
  const aurewas = {
    init() {
      return {
        items: [], t: 0, spawnIn: 0.4, n: 0,
        counts: { metal: 0, plastic: 0, paper: 0 },
        leds: { pe: 0, ind: 0, cap: 0, q0: 0, q1: 0, q2: 0 },
        plunger: [0, 0, 0], pulse: [0, 0, 0],
        log: ['> PLC RUN · SCAN 2.4 ms'], belt: 0, L: null
      };
    },
    layout(s, W, H) {
      const compact = W < 460;
      // design the scene in a band of at most 440px and centre it vertically
      const Hc = Math.min(H, 440), oy = (H - Hc) / 2;
      const beltH = clamp(Hc * 0.13, 34, 52);
      const beltY = oy + Hc * 0.47 - beltH / 2;
      const x0 = W * 0.04, x1 = W * 0.96;
      const gate = x0 + (x1 - x0) * 0.2;
      const st = [0.45, 0.66, 0.87].map(f => x0 + (x1 - x0) * f);
      const binW = Math.min(W * 0.17, 110), binH = clamp(Hc * 0.2, 54, 84);
      const binY = beltY + beltH + clamp(Hc * 0.09, 26, 44);
      const panelY = Math.max(14, oy + 4);
      s.L = { compact, beltH, beltY, x0, x1, gate, st, binW, binH, binY, panelY, size: clamp(beltH * 0.52, 15, 26), speed: Math.max(70, W * 0.12) };
    },
    frame(ctx, s, W, H, dt) {
      const L = s.L; if (!L) return;
      s.t += dt; s.belt = (s.belt + L.speed * dt) % 18;
      for (const k in s.leds) s.leds[k] = Math.max(0, s.leds[k] - dt * 2.2);
      s.plunger = s.plunger.map(p => Math.max(0, p - dt * 3.2));
      s.pulse = s.pulse.map(p => Math.max(0, p - dt * 2));

      // spawn
      s.spawnIn -= dt;
      if (s.spawnIn <= 0) {
        const types = ['metal', 'plastic', 'paper'];
        s.items.push({ type: types[Math.floor(Math.random() * 3)], x: L.x0 - L.size, y: 0, cls: null, state: 'belt', k: 0, id: ++s.n, rot: Math.random() * 6 });
        s.spawnIn = 1.15 + Math.random() * 0.7;
      }

      // update items
      const beltCy = L.beltY + L.beltH / 2;
      for (const it of s.items) {
        if (it.state === 'belt') {
          it.x += L.speed * dt; it.y = beltCy;
          if (!it.cls && it.x >= L.gate) {
            it.cls = it.type;
            s.leds.pe = 1;
            if (it.type === 'metal') s.leds.ind = 1;
            if (it.type === 'plastic') s.leds.cap = 1;
            s.log.unshift(`> #${String(it.id).padStart(3, '0')}  PE=1 IND=${it.type === 'metal' ? 1 : 0} CAP=${it.type === 'plastic' ? 1 : 0}  → ${it.type.toUpperCase()}`);
            s.log.length = Math.min(s.log.length, 3);
          }
          const idx = { metal: 0, plastic: 1, paper: 2 }[it.type];
          if (it.cls && it.x >= L.st[idx]) {
            it.x = L.st[idx]; it.state = 'eject'; it.k = 0; it.sy = it.y; it.idx = idx;
            s.plunger[idx] = 1; s.leds['q' + idx] = 1;
          }
        } else if (it.state === 'eject') {
          it.k += dt / 0.5;
          const e = ease(Math.min(1, it.k));
          it.y = it.sy + (L.binY + L.binH * 0.45 - it.sy) * e;
          if (it.k >= 1) { it.state = 'done'; s.counts[it.type]++; s.pulse[it.idx] = 1; }
        }
      }
      s.items = s.items.filter(it => it.state !== 'done' && it.x < W + 40);

      /* ---- draw ---- */
      const fs = L.compact ? 9 : 10.5;
      ctx.font = `500 ${fs}px ${MONO}`;
      ctx.textBaseline = 'middle';

      // bins
      const labels = ['METAL', 'PLASTIC', 'PAPER'], cols = [C.metal, C.plastic, C.paper], keys = ['metal', 'plastic', 'paper'];
      L.st.forEach((x, i) => {
        const bx = x - L.binW / 2, by = L.binY;
        // chute
        ctx.fillStyle = 'rgba(10,92,255,0.04)';
        ctx.fillRect(x - L.size * 0.9, L.beltY + L.beltH, L.size * 1.8, by - (L.beltY + L.beltH));
        ctx.save();
        if (s.pulse[i] > 0) { ctx.shadowColor = cols[i]; ctx.shadowBlur = 18 * s.pulse[i]; }
        rr(ctx, bx, by, L.binW, L.binH, 10);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = s.pulse[i] > 0 ? cols[i] : C.line; ctx.stroke();
        ctx.restore();
        ctx.fillStyle = cols[i];
        rr(ctx, bx, by, L.binW, 4, 2); ctx.fill();
        ctx.fillStyle = C.muted; ctx.textAlign = 'center';
        ctx.fillText(labels[i], x, by + L.binH * 0.32);
        ctx.fillStyle = C.ink; ctx.font = `600 ${L.compact ? 15 : 19}px "Space Grotesk", sans-serif`;
        ctx.fillText(String(s.counts[keys[i]]).padStart(2, '0'), x, by + L.binH * 0.68);
        ctx.font = `500 ${fs}px ${MONO}`;
      });

      // belt
      ctx.save();
      rr(ctx, L.x0, L.beltY, L.x1 - L.x0, L.beltH, L.beltH / 2);
      ctx.fillStyle = '#1b2638'; ctx.fill();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2;
      for (let x = L.x0 - 18 + s.belt; x < L.x1 + 18; x += 18) {
        ctx.beginPath(); ctx.moveTo(x, L.beltY); ctx.lineTo(x - 8, L.beltY + L.beltH); ctx.stroke();
      }
      ctx.restore();
      // rollers
      [L.x0 + L.beltH / 2, L.x1 - L.beltH / 2].forEach(rx => {
        ctx.beginPath(); ctx.arc(rx, L.beltY + L.beltH / 2, L.beltH * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = '#2b3a52'; ctx.fill();
        ctx.save(); ctx.translate(rx, L.beltY + L.beltH / 2); ctx.rotate(s.t * 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-L.beltH * 0.2, 0); ctx.lineTo(L.beltH * 0.2, 0); ctx.stroke();
        ctx.restore();
      });

      // photoelectric beam
      const beamOn = s.leds.pe > 0.05;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = beamOn ? 'rgba(239,68,68,0.9)' : 'rgba(239,68,68,0.35)';
      ctx.lineWidth = beamOn ? 2 : 1.2;
      ctx.beginPath(); ctx.moveTo(L.gate, L.beltY - 6); ctx.lineTo(L.gate, L.beltY + L.beltH + 6); ctx.stroke();
      ctx.restore();

      // sensors (above belt at the gate)
      const sensors = [['PE', 'pe', C.red], ['IND', 'ind', C.metal], ['CAP', 'cap', C.plastic]];
      const sw = L.compact ? 30 : 36, sh = 20, sy = L.beltY - sh - 8;
      sensors.forEach(([lab, key, col], i) => {
        const sx = L.gate - sw * 1.5 - 4 + i * (sw + 4);
        rr(ctx, sx, sy, sw, sh, 5);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = s.leds[key] > 0.05 ? col : C.line; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.beginPath(); ctx.arc(sx + 7, sy + sh / 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = s.leds[key] > 0.05 ? C.ok : '#cfd8e3'; ctx.fill();
        ctx.fillStyle = C.ink2; ctx.textAlign = 'left';
        ctx.font = `500 ${L.compact ? 8 : 9}px ${MONO}`;
        ctx.fillText(lab, sx + 13, sy + sh / 2 + 0.5);
      });
      ctx.font = `500 ${fs}px ${MONO}`;

      // solenoids
      L.st.forEach((x, i) => {
        const hw = L.size * 0.9, hh = 18, hy = L.beltY - hh - 8;
        const ext = ease(s.plunger[i]) * (L.beltH * 0.75);
        // rod
        ctx.fillStyle = '#9aa8bc';
        ctx.fillRect(x - 2.5, hy + hh, 5, 6 + ext);
        // plunger head
        rr(ctx, x - hw * 0.55, hy + hh + 4 + ext, hw * 1.1, 6, 3);
        ctx.fillStyle = s.plunger[i] > 0.05 ? C.accent : '#6b7a90'; ctx.fill();
        // housing
        rr(ctx, x - hw / 2, hy, hw, hh, 5);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = s.plunger[i] > 0.05 ? C.accent : C.line; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.font = `500 ${L.compact ? 7.5 : 8.5}px ${MONO}`;
        ctx.fillText('SOL' + (i + 1), x, hy + hh / 2 + 0.5);
      });
      ctx.font = `500 ${fs}px ${MONO}`;

      // items
      for (const it of s.items) drawItem(ctx, it, L.size);

      // PLC panel (top right)
      const pw = L.compact ? Math.min(W - 24, 230) : Math.min(W * 0.56, 300), ph = L.compact ? 54 : 62;
      const px = W - pw - 14, py = L.panelY;
      rr(ctx, px, py, pw, ph, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.94)'; ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = 'left'; ctx.fillStyle = C.accent; ctx.font = `600 ${L.compact ? 8.5 : 9.5}px ${MONO}`;
      ctx.fillText('OMRON CP2E-N', px + 10, py + 13);
      // IO leds
      const io = [['I0', s.leds.pe], ['I1', s.leds.ind], ['I2', s.leds.cap], ['Q0', s.leds.q0], ['Q1', s.leds.q1], ['Q2', s.leds.q2]];
      ctx.font = `500 ${L.compact ? 7.5 : 8.5}px ${MONO}`;
      const ioStart = px + (L.compact ? 92 : 108), ioStep = L.compact ? 22 : 31;
      io.forEach(([lab, v], i) => {
        const lx = ioStart + i * ioStep;
        if (lx + 18 > px + pw) return;
        ctx.beginPath(); ctx.arc(lx, py + 13, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = v > 0.05 ? (i < 3 ? C.ok : C.amber) : '#d5dde8'; ctx.fill();
        ctx.fillStyle = C.muted; ctx.fillText(lab, lx + 5, py + 13.5);
      });
      ctx.fillStyle = C.ink2; ctx.font = `500 ${L.compact ? 8 : 9.5}px ${MONO}`;
      const maxChars = Math.floor((pw - 20) / (L.compact ? 4.9 : 5.8));
      s.log.slice(0, 2).forEach((line, i) => {
        ctx.globalAlpha = i === 0 ? 1 : 0.45;
        ctx.fillText(line.length > maxChars ? line.slice(0, maxChars - 1) + '…' : line, px + 10, py + 30 + i * (L.compact ? 12 : 14));
      });
      ctx.globalAlpha = 1;
    }
  };

  function drawItem(ctx, it, size) {
    ctx.save();
    ctx.translate(it.x, it.y);
    const fade = it.state === 'eject' ? 1 - Math.max(0, (it.k - 0.75) / 0.25) : 1;
    ctx.globalAlpha = fade;
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    if (it.type === 'metal') {
      ctx.beginPath(); ctx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
      const g = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
      g.addColorStop(0, '#e8edf3'); g.addColorStop(0.5, '#a3afbf'); g.addColorStop(1, '#6f7c8f');
      ctx.fillStyle = g; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.beginPath(); ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    } else if (it.type === 'plastic') {
      ctx.rotate(it.rot * 0.15);
      rr(ctx, -size * 0.62, -size * 0.3, size * 1.1, size * 0.6, size * 0.28);
      ctx.fillStyle = 'rgba(47,155,255,0.85)'; ctx.fill();
      ctx.shadowColor = 'transparent';
      rr(ctx, size * 0.45, -size * 0.14, size * 0.2, size * 0.28, 2);
      ctx.fillStyle = '#0a5cff'; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-size * 0.45, -size * 0.18, size * 0.6, size * 0.07);
    } else {
      ctx.rotate(it.rot * 0.2 - 0.6);
      ctx.fillStyle = '#f1e2c2';
      ctx.fillRect(-size * 0.48, -size * 0.36, size * 0.96, size * 0.72);
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(140,110,60,0.45)'; ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-size * 0.32, i * size * 0.16); ctx.lineTo(size * 0.32, i * size * 0.16); ctx.stroke(); }
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------
     VISION — camera HUD with bounding boxes (AI-REWAS)
     ------------------------------------------------------------------ */
  const vision = {
    init() { return { items: [], t: 0, spawnIn: 0, fps: 30, n: 0 }; },
    frame(ctx, s, W, H, dt) {
      s.t += dt;
      const size = clamp(H * 0.16, 28, 46), speed = Math.max(60, W * 0.1);
      const cy = H * 0.56;
      s.spawnIn -= dt;
      if (s.spawnIn <= 0) {
        const types = ['metal', 'plastic', 'paper'];
        s.items.push({ type: types[Math.floor(Math.random() * 3)], x: -size, y: cy + (Math.random() - 0.5) * H * 0.08, rot: Math.random() * 6, conf: 0.9 + Math.random() * 0.095, id: ++s.n, state: 'belt' });
        s.spawnIn = 1.0 + Math.random() * 0.6;
      }
      s.items.forEach(it => (it.x += speed * dt));
      s.items = s.items.filter(it => it.x < W + size * 2);

      // belt band
      ctx.fillStyle = '#e9eff7';
      ctx.fillRect(0, cy - size * 1.05, W, size * 2.1);
      ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, cy - size * 1.05); ctx.lineTo(W, cy - size * 1.05); ctx.moveTo(0, cy + size * 1.05); ctx.lineTo(W, cy + size * 1.05); ctx.stroke();

      // viewfinder
      const vw = Math.min(W * 0.5, 280), vh = size * 3.2, vx = W / 2 - vw / 2, vy = cy - vh / 2;
      ctx.fillStyle = 'rgba(10,92,255,0.04)'; ctx.fillRect(vx, vy, vw, vh);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
      const cl = 16;
      [[vx, vy, 1, 1], [vx + vw, vy, -1, 1], [vx, vy + vh, 1, -1], [vx + vw, vy + vh, -1, -1]].forEach(([x, y, sx, sy]) => {
        ctx.beginPath(); ctx.moveTo(x, y + sy * cl); ctx.lineTo(x, y); ctx.lineTo(x + sx * cl, y); ctx.stroke();
      });
      // scan line
      const sl = vy + ((s.t * 0.8) % 1) * vh;
      const g = ctx.createLinearGradient(0, sl - 18, 0, sl);
      g.addColorStop(0, 'rgba(0,184,255,0)'); g.addColorStop(1, 'rgba(0,184,255,0.35)');
      ctx.fillStyle = g; ctx.fillRect(vx, sl - 18, vw, 18);

      for (const it of s.items) {
        drawItem(ctx, it, size);
        const inView = it.x > vx + size * 0.3 && it.x < vx + vw - size * 0.3;
        if (inView) {
          const bw = size * 1.45, bh = size * 1.25;
          ctx.strokeStyle = it.type === 'metal' ? C.ink2 : it.type === 'plastic' ? C.accent : C.amber;
          ctx.lineWidth = 1.6; ctx.setLineDash([]);
          ctx.strokeRect(it.x - bw / 2, it.y - bh / 2, bw, bh);
          const label = `${it.type.toUpperCase()} ${it.conf.toFixed(2)}`;
          ctx.font = `600 ${W < 460 ? 8.5 : 10}px ${MONO}`;
          const tw = ctx.measureText(label).width + 10;
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fillRect(it.x - bw / 2, it.y - bh / 2 - 16, tw, 15);
          ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
          ctx.fillText(label, it.x - bw / 2 + 5, it.y - bh / 2 - 8);
          if (!it.logged) { it.logged = true; s.lastLabel = label; }
        }
      }

      // HUD
      ctx.font = `500 ${W < 460 ? 8.5 : 10}px ${MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillStyle = C.ink2;
      ctx.fillText('CAM-01 · 1280×720 · 30 FPS', 16, H - 22);
      ctx.textAlign = 'right';
      ctx.fillStyle = C.accent;
      ctx.fillText(s.lastLabel ? '→ PLC  ' + s.lastLabel.split(' ')[0] : '→ PLC  WAITING', W - 16, H - 22);
      // rec dot
      ctx.beginPath(); ctx.arc(W - 22, 22, 4, 0, Math.PI * 2);
      ctx.fillStyle = Math.sin(s.t * 5) > 0 ? C.red : 'rgba(239,68,68,0.3)'; ctx.fill();
      ctx.fillStyle = C.muted; ctx.fillText('INFERENCE', W - 32, 22.5);
    }
  };

  /* ------------------------------------------------------------------
     DATABASE — FIFO queue
     ------------------------------------------------------------------ */
  const database = {
    init() {
      const q = [];
      for (let i = 0; i < 6; i++) q.push({ id: 4100 + i, x: null, a: 1 });
      return { q, next: 4106, t: 0, shift: 0, phase: 0, level: [0.62, 0.48, 0.81, 0.35, 0.7] };
    },
    frame(ctx, s, W, H, dt) {
      s.t += dt;
      const compact = W < 460;
      const cw = compact ? 50 : 66, ch = compact ? 40 : 48, gap = 8;
      const n = s.q.length;
      const totalW = n * cw + (n - 1) * gap;
      const qx = W / 2 - totalW / 2, qy = H * 0.36;
      // cycle every 1.6s: shift left by one cell
      s.phase += dt / 1.6;
      if (s.phase >= 1) { s.phase = 0; s.q.shift(); s.q.push({ id: s.next++ }); }
      const e = ease(clamp((s.phase - 0.55) / 0.45, 0, 1));
      const off = e * (cw + gap);

      ctx.font = `600 ${compact ? 9 : 10.5}px ${MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      // labels
      ctx.fillStyle = C.ok; ctx.fillText('OUT ← oldest first', qx + cw / 2 + 10, qy - 22);
      ctx.fillStyle = C.accent; ctx.fillText('IN ← new batch', qx + totalW - cw / 2 - 10, qy + ch + 24);

      s.q.forEach((c, i) => {
        let x = qx + i * (cw + gap) - off;
        let alpha = 1;
        if (i === 0) alpha = 1 - e;
        if (i === n - 1) alpha = 1;
        ctx.globalAlpha = alpha;
        rr(ctx, x, qy, cw, ch, 8);
        ctx.fillStyle = i === 0 ? 'rgba(18,184,134,0.1)' : '#fff'; ctx.fill();
        ctx.strokeStyle = i === 0 ? C.ok : C.line; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.fillStyle = C.ink2; ctx.font = `600 ${compact ? 9 : 11}px ${MONO}`;
        ctx.fillText('B-' + c.id, x + cw / 2, qy + ch / 2 - 6);
        ctx.fillStyle = C.muted; ctx.font = `500 ${compact ? 7.5 : 9}px ${MONO}`;
        ctx.fillText('d+' + i, x + cw / 2, qy + ch / 2 + 9);
      });
      // incoming cell
      ctx.globalAlpha = e;
      const nx = qx + n * (cw + gap) - off;
      rr(ctx, nx, qy, cw, ch, 8);
      ctx.fillStyle = 'rgba(10,92,255,0.06)'; ctx.fill(); ctx.strokeStyle = C.accent; ctx.stroke();
      ctx.globalAlpha = 1;

      // stock bars
      const by = H * 0.68, bh = H * 0.2, bw = compact ? 16 : 22, bgap = compact ? 12 : 18;
      const tot = s.level.length * bw + (s.level.length - 1) * bgap;
      const bx0 = W / 2 - tot / 2;
      s.level = s.level.map((v, i) => clamp(v + Math.sin(s.t * 0.9 + i * 1.7) * dt * 0.08, 0.15, 0.95));
      s.level.forEach((v, i) => {
        const x = bx0 + i * (bw + bgap);
        rr(ctx, x, by, bw, bh, 5); ctx.fillStyle = '#e9eff7'; ctx.fill();
        rr(ctx, x, by + bh * (1 - v), bw, bh * v, 5);
        ctx.fillStyle = v < 0.3 ? C.amber : C.accent; ctx.fill();
      });
      ctx.fillStyle = C.muted; ctx.font = `500 ${compact ? 8 : 9.5}px ${MONO}`;
      ctx.fillText('RAW-MATERIAL STOCK LEVEL', W / 2, by + bh + 16);
    }
  };

  window.ProjectVisuals = {
    mount(canvas, kind) {
      const scene = { aurewas, vision, database }[kind];
      if (scene && canvas.getContext) run(canvas, scene);
    }
  };
})();
