# planningiut

Un planning universitaire moderne réalisé par @kernoeb.  

[![Heroku App Status](https://heroku-shields.herokuapp.com/planningiut)](https://planningiut.herokuapp.com)
[![Depfu](https://badges.depfu.com/badges/01919e6a50135b1fa0c82c303dd44fec/status.svg)](https://depfu.com)
[![DeepScan grade](https://deepscan.io/api/teams/12018/projects/14979/branches/290903/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=12018&pid=14979&bid=290903)

### Ajouter une spécialité ou une université

Si votre université (ou autre!) accepte le format `ICS` pour les calendriers, n'hésitez pas à faire une pull request en modifiant le fichier `static/url.json` - en respectant à la lettre le schéma déjà présent ! :wink:

> Note : dans la plupart des cas, vous devrez exporter votre calendrier au format iCalendar, et récupérer l'url obtenue (veillez à mettre un calendrier qui dure longtemps!).

### Fonctionnalités

<!--- Mode hors connexion-->
- Couleurs par catégorie (Amphi, TD, TP, etc.)
- Mode jour / semaine / mois
- Zoom sur un cours
- Changement d'université / spécialité (cookie)
- Thème clair / thème sombre (cookie)
- Actualisation du planning au chargement, au focus de la page, ainsi que toutes les 2 minutes
- Liste noire (cacher un cours)

> N'hésitez pas à créér une issue ou à me contacter sur [Telegram](https://t.me/kernoeb) (@kernoeb) ou Discord (kernoeb#7737) pour plus d'infos, pour me notifier d'une erreur ou proposer une fonctionnalité !

### Comment ça marche ?

Le planning est hébergé sur un Heroku, et développé en Nuxt.js (et donc Vue.js).  
Nuxt.js, c'est du server-side rendering (SSR), donc le planning est généré côté serveur.

Il existe aussi une api : `/api/calendar`, qui fetch côté serveur le calendrier au format `.ics` depuis l'url donnée dans `static/url.json` (et vérifie l'existence du calendrier, comme un contrat).
Ce fichier est ensuite transformé en `.json`.

> Note : l'url n'est pas directement fetch dans la méthode *$fetch* de Nuxt.js pour éviter les problèmes de CORS.

L'application est une `PWA`, et fonctionne donc hors connexion *(à condition d'être déjà venu sur le planning, ça se sauvegarde dans le cache !)*

Pour finir, afin d'éviter les erreurs serveurs *(http 500)* côté université, les fichiers json sont sauvegardés dans une base de donnée PostgreSQL *(Heroku)*.
Si une erreur est présente, les données seront donc récupérées dans cette base de donnée.

### Captures

![desktop](img/desktop.png)  
<img src="img/phone1.png" height="300" />
<br>
<img src="img/phone2.png" height="300" />
<br>
<img src="img/phone3.png" height="300" />
<br>
<img src="img/phone4.png" height="300" />
<br>
<img src="img/phone5.png" height="300" />
<br>
<img src="img/phone6.png" height="300" />

### Installation

#### Heroku

Config Vars :
- DATABASE_URL | postgres://....
- HOST | 0.0.0.0
- NODE_ENV | production
- NPM_CONFIG_PRODUCTION | false

### Dons

Si vous souhaitez me faire un petit don :  
[![Support me on Buy Me a Coffee](https://img.shields.io/badge/Support%20me-☕-orange.svg?style=for-the-badge&label=Buy%20me%20a%20coffee)](https://www.buymeacoffee.com/kernoeb) [![PayPal](https://img.shields.io/badge/Donate-💵-yellow.svg?style=for-the-badge&label=PayPal)](https://www.paypal.com/kernoeb)
