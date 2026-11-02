// Suivi d'input — le serveur du PC.
//
// L'application n'en a pas besoin pour marcher : elle garde tout dans le
// navigateur, et c'est ce qui lui permet de fonctionner dans l'autobus. Ce
// serveur ne remplace rien. Il ajoute **un endroit où les données vivent
// aussi**, sur le PC, dans un fichier qu'on peut copier, lire et sauver —
// parce qu'un `localStorage` de téléphone, c'est un seul exemplaire, dans
// un seul navigateur, qu'un nettoyage efface sans prévenir.
//
// TROIS CHOSES VALENT D'ÊTRE DITES AVANT DE LIRE LE CODE.
//
// 1. LA FUSION EXISTE DÉJÀ, ET ELLE EST DANS L'APPLI. `mergeLanguages()`
//    garde, jour par jour, la valeur la plus haute des deux côtés : jamais
//    de perte, et aucune question du genre « qui gagne ». Le serveur ne
//    fusionne donc rien du tout — il garde un fichier et le rend. Toute
//    l'intelligence reste là où elle était déjà écrite.
//
// 2. CHANGER D'ORIGINE, C'EST PERDRE SES DONNÉES — EN APPARENCE. C'est le
//    §8.1 de la fiche de l'appli, et c'est le vrai risque de l'opération :
//    servie depuis le PC, l'application s'ouvre VIDE, parce qu'un
//    `localStorage` appartient à une origine et à une seule. Les données de
//    GitHub Pages sont toujours là, invisibles. La marche à suivre est donc
//    d'exporter depuis l'ancienne adresse et d'importer dans la nouvelle,
//    une fois — les deux boutons existent déjà dans l'appli.
//
// 3. LE CERTIFICAT EST CELUI DE NOTER. Un téléphone n'installe une
//    application que depuis une adresse sûre, et il fait déjà confiance à
//    l'autorité de noter. En fabriquer une deuxième pour la même maison et
//    la même machine, ce serait une deuxième à installer sur le téléphone,
//    pour rien. On lit la sienne, sans rien y écrire.
//
//     node input-sync.mjs
//
// Rien à installer : Node seul, aucune dépendance.
import { createServer } from 'node:http';
import { createServer as createServerSecure } from 'node:https';
import { readFile, writeFile, mkdir, readdir, unlink, stat } from 'node:fs/promises';
import { existsSync, statSync, readFileSync, createReadStream } from 'node:fs';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const ICI = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.INPUT_PORT) || 8792;
const PORT_SUR = Number(process.env.INPUT_PORT_HTTPS) || (PORT + 1);
const DONNEES = process.env.INPUT_DONNEES || join(ICI, 'input-donnees.json');
const COPIES = join(dirname(DONNEES), 'input-copies');
const GARDE = 30;            // copies conservées

// Les fichiers de l'application, et EUX SEULS. Une liste fermée plutôt
// qu'un dossier ouvert : le serveur vit dans le dossier du dépôt, où il y a
// aussi un .git et une fiche technique. Rien de tout ça n'a à sortir sur le
// réseau de la maison.
const SERVIS = new Map([
  ['/',                      ['index.html',            'text/html; charset=utf-8']],
  ['/index.html',            ['index.html',            'text/html; charset=utf-8']],
  ['/manifest.webmanifest',  ['manifest.webmanifest',  'application/manifest+json; charset=utf-8']],
  ['/sw.js',                 ['sw.js',                 'text/javascript; charset=utf-8']],
  ['/icon-192.png',          ['icon-192.png',          'image/png']],
  ['/icon-512.png',          ['icon-512.png',          'image/png']],
]);

const json = (res, code, obj) => {
  const corps = JSON.stringify(obj);
  res.writeHead(code, { 'content-type':'application/json; charset=utf-8',
                        'cache-control':'no-store',
                        'content-length': Buffer.byteLength(corps) });
  res.end(corps);
};

// ── les données ──────────────────────────────────────────────────────────
// Un seul fichier, lisible à l'œil nu, et une copie datée à chaque écriture
// différente de la précédente. Le même choix que noter, pour la même
// raison : le jour où quelque chose tourne mal, on veut pouvoir ouvrir le
// fichier d'avant dans un éditeur de texte, pas réparer une base.
const VIDE = { app:'suivi-input', version:2, maj:0, languages:[] };

