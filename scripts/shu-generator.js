/**
 * SHU Generator Script
 * Reads planning JSON files and replaces URLs in place with generated .shu URLs
 *
 * Usage:
 *   node shu-generator.js [filename]
 *
 * Examples:
 *   node shu-generator.js               # Process xxxx.json (default)
 *   node shu-generator.js xxxx.json    # Process xxxx.json explicitly
 *
 * The script will:
 * 1. Read the specified JSON file from resources/plannings/
 * 2. Extract project IDs from URLs with pattern: resources=123
 * 3. Call the GWT RPC API to generate .shu URLs
 * 4. Replace the original URLs in place
 * 5. Create a backup file with .backup extension
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration constants
const CONFIG = {
  // Server configuration
  DOMAIN: 'https://planning.xxxx-xxxx.fr',
  COOKIE: 'JSESSIONID=xxxxx',
  GWT_PERMUTATION: 'EF3D83F3B44FED6FC7C6AD129C70B9DA', // idk what this is

  // API endpoints
  RPC_ENDPOINT: '/direct/gwtdirectplanning/CorePlanningServiceProxy',

  // GWT RPC payload template (DOMAIN and PROJECT_ID will be replaced)
  RPC_PAYLOAD_TEMPLATE: '7|0|11|DOMAIN/direct/gwtdirectplanning/|AB6CBED41BD6D0AD629E9C452786823C|com.adesoft.gwt.core.client.rpc.CorePlanningServiceProxy|method9getGeneratedUrl|J|java.util.List|java.lang.String/2004016611|java.util.Date/3385151746|java.lang.Integer/3438268394|java.util.ArrayList/4159755760|ical|1|2|3|4|7|5|6|7|8|8|9|9|Zk1T_Cy|10|1|9|PROJECT_ID|11|8|ZkmMXcA|8|Zk_8UMA|9|12|9|8|',

  // Request settings
  REQUEST_DELAY_MS: 100,

  // File patterns
  URL_PATTERN: /resources=(\d+)/,
  SHU_RESPONSE_PATTERN: /\/\/OK\[1,\["([^"]+\.shu)"\]/,
}

// Function to extract projectId from URL
function extractProjectId(url) {
  const match = url.match(CONFIG.URL_PATTERN)
  return match ? match[1] : null
}

// Function to make the curl request and get .shu URL
async function getShuUrl(projectId) {
  const url = `${CONFIG.DOMAIN}${CONFIG.RPC_ENDPOINT}`

  const headers = {
    'content-type': 'text/x-gwt-rpc; charset=UTF-8',
    'x-gwt-permutation': CONFIG.GWT_PERMUTATION,
    'Cookie': CONFIG.COOKIE,
  }

  // Replace DOMAIN and PROJECT_ID with actual values in the data payload
  const data = CONFIG.RPC_PAYLOAD_TEMPLATE
    .replace('DOMAIN', CONFIG.DOMAIN)
    .replace('PROJECT_ID', projectId)

  try {
    const response = await axios.post(url, data, { headers })

    // Parse the response to extract the .shu URL
    const responseText = response.data

    // Look for the pattern //OK[1,["https://...shu"],...
    const match = responseText.match(CONFIG.SHU_RESPONSE_PATTERN)

    if (match) {
      return match[1]
    } else {
      console.log(`No .shu URL found in response for projectId ${projectId}`)
      console.log('Response:', responseText)
      return null
    }
  } catch (error) {
    console.error(`Error fetching .shu URL for projectId ${projectId}:`, error.message)
    return null
  }
}

// Function to recursively process and replace URLs in the planning structure
async function processEdtUrls(planningObject, stats) {
  if (planningObject.url) {
    const projectId = extractProjectId(planningObject.url)

    if (projectId) {
      console.log(`Processing ${planningObject.title} (ID: ${planningObject.id}) with projectId: ${projectId}`)

      const shuUrl = await getShuUrl(projectId)

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
      await new Promise(resolve => setTimeout(resolve, CONFIG.REQUEST_DELAY_MS))
    } else {
      console.log(`Could not extract projectId from URL: ${planningObject.url}`)
      stats.failed++
    }
  }

  // Recursively process nested edts
  if (planningObject.edts && Array.isArray(planningObject.edts)) {
    for (const edt of planningObject.edts) {
      await processEdtUrls(edt, stats)
    }
  }
}

// Main function
async function main() {
  try {
    // Get filename from command line argument
    const filename = process.argv[2]
    if (!filename) {
      console.error('Usage: node shu-generator.js [filename]')
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

export { extractProjectId, getShuUrl }
