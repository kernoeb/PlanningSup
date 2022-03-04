const { Schema, model } = require('mongoose')

const schemaCustomEvent = new Schema({
  name: {
    type: 'String',
    unique: true,
    index: true
  },
  content: String
})

module.exports = model('CustomEvents', schemaCustomEvent)
