/* =========================================================
   ÉCRAN DE CHARGEMENT — façon jeu vidéo
   La progression suit le vrai chargement de la page
   (document, polices, images), avec une durée minimale
   pour que la séquence se lise. Une touche ou un clic
   permet d'entrer dès que c'est prêt ; sinon on entre seul.
   Visite suivante dans la même session : séquence courte.
========================================================= */
(function(){
  const loader = document.getElementById('loader');
  if(!loader) return;

  const $ = id => document.getElementById(id);
  const segsEl = $('ldSegs'), pctEl = $('ldPct'), statusEl = $('ldStatus');
  const logEl = $('ldLog'), ring = $('ldRing'), tipEl = $('ldTip'), clockEl = $('ldClock');

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seen = false;
  try { seen = sessionStorage.getItem('mag-loaded') === '1'; } catch(e){}
  const MIN_MS = reduce ? 300 : (seen ? 700 : 2600);

  document.documentElement.classList.add('is-loading');

  /* ----- barre segmentée ----- */
  const SEGS = 32;
  segsEl.innerHTML = Array.from({length: SEGS}, () => '<i></i>').join('');
  const segs = [...segsEl.children];

  /* ----- anneau ----- */
  const R = 88, C = 2 * Math.PI * R;
  ring.style.strokeDasharray = C;
  ring.style.strokeDashoffset = C;

  /* ----- horloge du HUD ----- */
  const tick = () => {
    const d = new Date();
    clockEl.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
  };
  tick();
  const clockIv = setInterval(tick, 1000);

  /* ----- astuces ----- */
  const TIPS = [
    'Le thème clair ou sombre se change en haut à droite.',
    'Les projets se mettent à jour tout seuls depuis GitHub.',
    '↑ ↑ ↓ ↓ ← → ← → B A… essaie sur la page.',
    'Le fond est un réseau de neurones : passe la souris dessus.',
  ];
  const touch = window.matchMedia('(hover:none)').matches;
  const tips = touch ? TIPS.filter(t => !/souris|↑/.test(t)) : TIPS;
  tipEl.textContent = tips[Math.floor(Math.random() * tips.length)];

  /* ----- étapes affichées ----- */
  const STEPS = [
    [0,  'Initialisation du système'],
    [18, 'Connexion au réseau neuronal'],
    [36, 'Chargement des polices'],
    [55, 'Récupération des projets GitHub'],
    [74, 'Compilation de l\'interface'],
    [92, 'Vérification finale'],
  ];
  let stepIdx = -1;
  function setStep(pct){
    while(stepIdx + 1 < STEPS.length && pct >= STEPS[stepIdx + 1][0]){
      stepIdx++;
      statusEl.textContent = STEPS[stepIdx][1];
      if(stepIdx > 0){
        const li = document.createElement('li');
        li.innerHTML = `<b>OK</b> ${STEPS[stepIdx - 1][1]}`;
        logEl.appendChild(li);
        while(logEl.children.length > 3) logEl.firstChild.remove();
      }
    }
  }

  /* ----- vraie progression ----- */
  let target = 10;
  const bump = v => { target = Math.max(target, v); };
  if(document.readyState !== 'loading') bump(35);
  else document.addEventListener('DOMContentLoaded', () => bump(35));
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => bump(65));
  else bump(65);
  if(document.readyState === 'complete') bump(100);
  else window.addEventListener('load', () => bump(100));
  // filet de sécurité : jamais bloqué plus de 6 s
  setTimeout(() => bump(100), 6000);

  /* ----- boucle d'affichage ----- */
  const start = performance.now();
  let shown = 0, done = false;
  function frame(now){
    // la barre ne dépasse pas le temps minimal, ni le vrai chargement
    const timeCap = Math.min(100, ((now - start) / MIN_MS) * 100);
    const goal = Math.min(target, timeCap);
    shown += (goal - shown) * 0.2;
    if(goal - shown < 0.4) shown = goal;
    const pct = Math.floor(shown);

    pctEl.textContent = pct;
    loader.setAttribute('aria-valuenow', pct);
    ring.style.strokeDashoffset = C * (1 - shown / 100);
    const lit = Math.round((shown / 100) * SEGS);
    segs.forEach((s, i) => s.classList.toggle('on', i < lit));
    setStep(shown);

    if(pct >= 100 && !done){ done = true; ready(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ----- prêt : on attend une touche ou on entre seul ----- */
  let entered = false;
  function ready(){
    statusEl.textContent = 'Système prêt';
    const li = document.createElement('li');
    li.innerHTML = '<b>OK</b> Vérification finale';
    logEl.appendChild(li);
    while(logEl.children.length > 3) logEl.firstChild.remove();
    loader.classList.add('is-ready');

    const enter = () => {
      if(entered) return;
      entered = true;
      window.removeEventListener('keydown', enter);
      loader.removeEventListener('click', enter);
      leave();
    };
    window.addEventListener('keydown', enter);
    loader.addEventListener('click', enter);
    setTimeout(enter, reduce ? 0 : (seen ? 250 : 1400));
  }

  function leave(){
    try { sessionStorage.setItem('mag-loaded', '1'); } catch(e){}
    loader.classList.add('is-leaving');
    document.documentElement.classList.remove('is-loading');
    // lance l'entrée du hero pendant que l'écran s'ouvre
    setTimeout(() => {
      document.getElementById('hero')?.classList.add('hero-content-ready');
      document.querySelector('.hero-title')?.classList.add('animate');
    }, reduce ? 0 : 250);
    setTimeout(() => { clearInterval(clockIv); loader.remove(); }, reduce ? 50 : 1000);
  }
})();
