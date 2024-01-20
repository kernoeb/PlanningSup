const assert = require('node:assert')
const request = require('supertest')
const { describe, it } = require('mocha')

const app = require('../server/index.js')

const p = 'iutdevannes.butdutgea.1ereannee.groupe1.gr1g'
const p2 = 'iutdevannes.butdutgea.1ereannee.groupe2.gr2g'

describe('API : /calendars', function () {
  process.env.CURL_TIMEOUT = '10000'

  it('Default calendar and check result', function (done) {
    request(app)
      .get('/calendars')
      .expect(400, done)
  })

  it('Get specific calendar and check result', function (done) {
    request(app)
      .get(`/calendars?p=${p}`)
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, response) {
        if (err) return done(err)
        assert(response.body.plannings.length === 1)
        assert(response.body.plannings[0].id === p)
        assert(response.body.plannings[0].events.length)
        return done()
      })
  })

  it('Get specific two calendars and check result', function (done) {
    request(app)
      .get(`/calendars?p=${p},${p2}`)
      .expect(200)
      .expect('Content-Type', /json/)
      .end(function (err, response) {
        if (err) return done(err)
        assert(response.body.plannings.length === 2)
        assert(response.body.plannings[0].id === p)
        assert(response.body.plannings[1].id === p2)
        assert(response.body.plannings[0].events.length)
        assert(response.body.plannings[1].events.length)
        return done()
      })
  })

  it('Invalid planning', function (done) {
    request(app)
      .get('/calendars?p=ptdr')
      .expect(404)
      .end((err) => {
        if (err) return done(err)
        return done()
      })
  })

  it('One planning is invalid', function (done) {
    request(app)
      .get(`/calendars?p=ptdr,${p}`)
      .expect(200)
      .end((err) => {
        if (err) return done(err)
        return done()
      })
  })
})
