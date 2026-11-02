// Le serveur du PC, de bout en bout.
//
// Ce test monte un vrai serveur et deux vrais navigateurs — un appareil
// qui a des données, un appareil neuf — et vérifie ce qui compte vraiment :
// que rien ne se perd dans l'échange, et que l'appli reste entière quand
// le PC n'est pas là.
//
// POURQUOI « RIEN NE SE PERD » EST LA SEULE QUESTION. L'appli savait déjà
// fusionner deux sauvegardes : jour par jour, elle garde la valeur la plus
// haute (`mergeLanguages`). La synchro ne fait que rappeler cette
// fonction-là. Du coup il n'y a pas de « qui gagne » à départager, pas
// d'horodatage à comparer, et deux appareils qui se rencontrent finissent
// identiques quel que soit l'ordre. C'est ce que ce fichier éprouve.
//
//     node tests/test-serveur.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..');
const PORT = Number(process.env.INPUT_PORT_ESSAI || 8795);
const BASE = `http://127.0.0.1:${PORT}`;
let ok = 0, ko = 0;
const chk = (c, n, e = '') => { c ? ok++ : ko++;
  console.log(c ? '  ✓' : '  ✗ ÉCHEC', n, e === '' ? '' : JSON.stringify(e)); };
const dort = ms => new Promise(r => setTimeout(r, ms));

// Chromium : celui qui est déjà là, sinon celui de playwright.
let chromium = null;
for(const spec of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']){
  try{ ({ chromium } = await import(spec)); break; }catch(_){}
}
if(!chromium) throw new Error(
  'playwright est introuvable — « npm i -D playwright && npx playwright install chromium »');
const PRET = process.env.INPUT_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const lancement = existsSync(PRET) ? { executablePath: PRET } : {};

const nid = mkdtempSync(join(tmpdir(), 'input-essai-'));
const DONNEES = join(nid, 'donnees.json');
let serveur = null, b = null;

const ETAT = langues => JSON.stringify({ languages: langues, activeIndex: 0 });
const KR = (sessions, base = 0) => ({
  id:'kr', name:'coréen', scale:'kr', theme:'coral', sessions,
  baseMinutes:base, totalMinutes:0, levelNotes:{}, dailyGoalMinutes:30 });

// Un appareil : son navigateur à lui, donc son stockage à lui.
async function appareil(etat){
  const ctx = await b.newContext({ viewport:{ width:412, height:915 },
    hasTouch:true, isMobile:true });
  const p = await ctx.newPage();
  const fautes = [];
  p.on('pageerror', e => fautes.push(e.message));
  await p.goto(BASE + '/', { waitUntil:'domcontentloaded' });
  await p.evaluate(([e, a]) => {
    if(e) localStorage.setItem('inputTrackerV2', e);
    if(a) localStorage.setItem('inputServeur', a);
  }, [etat || '', BASE]);
  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForTimeout(2200);
  return { ctx, p, fautes };
}
const sessionsDe = p => p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('inputTrackerV2') || '{}');
  return ((s.languages || [])[0] || {}).sessions || {};
});
const duPc = async () => (await fetch(BASE + '/donnees')).json();

