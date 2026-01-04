<h1 align="center">
  <br>
  <a href="https://planningsup.app"><img src="https://raw.githubusercontent.com/kernoeb/PlanningSup/main/apps/web/public/icon.png" alt="PlanningSup" width="200"></a>
  <br>
  PlanningSup
  <br>
</h1>

<h4 align="center">Un planning universitaire moderne réalisé par <a href="https://github.com/kernoeb" target="_blank">@kernoeb</a>.</h4>

<p align="center">
  <a href="https://github.com/kernoeb/PlanningSup/releases"><img src="https://img.shields.io/github/v/release/kernoeb/planningsup"></a>
  <a href="https://deepscan.io/dashboard#view=project&tid=12018&pid=22093&bid=649211">
    <img src="https://deepscan.io/api/teams/12018/projects/22093/branches/649211/badge/grade.svg" alt="DeepScan grade">
  </a>
</p>

![img.png](apps/web/public/screenshots/wide.png)

## Fonctionnalités

- **PWA hors connexion** avec installation sur bureau et mobile
- Couleurs par catégorie ou UE, thèmes clair/sombre
- Vues jour / semaine / mois, zoom sur un cours, sélection multiple
- Rafraîchissement automatique (chargement, focus, toutes les 2 minutes)
- Liste de blocage (cacher un cours) et mise en avant de l’enseignant
- Changement d’université/spécialité via cookie ou paramètres

> N'hésitez pas à créer une issue ou à me contacter sur [Telegram](https://t.me/kernoeb) (@kernoeb) ou Discord (kernoeb) pour plus d'infos, pour me notifier d'une erreur ou proposer une fonctionnalité !

## Extension navigateur

- [Chrome Web Store](https://chromewebstore.google.com/detail/planningsup/bcjhdlcgblcphljokeippholkfifdbod)

## Ajouter une spécialité ou une université

Si votre université (ou autre !) accepte le format `ICS` pour les calendriers, vous pouvez ouvrir une Pull Request en modifiant le fichier `.json` correspondant dans `resources/plannings`.

> Avec [@matissePe](https://github.com/matissePe) et [@ShockedPlot7560](https://github.com/ShockedPlot7560), nous avons réalisé un **script** pour générer automatiquement le JSON dans la bonne forme, situé dans le dossier `scripts` du projet.

## Stack & architecture

- **Monorepo Bun workspaces** : `apps/` (API, PWA, desktop/mobile, extension) et `packages/` (config, libs), assets dans `resources/`.
- **API** `apps/api` : [Elysia](https://elysiajs.com) + Drizzle, base **PostgreSQL** (plus de MongoDB). Les plannings ICS sont lus depuis `resources/plannings/*.json`, convertis à la volée et sauvegardés en backup dans Postgres.
- **Front** `apps/web` : Vue 3 + Vite + DaisyUI (Tailwind). Sert la PWA et consomme l’API (`/plannings`, `/plannings/:fullId?events=true`).
- **Jobs** : runner Bun avec fenêtres de silence configurables (`RUN_JOBS`, `JOBS_QUIET_HOURS`), notamment pour le backup des plannings.
- **Partagé** : presets Vite/TS (`packages/config`) et utilitaires ESLint/TS (`packages/libs`).

## Structure du dépôt

- `apps/api` : service Elysia, migrations/ORM Drizzle.
- `apps/web` : PWA Vue 3.
- `apps/app` : cibles desktop/mobile (Tauri).
- `apps/extension` : extension navigateur.
- `packages/libs`, `packages/config` : outillage partagé.
- `resources/plannings` : JSON ICS par établissement.
- `test/` : unitaires, intégration, E2E (Playwright).

## Pré-requis

- [Bun](https://bun.sh) (version indiquée dans `.bun-version`)
- Node.js ≥ 24 (pour certains outils)
- Docker + Docker Compose (PostgreSQL 18 fourni dans `docker-compose.yml`)

## Démarrage rapide (développement)

```bash
# 1. Dépendances
bun install

# 2. Variables d'environnement API
cp apps/api/.env.example apps/api/.env
# DATABASE_URL par défaut : postgres://planningsup:mysecretpassword@localhost:5432/planningsup

# 3. Lancer tout le stack
bun dev
# -> démarre Postgres via docker compose puis API (http://localhost:20000) et PWA (http://localhost:4444)
```

- Les migrations Drizzle et la synchronisation des plannings sont exécutées au démarrage de l’API.
- `bun dev` passe par `scripts/run dev` et ignore `apps/app`/`apps/extension` pour un démarrage rapide.

### Commandes utiles

- `bun run build` : build de tous les packages applicables.
- `bun run lint` · `bun run lint-fix` : ESLint.
- `bun run typecheck` : vérification TS.
- `bun run test:unit` : tests unitaires Bun.
- `bun run test:integration` : tests d’intégration (Docker requis).
- `bun run test:e2e` (+ variantes `:safari`, `:headed`, `:debug`) : Playwright.  
  Plus de détails dans `TESTING.md`.

## Déploiement Docker

- Image publique : `ghcr.io/kernoeb/planningsup`.
- Exemple `docker-compose.prod.yml` (Postgres + webapp).  
  Créez `db.env` (POSTGRES_USER/PASSWORD/DB) et `webapp.env` avec au minimum :

```bash
DATABASE_URL=postgres://planningsup:mysecretpassword@postgres:5432/planningsup
PORT=20000
RUN_JOBS=true
PUBLIC_ORIGIN=https://planningsup.app
TRUSTED_ORIGINS=https://planningsup.app
```

## Donateurs

- [Ewennn](https://github.com/Ewennnn)
- [W00dy](https://github.com/0xW00dy)
- [Rick](https://github.com/rick-gnous)
- [Lahgolz](https://twitter.com/lahgolzmiin)
- [Dyskal](https://github.com/Dyskal)
- [Mimipepin](https://github.com/mimipepin)
- [Atao](https://github.com/Ataaoo)
- [PandAmiral](https://github.com/PandAmiral)
- [ShockedPlot](https://github.com/ShockedPlot7560)
- [BatLeDev](https://github.com/BatLeDev)
- Louanne M.
- RidzArt
- [EDM115](https://github.com/EDM115)
- Xotak

(merci à vous ! ❤️)

Si vous souhaitez me faire un petit don :

[![PayPal](https://img.shields.io/badge/Donate-💵-yellow.svg?style=for-the-badge&label=PayPal)](https://www.paypal.com/paypalme/kernoeb)

[![Support me on Buy Me a Coffee](https://img.shields.io/badge/Support%20me-☕-orange.svg?style=for-the-badge&label=Buy%20me%20a%20coffee)](https://www.buymeacoffee.com/kernoeb)
