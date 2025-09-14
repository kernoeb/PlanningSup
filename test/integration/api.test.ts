import { describe, it, expect } from 'bun:test'
import './setup'

describe('API Integration Tests', () => {
  const baseUrl = 'http://localhost:20000'

  it('should respond to ping check', async () => {
    const response = await fetch(`${baseUrl}/api/ping`)
    expect(response.ok).toBe(true)

    const text = await response.text()
    expect(text).toBe('pong')
  })

  it('should return plannings list', async () => {
    const response = await fetch(`${baseUrl}/api/plannings`)
    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)

    if (data.length > 0) {
      const firstPlanning = data[0]
      expect(firstPlanning).toHaveProperty('id')
      expect(firstPlanning).toHaveProperty('fullId')
      expect(firstPlanning).toHaveProperty('title')
      expect(firstPlanning).not.toHaveProperty('url') // URLs should be stripped from public response
    }
  })



  it('should return 404 for non-existent endpoints', async () => {
    const response = await fetch(`${baseUrl}/api/nonexistent`)
    expect(response.status).toBe(404)
  })

  it('should return planning details for valid planning ID', async () => {
    // First get the list of plannings
    const listResponse = await fetch(`${baseUrl}/api/plannings`)
    const plannings = await listResponse.json()

    // Find a planning with a fullId (leaf node)
    const findPlanningWithFullId = (items: any[]): any => {
      for (const item of items) {
        if (item.fullId && !item.children) {
          return item
        }
        if (item.children) {
          const found = findPlanningWithFullId(item.children)
          if (found) return found
        }
      }
      return null
    }

    const targetPlanning = findPlanningWithFullId(plannings)

    if (targetPlanning) {
      const detailResponse = await fetch(`${baseUrl}/api/plannings/${encodeURIComponent(targetPlanning.fullId)}`)
      expect(detailResponse.ok).toBe(true)

      const details = await detailResponse.json()
      expect(details).toHaveProperty('id', targetPlanning.id)
      expect(details).toHaveProperty('fullId', targetPlanning.fullId)
      expect(details).toHaveProperty('title', targetPlanning.title)
      expect(details).not.toHaveProperty('events') // Events not included by default
    }
  })

  it('should return planning events when requested', async () => {
    // Get plannings list first
    const listResponse = await fetch(`${baseUrl}/api/plannings`)
    const plannings = await listResponse.json()

    // Find a planning with a fullId
    const findPlanningWithFullId = (items: any[]): any => {
      for (const item of items) {
        if (item.fullId && !item.children) {
          return item
        }
        if (item.children) {
          const found = findPlanningWithFullId(item.children)
          if (found) return found
        }
      }
      return null
    }

    const targetPlanning = findPlanningWithFullId(plannings)

    if (targetPlanning) {
      const eventsResponse = await fetch(`${baseUrl}/api/plannings/${encodeURIComponent(targetPlanning.fullId)}?events=true`)
      expect(eventsResponse.ok).toBe(true)

      const result = await eventsResponse.json()
      expect(result).toHaveProperty('status')

      if (result.status === 'ok') {
        expect(result).toHaveProperty('events')
        expect(result).toHaveProperty('nbEvents')
        expect(Array.isArray(result.events)).toBe(true)
        expect(result.nbEvents).toBe(result.events.length)
      }
    }
  }, 30000) // Longer timeout for ICS fetching

  it('should handle invalid planning IDs gracefully', async () => {
    const response = await fetch(`${baseUrl}/api/plannings/invalid-planning-id`)
    expect(response.status).toBe(404)

    const error = await response.json()
    expect(error).toHaveProperty('error')
  })

  it('should respect query parameters for events', async () => {
    // Get plannings list first
    const listResponse = await fetch(`${baseUrl}/api/plannings`)
    const plannings = await listResponse.json()

    const findPlanningWithFullId = (items: any[]): any => {
      for (const item of items) {
        if (item.fullId && !item.children) {
          return item
        }
        if (item.children) {
          const found = findPlanningWithFullId(item.children)
          if (found) return found
        }
      }
      return null
    }

    const targetPlanning = findPlanningWithFullId(plannings)

    if (targetPlanning) {
      // Test with colors parameter
      const colorsResponse = await fetch(
        `${baseUrl}/api/plannings/${encodeURIComponent(targetPlanning.fullId)}?events=true&colors=true`
      )
      expect(colorsResponse.ok).toBe(true)

      // Test with timezone parameters
      const timezoneResponse = await fetch(
        `${baseUrl}/api/plannings/${encodeURIComponent(targetPlanning.fullId)}?events=true&browserTimezone=Europe/Paris&targetTimezone=UTC`
      )
      expect(timezoneResponse.ok).toBe(true)

      // Test with blocklist
      const blocklistResponse = await fetch(
        `${baseUrl}/api/plannings/${encodeURIComponent(targetPlanning.fullId)}?events=true&blocklist=test`
      )
      expect(blocklistResponse.ok).toBe(true)
    }
  }, 30000)

  it('should handle request headers properly', async () => {
    const response = await fetch(`${baseUrl}/api/plannings`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PlanningSup-Test/1.0'
      }
    })

    expect(response.ok).toBe(true)
    expect(response.headers.get('content-type')).toContain('application/json')
  })


})
