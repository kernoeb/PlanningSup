/**
 * SHU Generator Script
 * Reads planning JSON files and replaces URLs in place with generated .shu URLs
 *
 * Usage:
 *   node shu-generator.js <filename> [--domain <url>] [--cookie <cookie>] [--project <id>]
 *
 * Examples:
 *   node shu-generator.js xxxx.json
 *   node shu-generator.js ensea.json --domain https://ade.ensea.fr --cookie 'JSESSIONID=...' --project 3
 *
 * Options (each can also be set in CONFIG below or with ADE_DOMAIN / ADE_COOKIE):
 *   --domain   ADE host, e.g. https://planning.univ-xxxx.fr
 *   --cookie   cookie of a logged-in ADE session (copy it from the browser)
 *   --project  ADE projectId to use instead of the one in each URL (needed after a year rollover)
 *
 * The script will:
 * 1. Read the specified JSON file from resources/plannings/
 * 2. Extract the resource ids and the projectId from URLs like: resources=123,456&projectId=3
 * 3. Read the GWT method name and hashes from the server, so old and new ADE versions both work
 * 4. Call the GWT RPC API to generate .shu URLs
 * 5. Replace the original URLs in place
 * 6. Create a backup file with .backup extension
 */

import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    domain: { type: 'string' },
    cookie: { type: 'string' },
    project: { type: 'string' },
  },
})

// Configuration constants
const CONFIG = {
  // Server configuration
  DOMAIN: args.domain || process.env.ADE_DOMAIN || 'https://planning.xxxx-xxxx.fr',
  COOKIE: args.cookie || process.env.ADE_COOKIE || 'JSESSIONID=xxxxx',

  // Values of the old ADE build, used when the server does not let us read them
  LEGACY: {
    PERMUTATION: 'EF3D83F3B44FED6FC7C6AD129C70B9DA',
    CORE_POLICY: 'AB6CBED41BD6D0AD629E9C452786823C',
    GET_URL_METHOD: 'method9getGeneratedUrl',
    SESSION_ID: 'ZptuO4Q',
  },

  // GWT encodes dates as base64 milliseconds
  START_DATE: 'Zpq2QmA',
  END_DATE: 'ZqJvzGA',

  // Request settings
  REQUEST_DELAY_MS: 100,
  RETRY_DELAY_MS: 500,

  // File patterns
  RESOURCES_PATTERN: /resources=([\d,]+)/,
  PROJECT_PATTERN: /projectId=(\d+)/,
  SHU_RESPONSE_PATTERN: /\/\/OK\[1,\["([^"]+\.shu)"\]/,
  MAX_RETRIES: 10,
}

const GWT_BASE = () => `${CONFIG.DOMAIN}/direct/gwtdirectplanning`
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$_'

// Build details read from the server, or the legacy values
let build = null
// One registered session id per projectId
const sessions = new Map()

// Newer ADE versions rename the RPC method and change the hashes, so read them from the client code.
async function detectBuild() {
  const legacy = {
    permutation: CONFIG.LEGACY.PERMUTATION,
    corePolicy: CONFIG.LEGACY.CORE_POLICY,
    directPolicy: null,
    getUrlMethod: CONFIG.LEGACY.GET_URL_METHOD,
    detected: false,
  }
  try {
    const get = url => fetch(url).then(r => r.text())
    const loader = await get(`${GWT_BASE()}/gwtdirectplanning.nocache.js`)
    const permutation = loader.match(/'([0-9A-F]{32})'/)?.[1]
    if (!permutation) return legacy
    const client = await get(`${GWT_BASE()}/${permutation}.cache.html`)
    const getUrlMethod = client.match(/method\d+getGeneratedUrl/)?.[0]
    const corePolicy = client.match(/'CorePlanningServiceProxy','([0-9A-F]{32})'/)?.[1]
    const directPolicy = client.match(/'DirectPlanningServiceProxy','([0-9A-F]{32})'/)?.[1] ?? null
    if (!getUrlMethod || !corePolicy) return legacy
    return { permutation, corePolicy, directPolicy, getUrlMethod, detected: true }
  } catch (error) {
    console.log(`Could not read the GWT build (${error.message}), using legacy values.`)
    return legacy
  }
}

