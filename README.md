# planningiut

Un planning universitaire moderne réalisé par @kernoeb.  

[![Heroku App Status](https://heroku-shields.herokuapp.com/planningiut)](https://planningiut.herokuapp.com)
[![Depfu](https://badges.depfu.com/badges/01919e6a50135b1fa0c82c303dd44fec/status.svg)](https://depfu.com)
[![DeepScan grade](https://deepscan.io/api/teams/12018/projects/14979/branches/290903/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=12018&pid=14979&bid=290903)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/kernoeb/planningiut)
[![Better Uptime Badge](https://betteruptime.com/status-badges/v1/monitor/4xs1.svg)](https://betteruptime.com/?utm_source=status_badge)

### Ajouter une spécialité ou une université

Si votre université (ou autre!) accepte le format `ICS` pour les calendriers, n'hésitez pas à faire une pull request en modifiant le fichier `static/url.json` - en respectant à la lettre le schéma déjà présent ! :wink:

> Note : dans la plupart des cas, vous devrez exporter votre calendrier au format iCalendar, et récupérer l'url obtenue (veillez à mettre un calendrier qui dure longtemps!).  
> Si vous ne maîtrisez pas Git, envoyez moi un message privé (voir ci-dessous) :)

### Fonctionnalités

<!--- Mode hors connexion-->
- Couleurs par catégorie *ou* par UE (Amphi, TD, TP, etc.)
- Mode jour / semaine / mois
- Zoom sur un cours
- Changement d'université / spécialité (cookie)
- Thème clair / thème sombre (cookie)
- Actualisation du planning au chargement, au focus de la page, ainsi que toutes les 2 minutes
- Liste noire (cacher un cours)

> N'hésitez pas à créér une issue ou à me contacter sur [Telegram](https://t.me/kernoeb) (@kernoeb) ou Discord (kernoeb#7737) pour plus d'infos, pour me notifier d'une erreur ou proposer une fonctionnalité !

### Comment ça marche ?

Le planning est développé en [Nuxt.js](https://nuxtjs.org/). Pour résumer, c'est du server-side rendering (SSR).

#### APIs :

- `/api/calendar` : fetch côté serveur du calendrier au format `.ics`, puis conversion au format JSON
- `/api/urls` (en cache côté serveur) : `./static/url.json`, mais sans les URLs


> Note : l'url n'est pas directement fetch dans la méthode *$fetch* de Nuxt.js pour éviter les problèmes de CORS.

Pour finir, afin d'éviter les erreurs serveurs *(http 500)* côté université, les fichiers json sont sauvegardés dans une base de donnée PostgreSQL. J'utilise pour cela un Node.js worker (threads) qui fetch les plannings toutes les 10 minutes.  
Si une erreur est présente (serveur down, par exemple), les données seront donc récupérées dans cette base de donnée.

### Captures

![desktop](img/desktop.png)  
<img src="img/phone1.png" height="300" />
<br>
<img src="img/phone2.png" height="300" />
<br>
<img src="img/phone3.png" height="300" />
<br>
<img src="img/phone4.png" height="300" />

### Installation

#### Heroku

Config Vars :
- DATABASE_URL | postgres://....
- HOST | 0.0.0.0
- NODE_ENV | production
- NPM_CONFIG_PRODUCTION | false

#### Docker

docker-compose.yml
```
services:
  web:
    image: ghcr.io/kernoeb/planningiut/planning
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - web.env
    depends_on:
      - db
  db:
    image: postgres
    volumes:
      - /opt/planning/data:/var/lib/postgresql/data
    restart: always
    env_file:
      - db.env

networks:
  default:
    external:
      name: planning
```

db.env
```
DATABASE_URL=postgresql://postgres:P4SSW0RD@db
```

web.env
```
DATABASE_URL=postgresql://postgres:P4SSW0RD@db
```

Pull automatique (toutes les 30 minutes) du docker-compose et démarrage :
```
*/30 * * * * cd /path/to/dockercompose/ && docker-compose pull && docker-compose up -d
```


### Dons

Si vous souhaitez me faire un petit don :  
[![Support me on Buy Me a Coffee](https://img.shields.io/badge/Support%20me-☕-orange.svg?style=for-the-badge&label=Buy%20me%20a%20coffee)](https://www.buymeacoffee.com/kernoeb) [![PayPal](https://img.shields.io/badge/Donate-💵-yellow.svg?style=for-the-badge&label=PayPal)](https://www.paypal.com/kernoeb)
