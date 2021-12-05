const { assert, expect } = require('chai')
const request = require('supertest')
const { describe, it } = require('mocha')

const app = require('../server/index.js')

// TODO Nock usage

describe('API : /calendars', function () {
  it('Default calendar and check result', function () {
    this.timeout(process.env.DURATION_CALENDAR || 10000)
    return request(app)
      .get('/calendars')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response) => {
        expect(response.body.status).to.be.oneOf(['on', 'off'])
        assert(response.body.plannings.length === 1)
        assert(response.body.plannings[0].id === 'iutdevannes.butdutinfo.2emeannee.a1')
        assert(response.body.plannings[0].events.length)
      })
  })

  it('Get specific calendar and check result', function () {
    this.timeout(process.env.DURATION_CALENDAR || 10000)
    return request(app)
      .get('/calendars?p=WyJpdXRkZXZhbm5lcy5idXRkdXRpbmZvLjJlbWVhbm5lZS5hMiJd')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response) => {
        expect(response.body.status).to.be.oneOf(['on', 'off'])
        assert(response.body.plannings.length === 1)
        assert(response.body.plannings[0].id === 'iutdevannes.butdutinfo.2emeannee.a2')
        assert(response.body.plannings[0].events.length)
      })
  })

  it('Get specific two calendars and check result', function () {
    this.timeout(process.env.DURATION_CALENDAR || 10000)
    return request(app)
      .get('/calendars?p=WyJpdXRkZXZhbm5lcy5idXRkdXRpbmZvLjJlbWVhbm5lZS5hMSIsICJpdXRkZXZhbm5lcy5idXRkdXRpbmZvLjJlbWVhbm5lZS5hMiJd')
      .expect(200)
      .expect('Content-Type', /json/)
      .then((response) => {
        expect(response.body.status).to.be.oneOf(['on', 'off'])
        assert(response.body.plannings.length === 2)
        assert(response.body.plannings[0].id === 'iutdevannes.butdutinfo.2emeannee.a1')
        assert(response.body.plannings[1].id === 'iutdevannes.butdutinfo.2emeannee.a2')
        assert(response.body.plannings[0].events.length)
        assert(response.body.plannings[1].events.length)
      })
  })

  it('Invalid parameter (not base64)', function () {
    this.timeout(process.env.DURATION_CALENDAR || 10000)
    return request(app)
      .get('/calendars?p=ptdr')
      .expect(400)
  })

  it('Invalid parameter', function () {
    this.timeout(process.env.DURATION_CALENDAR || 10000)
    return request(app)
      .get('/calendars?p=W10=')
      .expect(400)
  })
})