async function rpc(service, data) {
  const response = await fetch(`${GWT_BASE()}/${service}`, {
    method: 'POST',
    headers: {
      'content-type': 'text/x-gwt-rpc; charset=UTF-8',
      'x-gwt-permutation': build.permutation,
      'x-gwt-module-base': `${GWT_BASE()}/`,
      'Cookie': CONFIG.COOKIE,
    },
    body: data,
  })
  return response.text()
}

// Newer ADE versions only accept ids that the web client registered with a login, then a project load.
async function registerSession(projectId) {
  if (!build.detected || !build.directPolicy) return CONFIG.LEGACY.SESSION_ID

  const sessionId = `a${Array.from(randomBytes(6), b => BASE64[b % 62]).join('')}`
  const service = 'com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy'
  const header = `${GWT_BASE()}/|${build.directPolicy}|${service}`
  try {
    const login = await rpc(
      'DirectPlanningServiceProxy',
      `7|0|11|${header}|method1login|J|com.adesoft.gwt.core.client.rpc.data.LoginRequest/3705388826|java.lang.String/2004016611|Z|com.adesoft.gwt.directplan.client.rpc.data.DirectLoginRequest/635437471||fr|1|2|3|4|4|5|6|7|8|${sessionId}|9|0|10|0|1|1|10|10|-1|0|0|11|0|`,
    )
    if (!login.startsWith('//OK')) throw new Error(login.slice(0, 120))
    const load = await rpc(
      'DirectPlanningServiceProxy',
      `7|0|7|${header}|method13loadProject|J|I|Z|1|2|3|4|3|5|6|7|${sessionId}|${projectId}|1|`,
    )
    if (!load.startsWith('//OK')) throw new Error(load.slice(0, 120))
    return sessionId
  } catch (error) {
    console.log(`Could not register a session (${error.message}), using the legacy session id.`)
    return CONFIG.LEGACY.SESSION_ID
  }
}

async function sessionFor(projectId) {
  if (!sessions.has(projectId)) sessions.set(projectId, await registerSession(projectId))
  return sessions.get(projectId)
}

// Function to extract the resource ids from a URL: resources=12,34 gives ['12', '34']
function extractResourceIds(url) {
  const match = url.match(CONFIG.RESOURCES_PATTERN)
  return match ? match[1].split(',') : null
}

// The project of the URL, unless --project overrides it. ADE 6 plannings use project 1 by default.
function extractProjectId(url) {
  return args.project || url.match(CONFIG.PROJECT_PATTERN)?.[1] || '1'
}

// Some responses return /plannings/.shu (missing filename); detect so we can retry.
function isIncompleteShuUrl(url) {
  return typeof url === 'string' && url.includes('/plannings/.shu')
}

// GWT RPC body: a string table, then the type and value of each argument.
function buildPayload(sessionId, resourceIds, projectId) {
  const ids = resourceIds.map(id => `9|${id}`).join('|')
  return [
    '7|0|11',
    `${GWT_BASE()}/`,
    build.corePolicy,
    'com.adesoft.gwt.core.client.rpc.CorePlanningServiceProxy',
    build.getUrlMethod,
    'J',
    'java.util.List',
    'java.lang.String/2004016611',
    'java.util.Date/3385151746',
    'java.lang.Integer/3438268394',
    'java.util.ArrayList/4159755760',
    'ical',
    '1|2|3|4|7|5|6|7|8|8|9|9',
    sessionId,
    `10|${resourceIds.length}|${ids}`,
    `11|8|${CONFIG.START_DATE}|8|${CONFIG.END_DATE}|9|${projectId}|9|8|`,
  ].join('|')
}

