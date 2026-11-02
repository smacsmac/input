# Fiche technique — Suivi d'input

Fiche destinée au hub qui lancera cette application. Elle décrit le dépôt à
`2dedcfc` (branche `main`). Tous les faits ci-dessous ont été relevés dans les
fichiers, avec leur emplacement ; ce que le dépôt ne peut pas savoir est marqué
**à compléter**, ce qui n'existe pas est marqué **sans objet** avec la preuve.

> **À lire avant de brancher le hub.** Cette application n'est pas un serveur.
> C'est un site statique de cinq fichiers, servi par GitHub Pages, dont toutes
> les données vivent dans le navigateur. Il n'y a ni processus, ni port, ni
> fenêtre `cmd`, ni variable d'environnement, ni dépendance npm, ni certificat.
> Plusieurs rubriques du gabarit sont donc sans objet ici : elles sont
> conservées dans l'ordre demandé, avec la réponse réelle et ce que le hub peut
> faire à la place. Le point le plus important pour le hub est le §8.1.
>
> **Ceci reste vrai de l'application. Depuis, un serveur FACULTATIF est
> venu se poser à côté : voir le §0 juste en dessous.**

---

## 0. Ce qui a changé : un serveur, et il reste facultatif

Tout ce qui suit reste vrai de l'application elle-même. Ce qui s'ajoute,
c'est **`input-sync.mjs`** : un serveur d'environ 250 lignes, Node seul,
aucune dépendance, qui fait deux choses et pas une de plus.

1. **Il sert les cinq fichiers** — et eux seuls : la liste est fermée, le
   `.git` et cette fiche répondent 404. Sur `http://localhost:8792` pour le
   PC, et sur `https://<ip-du-pc>:8793` pour le téléphone, avec **le
   certificat de noter**, lu sans rien y écrire : le téléphone fait déjà
   confiance à cette autorité, et une deuxième serait une deuxième à
   installer pour rien.
2. **Il garde les données dans un fichier** — `input-donnees.json`, lisible
   à l'œil nu, avec une copie datée à chaque écriture différente de la
   précédente (`input-copies/`, les trente dernières).

**L'application ne lui demande jamais la permission d'exister.** Sans
adresse de serveur, ou hors de la maison, elle se comporte exactement comme
avant : les données vivent dans le navigateur, et c'est ce qui lui permet de
marcher dans l'autobus. Le réglage est dans « Réglages de l'appli → Serveur
du PC » ; laissé vide, il n'y a pas de serveur.

**La synchro ne décide rien.** Elle prend ce que le PC a, le passe par
`mergeLanguages()` — la fonction qui servait déjà à restaurer une sauvegarde :
jour par jour, la valeur la plus haute, jamais de perte — puis renvoie le
résultat. Il n'y a donc **aucun** « qui gagne » à départager, aucun
horodatage à comparer, et deux appareils qui se rencontrent finissent
identiques quel que soit l'ordre. `tests/test-serveur.mjs` éprouve exactement
ce cas, avec deux vrais navigateurs.