async function litDonnees(){
  try{
    const brut = await readFile(DONNEES, 'utf8');
    const d = JSON.parse(brut);
    if(!d || typeof d !== 'object' || !Array.isArray(d.languages)) return { ...VIDE };
    return { ...VIDE, ...d, languages: d.languages };
  }catch(err){
    if(err.code !== 'ENOENT') console.warn('  ! données illisibles :', err.message);
    return { ...VIDE };
  }
}

async function copieAvant(){
  if(!existsSync(DONNEES)) return;
  try{
    await mkdir(COPIES, { recursive:true });
    const quand = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    await writeFile(join(COPIES, `input-${quand}.json`), await readFile(DONNEES));
    const vieilles = (await readdir(COPIES)).filter(f => f.endsWith('.json')).sort();
    for(const f of vieilles.slice(0, Math.max(0, vieilles.length - GARDE)))
      await unlink(join(COPIES, f)).catch(() => {});
  }catch(err){ console.warn('  ! copie impossible :', err.message); }
}

async function ecritDonnees(d){
  const avant = await litDonnees();
  const suite = { app:'suivi-input', version:2, maj: Date.now(),
                  languages: d.languages };
  // Écrire pour rien use le disque et noie les copies : si rien n'a changé,
  // on garde le fichier tel quel et on rend simplement sa date.
  if(JSON.stringify(avant.languages) === JSON.stringify(suite.languages))
    return { ...avant, change:false };
  await copieAvant();
  // Le fichier à côté puis renommé : une coupure de courant au mauvais
  // moment laisse l'ancien fichier entier, jamais un demi-fichier.
  const tmp = DONNEES + '.en-cours';
  await writeFile(tmp, JSON.stringify(suite, null, 1));
  const { rename } = await import('node:fs/promises');
  await rename(tmp, DONNEES);
  return { ...suite, change:true };
}

const compte = d => (d.languages || []).reduce((t, l) =>
  t + Object.keys(l.sessions || {}).filter(k => Number(l.sessions[k]) > 0).length, 0);

// ── le certificat de noter ───────────────────────────────────────────────
function dossierCert(){
  const essais = [];
  if(process.env.INPUT_CERT) essais.push(process.env.INPUT_CERT);
  essais.push(join(ICI, 'noter-cert'), join(ICI, '..', 'noter-cert'),
              join(ICI, '..', 'noter', 'noter-cert'),
              'C:\\Hub\\noter\\noter-cert');
  for(const d of essais){
    try{
      if(statSync(join(d, 'server.crt')).size && statSync(join(d, 'server.key')).size) return d;
    }catch{}
  }
  return null;
}

