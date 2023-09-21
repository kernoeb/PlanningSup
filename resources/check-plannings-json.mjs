import fs from 'fs'
import path from 'path'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
// import axios from 'axios'

const __dirname = path.dirname(new URL(import.meta.url).pathname)

const ajv = new Ajv()
addFormats(ajv)

const element = {
  type: 'object',
  $id: 'element',
  oneOf: [
    { required: ['id', 'title', 'edts'] },
    { required: ['id', 'title', 'url'] }
  ],
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      minLength: 1
    },
    title: {
      type: 'string',
      minLength: 1
    },
    edts: {
      type: 'array',
      items: {
        type: 'object',
        $ref: 'element'
      },
      minItems: 1
    },
    url: {
      type: 'string',
      minLength: 5,
      pattern: '^https?://'
    }
  }
}

const schema = {
  type: 'array',
  items: element
}

const validate = ajv.compile(schema)

const JSON_FILE = path.join(__dirname, '../assets/plannings.json')

const content = fs.readFileSync(JSON_FILE, { encoding: 'utf8' })
const data = JSON.parse(content)

const valid = validate(data)
if (!valid) {
  console.error(validate.errors)
  process.exit(1)
}

console.log('JSON is valid')

/* const today = new Date()
const inSixMonths = new Date()
inSixMonths.setMonth(today.getMonth() + 6)

const formattedToday = today.toISOString().split('T')[0]
const formattedInSixMonths = inSixMonths.toISOString().split('T')[0]

console.log(formattedToday)
console.log(formattedInSixMonths)

let allUrls = []
JSON.parse(content, (key, value) => {
  if (key === 'url') allUrls.push(value.replace('{date-start}', formattedToday).replace('{date-end}', formattedInSixMonths))
})

const errorUrls = []

async function processUrlsInChunks (urls, chunkSize) {
  for (let i = 0; i < urls.length; i += chunkSize) {
    const chunk = urls.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map(async (url) => {
        try {
          const { data } = await axios.get(url, { timeout: 10000 })
          if (data.includes('The project is invalid')) throw new Error('The project is invalid')
          if (data.includes('<html')) throw new Error('HTML')
          if (!data.includes('VCALENDAR')) throw new Error('No VCALENDAR')
          if (data.split('\n').length < 10) {
            errorUrls.push({ url, data, empty: true })
          }
        } catch (error) {
          // if error is 404
          if (error.response && error.response.status === 404) errorUrls.push({ url, error: '404' })
          else errorUrls.push({ url, error })
        }
      })
    )
    process.stdout.write(`\r${Math.min(i + chunkSize, urls.length)}/${urls.length}`)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

process.stdout.write(`\r0/${allUrls.length}`)

const blacklist = []
// const whitelist = []

allUrls = allUrls.filter(url => !blacklist.some(domain => url.includes(domain)))
// allUrls = allUrls.filter(url => whitelist.some(domain => url.includes(domain)))

const chunkSize = 10

await processUrlsInChunks(
  // allUrls.filter(url => !blacklist.some(domain => url.includes(domain))),
  allUrls,
  chunkSize
)

if (errorUrls.length) {
  console.error('\n\nError URLs:')
  console.error('Length:', errorUrls.filter(({ empty }) => !empty).length)
  console.error(errorUrls.filter(({ empty }) => !empty))

  console.error('\n\nEmpty URLs:')
  console.error('Length:', errorUrls.filter(({ empty }) => empty).length)

  const error404 = errorUrls.filter(({ error }) => error === '404')
  if (error404.length) {
    console.error('\n\n404 URLs:')
    console.error('Length:', error404.length)
    console.error(error404)
  }

  process.exit(1)
} */

process.exit(0)
