/* =========================================================
   FOND « RÉSEAU DE NEURONES »
   Des neurones reliés à leurs voisins ; des impulsions
   parcourent les connexions et en allument d'autres.
   La souris stimule les neurones proches.
========================================================= */
(function(){
  const canvas = document.getElementById('bg');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, DPR = 1;
  let nodes = [], edges = [], adj = [], pulses = [];
  let colors = {};
  const mouse = { x: -9999, y: -9999, lastFire: 0 };

  /* ---------- couleurs depuis les variables CSS ---------- */
  function hexToRgb(hex){
    const h = hex.trim().replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, c => c + c) : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
  }
  function readColors(){
    const cs = getComputedStyle(document.documentElement);
    const light = cs.getPropertyValue('color-scheme').trim() === 'light';
    colors = {
      fg: cs.getPropertyValue('--fg-rgb').trim() || '255,255,255',
      a1: hexToRgb(cs.getPropertyValue('--accent') || '#ff4d1c'),
      a2: hexToRgb(cs.getPropertyValue('--accent2') || '#00e5c8'),
      edge: light ? .10 : .07,   // opacité des connexions au repos
      node: light ? .30 : .22,   // opacité des neurones au repos
      glow: light ? .55 : .9,    // intensité des neurones activés
    };
  }

  /* ---------- construction du réseau ---------- */
  function build(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const target = Math.round(Math.min(120, Math.max(36, (W * H) / 15000)));
    // placement en grille irrégulière : réparti sans paquets
    const cols = Math.ceil(Math.sqrt(target * W / H)), rows = Math.ceil(target / cols);
    const cw = W / cols, ch = H / rows;
    nodes = [];
    for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
      const x = (c + .15 + Math.random() * .7) * cw;
      const y = (r + .15 + Math.random() * .7) * ch;
      nodes.push({
        ax: x, ay: y, x, y,
        ph: Math.random() * Math.PI * 2,            // phase de dérive
        sp: .00018 + Math.random() * .00022,        // vitesse de dérive
        amp: 6 + Math.random() * 10,                // amplitude de dérive
        r: 1.2 + Math.random() * 1.4,
        act: 0,                                     // activation 0..1
        tint: Math.random() < .7 ? 'a1' : 'a2',
      });
    }

    // chaque neurone se connecte à ses 3 voisins les plus proches
    const maxD = Math.max(cw, ch) * 1.9;
    const seen = new Set();
    edges = []; adj = nodes.map(() => []);
    nodes.forEach((n, i) => {
      nodes.map((m, j) => [j, Math.hypot(n.ax - m.ax, n.ay - m.ay)])
        .filter(([j, d]) => j !== i && d < maxD)
        .sort((a, b) => a[1] - b[1]).slice(0, 3)
        .forEach(([j]) => {
          const key = i < j ? i + '-' + j : j + '-' + i;
          if(seen.has(key)) return;
          seen.add(key);
          edges.push([i, j]);
          adj[i].push(j); adj[j].push(i);
        });
    });
    pulses = [];
  }

  /* ---------- activité ---------- */
  function fire(i, from = -1, depth = 0){
    nodes[i].act = 1;
    if(depth > 5) return;
    const next = adj[i].filter(j => j !== from);
    next.sort(() => Math.random() - .5);
    const n = depth === 0 ? Math.min(3, next.length) : (Math.random() < .55 ? 1 : 0) + (Math.random() < .15 ? 1 : 0);
    for(let k = 0; k < n && pulses.length < 70; k++){
      const j = next[k];
      pulses.push({ a: i, b: j, t: 0, dur: 650 + Math.random() * 700, depth: depth + 1, tint: nodes[i].tint });
    }
  }

  /* ---------- dessin ---------- */
  function draw(now, dt){
    ctx.clearRect(0, 0, W, H);

    for(const n of nodes){
      n.x = n.ax + Math.cos(now * n.sp + n.ph) * n.amp;
      n.y = n.ay + Math.sin(now * n.sp * 1.3 + n.ph) * n.amp;
      n.act = Math.max(0, n.act - dt / 1400);
    }

    // connexions
    ctx.lineWidth = 1;
    for(const [i, j] of edges){
      const a = nodes[i], b = nodes[j];
      const act = Math.max(a.act, b.act);
      const mx = (a.x + b.x) / 2 - mouse.x, my = (a.y + b.y) / 2 - mouse.y;
      const near = Math.max(0, 1 - Math.hypot(mx, my) / 220);
      const alpha = colors.edge + act * .18 + near * .12;
      ctx.strokeStyle = act > .05 ? `rgba(${colors[a.act >= b.act ? a.tint : b.tint]},${alpha})` : `rgba(${colors.fg},${alpha})`;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // impulsions
    for(let k = pulses.length - 1; k >= 0; k--){
      const p = pulses[k];
      p.t += dt;
      const f = Math.min(1, p.t / p.dur);
      const a = nodes[p.a], b = nodes[p.b];
      const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
      // petite traîne
      const f0 = Math.max(0, f - .18);
      const g = ctx.createLinearGradient(a.x + (b.x - a.x) * f0, a.y + (b.y - a.y) * f0, x, y);
      g.addColorStop(0, `rgba(${colors[p.tint]},0)`);
      g.addColorStop(1, `rgba(${colors[p.tint]},${colors.glow})`);
      ctx.strokeStyle = g; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(a.x + (b.x - a.x) * f0, a.y + (b.y - a.y) * f0); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = `rgba(${colors[p.tint]},${colors.glow})`;
      ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
      if(f >= 1){ pulses.splice(k, 1); fire(p.b, p.a, p.depth); }
    }

    // neurones
    for(const n of nodes){
      if(n.act > .02){
        const rad = n.r + 10 * n.act;
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, rad);
        g.addColorStop(0, `rgba(${colors[n.tint]},${.55 * n.act * colors.glow})`);
        g.addColorStop(1, `rgba(${colors[n.tint]},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(n.x, n.y, rad, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = n.act > .05
        ? `rgba(${colors[n.tint]},${Math.max(colors.node, n.act * colors.glow)})`
        : `rgba(${colors.fg},${colors.node})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + n.act * 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ---------- boucle ---------- */
  let last = performance.now(), nextSpont = 0;
  function loop(now){
    const dt = Math.min(50, now - last); last = now;
    if(now > nextSpont){
      fire(Math.floor(Math.random() * nodes.length));
      nextSpont = now + 1100 + Math.random() * 1400;
    }
    draw(now, dt);
    requestAnimationFrame(loop);
  }

  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    const now = performance.now();
    if(now - mouse.lastFire < 280) return;
    let best = -1, bd = 90;
    nodes.forEach((n, i) => { const d = Math.hypot(n.x - mouse.x, n.y - mouse.y); if(d < bd){ bd = d; best = i; } });
    if(best >= 0 && nodes[best].act < .3){ fire(best); mouse.lastFire = now; }
  }, { passive: true });
  window.addEventListener('mouseout', e => { if(!e.relatedTarget){ mouse.x = mouse.y = -9999; } });

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { build(); if(reduce) draw(0, 0); }, 150);
  });
  document.addEventListener('themechange', () => { readColors(); if(reduce) draw(0, 0); });

  readColors();
  build();
  if(reduce){
    // mouvement réduit : une image fixe avec quelques neurones allumés
    nodes.forEach(n => { if(Math.random() < .08) n.act = .8; });
    draw(0, 0);
  } else {
    requestAnimationFrame(loop);
  }
})();