// Les adresses du PC sur le réseau de la maison : celles qu'on tape sur le
// téléphone. Un nom en .local ne se résout pas sur Android — on donne des
// chiffres.
function adressesLan(){
  const out = [];
  for(const liste of Object.values(networkInterfaces() || {}))
    for(const a of liste || [])
      if(a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}

// ── servir ───────────────────────────────────────────────────────────────
function fichier(res, nom, type){
  const chemin = join(ICI, nom);
  if(!existsSync(chemin)){ res.writeHead(404); return res.end('introuvable'); }
  // Pas de cache sur la page ni sur le service worker : c'est LUI qui décide
  // de ce qui est gardé, et un navigateur qui garderait une vieille copie
  // par-dessus rendrait toute mise à jour imprévisible.
  const dur = /\.png$/.test(nom) ? 'public, max-age=86400' : 'no-store';
  res.writeHead(200, { 'content-type':type, 'cache-control':dur });
  createReadStream(chemin).pipe(res);
}

// Ce qui arrive par le réseau a une taille annoncée : on la croit sur
// parole pour refuser tout de suite, et on recompte en lisant.
function litCorps(req, max = 8 * 1024 * 1024){
  return new Promise((ok, non) => {
    const annonce = Number(req.headers['content-length'] || 0);
    if(annonce > max) return non(new Error('trop gros'));
    let n = 0; const bouts = [];
    req.on('data', b => { n += b.length;
      if(n > max){ non(new Error('trop gros')); return; }
      bouts.push(b); });
    req.on('end', () => ok(Buffer.concat(bouts).toString('utf8')));
    req.on('error', non);
  });
}

async function poigne(req, res){
  let p = '/';
  try{ p = new URL(req.url, 'http://x').pathname; }catch{}

  if(p === '/health'){
    const d = await litDonnees();
    return json(res, 200, { ok:true, app:'suivi-input', maj:d.maj || 0,
                            langues:(d.languages || []).length, jours:compte(d) });
  }

  if(p === '/donnees'){
    if(req.method === 'GET'){
      const d = await litDonnees();
      return json(res, 200, d);
    }
    if(req.method === 'PUT' || req.method === 'POST'){
      let recu;
      try{ recu = JSON.parse(await litCorps(req)); }
      catch(err){ return json(res, 400, { ok:false, raison:'corps illisible : ' + err.message }); }
      if(!recu || !Array.isArray(recu.languages))
        return json(res, 400, { ok:false, raison:'il manque « languages »' });
      try{
        const d = await ecritDonnees(recu);
        if(d.change) console.log(`  ${new Date().toTimeString().slice(0,8)}  reçu `
          + `${d.languages.length} langue(s), ${compte(d)} jour(s)`);
        return json(res, 200, { ok:true, maj:d.maj, change:d.change, jours:compte(d) });
      }catch(err){ return json(res, 500, { ok:false, raison:err.message }); }
    }
    return json(res, 405, { ok:false, raison:'méthode' });
  }

  const f = SERVIS.get(p);
  if(f && (req.method === 'GET' || req.method === 'HEAD')) return fichier(res, f[0], f[1]);
  res.writeHead(404, { 'content-type':'text/plain; charset=utf-8' });
  res.end('introuvable');
}

// ── démarrage ────────────────────────────────────────────────────────────
const serveur = createServer((req, res) => {
  poigne(req, res).catch(err => {
    console.error('  ! ', err.message);
    try{ json(res, 500, { ok:false, raison:err.message }); }catch{}
  });
});
serveur.on('error', err => {
  console.error(err.code === 'EADDRINUSE'
    ? `\n  Le port ${PORT} est déjà pris. Une autre copie tourne peut-être déjà.\n`
    : '\n  ' + err.message + '\n');
  process.exit(1);
});
serveur.listen(PORT, '0.0.0.0', async () => {
  const d = await litDonnees();
  console.log('\n  Suivi d’input — serveur');
  console.log('  ' + '─'.repeat(52));
  console.log(`  données    ${DONNEES}`
    + (existsSync(DONNEES) ? `  (${(d.languages||[]).length} langue(s), ${compte(d)} jour(s))`
                           : '  (nouveau)'));
  console.log(`  copies     ${COPIES}  (${GARDE} dernières)`);

  const dc = dossierCert();
  if(dc){
    try{
      const sur = createServerSecure({
        key: readFileSync(join(dc, 'server.key'), 'utf8'),
        cert: readFileSync(join(dc, 'server.crt'), 'utf8'),
      }, (req, res) => poigne(req, res).catch(() => {}));
      sur.on('error', e => console.warn('  ! https indisponible :', e.message));
      sur.listen(PORT_SUR, '0.0.0.0');
      console.log(`  certificat ${dc}  (celui de noter, lu seulement)`);
    }catch(err){ console.warn('  ! certificat illisible :', err.message); }
  }else{
    console.log('  certificat introuvable — démarre noter une fois pour qu’il en');
    console.log('             crée un, puis relance. Sans lui, le téléphone ne');
    console.log('             proposera pas d’installer l’application.');
  }

  console.log('');
  console.log(`  SUR CE PC                 http://localhost:${PORT}`);
  const ips = adressesLan();
  if(ips.length && dc){
    console.log(`  SUR LE TÉLÉPHONE          https://${ips[0]}:${PORT_SUR}`);
    console.log('     menu du navigateur › « Installer l’application »');
    console.log('');
    console.log('  LA PREMIÈRE FOIS, et une seule : l’application servie d’ici');
    console.log('  s’ouvre VIDE — un navigateur range les données par adresse, et');
    console.log('  celle-ci est neuve. Exporte depuis l’ancienne adresse, importe');
    console.log('  ici. Les deux boutons sont déjà dans l’appli, en bas.');
  }else if(ips.length){
    console.log(`  SUR LE TÉLÉPHONE          http://${ips[0]}:${PORT}  (sans certificat)`);
  }
  console.log('');
});
