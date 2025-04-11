const assert = require('node:assert')
const { describe, it } = require('mocha')
const request = require('supertest')

const TEST_PLANNING_ID = 'ensibs'

const app = require('../apps/web-app/server/index.js')

const firstPlanning = require(`../resources/plannings/${TEST_PLANNING_ID}.json`)

describe('API : /urls', () => {
  it('Return json and compare to local json', (done) => {
    request(app)
      .get('/urls')
      .expect(200)
      .expect('Content-Type', /json/)
      .end((err, response) => {
        if (err) return done(err)
        assert.equal(response.body.find(v => v.fullId === TEST_PLANNING_ID).title, firstPlanning.title)
        return done()
      })
  })
})
