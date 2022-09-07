const { Schema, model } = require('mongoose')

const schemaCustomEvent = new Schema({
  name: {
    type: 'String',
    unique: true,
    index: true
  },
  content: String
})

const CustomEvent = model('CustomEvent', schemaCustomEvent)
module.exports = { CustomEvent }