// Function to make the request and get the .shu URL
async function getShuUrl(resourceIds, projectId) {
  const sessionId = await sessionFor(projectId)
  const data = buildPayload(sessionId, resourceIds, projectId)

  try {
    const responseText = await rpc('CorePlanningServiceProxy', data)

    // Look for the pattern //OK[1,["https://...shu"],...
    const match = responseText.match(CONFIG.SHU_RESPONSE_PATTERN)

    if (match) {
      return match[1]
    } else {
      console.log(`No .shu URL found in response for resources ${resourceIds.join(',')}`)
      console.log('Response:', responseText)
      return null
    }
  } catch (error) {
    console.error(`Error fetching .shu URL for resources ${resourceIds.join(',')}:`, error.message)
    return null
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Function to recursively process and replace URLs in the planning structure
async function processEdtUrls(planningObject, stats) {
  if (planningObject.url) {
    const resourceIds = extractResourceIds(planningObject.url)

    if (resourceIds) {
      const projectId = extractProjectId(planningObject.url)
      console.log(`Processing ${planningObject.title} (ID: ${planningObject.id}) with resources: ${resourceIds.join(',')}`)

      let shuUrl = null
      for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
        const candidate = await getShuUrl(resourceIds, projectId)

        if (candidate && !isIncompleteShuUrl(candidate)) {
          shuUrl = candidate
          break
        }

        const reason = candidate ? 'incomplete .shu URL' : 'empty response'
        console.log(`Attempt ${attempt}/${CONFIG.MAX_RETRIES} failed (${reason}).`)

        if (attempt < CONFIG.MAX_RETRIES) {
          console.log(`Retrying in ${CONFIG.RETRY_DELAY_MS}ms...`)
          await delay(CONFIG.RETRY_DELAY_MS)
        }
      }

      if (shuUrl) {
        // Replace the URL in place
        planningObject.url = shuUrl
        stats.success++
        console.log(`✓ Updated: ${shuUrl}`)
      } else {
        stats.failed++
        console.log(`✗ Failed to get .shu URL for ${planningObject.title}`)
      }

      // Add a small delay to avoid overwhelming the server
      await delay(CONFIG.REQUEST_DELAY_MS)
    } else if (!planningObject.url.endsWith('.shu')) {
      console.log(`Could not extract resources from URL: ${planningObject.url}`)
      stats.failed++
    }
  }

  // Recursively process nested edts
  for (const key of ['edts', 'children']) {
    if (Array.isArray(planningObject[key])) {
      for (const edt of planningObject[key]) {
        await processEdtUrls(edt, stats)
      }
    }
  }
}

// Main function
async function main() {
  try {
    // Get filename from command line argument
    const filename = positionals[0]
    if (!filename) {
      console.error('Usage: node shu-generator.js <filename> [--domain <url>] [--cookie <cookie>] [--project <id>]')
      process.exit(1)
    }

    const jsonPath = path.join(__dirname, '..', 'resources', 'plannings', filename)

    if (!fs.existsSync(jsonPath)) {
      console.error(`File not found: ${jsonPath}`)
      process.exit(1)
    }

    const jsonContent = fs.readFileSync(jsonPath, 'utf8')
    const planningData = JSON.parse(jsonContent)

    console.log(`Reading ${filename}...`)
    build = await detectBuild()
    console.log(build.detected
      ? `Detected ADE build: ${build.getUrlMethod}`
      : `Using legacy ADE build: ${build.getUrlMethod}`)
    console.log('Starting URL replacement process...\n')

    // Statistics tracking
    const stats = { success: 0, failed: 0 }

    // Process all URLs recursively and replace them in place
    await processEdtUrls(planningData, stats)

    // Create backup of original file
    const backupPath = `${jsonPath}.backup`
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, jsonContent)
      console.log(`\nBackup created: ${backupPath}`)
    }

    // Write the updated data back to the original file
    fs.writeFileSync(jsonPath, JSON.stringify(planningData, null, 2))
    console.log(`Updated file saved: ${jsonPath}`)

    // Print summary
    console.log(`\nSummary:`)
    console.log(`Successful .shu URLs generated: ${stats.success}`)
    console.log(`Failed: ${stats.failed}`)
    console.log(`Total processed: ${stats.success + stats.failed}`)

    if (stats.success > 0) {
      console.log(`\n✅ URLs have been replaced in place in ${filename}`)
    }
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

// Run the script
main()

export { extractProjectId, extractResourceIds, getShuUrl }