**La synchro n'attend jamais longtemps.** Chaque requête est coupée par un
`AbortController` : 4 s pour aller chercher, 8 s pour envoyer (l'envoi porte
tout l'historique). Sans cela, un PC hors de portée laissait la synchro « en
cours » pendant une minute — et pendant tout ce temps elle refusait la
suivante. Hors de la maison, l'appli ne dit rien du tout : être dehors est la
situation normale, pas une panne. Elle ne parle que si on a appuyé sur
« Synchroniser maintenant ». Et **un appui pendant une synchro déjà partie est
adopté**, pas avalé : celle qui est en l'air rendra des comptes comme si on
l'avait demandée — sinon le bouton semblait mort pendant les secondes qui
suivent l'ouverture, où une synchro part toute seule.

> **Le §8.1 reste le point le plus important — et le serveur ne le règle
> pas : il le déclenche.** Servie depuis le PC, l'application est sur une
> **nouvelle origine** : elle s'ouvre donc VIDE la première fois, et les
> données de GitHub Pages sont toujours là, invisibles. La marche à suivre,
> une fois : exporter depuis l'ancienne adresse, importer dans la nouvelle.
> Les deux boutons existent déjà.

---

## 1. Identité

| | |
|---|---|
| Nom | **Suivi d'input** (`manifest.webmanifest`, `name`) |
| Nom court | **Input** (`short_name`) — aussi le nom sur l'écran d'accueil iOS (`index.html:10`) |
| Titre de la page | `Suivi d'input · 한국어` (`index.html:13`) |
| Dépôt | `smacsmac/input` — public, branche par défaut `main` (API GitHub) |
| Dossier sur le PC (Windows) | **à compléter** — le dépôt ne peut pas le connaître |
| Fichier du serveur | **sans objet** — voir ci-dessous |
| Page servie | `index.html` (166 Ko, tout en un : HTML + CSS + JS, aucun module externe) |
| Dépendances npm | **aucune** |

**Pourquoi « aucun serveur » est un fait vérifié et pas une supposition :**
`git ls-files` ne renvoie que les cinq fichiers listés ci-dessous, et
`git log --all --name-only` montre que le dépôt n'a **jamais** contenu autre
chose. Aucune occurrence de `process.env`, `import.meta`, `require(` ni
`.listen(` dans `index.html` (0 résultat). Aucun `package.json`, `.cmd`,
`.bat`, `.ps1`, `.pem`, `.crt`, `.key` nulle part.

**Les cinq fichiers livrés :**

| Fichier | Rôle |
|---|---|
| `index.html` | l'application entière |
| `manifest.webmanifest` | manifeste d'installation (§4) |
| `sw.js` | service worker, mode hors ligne (§4) |
| `icon-192.png` | icône PWA + `apple-touch-icon` + favicon |
| `icon-512.png` | icône PWA (y compris `maskable`) |

**Seule dépendance au moment de l'exécution :** la feuille de styles Google
Fonts (`index.html:18`), chargée sans bloquer l'affichage (`media="print"`
puis bascule au `onload`). Si elle est injoignable, l'application s'affiche
normalement avec les polices de repli.

---

## 2. Démarrage

**Commande exacte : sans objet.** Il n'y a rien à démarrer. L'application est
servie par GitHub Pages depuis la branche `main` ; pousser sur `main` *est* le
déploiement.

**Si le hub veut tout de même la servir localement**, n'importe quel serveur de
fichiers statiques pointé sur la racine du dépôt suffit (par exemple
`python -m http.server` ou `npx serve`) — mais lire le §8.1 **avant** : servir
l'application sur une autre adresse affiche une application vide.

| Question | Réponse |
|---|---|
| Variables d'environnement | **aucune**, donc aucun défaut à fournir (0 occurrence de `process.env`) |
| À préparer au premier lancement | **rien** : pas d'installation, pas de compilation, pas de dossier à créer |
| Arrêt propre | **sans objet** : aucun processus. L'application ne tient aucun état côté serveur ; couper le serveur statique, à n'importe quel moment, ne peut rien corrompre |

### Les trois questions explicites

**1. Le serveur dépend-il du dossier de travail ?**
Sans objet au sens strict : il n'y a pas de serveur, donc pas de dossier de
travail. `import.meta.url` n'apparaît nulle part (0 occurrence). Ce qui compte
pour le hub, c'est que **tous les chemins internes sont relatifs** :
`manifest.webmanifest` et `icon-192.png` (`index.html:7,11,12`), `sw.js`
(`index.html:3935`), `start_url` et `scope` valant `"."`
(`manifest.webmanifest`), et `./`, `./index.html`, `./manifest.webmanifest`,
`./icon-192.png`, `./icon-512.png` dans le service worker (`sw.js:3`).
Conséquence : l'application fonctionne à n'importe quel sous-chemin
(`/input/`, `/`, autre), **à condition que les cinq fichiers restent côte à
côte** et soient servis depuis le même dossier.

