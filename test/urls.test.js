const { assert } = require('chai')
const request = require('supertest')
const { describe, it } = require('mocha')

const app = require('../server/index.js')

const plannings = require('../assets/plannings.json')

describe('API : /urls', function () {
  it('Return json and compare to local json', function () {
    return request(app)
      .get('/urls')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response) => {
        assert.equal(response.body[0].title, plannings[0].title)
        assert.equal(response.body.at(-1).title, plannings.at(-1).title)
      })
  })
})
