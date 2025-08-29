const assert = require('node:assert')
const { describe, it } = require('mocha')
const request = require('supertest')

const app = require('../apps/web-app/server/index.js')

const p = 'iut-de-vannes.butdutgea.1ereannee.groupe1.gr1g'
const p2 = 'iut-de-vannes.butdutgea.1ereannee.groupe2.gr2g'

describe('API : /calendars', () => {
  process.env.CURL_TIMEOUT = '10000'

  it('Default calendar and check result', (done) => {
    request(app)
      .get('/calendars')
      .expect(400, done)
  })

  it('Get specific calendar and check result', (done) => {
    request(app)
      .get(`/calendars?p=${p}`)
      .expect(200)
      .expect('Content-Type', /json/)
      .end((err, response) => {
        if (err) return done(err)
        assert(response.body.plannings.length === 1)
        assert(response.body.plannings[0].id === p)
        assert(response.body.plannings[0].events.length)
        return done()
      })
  })

  it('Get specific two calendars and check result', (done) => {
    request(app)
      .get(`/calendars?p=${p},${p2}`)
      .expect(200)
      .expect('Content-Type', /json/)
      .end((err, response) => {
        if (err) return done(err)
        assert(response.body.plannings.length === 2)
        assert(response.body.plannings[0].id === p)
        assert(response.body.plannings[1].id === p2)
        assert(response.body.plannings[0].events.length)
        assert(response.body.plannings[1].events.length)
        return done()
      })
  })

  it('Invalid planning', (done) => {
    request(app)
      .get('/calendars?p=ptdr')
      .expect(404)
      .end((err) => {
        if (err) return done(err)
        return done()
      })
  })

  it('One planning is invalid', (done) => {
    request(app)
      .get(`/calendars?p=ptdr,${p}`)
      .expect(200)
      .end((err) => {
        if (err) return done(err)
        return done()
      })
  })
})