**2. Le lanceur `.cmd` se termine-t-il par `pause` ?**
**Sans objet : il n'existe aucun lanceur.** Aucun `.cmd`, `.bat` ni `.ps1`
dans le dépôt ni dans son historique.

**3. Écrit-elle sur la console quelque chose que je perdrais sans fenêtre ?**
**Non.** Il n'y a que deux écritures console dans tout le code
(`index.html:1725` « Erreur de lecture des données » et `index.html:1740`
« Erreur d'enregistrement des données »), et elles vont dans la **console du
navigateur**, pas dans un terminal. Aucune sortie console n'est perdue en
supprimant une fenêtre `cmd` : il n'y en a jamais eu.

---

## 3. Adresses et ports

| | |
|---|---|
| Port http | **aucun en propre** — l'application n'ouvre aucun port |
| Port https | **aucun en propre** |
| Adresse réelle d'ouverture | `https://smacsmac.github.io/input/` |

L'API confirme `has_pages: true` et `default_branch: main` sur
`smacsmac/input`. Le détail de la configuration Pages (branche et dossier
exacts) n'est pas lisible ici — l'API `/pages` est bloquée par le proxy de
cette session (HTTP 403) — et n'est de toute façon pas dans le dépôt :
**à confirmer** côté GitHub si le hub doit l'afficher.

### Adresses à NE PAS utiliser

| Adresse | Pourquoi |
|---|---|
| `file:///…/index.html` | `index.html:3933` n'enregistre le service worker que si le protocole commence par `http` : en `file://` il n'y a ni hors ligne, ni installation. C'est en plus une **origine différente**, donc aucune donnée (§8.1) |
| `http://localhost:<port>` ou toute autre origine locale | origine différente → application vide (§8.1) |
| `raw.githubusercontent.com/...` | renvoyé en `text/plain` : la page ne s'exécute pas |

### Routes servies

Il n'y a **aucune route dynamique, aucune API** : seulement des fichiers.

| Route | Réponse |
|---|---|
| `/` | `index.html` (index de dossier du serveur statique) |
| `/index.html` | l'application |
| `/manifest.webmanifest` | le manifeste |
| `/sw.js` | le service worker |
| `/icon-192.png`, `/icon-512.png` | les icônes |
| tout le reste | 404 du serveur statique |

---

## 4. Installation sur le téléphone

### Étapes, dans l'ordre

1. Ouvrir l'adresse réelle (§3) dans le navigateur du téléphone — pas un
   fichier local, pas une autre origine.
2. Appuyer sur l'engrenage du **tableau de bord** (la page d'accueil de
   l'application) → fenêtre « Réglages de l'appli ».
3. Section « Installer sur l'écran d'accueil ». Elle se masque d'elle-même si
   l'application est déjà installée (test `display-mode: standalone` ou
   `navigator.standalone`, `index.html:3485`).
4. **Android / Chrome :** un bouton « Installer l'appli » apparaît lorsque le
   navigateur a proposé l'installation (`beforeinstallprompt`,
   `index.html:3478`) ; sinon le texte renvoie au menu du navigateur
   (`index.html:3505`).
   **iPhone :** bouton Partager, puis « Sur l'écran d'accueil »
   (`index.html:3504`) — iOS n'offre pas de bouton d'installation.

### Contenu du manifeste

| Champ | Valeur |
|---|---|
| `id` | **absent du fichier.** Le navigateur retombe alors sur `start_url` pour identifier l'application — voir §8.9 |
| `start_url` | `"."` |
| `scope` | `"."` |
| `name` | `"Suivi d'input"` |
| `short_name` | `"Input"` |
| `display` | `"standalone"` |
| `orientation` | `"portrait"` |
| `theme_color` / `background_color` | `#14131f` |
| `lang` | `"fr"` |
| `icons` | 3 entrées pour 2 fichiers : 192 `any`, 512 `any`, 512 `maskable` |

