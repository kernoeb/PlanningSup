const mongoose = require('mongoose')

const schemaCustomEvent = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    index: true
  },
  content: String
})

const CustomEvent = mongoose.model('CustomEvent', schemaCustomEvent)
module.exports = { CustomEvent }
