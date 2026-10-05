/* =========================================================
   PROJETS — rendus depuis data/projects.json
   Le fichier est régénéré chaque jour par GitHub Actions.
   On lit d'abord la version brute du dépôt (à jour sans attendre
   le redéploiement de GitHub Pages), puis la copie locale.
========================================================= */
(function(){
  const SOURCES = [
    'https://raw.githubusercontent.com/angemevo/Portfolio/master/data/projects.json',
    'data/projects.json',
  ];
  const INITIAL = 9;

  const grid  = document.getElementById('projGrid');
  const more  = document.getElementById('projMore');
  const empty = document.getElementById('projEmpty');
  const count = document.getElementById('projCount');
  if(!grid) return;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : null;

  // teinte stable dérivée du nom, pour que chaque projet garde sa couleur
  function hue(name){
    let h = 0;
    for(const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  // les chemins d'images sont relatifs à la source du JSON (dépôt brut ou site)
  let assetBase = '';
  const imgUrl = src => {
    if(!src) return null;
    if(/^https?:\/\//i.test(src)) return src;
    if(/^[\w./-]+$/.test(src)) return assetBase + src.replace(/^\.?\//, '');
    return null;
  };

  function card(p){
    const gh   = safeUrl(p.github);
    const img  = imgUrl(p.image);
    const demo = safeUrl(p.demo);
    const tags = (p.stack || []).slice(0, 5)
      .map((t, i) => `<span class="proj-tag pt${(i % 4) + 1}">${esc(t)}</span>`).join('');
    const links = [
      demo ? `<a class="proj-link pl-live" href="${esc(demo)}" target="_blank" rel="noopener">Démo</a>` : '',
      gh && !p.private ? `<a class="proj-link pl-gh" href="${esc(gh)}" target="_blank" rel="noopener">GitHub</a>` : '',
    ].join('') || (p.private ? '<span class="proj-private-note">Code privé</span>' : '');
    const stars = p.stars > 0 ? `<span class="proj-stars" title="Étoiles GitHub">★ ${p.stars}</span>` : '';

    return `
      <article class="proj-card" style="--h:${hue(p.repo || p.name)}">
        <div class="proj-thumb">
          <div class="proj-thumb-bg"></div>
          ${img
            ? `<img class="proj-shot" src="${esc(img)}" alt="Capture d'écran de ${esc(p.name)}" loading="lazy" decoding="async" onerror="this.remove()">`
            : `<span class="proj-thumb-emoji" aria-hidden="true">${esc(p.emoji || '🧪')}</span>`}
          <div class="proj-thumb-overlay"></div>
          <div class="proj-badges">
            ${p.featured ? '<span class="proj-badge">Sélection</span>' : ''}
            ${p.private ? '<span class="proj-badge proj-badge-private" title="Code source privé">Privé</span>' : ''}
          </div>
        </div>
        <div class="proj-body">
          <h3 class="proj-name">${esc(p.name)}</h3>
          <p class="proj-desc">${esc(p.description || 'Projet en cours de documentation.')}</p>
          <div class="proj-stack">${tags}</div>
        </div>
        <div class="proj-footer">
          <div class="proj-links">${links}</div>
          <div class="proj-meta">${stars}<span class="proj-yr">${esc(p.year || '')}</span></div>
        </div>
      </article>`;
  }

  async function load(){
    for(const url of SOURCES){
      try{
        const res = await fetch(url, { cache: 'no-cache' });
        if(!res.ok) continue;
        const data = await res.json();
        if(Array.isArray(data.projects) && data.projects.length){
          assetBase = url.replace(/data\/projects\.json$/, '');
          return data.projects;
        }
      }catch(e){ /* source suivante */ }
    }
    return null;
  }

  // Entrée des cartes : elles apparaissent une à une, une seule fois, quand la grille devient visible
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function reveal(cards){
    if(reduce || !('IntersectionObserver' in window)) return;
    cards.forEach(c => c.classList.add('pc-enter'));
    const io = new IntersectionObserver(entries => {
      if(!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      cards.forEach((c, i) => setTimeout(() => { c.classList.add('pc-in'); c.classList.remove('pc-enter'); }, i * 70));
    }, { threshold: .1 });
    io.observe(grid);
  }

  function render(list){
    let shown = Math.min(INITIAL, list.length);
    const draw = (from = 0) => {
      grid.innerHTML = list.slice(0, shown).map(card).join('');
      more.hidden = shown >= list.length;
      more.textContent = `Afficher les ${list.length - shown} autres projets`;
      reveal([...grid.children].slice(from));
    };
    draw();
    const n = String(list.length).padStart(2, '0');
    count.textContent = n;
    const heroCount = document.getElementById('heroProjCount');
    if(heroCount) heroCount.textContent = list.length;
    more.onclick = () => { const from = shown; shown = list.length; draw(from); };
  }

  load().then(list => {
    if(list) render(list);
    else { empty.hidden = false; count.textContent = ''; }
  });
})();

/* =========================================================
   THÈME CLAIR / SOMBRE
   - sans choix enregistré : suit le réglage du système
   - un clic enregistre le choix dans le navigateur
========================================================= */
(function(){
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: light)');
  const current = () => root.dataset.theme || (media.matches ? 'light' : 'dark');

  function sync(){
    const t = current();
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.setAttribute('aria-label', t === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre');
      btn.setAttribute('aria-pressed', String(t === 'light'));
    });
    document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  }

  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try{ localStorage.setItem('theme', next); }catch(e){}
      sync();
    });
  });
  media.addEventListener('change', () => { if(!root.dataset.theme) sync(); });
  sync();

  const y = document.getElementById('year');
  if(y) y.textContent = new Date().getFullYear();
})();
