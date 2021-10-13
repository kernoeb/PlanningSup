const request = require('supertest')
const { assert } = require('chai')
const { describe, it } = require('mocha')

const app = require('../server/index.js')

describe('API : /calendars', function () {
  it('Timeout too long and no mongo backup', function () {
    return request(app)
      .get('/calendars')
      .expect(200)
      .then((response) => {
        // console.log(response)
        assert(response.body.status, 'off')
      })
  })
})
