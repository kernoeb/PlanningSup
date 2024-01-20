const assert = require('node:assert')
const request = require('supertest')
const { describe, it } = require('mocha')

const app = require('../server/index.js')

const plannings = require('../assets/plannings.json')

describe('API : /urls', () => {
  it('Return json and compare to local json', function (done) {
    request(app)
      .get('/urls')
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, response) {
        if (err) return done(err)
        assert.equal(response.body[0].title, plannings[0].title)
        assert.equal(response.body.at(-1).title, plannings.at(-1).title)
        return done()
      })
  })
})
