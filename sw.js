/* Service worker : l'appli s'ouvre hors ligne, et surtout elle s'ouvre VITE.
 *
 * CE QUI N'ALLAIT PAS. La version d'avant demandait le réseau d'abord pour
 * la page, et attendait sa réponse — sans limite. Tant que le serveur
 * répond, personne ne le remarque. Loin de la maison, c'est autre chose :
 * une adresse en 192.168 ne répond pas « non », elle ne répond RIEN. Le
 * téléphone attend alors que le système abandonne de lui-même, et ça prend
 * trente secondes, parfois plus d'une minute. Pendant ce temps l'appli est
 * un écran blanc, alors que sa copie était là, prête, depuis le début.
 *
 * CE QUI SE PASSE MAINTENANT. On demande quand même le réseau — c'est lui
 * qui apporte les mises à jour — mais on ne l'attend qu'un court instant.
 * Passé ce délai, on sert la copie gardée tout de suite, et la requête
 * continue en arrière-plan : la version fraîche est déjà là à l'ouverture
 * suivante. L'appli s'ouvre donc en moins d'une seconde et demie, que la
 * maison soit à portée ou à l'autre bout de la ville.
 */
const CACHE = 'suivi-input-v2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const ATTENTE = 1200;   // ce qu'on accorde au réseau avant de servir la copie

// L'APPLICATION EST UNE PAGE. Une navigation n'est pas toujours une page —
// télécharger un fichier, c'est aussi « naviguer » vers une adresse. Ranger
// ces octets-là sous la clé de l'appli, c'est servir un téléchargement à la
// place de l'application à l'ouverture suivante. La leçon vient de noter,
// qui l'a apprise à ses dépens.
const estPage = r => !!r && r.ok &&
  (r.headers.get('content-type') || '').toLowerCase().indexOf('text/html') === 0;

self.addEventListener('install', (e) => {
  // Chacun pour soi, et surtout : on s'installe même s'il en manque un.
  // `addAll` est tout ou rien — un seul raté, le Wi-Fi qui hoquette au
  // mauvais moment, et l'ANCIEN service worker restait en place.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(u =>
    fetch(u, { cache:'reload' })
      .then(r => (r && r.ok ? c.put(u, r) : null))
      .catch(() => null)))).then(() => self.skipWaiting(), () => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if(req.method !== 'GET') return;
  let url;
  try{ url = new URL(req.url); }catch(_){ return; }
  // Une autre origine — la feuille de Google Fonts — n'est pas notre
  // affaire : on la laisse passer sans y toucher.
  if(url.origin !== self.location.origin) return;
  // Les données et la santé ne sont JAMAIS gardées : une réponse d'hier
  // serait un mensonge, et c'est justement ce qu'on synchronise.
  if(/\/(donnees|health)$/.test(url.pathname)) return;

  const nav = req.mode === 'navigate';
  const cle = nav ? './index.html' : req;

  // La requête réseau ne se termine qu'une fois la copie rangée : le
  // `waitUntil` garde le worker en vie jusque-là, même si la page a déjà
  // reçu sa réponse du cache.
  const reseau = fetch(req).then(res => {
    if(!res || !res.ok) return res;             // une réponse opaque n'a rien à garder
    if(nav && !estPage(res)) return res;        // un téléchargement n'est pas l'appli
    const copie = res.clone();
    return caches.open(CACHE).then(c => c.put(cle, copie)).then(() => res, () => res);
  });
  e.waitUntil(reseau.catch(() => {}));

  e.respondWith(caches.match(cle).then(hit => {
    // Ceinture : une réserve empoisonnée par une version précédente ne doit
    // pas pouvoir empêcher l'appli de s'ouvrir.
    if(nav && hit && !estPage(hit)){
      caches.open(CACHE).then(c => c.delete(cle)).catch(() => {});
      hit = null;
    }
    // Rien en réserve : il faut bien attendre le réseau. Et s'il échoue,
    // seule une navigation mérite l'appli en secours — rendre la page en
    // guise d'icône ne servirait personne.
    //
    // (C'est ici qu'était le défaut signalé au §8.4 de la fiche :
    // `.catch(() => hit)` dans une branche où `hit` est forcément faux. La
    // promesse se résolvait sur `undefined`, et la requête devenait une
    // erreur réseau au lieu d'un échec propre.)
    if(!hit) return reseau.catch(() => nav
      ? caches.match('./index.html').then(r => (estPage(r) ? r : Response.error()))
      : Response.error());
    return Promise.race([
      reseau.catch(() => hit),
      new Promise(ok => setTimeout(() => ok(hit), ATTENTE)),
    ]);
  }));
});
