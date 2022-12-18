import jsdom from 'jsdom'
import { curly } from 'node-libcurl'
import ical from 'cal-parser'
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
    const { data } = await curly.get(e.url)
    const ics = ical.parseString(data)
    const next = ics.events.find(v => new Date(v.dtstart.value).getTime() > TODAY.getTime() &&
      v.summary &&
      !v.summary.value.toLowerCase().includes('fermeture') &&
      !v.summary.value.toLowerCase().includes('férié'))
    if (!next) {
      console.log('No next event :,' + e.title)
      g.edts = g.edts.filter(v => v.id !== e.id)
    }
  }
}

pbcopy(JSON.stringify(EDTS))