try{
  serveur = spawn(process.execPath, [join(RACINE, 'input-sync.mjs')], {
    cwd: RACINE, stdio:['ignore','pipe','pipe'],
    env:{ ...process.env, INPUT_PORT:String(PORT), INPUT_DONNEES:DONNEES } });
  const journal = [];
  serveur.stdout.on('data', d => journal.push(d));
  serveur.stderr.on('data', d => journal.push(d));
  for(let i = 0; i < 60; i++){ await dort(250);
    try{ if((await fetch(BASE + '/health')).ok) break; }catch{} }

  console.log('── LE SERVEUR SERT L’APPLI, ET RIEN D’AUTRE ──');
  { const h = await (await fetch(BASE + '/health')).json();
    chk(h.ok && h.app === 'suivi-input', 'il se présente', h);
    for(const [chemin, attendu] of [['/', 200], ['/manifest.webmanifest', 200],
                                    ['/sw.js', 200], ['/icon-192.png', 200],
                                    ['/FICHE.md', 404], ['/input-sync.mjs', 404],
                                    ['/.git/config', 404]]){
      const r = await fetch(BASE + chemin);
      chk(r.status === attendu, `${chemin} → ${attendu}`, r.status);
    }
    // La liste est fermée : le serveur vit dans le dossier du dépôt, et ni
    // la fiche technique ni le .git n'ont à sortir sur le réseau.
  }

  b = await chromium.launch(lancement);

  console.log('── CE QU’UN APPAREIL A, LE PC L’A ──');
  { const a = await appareil(ETAT([KR({ '2026-10-30':45, '2026-10-31':60 }, 120)]));
    chk(a.fautes.length === 0, 'l’appli s’ouvre sans rien casser', a.fautes);
    const d = await duPc();
    chk(d.languages.length === 1, 'le PC a reçu la langue', d.languages.length);
    chk(d.languages[0].sessions['2026-10-31'] === 60, 'et ses jours', d.languages[0].sessions);
    chk(existsSync(DONNEES), 'dans un fichier qu’on peut ouvrir à la main');
    const sur = JSON.parse(readFileSync(DONNEES, 'utf8'));
    chk(sur.app === 'suivi-input' && sur.maj > 0, 'daté, et signé de l’appli', sur.maj > 0);
    await a.ctx.close(); }

  console.log('── ET UN APPAREIL NEUF REÇOIT TOUT ──');
  { const n = await appareil(null);
    const s = await sessionsDe(n.p);
    chk(s['2026-10-30'] === 45 && s['2026-10-31'] === 60,
      'le téléphone neuf repart avec l’historique', s);
    chk(/à jour/i.test(await n.p.evaluate(() =>
      (document.getElementById('srvLine') || {}).textContent || '')),
      'et l’appli le dit', await n.p.evaluate(() =>
        (document.getElementById('srvLine') || {}).textContent));
    await n.ctx.close(); }

  console.log('── DEUX APPAREILS QUI ONT TRAVAILLÉ CHACUN DE SON CÔTÉ ──');
  // Le cas qui décide de tout : chacun a des jours que l'autre n'a pas, et
  // un jour en commun avec deux valeurs. Personne ne doit rien perdre, et
  // le jour partagé garde la plus haute — c'est la règle que l'appli
  // appliquait déjà en restaurant une sauvegarde.
  { const a = await appareil(ETAT([KR({ '2026-11-01':20, '2026-11-02':90 })]));
    await a.ctx.close();
    const c = await appareil(ETAT([KR({ '2026-11-01':50, '2026-11-03':15 })]));
    const s = await sessionsDe(c.p);
    chk(s['2026-11-02'] === 90, 'ce que l’autre avait est arrivé', s);
    chk(s['2026-11-03'] === 15, 'ce qu’on avait est resté', s);
    chk(s['2026-11-01'] === 50, 'et le jour partagé garde la valeur la plus haute', s);
    chk(s['2026-10-31'] === 60, 'sans rien perdre de l’histoire d’avant', s);
    await c.ctx.close();
    const d = await duPc();
    chk(d.languages[0].sessions['2026-11-02'] === 90
     && d.languages[0].sessions['2026-11-03'] === 15,
      'et le PC finit avec la somme des deux', d.languages[0].sessions); }

  console.log('── SANS SERVEUR, L’APPLI RESTE ENTIÈRE ──');
  // La situation la plus fréquente : on est dans l'autobus. Le PC ne
  // répond pas, et ce n'est pas une panne — l'appli doit s'ouvrir, écrire
  // et compter comme si de rien n'était.
  { const ctx = await b.newContext({ viewport:{ width:412, height:915 },
      hasTouch:true, isMobile:true });
    const p = await ctx.newPage();
    const fautes = [];
    p.on('pageerror', e => fautes.push(e.message));
    await p.goto(BASE + '/', { waitUntil:'domcontentloaded' });
    await p.evaluate(e => {
      localStorage.setItem('inputTrackerV2', e);
      localStorage.setItem('inputServeur', 'http://127.0.0.1:9');   // personne
    }, ETAT([KR({ '2026-11-04':25 })]));
    await p.reload({ waitUntil:'domcontentloaded' });
    await p.waitForTimeout(2500);
    chk(fautes.length === 0, 'aucune erreur de page quand le PC manque', fautes);
    const s = await sessionsDe(p);
    chk(s['2026-11-04'] === 25, 'les données du téléphone sont intactes', s);
    chk((await p.evaluate(() =>
      (document.getElementById('srvLine') || {}).textContent || '')).trim() === '',
      'et l’appli ne crie pas : être dehors est normal');
    await ctx.close(); }

  console.log('── L’APPLI S’OUVRE VITE QUAND LE PC NE RÉPOND PAS ──');
  // LE BOGUE, tel qu'il se présentait : soixante secondes d'écran blanc
  // pour ouvrir l'appli hors de la maison. Le service worker demandait le
  // réseau d'abord et l'attendait SANS LIMITE — or une adresse en 192.168
  // hors de portée ne répond pas « non », elle ne répond rien, et le
  // téléphone attend que le système abandonne.
  //
  // Un serveur refusé net (connexion impossible) ne reproduirait pas la
  // panne : l'échec est immédiat. Il faut un serveur qui ACCEPTE et se
  // taise — c'est ce que fait ce relais, et c'est tout l'intérêt du test.
  { const { createServer } = await import('node:http');
    let muet = false;
    const enAttente = [];
    const relais = createServer((req, res) => {
      if(muet){ enAttente.push(res); return; }          // accepté, jamais répondu
      relaye(req, res).catch(() => { try{ res.writeHead(502); res.end(); }catch{} });
    });
    async function relaye(req, res){
      const amont = await fetch(BASE + req.url, { method:req.method });
      const corps = Buffer.from(await amont.arrayBuffer());
      res.writeHead(amont.status, {
        'content-type': amont.headers.get('content-type') || 'text/plain',
        'content-length': corps.length, 'cache-control':'no-store' });
      res.end(corps);
    }
    await new Promise(r => relais.listen(0, '127.0.0.1', r));
    const VIA = `http://127.0.0.1:${relais.address().port}`;

    const ctx = await b.newContext({ viewport:{ width:412, height:915 },
      hasTouch:true, isMobile:true });
    const p = await ctx.newPage();
    // 1. une visite normale : le service worker s'installe et garde l'appli
    await p.goto(VIA + '/', { waitUntil:'domcontentloaded' });
    await p.evaluate(a => localStorage.setItem('inputServeur', a), VIA);
    await p.reload({ waitUntil:'domcontentloaded' });
    await p.waitForTimeout(1800);
    chk(await p.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active)),
      'le service worker s’installe');

    // 2. le PC devient muet — la maison n'est plus à portée
    muet = true;
    const t0 = Date.now();
    let ouverte = true;
    try{ await p.goto(VIA + '/', { waitUntil:'domcontentloaded', timeout:15000 }); }
    catch(_){ ouverte = false; }
    const mis = Date.now() - t0;
    chk(ouverte, 'l’appli s’ouvre quand même', { ms:mis });
    chk(mis < 5000, `et vite : ${mis} ms, pas soixante secondes`, mis);
    chk(await p.evaluate(() => !!document.getElementById('srvLine')),
      'c’est bien l’application, pas une page d’erreur');
    // 3. et la synchro ne reste pas accrochée une minute à un PC muet
    const t1 = Date.now();
    await p.evaluate(() => document.getElementById('srvBtn').click());
    let dit = '';
    for(let i = 0; i < 60; i++){
      dit = await p.evaluate(() => (document.getElementById('srvLine') || {}).textContent || '');
      if(/ne répond pas/.test(dit)) break;
      await new Promise(r => setTimeout(r, 250));
    }
    chk(Date.now() - t1 < 9000,
      'la synchro abandonne au bout de quelques secondes', Date.now() - t1);
    chk(/ne répond pas/.test(dit), 'et le dit sans mentir', dit);

    for(const r of enAttente){ try{ r.destroy(); }catch{} }
    await ctx.close();
    relais.close(); }

  console.log('── UN ENVOI ABÎMÉ NE CASSE RIEN ──');
  { const avant = await duPc();
    const r = await fetch(BASE + '/donnees', { method:'PUT',
      headers:{ 'content-type':'application/json' }, body:'{"pas":"ça"}' });
    chk(r.status === 400, 'un corps sans langues est refusé', r.status);
    const apres = await duPc();
    chk(JSON.stringify(avant.languages) === JSON.stringify(apres.languages),
      'et le fichier du PC n’a pas bougé'); }
}finally{
  if(b) await b.close().catch(() => {});
  if(serveur) serveur.kill();
  rmSync(nid, { recursive:true, force:true });
}

console.log(`\n${ok} réussites, ${ko} échecs`);
process.exit(ko ? 1 : 0);
