#!/usr/bin/env node
/**
 * Génère data/projects.json (et les captures d'écran) à partir des repos GitHub.
 *
 * Règles :
 *  - repos de l'utilisateur, hors forks, archives et repo du portfolio ;
 *  - le repo doit avoir un README avec du contenu (pas seulement un titre) ;
 *  - un repo avec le topic "portfolio-hide" est ignoré ;
 *  - les repos privés sont affichés sans lien (il faut PORTFOLIO_TOKEN pour les voir) ;
 *  - les entrées de data/featured.json passent en premier et remplacent
 *    les textes générés pour le repo correspondant.
 *
 * Captures d'écran, par ordre de priorité :
 *  1. champ "image" dans data/featured.json ;
 *  2. un fichier captures/<nom-du-repo>.png|jpg|jpeg|webp|gif ajouté à la main ;
 *  3. la première image du README (hors badges), copiée dans data/captures/.
 *
 * Variables d'environnement :
 *  PORTFOLIO_TOKEN   jeton personnel avec accès en lecture à tous tes repos (privés inclus)
 *  GITHUB_TOKEN      jeton par défaut de GitHub Actions (repos publics seulement)
 *  GITHUB_USER       compte à lister (défaut : propriétaire du repo courant)
 *  GITHUB_REPOSITORY "owner/repo" du portfolio (fourni par GitHub Actions)
 *  FIXTURES_DIR      dossier de réponses simulées, pour tester sans réseau
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'data', 'projects.json');
const FEATURED = path.join(ROOT, 'data', 'featured.json');
const MANUAL_DIR = path.join(ROOT, 'captures');
const AUTO_DIR = path.join(ROOT, 'data', 'captures');

const [repoOwner, repoName] = (process.env.GITHUB_REPOSITORY || 'angemevo/Portfolio').split('/');
const USER = process.env.GITHUB_USER || repoOwner;
const SELF = repoName.toLowerCase();
const PAT = process.env.PORTFOLIO_TOKEN || '';
const TOKEN = PAT || process.env.GITHUB_TOKEN || '';
const FIXTURES = process.env.FIXTURES_DIR;
const HIDE_TOPICS = new Set(['portfolio-hide', 'no-portfolio']);
const MIN_README_CHARS = 40;
// Textes générés par défaut par les outils (flutter create, create-next-app…) : pas une vraie description
const BOILERPLATE = /^(A new Flutter (project|application)|This project is a starting point|This is a \[?Next\.js\]? project|This project was bootstrapped with|This template should help|Getting Started)/i;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

/* ---------- accès API ---------- */
const fixtureName = url => url.replace(/^https?:\/\//, '').replace(/^\//, '').replace(/[/?&=:]/g, '_');

async function gh(url, { raw = false } = {}) {
  if (FIXTURES) {
    const file = path.join(FIXTURES, fixtureName(url) + (raw ? '.md' : '.json'));
    if (!existsSync(file)) return null;
    const txt = await readFile(file, 'utf8');
    return raw ? txt : JSON.parse(txt);
  }
  const res = await fetch('https://api.github.com' + url, {
    headers: {
      Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'portfolio-sync',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} sur ${url} : ${await res.text()}`);
  return raw ? res.text() : res.json();
}

/** Télécharge un fichier binaire ; renvoie { buf, type } ou null. */
async function download(url, { auth = false } = {}) {
  if (FIXTURES) {
    const file = path.join(FIXTURES, fixtureName(url) + '.bin');
    if (!existsSync(file)) return null;
    const buf = await readFile(file);
    return { buf, type: 'image/' + (extOf(url) || 'png') };
  }
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'portfolio-sync',
        ...(auth ? { Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' } : {}),
        ...(auth && TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
    });
    if (!res.ok) return null;
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_IMAGE_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) return null;
    return { buf, type: res.headers.get('content-type') || '' };
  } catch {
    return null;
  }
}

async function listRepos() {
  // Avec un jeton personnel : tous tes repos, privés compris. Sinon : publics seulement.
  const base = PAT
    ? `/user/repos?affiliation=owner&visibility=all&sort=pushed&per_page=100`
    : `/users/${USER}/repos?type=owner&sort=pushed&per_page=100`;
  const all = [];
  for (let page = 1; page < 20; page++) {
    const batch = await gh(`${base}&page=${page}`);
    if (!batch || !batch.length) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

/* ---------- lecture du README ---------- */
function stripMarkdown(md) {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')          // images / badges
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')        // liens -> texte
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')              // titres
    .replace(/^\s*[-*+>]\s+/gm, '')                  // listes / citations
    .replace(/[*_`~|]/g, '')
    .replace(/[ \t]+/g, ' ');
}

/** Contenu utile du README : tout sauf le titre principal. */
function readmeBody(md) {
  return stripMarkdown(md.replace(/^\s*#\s+.*$/m, '')).trim();
}

/** Premier paragraphe lisible du README, pour servir de description. */
function firstParagraph(md) {
  const paras = readmeBody(md).split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim());
  const p = paras.find(x => x.length >= 25
    && !/^(table des matières|sommaire|installation|table of contents)/i.test(x)
    && !BOILERPLATE.test(x));
  if (!p) return '';
  return p.length > 190 ? p.slice(0, 187).replace(/\s+\S*$/, '') + '…' : p;
}

/* ---------- captures d'écran ---------- */
const extOf = u => (String(u).split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
const isBadge = u => /shields\.io|badgen|badge|travis-ci|codecov|\/workflows\/|img\.shields|vercel\.com\/button|buymeacoffee|ko-fi/i.test(u);

/** URLs d'images du README, dans l'ordre, sans les badges ni les SVG (logos). */
function readmeImages(md) {
  const clean = md.replace(/```[\s\S]*?```/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const found = [];
  const re = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)|<img[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(clean))) found.push(m[1] || m[2]);
  return found.filter(u => u && !isBadge(u) && extOf(u) !== 'svg' && !/^data:/.test(u));
}

/** Transforme une URL du README en source téléchargeable. */
function resolveImage(url, repo) {
  const u = url.trim();
  // lien "blob" GitHub vers un fichier du repo -> chemin dans le repo
  const blob = u.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/[^/]+\/(.+)$/i);
  if (blob && `${blob[1]}/${blob[2]}`.toLowerCase() === repo.full_name.toLowerCase()) return { repoPath: blob[3] };
  const rawUrl = u.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/[^/]+\/(.+)$/i);
  if (rawUrl && `${rawUrl[1]}/${rawUrl[2]}`.toLowerCase() === repo.full_name.toLowerCase()) return { repoPath: rawUrl[3] };
  if (/^https?:\/\//i.test(u)) return { url: u, auth: /github\.com\/user-attachments\//i.test(u) };
  // chemin relatif dans le repo
  return { repoPath: u.replace(/^\.?\//, '') };
}

async function fetchReadmeImage(repo, md) {
  for (const candidate of readmeImages(md).slice(0, 4)) {
    const src = resolveImage(candidate, repo);
    const got = src.repoPath
      ? await download(`https://api.github.com/repos/${repo.full_name}/contents/${src.repoPath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(repo.default_branch || 'HEAD')}`, { auth: true })
      : await download(src.url, { auth: src.auth });
    if (!got || !got.buf.length) continue;
    let ext = extOf(candidate);
    if (!IMAGE_EXT.includes(ext)) ext = (got.type.match(/image\/(png|jpe?g|webp|gif)/) || [])[1];
    if (!IMAGE_EXT.includes(ext)) continue;
    return { buf: got.buf, ext: ext === 'jpeg' ? 'jpg' : ext };
  }
  return null;
}

/** Écrit la capture seulement si elle a changé (évite des commits inutiles). */
async function saveCapture(repoName, { buf, ext }) {
  await mkdir(AUTO_DIR, { recursive: true });
  const file = path.join(AUTO_DIR, `${repoName.toLowerCase()}.${ext}`);
  const prev = existsSync(file) ? await readFile(file) : null;
  if (!prev || !prev.equals(buf)) await writeFile(file, buf);
  return path.relative(ROOT, file).split(path.sep).join('/');
}

async function manualCaptures() {
  if (!existsSync(MANUAL_DIR)) return new Map();
  const files = await readdir(MANUAL_DIR);
  return new Map(files
    .filter(f => IMAGE_EXT.includes(extOf(f)))
    .map(f => [f.replace(/\.[^.]+$/, '').toLowerCase(), `captures/${f}`]));
}

/* ---------- présentation ---------- */
const EMOJI_BY_LANG = {
  dart: '📱', kotlin: '📱', swift: '📱', java: '☕', typescript: '🧩', javascript: '🌐',
  python: '🐍', c: '⚙️', 'c++': '🎮', 'c#': '🎮', gdscript: '🎮', html: '🌐', css: '🎨',
  php: '🌐', go: '🐹', rust: '🦀', 'jupyter notebook': '📊', shell: '🖥️',
};
const LANG_LABEL = { dart: 'Flutter / Dart' };

function prettyName(name) {
  return name.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ---------- programme ---------- */
async function main() {
  const featuredFile = existsSync(FEATURED) ? JSON.parse(await readFile(FEATURED, 'utf8')) : { projects: [] };
  const featured = featuredFile.projects || [];
  const featuredByRepo = new Map(featured.filter(f => f.repo).map(f => [f.repo.toLowerCase(), f]));
  const manual = await manualCaptures();

  if (!PAT) console.log('PORTFOLIO_TOKEN absent : seuls les repos publics sont listés.');

  const repos = await listRepos();
  const auto = [];
  const skipped = [];

  for (const r of repos) {
    const key = r.name.toLowerCase();
    const topics = r.topics || [];
    if (r.owner && r.owner.login && r.owner.login.toLowerCase() !== USER.toLowerCase()) continue;
    if (r.fork) { skipped.push([r.name, 'fork']); continue; }
    if (r.archived) { skipped.push([r.name, 'archivé']); continue; }
    if (key === SELF || key === `${USER.toLowerCase()}.github.io`) continue;
    if (topics.some(t => HIDE_TOPICS.has(t))) { skipped.push([r.name, 'topic portfolio-hide']); continue; }

    const readme = await gh(`/repos/${r.full_name}/readme`, { raw: true });
    if (!readme) { skipped.push([r.name, 'pas de README']); continue; }
    if (readmeBody(readme).length < MIN_README_CHARS) { skipped.push([r.name, 'README vide']); continue; }

    const langs = (await gh(`/repos/${r.full_name}/languages`)) || {};
    // langages représentant au moins 10 % du code, pour ignorer le CSS ou les scripts annexes
    const total = Object.values(langs).reduce((s, n) => s + n, 0) || 1;
    const langNames = Object.entries(langs)
      .filter(([, n]) => n / total >= 0.1)
      .sort((a, b) => b[1] - a[1]).map(([l]) => l);
    const mainLang = (r.language || langNames[0] || '').toLowerCase();
    const stack = [...new Set([
      ...langNames.slice(0, 3).map(l => LANG_LABEL[l.toLowerCase()] || l),
      ...topics.filter(t => !HIDE_TOPICS.has(t) && t !== 'portfolio').slice(0, 3),
    ])].slice(0, 5);

    // capture : manuelle d'abord, sinon la première image du README
    let image = manual.get(key) || null;
    if (!image && !featuredByRepo.get(key)?.image) {
      const img = await fetchReadmeImage(r, readme);
      if (img) image = await saveCapture(r.name, img);
    }

    auto.push({
      repo: r.name,
      name: prettyName(r.name),
      emoji: EMOJI_BY_LANG[mainLang] || '🧪',
      description: (BOILERPLATE.test((r.description || '').trim()) ? '' : (r.description || '').trim()) || firstParagraph(readme),
      stack,
      year: new Date(r.created_at).getFullYear(),
      image,
      private: !!r.private,
      github: r.private ? null : r.html_url,
      demo: r.homepage || null,
      stars: r.stargazers_count || 0,
      updated: r.pushed_at,
    });
  }

  const autoByRepo = new Map(auto.map(a => [a.repo.toLowerCase(), a]));

  // 1. projets mis en avant, enrichis des données GitHub quand le repo existe
  const out = featured.map(f => {
    const key = f.repo?.toLowerCase();
    const a = key ? autoByRepo.get(key) : null;
    const isPrivate = a ? a.private : false;
    const github = isPrivate ? null : (a?.github || (f.repo ? `https://github.com/${USER}/${f.repo}` : null));
    return {
      ...(a || {}),
      ...stripUndefined(f),
      image: f.image || (key && manual.get(key)) || a?.image || null,
      private: isPrivate,
      github: f.github !== undefined ? f.github : github,
      demo: f.demo || a?.demo || null,
      featured: true,
    };
  });
  // 2. tous les autres, du plus récemment modifié au plus ancien
  for (const a of auto.sort((x, y) => (y.updated || '').localeCompare(x.updated || ''))) {
    if (!featuredByRepo.has(a.repo.toLowerCase())) out.push({ ...a, featured: false });
  }

  const payload = {
    user: USER,
    profile: `https://github.com/${USER}`,
    count: out.length,
    projects: out,
  };

  // N'écrit le fichier que si les projets ont changé, pour éviter des commits inutiles.
  const prev = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : null;
  if (prev && JSON.stringify(prev.projects) === JSON.stringify(payload.projects)) {
    console.log(`Aucun changement (${out.length} projets).`);
  } else {
    await mkdir(path.dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify({ ...payload, generated: new Date().toISOString() }, null, 2) + '\n');
    console.log(`data/projects.json mis à jour : ${out.length} projets.`);
  }
  for (const p of out) console.log(`  ${p.private ? 'privé ' : 'public'}  ${p.name}${p.image ? '  [capture]' : ''}`);
  for (const [name, why] of skipped) console.log(`  ignoré  ${name} (${why})`);
}

function stripUndefined(o) {
  return Object.fromEntries(Object.entries(o).filter(([k, v]) => v !== undefined && !k.startsWith('_')));
}

main().catch(err => { console.error(err); process.exit(1); });
