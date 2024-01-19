const { assert } = require('chai')
const request = require('supertest')
const { describe, it } = require('mocha')

const app = require('../server/index.js')
const p = 'iutdevannes.butdutgea.1ereannee.groupe1.gr1g'
const p2 = 'iutdevannes.butdutgea.1ereannee.groupe2.gr2g'

describe('API : /calendars', function () {
  process.env.CURL_TIMEOUT = '10000'
  it('Default calendar and check result', function () {
    this.timeout(process.env.DURATION_CALENDAR || 10000)
    return request(app)
      .get('/calendars')
      .expect(400)
  })

  it('Get specific calendar and check result', function () {
    this.timeout(10000)
    return request(app)
      .get('/calendars?p=' + p)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response) => {
        assert(response.body.plannings.length === 1)
        assert(response.body.plannings[0].id === p)
        assert(response.body.plannings[0].events.length)
      })
  })

  it('Get specific two calendars and check result', function () {
    this.timeout(10000)
    return request(app)
      .get('/calendars?p=' + p + ',' + p2)
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response) => {
        assert(response.body.plannings.length === 2)
        assert(response.body.plannings[0].id === p)
        assert(response.body.plannings[1].id === p2)
        assert(response.body.plannings[0].events.length)
        assert(response.body.plannings[1].events.length)
      })
  })

  it('Invalid planning', function () {
    this.timeout(10000)
    return request(app)
      .get('/calendars?p=ptdr')
      .expect(404)
  })

  it('One planning is invalid', function () {
    this.timeout(10000)
    return request(app)
      .get('/calendars?p=ptdr,' + p)
      .expect(200)
  })

  it('Lots of requests', function () {
    Promise.all(
      Array(20).fill(0).map(() => {
        return request(app)
          .get('/calendars?p=' + p)
          .expect(200)
          .then((response) => {
            assert(response.body.plannings.length === 1)
            assert(response.body.plannings[0].id === p)
            assert(response.body.plannings[0].events.length)
          })
      })
    )
  })
})

describe('API : errors', function () {
  process.env.CURL_TIMEOUT = '10'
  it('Really short timeout', function () {
    this.timeout(10000)
    return request(app)
      .get('/calendars?p=' + p)
      .expect(200)
      .then((response) => {
        assert(response.body.status, 'off')
      })
  })
})