### Service worker

Fichier `sw.js`, enregistré au chargement de la page et **uniquement en
http(s)** (`index.html:4064-4066`). Nom du cache : `suivi-input-v2`
(`sw.js:18`).

**Mis en cache** (`sw.js:19`) : `./`, `./index.html`, `./manifest.webmanifest`,
`./icon-192.png`, `./icon-512.png`. L'installation les demande **un par un**,
en `cache:'reload'`, et réussit même s'il en manque un (`sw.js:34-37`) :
`addAll` est tout ou rien, et un seul raté — le Wi-Fi qui hoquette au mauvais
moment — laissait l'ancien service worker en place.

**Stratégie, la même pour tout : la copie gardée, ou le réseau si elle manque,
mais on n'attend le réseau que `ATTENTE` = 1200 ms** (`sw.js:20`, `92-95`).
Passé ce délai on sert la copie et la requête continue en arrière-plan
(`e.waitUntil`, `sw.js:72`) : la version fraîche est déjà là à l'ouverture
suivante. Sans copie en réserve, il faut bien attendre le réseau, et seule une
navigation a droit à l'appli en secours (`sw.js:89-91`).

> **La leçon, et elle a coûté une minute par lancement.** « Réseau d'abord »
> sans limite de temps est un piège : une adresse en 192.168 hors de la maison
> ne répond pas « non », elle ne répond **rien**. Le téléphone attend que le
> système abandonne — trente à soixante secondes d'écran blanc, alors que la
> copie de l'appli était prête depuis le début. noter l'avait appris avant ;
> cette appli a répété la faute mot pour mot. Un `Promise.race` contre une
> minuterie est tout ce qu'il fallait. Le test
> `tests/test-serveur.mjs` le tient : il monte un serveur qui **accepte la
> connexion et se tait** — un serveur qui refuse net ne reproduirait rien,
> l'échec étant immédiat — et exige que la page s'ouvre en moins de 5 s.

**L'application est une PAGE** (`sw.js:27-28`, `estPage`). Une navigation n'est
pas toujours une page : télécharger un fichier, c'est aussi « naviguer ». Ranger
ces octets sous la clé de l'appli servirait un téléchargement à la place de
l'application à l'ouverture suivante — là encore, la leçon vient de noter. Le
garde joue aux deux bouts : à l'enregistrement (`sw.js:68`) et à la lecture,
où une réserve déjà empoisonnée est jetée (`sw.js:77-80`).

**Jamais mis en cache :**
- toute requête qui n'est pas un `GET` (`sw.js:50` : la fonction sort sans
  répondre) ;
- toute requête **d'une autre origine** — la feuille Google Fonts passe sans
  qu'on y touche (`sw.js:55`) ;
- **`/donnees` et `/health`** (`sw.js:58`) : une réponse d'hier serait un
  mensonge, et c'est précisément ce que la synchro va chercher.

---

## 5. Certificat

**Sans objet dans ce dépôt.** Aucun fichier `.pem`, `.crt`, `.key`, aucun
script qui en fabrique, ni aujourd'hui ni dans l'historique.

Le HTTPS vient de **GitHub Pages** : certificat émis, installé et renouvelé par
GitHub pour `*.github.io`. Rien à installer sur le téléphone, rien à surveiller,
rien à partager avec une autre application.

**Si le hub décide un jour de servir l'application en https localement**, tout
ce qui suit est **à compléter** : quel fichier le fabrique, où il est rangé,
lequel s'installe sur le téléphone, s'il est partagé, les adresses couvertes,
la date de renouvellement.

Une contrainte à connaître avant d'en fabriquer un : le service worker exige un
contexte sécurisé, mais **`http://localhost` compte déjà comme sécurisé**. Pour
une mise au point locale sur le PC, aucun certificat n'est nécessaire. Il n'en
faudrait un que pour ouvrir l'application depuis le téléphone via l'adresse IP
du PC.

