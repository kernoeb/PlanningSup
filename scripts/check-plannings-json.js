import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import Ajv from 'ajv'
import axios from 'axios'

const { values: { fetch, whitelist } } = parseArgs({
  options: {
    fetch: { type: 'boolean', default: false },
    whitelist: { type: 'string', short: 'w' },
  },
})

const WHITELIST = whitelist ? whitelist.split(',') : null
console.log('Whitelist:', WHITELIST)

const ajv = new Ajv()

const element = {
  type: 'object',
  $id: 'element',
  oneOf: [
    { required: ['id', 'title', 'edts'] },
    { required: ['id', 'title', 'url'] },
  ],
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      minLength: 1,
    },
    title: {
      type: 'string',
      minLength: 1,
    },
    edts: {
      type: 'array',
      items: {
        type: 'object',
        $ref: 'element',
      },
      minItems: 1,
    },
    url: {
      type: 'string',
      minLength: 5,
      pattern: '^https?://',
    },
  },
}

const schema = {
  type: 'object',
  $id: 'global',
  required: ['title', 'edts'],
  additionalProperties: false,
  properties: {
    title: {
      type: 'string',
      minLength: 1,
    },
    edts: {
      type: 'array',
      items: {
        type: 'object',
        $ref: 'element',
      },
      minItems: 1,
    },
  },
  definitions: { element },
}

const validate = ajv.compile(schema)

const PLANNINGS_DIR = path.join(import.meta.dirname, '../resources/plannings')

const allJson = fs.readdirSync(PLANNINGS_DIR)
  .filter(file => file.endsWith('.json'))
  .filter(file => WHITELIST ? WHITELIST.some(w => file === `${w}.json`) : true)

for (const file of allJson) {
  const jsonFile = path.join(PLANNINGS_DIR, file)

  let content = fs.readFileSync(jsonFile, { encoding: 'utf8' })
  const data = JSON.parse(content)

  console.log(`Checking ${file} | ${data.title}`)

  const valid = validate(data)
  if (!valid) {
    console.error(validate.errors)
    process.exit(1)
  }

  console.log('JSON is valid')

  if (fetch) {
    const today = new Date()
    const inSixMonths = new Date()
    inSixMonths.setMonth(today.getMonth() + 6)

    const formattedToday = today.toISOString().split('T')[0]
    const formattedInSixMonths = inSixMonths.toISOString().split('T')[0]

    console.log(formattedToday)
    console.log(formattedInSixMonths)

    const allUrls = []
    JSON.parse(content, (key, value) => {
      if (key === 'url') allUrls.push(value.replace('{date-start}', formattedToday).replace('{date-end}', formattedInSixMonths))
      return value
    })

    const errorUrls = []

    const isValidData = data => !data.includes('The project is invalid')
      && !data.includes('<html')
      && data.includes('VCALENDAR')
      && data.split('\n').length >= 10

    const fetchUrl = async (url, timeout = 10000) => {
      try {
        const { data } = await axios.get(url, {
          timeout,
          headers: {
            'Accept-Language': 'en-US,en', // "The project is invalid"
          },
        })
        return { success: true, data }
      } catch (error) {
        return { success: false, error }
      }
    }

    const tryDifferentProjectIds = async (url) => {
      for (let projectId = 0; projectId <= 10; projectId++) {
        const newUrl = url.replace(/projectId=\d+/, `projectId=${projectId}`)
        const { success, data } = await fetchUrl(newUrl)
        if (success && isValidData(data)) {
          return { success: true, url: newUrl, data }
        }
      }
      return { success: false }
    }

    const processUrl = async (url) => {
      const { success, data, error } = await fetchUrl(url)

      if (success) {
        if (isValidData(data)) {
          return { success: true, url, data }
        } else {
          return await tryDifferentProjectIds(url)
        }
      } else {
        if (error.response && error.response.status === 404) {
          return await tryDifferentProjectIds(url)
        } else {
          return { success: false, url, error }
        }
      }
    }

    const processUrlsInChunks = async (urls, chunkSize) => {
      let updatedUrls = false
      for (let i = 0; i < urls.length; i += chunkSize) {
        const chunk = urls.slice(i, i + chunkSize)
        await Promise.all(
          chunk.map(async (url) => {
            const result = await processUrl(url)
            if (result.success) {
              if (result.url !== url) {
                const _URL = new URL(url)
                const domain = _URL.hostname
                const resources = _URL.searchParams.get('resources')
                const oldProjectId = _URL.searchParams.get('projectId')
                const newProjectId = new URL(result.url).searchParams.get('projectId')

                console.log(`${domain} [${resources}] ${oldProjectId} => ${newProjectId}`)

                const oldUrlWithoutDate = url.replace(/&firstDate=.+/, '')
                const newUrlWithoutDate = result.url.replace(/&firstDate=.+/, '')
                content = content.replace(oldUrlWithoutDate, newUrlWithoutDate)
                updatedUrls = true
              }
            } else {
              if (result.error === '404') {
                errorUrls.push({ url, error: '404' })
              } else if (result.error) {
                errorUrls.push({ url, error: result.error })
              } else {
                errorUrls.push({ url, empty: true })
              }
            }
          }),
        )
        process.stdout.write(`\r${Math.min(i + chunkSize, urls.length)}/${urls.length}`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      return updatedUrls
    }

    process.stdout.write(`\r0/${allUrls.length}`)

    const chunkSize = 50

    const urlsUpdated = await processUrlsInChunks(allUrls, chunkSize)

    if (urlsUpdated) {
      fs.writeFileSync(jsonFile, content, 'utf8')
      console.log('\n\nUpdated URLs in the JSON file.')
    }

    if (errorUrls.length) {
      // Store filtered results to avoid redundant iterations
      const nonEmptyErrorUrls = errorUrls.filter(({ empty }) => !empty)
      const emptyErrorUrls = errorUrls.filter(({ empty }) => empty)
      const error404 = errorUrls.filter(({ error }) => error === '404')
      console.error('\n\nError URLs:')
      console.error('Length:', nonEmptyErrorUrls.length)
      console.error(nonEmptyErrorUrls)
      console.error('\nEmpty URLs:')
      console.error('Length:', emptyErrorUrls.length)
      if (error404.length) {
        console.error('\n\n404 URLs:')
        console.error('Length:', error404.length)
        console.error(error404)
      }
      // if (nonEmptyErrorUrls.length) process.exit(1)
    }
  }

  console.log()
  console.log('='.repeat(80))
}

process.exit(0)
