import jsdom from 'jsdom'
import icalJs from 'ical.js'
import { fetchWithTimeout } from '../server/util/http.js'
const { JSDOM } = jsdom

async function pbcopy (data) {
  const proc = (await import('child_process')).spawn('pbcopy')
  proc.stdin.write(data); proc.stdin.end()
}

const url = 'https://edt.xxxxxx.fr/iut_xxxxx/gindex.html'

const dom = await JSDOM.fromURL(url)
const document = dom.window.document

const TEMPLATE = 'https://edt.xxxxxx.fr/iut_xxxx/{ID}.ics'

const el = document.querySelector('[name="menu2"]')

const EDTS = {
  id: 'iutdexxxxx',
  title: 'IUT de X',
  edts: []
}

Array.from(el.childNodes).forEach((b) => {
  if (b.value && b.value.endsWith('.html')) {
    const id = b.value.split('.html')[0].trim()
    const url = TEMPLATE.replace('{ID}', id)
    const title = b.textContent.trim()
    const o = { id, url, title }
    const gId = title.replace('_', ' ').replace(/[^a-zA-Z ]+/g, '').split(' ')[0].trim().toLowerCase()
    if (!EDTS.edts.find(e => e.id === gId)) {
      EDTS.edts.push({
        id: gId,
        title,
        edts: [o]
      })
    } else {
      EDTS.edts.find(e => e.id === gId).edts.push(o)
    }
  }
})

const TODAY = new Date()

for (const g of EDTS.edts) {
  for (const e of g.edts) {
    const { data } = await fetchWithTimeout(e.url)
    const comp = new icalJs.Component(icalJs.parse(data))
    const vEvents = comp.getAllSubcomponents('vevent')
    const events = vEvents.map(v => new icalJs.Event(v))

    const next = events.find(v => v.startDate.toJSDate().getTime() > TODAY.getTime() &&
      v.summary &&
      !v.summary.toLowerCase().includes('fermeture') &&
      !v.summary.toLowerCase().includes('férié'))

    if (!next) {
      console.log('No next event :,' + e.title)
      g.edts = g.edts.filter(v => v.id !== e.id)
    }
  }
}

pbcopy(JSON.stringify(EDTS)).then(console.log).catch(console.error)
