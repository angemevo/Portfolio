#!/usr/bin/env node
/**
 * Génère data/projects.json à partir des repos GitHub publics.
 *
 * Règles :
 *  - repos publics de l'utilisateur, hors forks, archives et repo du portfolio ;
 *  - le repo doit avoir un README avec du contenu (pas seulement un titre) ;
 *  - un repo avec le topic "portfolio-hide" est ignoré ;
 *  - les entrées de data/featured.json passent en premier et remplacent
 *    les textes générés pour le repo correspondant.
 *
 * Variables d'environnement :
 *  GITHUB_TOKEN      jeton (fourni automatiquement dans GitHub Actions)
 *  GITHUB_USER       compte à lister (défaut : propriétaire du repo courant)
 *  GITHUB_REPOSITORY "owner/repo" du portfolio (fourni par GitHub Actions)
 *  FIXTURES_DIR      dossier de réponses simulées, pour tester sans réseau
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'data', 'projects.json');
const FEATURED = path.join(ROOT, 'data', 'featured.json');

const [repoOwner, repoName] = (process.env.GITHUB_REPOSITORY || 'angemevo/portfolio').split('/');
const USER = process.env.GITHUB_USER || repoOwner;
const SELF = repoName.toLowerCase();
const TOKEN = process.env.GITHUB_TOKEN;
const FIXTURES = process.env.FIXTURES_DIR;
const HIDE_TOPICS = new Set(['portfolio-hide', 'no-portfolio']);
const MIN_README_CHARS = 40;

/* ---------- accès API ---------- */
async function gh(url, { raw = false } = {}) {
  if (FIXTURES) {
    const file = path.join(FIXTURES, url.replace(/^\//, '').replace(/[/?&=]/g, '_') + (raw ? '.md' : '.json'));
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

async function listRepos() {
  const all = [];
  for (let page = 1; page < 20; page++) {
    const batch = await gh(`/users/${USER}/repos?type=owner&sort=pushed&per_page=100&page=${page}`);
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
  const p = paras.find(x => x.length >= 25 && !/^(table des matières|sommaire|installation|table of contents)/i.test(x));
  if (!p) return '';
  return p.length > 190 ? p.slice(0, 187).replace(/\s+\S*$/, '') + '…' : p;
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

  const repos = await listRepos();
  const auto = [];
  const skipped = [];

  for (const r of repos) {
    const key = r.name.toLowerCase();
    const topics = r.topics || [];
    if (r.private) continue;
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

    auto.push({
      repo: r.name,
      name: prettyName(r.name),
      emoji: EMOJI_BY_LANG[mainLang] || '🧪',
      description: (r.description || '').trim() || firstParagraph(readme),
      stack,
      year: new Date(r.created_at).getFullYear(),
      github: r.html_url,
      demo: r.homepage || null,
      stars: r.stargazers_count || 0,
      updated: r.pushed_at,
    });
  }

  const autoByRepo = new Map(auto.map(a => [a.repo.toLowerCase(), a]));

  // 1. projets mis en avant, enrichis des données GitHub quand le repo existe
  const out = featured.map(f => {
    const a = f.repo ? autoByRepo.get(f.repo.toLowerCase()) : null;
    const github = a?.github || (f.repo ? `https://github.com/${USER}/${f.repo}` : null);
    return {
      ...(a || {}),
      ...stripUndefined(f),
      github: f.github || github,
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
  for (const [name, why] of skipped) console.log(`  ignoré  ${name} (${why})`);
}

function stripUndefined(o) {
  return Object.fromEntries(Object.entries(o).filter(([k, v]) => v !== undefined && !k.startsWith('_')));
}

main().catch(err => { console.error(err); process.exit(1); });
