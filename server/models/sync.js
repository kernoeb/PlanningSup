const mongoose = require('mongoose')

const syncSchema = new mongoose.Schema({
  hash: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
    minLength: 128, // sha512 hex length
    maxLength: 128
  },
  planningList: {
    type: [String],
    default: undefined,
    required: false,
    canProject: true
  },
  favorites: {
    type: [{
      iv: {
        type: String,
        required: true,
        trim: true,
        minLength: 32, // IV
        maxLength: 32
      },
      content: {
        type: String,
        required: true,
        trim: true
      }
    }],
    default: undefined,
    required: false,
    canProject: true
  }
})

const Sync = mongoose.model('Sync', syncSchema)
module.exports = { Sync, schema: syncSchema.paths }
