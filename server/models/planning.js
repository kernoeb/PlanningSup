const { Schema, model } = require('mongoose')

const schemaPlanning = new Schema({
  fullId: { type: 'String', unique: true, index: true },
  url: String,
  backup: Array,
  timestamp: Date,
  title: { type: 'String', index: true }
})

const Planning = model('Planning', schemaPlanning)
module.exports = { Planning }