---

## 6. Signe de vie

Il n'y a **ni processus ni route de santé** : rien dans le code ne répond
« je tourne ». La seule chose qui peut tomber, c'est le serveur qui sert les
fichiers.

**Ce que le hub peut interroger**, et qui prouve que c'est bien *cette*
application qui est servie, et pas seulement qu'un port est ouvert :

| Contrôle | Attendu |
|---|---|
| `GET <base>/manifest.webmanifest` | `200`, JSON contenant `"name": "Suivi d'input"` |
| Repli : `GET <base>/` | `200`, corps contenant `<title>Suivi d'input` (`index.html:13`) |

Les deux sont de simples `GET` sur des fichiers statiques : aucun effet de
bord, interrogeables aussi souvent que voulu.

**Ce que ces contrôles ne prouvent pas :** que les données de l'utilisateur sont
intactes (elles sont dans le navigateur, pas accessibles en HTTP), ni que la
PWA installée sur le téléphone fonctionne (elle a son propre cache et peut
servir une version plus ancienne hors ligne).

---

## 7. Données et sauvegardes

**Où vivent les données : pas sur le disque.** Elles sont dans le
`localStorage` du navigateur, **attachées à l'origine qui sert la page**.

| | |
|---|---|
| Clé | `inputTrackerV2` (`index.html:1668`), lue en `1699`, écrite en `1738` |
| Ancienne clé | `krInputTrackerV1` (`index.html:1669`) — lue une seule fois pour la migration (`1713`), jamais réécrite, **jamais supprimée** |
| Contenu | toutes les langues, les minutes jour par jour, les notes de niveau, objectifs, couleurs, drapeaux, plus `lastExportAt` et `snoozeBackupUntil` |

**Où vont les copies :** uniquement là où l'utilisateur les met. Réglages de
l'appli → « Sauvegarder mes données » déclenche un téléchargement de navigateur
vers son dossier de téléchargements habituel.

| | |
|---|---|
| Nom du fichier | `suivi-input-AAAA-MM-JJ.json` (`index.html:1764`, date locale du jour) |
| Contenu | `{ app: "suivi-input", version: 2, exportedAt, languages }` (`index.html:1755-1760`) |

**À quel moment :** **jamais automatiquement.** L'application se contente de
*rappeler* : un bandeau apparaît sur le tableau de bord après 60 jours sans
export (`BACKUP_STALE_DAYS`, `index.html:1746`), et seulement à partir de 15
jours de temps enregistrés (`index.html:1821`). La croix du bandeau le met en
veille 14 jours (`index.html:2729`).

**Combien sont gardées :** aucune rotation, aucune limite, aucune suppression —
l'application ne supprime jamais une sauvegarde et n'en connaît même pas
l'existence une fois le fichier téléchargé. Un fichier par jour d'export ; deux
exports le même jour donnent deux fichiers (le navigateur suffixe) ou un
écrasement, selon son réglage.

### À ne JAMAIS supprimer

1. **Les données de site / le profil du navigateur de l'origine** qui sert
   l'application — c'est l'unique exemplaire des données. « Effacer les données
   de navigation » pour ce site efface tout l'historique de suivi.
2. **Les fichiers `suivi-input-*.json`** téléchargés — les seules copies hors
   du navigateur.
3. **Les cinq fichiers du dépôt.**
4. **Le cache et le service worker de cette origine** : le hub ne doit pas les
   « nettoyer » en les prenant pour des artefacts de compilation. Les effacer ne
   détruit pas les données (elles sont dans `localStorage`, pas dans le cache),
   mais supprime le mode hors ligne de la PWA installée.

---

## 8. Ce qui la casserait

Par ordre de gravité pour le hub. Les points 1 à 3 sont ceux sur lesquels un
hub se cogne en premier.

