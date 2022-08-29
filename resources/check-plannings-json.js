const fs = require('fs')
const path = require('path')
const Ajv = require('ajv')
const addFormats = require('ajv-formats').default

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
      format: 'uri',
      minLength: 5
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
} else {
  console.log('JSON is valid')
  process.exit(0)
}
