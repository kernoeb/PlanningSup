<h1 align="center">
  <br>
  <a href="https://planningsup.app"><img src="https://raw.githubusercontent.com/kernoeb/PlanningSup/main/static/icon.png" alt="PlanningSup" width="200"></a>
  <br>
  PlanningSup
  <br>
</h1>

<h4 align="center">Un planning universitaire moderne réalisé par <a href="https://github.com/kernoeb" target="_blank">@kernoeb</a>.</h4>

<p align="center">
  <a href="https://github.com/kernoeb/PlanningSup/releases"><img src="https://img.shields.io/github/v/release/kernoeb/planningsup"></a>
  <a href="https://betteruptime.com/?utm_source=status_badge">
    <img src="https://betteruptime.com/status-badges/v1/monitor/cg82.svg">
  </a>
</p>

![img.png](img/planning_mac.png)

## Fonctionnalités

- **Hors connexion** / installation en mode **PWA**
- Couleurs par catégorie *ou* par UE (Amphi, TD, TP, etc.) et choix des couleurs
- Mode jour / semaine / mois
- Zoom sur un cours
- Changement d'université / spécialité (cookie ou paramètre)
- Thème clair / thème sombre (cookie)
- Sélection **multiple** de plannings
- Actualisation du planning au chargement, au focus de la page et toutes les 2 minutes
- Liste noire (cacher un cours)

> N'hésitez pas à créer une issue ou à me contacter sur [Telegram](https://t.me/kernoeb) (@kernoeb) ou Discord (kernoeb#7737) pour plus d'infos, pour me notifier d'une erreur ou proposer une fonctionnalité !


## Ajouter une spécialité ou une université

Si votre université (ou autre !) accepte le format `ICS` pour les calendriers, n'hésitez pas à faire une pull request en modifiant le fichier `assets/plannings.json` - en respectant à la lettre le schéma déjà présent !

Avec [@matissePe](https://github.com/matissePe) et [@ShockedPlot7560](https://github.com/ShockedPlot7560), nous avons réalisé un script pour automatiquement générer un tableau au format JSON dans la bonne forme, situé dans le dossier `resources` du projet.

> Note : dans la plupart des cas, vous devrez exporter votre calendrier au format iCalendar, et récupérer l'URL obtenue (veillez à mettre un calendrier qui dure longtemps !).  
> Si vous ne maîtrisez pas Git, envoyez-moi un message privé (voir ci-dessous) :)

## Comment ça marche ?

Le planning est développé en [Nuxt.js](https://nuxtjs.org/). Tout est dockerisé !

#### APIs :

- `/api/calendars` : fetch côté serveur du calendrier au format `.ics`, puis conversion au format JSON
- `/api/urls` (en cache côté serveur) : `./assets/plannings.json`, mais sans les URLs

Pour finir, afin d'éviter les erreurs serveurs *(http 500)* côté université, les fichiers json sont sauvegardés dans une base de donnée PostgreSQL. J'utilise pour cela un Node.js worker (threads) qui fetch les plannings toutes les 10 minutes.  
Si une erreur est présente (serveur down, par exemple), les données seront donc récupérées dans cette base de donnée.

## Captures

![desktop](img/desktop.png)  
<img src="img/phone1.png" height="300" /><img src="img/phone4.png" height="300"/>
<br>
<img src="img/phone2.png" height="300" /><img src="img/phone3.png" height="300"/>
<br>

## Installation

### Docker

Créez un fichier `.env` avec les variables suivantes :  

> Remplacez la variable 'SESSION_SECRET' avec une valeur aléatoire et unique.

```
SESSION_SECRET=secret
MONGODB_URL=mongodb:27017
TZ=Europe/Paris
```

Copiez le fichier `docker-compose.yml` et lancez `docker-compose pull && docker-compose up -d --remove-orphans` pour démarrer les conteneurs.

Pull automatique (toutes les 30 minutes) du docker-compose et démarrage :
```
*/30 * * * * cd /path/to/dockercompose/ && docker-compose pull && docker-compose up -d --remove-orphans
```

## Développement

### Nécessaire

- [Node.js](https://github.com/nodejs/node) 16.X : Installation via [nvm](https://github.com/nvm-sh/nvm)
- [pnpm](https://pnpm.io/) : Gestionnaire de paquets

### Commandes utiles

- Lancement en local : `pnpm run dev` (pour ne pas utiliser Mongo et ne pas lancer les backups)
- Build du projet : `pnpm run build`
- Démarrage de MongoDB (en local) : `docker-compose up -f docker-compose-dev.yml up -d --remove-orphans`

```
version: '2'

services:
  mongodb:
    image: docker.io/bitnami/mongodb:5.0
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - '/opt/planning_v2:/bitnami/mongodb'
```

> For MacOS M1, you can use `zcube/bitnami-compat-mongodb:5.0`

## Donateurs

- [W00dy](https://github.com/0xW00dy)
- [Rick](https://github.com/rick-gnous)
- [Lahgolz](https://twitter.com/lahgolzmiin)
- [Dyskal](https://github.com/Dyskal)
- [Mimipepin](https://github.com/mimipepin)
- [Atao](https://github.com/Ataaoo)
- [PandAmiral](https://github.com/PandAmiral)
- [ShockedPlot](https://github.com/ShockedPlot7560)

(merci à vous ! ❤️)

Si vous souhaitez me faire un petit don :

[![PayPal](https://img.shields.io/badge/Donate-💵-yellow.svg?style=for-the-badge&label=PayPal)](https://www.paypal.com/paypalme/kernoeb)

[![Support me on Buy Me a Coffee](https://img.shields.io/badge/Support%20me-☕-orange.svg?style=for-the-badge&label=Buy%20me%20a%20coffee)](https://www.buymeacoffee.com/kernoeb)
