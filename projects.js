/* =========================================================
   PROJETS — rendus depuis data/projects.json
   Le fichier est régénéré chaque jour par GitHub Actions.
   On lit d'abord la version brute du dépôt (à jour sans attendre
   le redéploiement de GitHub Pages), puis la copie locale.
========================================================= */
(function(){
  const SOURCES = [
    'https://raw.githubusercontent.com/angemevo/portfolio/master/data/projects.json',
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

  function card(p){
    const gh   = safeUrl(p.github);
    const demo = safeUrl(p.demo);
    const tags = (p.stack || []).slice(0, 5)
      .map((t, i) => `<span class="proj-tag pt${(i % 4) + 1}">${esc(t)}</span>`).join('');
    const links = [
      demo ? `<a class="proj-link pl-live" href="${esc(demo)}" target="_blank" rel="noopener">Démo</a>` : '',
      gh   ? `<a class="proj-link pl-gh" href="${esc(gh)}" target="_blank" rel="noopener">GitHub</a>` : '',
    ].join('');
    const stars = p.stars > 0 ? `<span class="proj-stars" title="Étoiles GitHub">★ ${p.stars}</span>` : '';

    return `
      <article class="proj-card" style="--h:${hue(p.repo || p.name)}">
        <div class="proj-thumb">
          <div class="proj-thumb-bg"></div>
          <span class="proj-thumb-emoji" aria-hidden="true">${esc(p.emoji || '🧪')}</span>
          <div class="proj-thumb-overlay"></div>
          ${p.featured ? '<span class="proj-badge">Sélection</span>' : ''}
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
        if(Array.isArray(data.projects) && data.projects.length) return data.projects;
      }catch(e){ /* source suivante */ }
    }
    return null;
  }

  function render(list){
    let shown = Math.min(INITIAL, list.length);
    const draw = () => {
      grid.innerHTML = list.slice(0, shown).map(card).join('');
      more.hidden = shown >= list.length;
      more.textContent = `Afficher les ${list.length - shown} autres projets`;
    };
    draw();
    count.textContent = String(list.length).padStart(2, '0');
    more.onclick = () => { shown = list.length; draw(); };
  }

  load().then(list => {
    if(list) render(list);
    else { empty.hidden = false; count.textContent = '—'; }
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
