/* =========================================================
   ÉCRAN DE CHARGEMENT
   Une barre suit le chargement de la page (document, polices,
   images). Couleurs et fond suivent le thème actif. Séquence courte aux visites
   suivantes de la même session.
========================================================= */
(function(){
  const loader = document.getElementById('loader');
  if(!loader) return;

  const fill = document.getElementById('ldFill');
  const pctEl = document.getElementById('ldPct');

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seen = false;
  try { seen = sessionStorage.getItem('mag-loaded') === '1'; } catch(e){}
  const MIN_MS = reduce ? 200 : (seen ? 400 : 1400);

  document.documentElement.classList.add('is-loading');

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
