const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert');

let planningsDir = process.env.PLANNINGS_DIR || path.join(__dirname, '../../../../resources/plannings') // TODO do this better
if (!fs.existsSync(planningsDir)) throw new Error(`The plannings directory does not exist: ${planningsDir}`)

const allPlanningFiles = fs.readdirSync(planningsDir).filter(file => file.endsWith('.json'))

if (allPlanningFiles.length === 0) {
  throw new Error(`No planning files found in ${planningsDir}`)
}

const allPlannings = allPlanningFiles
  .map(file => ({
    file,
    content: JSON.parse(fs.readFileSync(path.join(planningsDir, file), 'utf-8'))
  }))
  .map(({ file, content }) => ({
    ...content,
    id: file.replace('.json', '')
  }))
  .flat()
  .toSorted((a ,b) => a.title.localeCompare(b.title))

assert(allPlannings.length === allPlanningFiles.length, 'All planning files are not loaded')

const idSeparator = '.'

function getChildElement (child, id) {
  if (child.url) {
    child.fullId = id + idSeparator + child.id
    delete child.url
  } else {
    (child.edts || child).forEach((v) => {
      v.fullId = child.id ? ((id ? (id + '.') : '') + child.id + idSeparator + v.id) : v.id
      getChildElement(v, id ? (id + idSeparator + child.id) : child.id)
    })
  }
}

/**
 * Remove ids
 * @param obj
 * @param match
 */
function deleteIds (obj, match) {
  delete obj[match]
  for (const v of Object.values(obj)) {
    if (v instanceof Object) {
      deleteIds(v, match)
    }
  }
}

const cleanedPlannings = structuredClone(allPlannings)
getChildElement(cleanedPlannings)
cleanedPlannings.forEach((v) => {
  deleteIds(v, 'id')
})


const planningsPerFullId = {}
const titleSeparator = ' | '
function recursiveEdts (j, id, title) {
  if (j.edts) {
    j.edts.forEach((edts) => {
      recursiveEdts(edts, id ? (id + idSeparator + j.id) : j.id, title ? (title + titleSeparator + j.title) : j.title)
    })
  } else {
    planningsPerFullId[id + idSeparator + j.id] = { title: title + titleSeparator + j.title, url: j.url }
  }
}

structuredClone(allPlannings).forEach((univ) => {
  recursiveEdts(univ)
})

const allCalendarIds = allPlanningFiles.map((file) => file.replace('.json', ''))

assert(Object.keys(planningsPerFullId).length > 0, 'No planning found in planningsPerFullId')

module.exports = {
  idSeparator,
  allCalendarIds,
  rawPlannings: allPlannings,
  cleanedPlannings,
  planningsPerFullId
}
