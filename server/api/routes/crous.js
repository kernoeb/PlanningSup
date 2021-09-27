const { Router, json } = require('express')
const router = Router()
const jsdom = require('jsdom')
const { JSDOM } = jsdom
const sanitizeHtml = require('sanitize-html')
const { DateTime } = require('luxon')
const routeCache = require('route-cache')
const axios = require('../../axios')
const xml2js = require('xml2js');

router.get('/crous/:ville', process.env.NODE_ENV === 'production' ? routeCache.cacheSeconds(60 * 10) : routeCache.cacheSeconds(0), async (req, res) => {
  try {

    const d = await axios.get("http://webservices-v2.crous-mobile.fr:8080/feed/" + req.params.ville + "/externe/resto.xml")
    const d2 = await axios.get("http://webservices-v2.crous-mobile.fr:8080/feed/" + req.params.ville + "/externe/menu.xml")
    
    var json = {}
    xml2js.parseString(d.data, (err, result) => {
      if (err) {
        throw err;
      }
      for (const elem of result.root.resto) {
        var id = (elem["$"].id);
        json[id] = ({
          description: elem["$"],
          infos: elem.infos[0],
          contact: elem.contact[0]
        })
      }
      xml2js.parseString(d2.data, (err, result) => {
        if (err) {
          throw err;
        }
        for (const elem of result.root.resto) {
          var id = (elem["$"].id);

          json[id].menu = new Array()
          if (elem.menu != null) {
            for (const repas of elem.menu) {
              json[id].menu.push({ data: repas["$"].date, repas: repas["_"] })
            }
		      }
        }
        return res.json(json)
      });
    });
    
  } catch (err) {
    throw err;
    return res.json({ title: err })
  }
})

router.get('/crous_menu', process.env.NODE_ENV === 'production' ? routeCache.cacheSeconds(60 * 10) : routeCache.cacheSeconds(0), async (req, res) => {
  try {
    const d = await axios.get('https://www.crous-rennes.fr/restaurant/restou-et-cafet-kercado/')
    const dom = new JSDOM(d.data)
    const el = dom.window.document.getElementById('menu-repas').childNodes
    const allEls = []

    Array.from(el[1].childNodes).forEach((b) => {
      const tmp = Array.from(b.childNodes).filter(v => v.innerHTML)
      if (tmp[0] && tmp[0].textContent && tmp[1] && tmp[1].innerHTML) {
        const dej = sanitizeHtml(tmp[1].innerHTML.trim())
        allEls.push({
          title: tmp[0].textContent,
          content: dej.split('\n'),
          date: DateTime.fromFormat(tmp[0].textContent.split(' ').slice(-3).join(' '), 'd LLLL yyyy', { locale: 'fr' }).toISO()
        })
      }
    })
    return res.json(allEls)
  } catch (err) {
    return res.json({})
  }
})

module.exports = router
