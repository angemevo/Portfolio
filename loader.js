/* =========================================================
   ÉCRAN DE CHARGEMENT
   Un petit réseau de neurones s'allume nœud par nœud pendant
   que la page charge (document, polices, images). Couleurs et
   fond suivent le thème actif. Séquence courte aux visites
   suivantes de la même session.
========================================================= */
(function(){
  const loader = document.getElementById('loader');
  if(!loader) return;

  const fill = document.getElementById('ldFill');
  const pctEl = document.getElementById('ldPct');
  const gEdges = loader.querySelector('.ld-edges');
  const gNodes = loader.querySelector('.ld-nodes');
  const NS = 'http://www.w3.org/2000/svg';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seen = false;
  try { seen = sessionStorage.getItem('mag-loaded') === '1'; } catch(e){}
  const MIN_MS = reduce ? 200 : (seen ? 400 : 1400);

  document.documentElement.classList.add('is-loading');

  /* ----- réseau : 8 neurones de gauche à droite ----- */
  const P = [[8,30],[44,12],[52,48],[96,28],[140,10],[150,46],[196,26],[232,30]];
  const E = [[0,1],[0,2],[1,3],[2,3],[3,4],[3,5],[4,6],[5,6],[6,7],[1,4],[2,5]];
  const nodes = P.map(([x, y]) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 2.4);
    gNodes.appendChild(c);
    return c;
  });
  nodes[nodes.length - 1].classList.add('last');
  const edges = E.map(([a, b]) => {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', P[a][0]); l.setAttribute('y1', P[a][1]);
    l.setAttribute('x2', P[b][0]); l.setAttribute('y2', P[b][1]);
    gEdges.appendChild(l);
    return { el: l, a, b };
  });

  /* ----- vraie progression ----- */
  let target = 10;
  const bump = v => { target = Math.max(target, v); };
  if(document.readyState !== 'loading') bump(40);
  else document.addEventListener('DOMContentLoaded', () => bump(40));
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => bump(70));
  else bump(70);
  if(document.readyState === 'complete') bump(100);
  else window.addEventListener('load', () => bump(100));
  setTimeout(() => bump(100), 5000); // jamais bloqué plus de 5 s

  /* ----- affichage ----- */
  const start = performance.now();
  let shown = 0, finished = false;
  function frame(now){
    const timeCap = Math.min(100, ((now - start) / MIN_MS) * 100);
    const goal = Math.min(target, timeCap);
    shown += (goal - shown) * 0.2;
    if(goal - shown < 0.5) shown = goal;

    const pct = Math.floor(shown);
    pctEl.textContent = pct;
    loader.setAttribute('aria-valuenow', pct);
    fill.style.transform = `scaleX(${shown / 100})`;

    // un neurone s'allume à chaque palier ; une connexion quand ses deux neurones le sont
    const lit = Math.floor((shown / 100) * (nodes.length - 1) + 0.0001);
    nodes.forEach((n, i) => n.classList.toggle('on', i <= lit));
    edges.forEach(e => e.el.classList.toggle('on', e.a <= lit && e.b <= lit));

    if(pct >= 100){ if(!finished){ finished = true; setTimeout(leave, reduce ? 0 : 250); } return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function leave(){
    try { sessionStorage.setItem('mag-loaded', '1'); } catch(e){}
    loader.classList.add('is-leaving');
    document.documentElement.classList.remove('is-loading');
    document.getElementById('hero')?.classList.add('hero-content-ready');
    document.querySelector('.hero-title')?.classList.add('animate');
    setTimeout(() => loader.remove(), 700);
  }
})();
