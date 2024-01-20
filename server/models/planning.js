const mongoose = require('mongoose')

const schemaPlanning = new mongoose.Schema({
  fullId: { type: 'String', required: true, unique: true, index: true },
  url: String,
  backup: Array,
  timestamp: Date,
  title: { type: 'String', index: true }
})

const Planning = mongoose.model('Planning', schemaPlanning)
module.exports = { Planning }