**1. Changer d'origine = perdre les données, en apparence.**
`localStorage` est cloisonné par origine (protocole + hôte + port). Si le hub
sert l'application sur `http://localhost:8080` alors que l'utilisateur
l'utilise sur `https://smacsmac.github.io/input/`, il verra une application
**neuve et vide**. Rien n'est détruit — les vraies données restent sur l'autre
origine, invisibles — mais la panique est garantie, et tout ce qu'il saisira
dans la copie vide restera dans la copie vide. **Le hub doit ouvrir exactement
l'adresse que l'utilisateur utilise déjà** (§3), pas une adresse locale
équivalente. C'est le risque numéro un de cette fiche.

**2. Un service worker déjà installé sur une origine locale.**
Si le hub sert l'application sur un port de `localhost` qu'un autre projet a
utilisé, un service worker enregistré par cet autre projet peut encore répondre
pour cette origine. Le nom du cache est écrit en dur dans `sw.js:18` ; il est
passé à `suivi-input-v2` avec la réécriture, et `activate` supprime tout cache
**portant un autre nom** (`sw.js:43`) — l'ancienne réserve est donc jetée au
premier chargement qui atteint le réseau. **Tout changement de la liste des
fichiers doit à nouveau changer ce nom**, sinon les anciennes entrées
survivent.

**3. Ouvrir le fichier directement.**
Double-cliquer `index.html` ouvre une `file://` : pas de service worker
(`index.html:3933`), pas d'installation, pas de hors ligne, et une origine
distincte donc aucune donnée. Le hub doit ouvrir une URL http, jamais le
fichier.

**4. Une sous-ressource absente du cache, hors ligne.** *(corrigé)*
L'ancien `sw.js` faisait `.catch(() => hit)` dans une branche où `hit` est
forcément faux : la promesse se résolvait sur `undefined` et la requête
devenait une erreur réseau au lieu d'un échec propre. C'est maintenant un
`Response.error()` explicite, et une navigation retombe sur la page gardée
(`sw.js:89-91`). Le piège de fond reste : **un fichier ajouté à l'application
sans être ajouté à `ASSETS`** (`sw.js:19`) n'existe pas hors ligne.

**5. Compter sur un processus ou un port.**
Il n'y en a pas. Un hub qui cherche un PID, un port à l'écoute ou une fenêtre
`cmd` affichera cette application en rouge en permanence. Elle est « une page à
ouvrir », pas « un service à démarrer » : le seul contrôle valable est celui du
§6, et il teste le serveur statique, pas l'application.

**6. Croire que le hub peut lire ou sauvegarder les données.**
Elles sont dans le navigateur, pas sur le disque (§7). Le hub ne peut ni les
afficher, ni les compter, ni les sauvegarder, ni les restaurer. La seule voie
reste l'export manuel depuis l'application.

**7. Deux origines = deux jeux de données.**
Le téléphone (PWA) et le PC ne se synchronisent jamais. Le seul pont est
export / import (§7). Un hub qui afficherait « les données de l'appli » sans
préciser de quelle origine induirait en erreur.

**8. Déploiement et cache après un `git push`.**
Pousser sur `main` déclenche la publication Pages, qui prend un moment, et le
CDN comme le navigateur peuvent encore servir l'ancienne page. Le service
worker servant la copie gardée dès que le réseau tarde plus de 1200 ms
(`sw.js:92-95`), **la première ouverture après un déploiement peut montrer
l'ancienne page** : la neuve arrive en arrière-plan et s'affiche au lancement
suivant. Un rechargement forcé l'obtient tout de suite. Le hub ne doit pas
conclure à un échec si la page ne change pas dans la minute.

**9. Le manifeste n'a pas d'`id`** (§4). L'identité de l'application installée
dérive donc de `start_url`. Si le hub servait un jour l'application à un autre
chemin, le téléphone pourrait la considérer comme une application différente et
en installer une seconde, avec son propre cache — et, comme au point 1, son
propre jeu de données vide. Signalé plutôt que corrigé, conformément à la
consigne.
