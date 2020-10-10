# planningiut

Un planning universitaire sympathique réalisé par @kernoeb.  

![Heroku](https://heroku-badge.herokuapp.com/?app=planningiut)

### Ajouter une spécialité ou une université

Faîtes une pull request en modifiant le fichier `static/url.json`, en respectant à la lettre le schéma déjà présent ! :)

### Fonctionnalités

- Mode hors connexion
- Couleurs par catégorie (Amhpi, TD, TP, etc)
- Mode jour / semaine / mois
- Zoom sur un cours
- Changement d'université / spécialité
- Thème clair / thème sombre

### Comment ça marche ?

Le planning est hébergé sur un Heroku, et développé en Nuxt.js (et donc Vue.js).  
Nuxt.js, c'est du server-side rendering (SSR), donc le planning est généré côté serveur.

Il existe aussi une api : `/api/getCalendar`, qui fetch le calendrier au format `.ics` depuis l'url donnée dans `static/url.json`.
Ce fichier est ensuite transformé en `.json`.

L'application est une `PWA`, et fonctionne donc hors connexion *(à condition d'être déjà venu sur le planning, ça se sauvegarde dans le cache !)*

Pour finir, afin d'éviter les erreurs serveurs *(http 500)* côté université, les fichiers json sont sauvegardés dans une base de donnée PostgreSQL *(Heroku)*.
Si une erreur est présente, les données seront donc récupérées dans cette base de donnée.

### Captures :

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
