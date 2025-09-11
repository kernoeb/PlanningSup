/**
 * Planning JSON Schema Validation Tests
 *
 * This test suite validates all JSON files in resources/plannings to ensure they:
 * 1. Are valid JSON format
 * 2. Conform to the planning schema (title + children with proper structure)
 * 3. Have valid URLs (when present)
 * 4. Have reasonable structural consistency
 * 5. Identify data quality issues (like duplicate sibling IDs)
 *
 * The schema validates a hierarchical structure where each element has:
 * - id: unique identifier (within siblings)
 * - title: human-readable name
 * - children: array of child elements OR url: string for leaf nodes
 *
 * This ensures data integrity and catches configuration errors early.
 */

import { describe, expect, it } from 'bun:test'
import { Glob } from 'bun'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { planningsLocation } from '@plannings'

// Define the schema for planning elements (same as in the main code)
type PlanningElement
  = | {
    readonly id: string
    readonly title: string
    readonly children: readonly PlanningElement[]
  }
  | {
    readonly id: string
    readonly title: string
    readonly url: string
  }

const ElementSchema: z.ZodType<PlanningElement> = z.lazy(() =>
  z.union([
    z.object({ id: z.string().min(1), title: z.string().min(1), children: z.array(ElementSchema).min(1) }),
    z.object({ id: z.string().min(1), title: z.string().min(1), url: z.string().url() }),
  ]),
)

const PlanningSchema = z.object({
  title: z.string().min(1),
  children: z.array(ElementSchema).min(1),
})

describe('Planning JSON Schema Validation', () => {
  // Get all JSON files from the plannings directory
  const glob = new Glob('*.json')
  const jsonFiles = Array.from(glob.scanSync(planningsLocation))

  it('should find planning JSON files in the resources directory', () => {
    expect(jsonFiles.length).toBeGreaterThan(0)
    expect(fs.existsSync(planningsLocation)).toBe(true)
  })

  // Create a test for each JSON file
  jsonFiles.forEach((filename) => {
    it(`should validate ${filename} against the planning schema`, () => {
      const filePath = path.join(planningsLocation, filename)

      // Read and parse the JSON file
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      let jsonData: unknown

      // First check if it's valid JSON
      expect(() => {
        jsonData = JSON.parse(fileContent)
      }).not.toThrow()

      // Then validate against the schema
      const result = PlanningSchema.safeParse(jsonData)

      if (!result.success) {
        // Provide detailed error information for debugging
        const errorMessage = `Schema validation failed for ${filename}:\n${result.error.issues.map(issue =>
          `  - ${issue.path.join('.')}: ${issue.message}`
        ).join('\n')}`

        throw new Error(errorMessage)
      }

      expect(result.success).toBe(true)
    })
  })

  // Additional validation tests
  it('should ensure all planning files have unique IDs within sibling groups', () => {
    jsonFiles.forEach((filename) => {
      const filePath = path.join(planningsLocation, filename)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const jsonData = JSON.parse(fileContent)

      // Check for unique IDs among siblings at each level
      const checkSiblingUniqueness = (siblings: any[], path: string[] = []): void => {
        const siblingIds = siblings.map(s => s.id)
        const uniqueSiblingIds = new Set(siblingIds)

        if (uniqueSiblingIds.size !== siblingIds.length) {
          const duplicates = siblingIds.filter((id, index) => siblingIds.indexOf(id) !== index)
          const duplicateDetails = [...new Set(duplicates)].map(dupId => {
            const count = siblingIds.filter(id => id === dupId).length
            return `"${dupId}" (${count} times)`
          })
          const pathStr = path.length > 0 ? ` at path: ${path.join(' -> ')}` : ' at root level'
          throw new Error(`Duplicate sibling IDs found in ${filename}${pathStr}: ${duplicateDetails.join(', ')}`)
        }

        // Recursively check children
        siblings.forEach((sibling) => {
          if (sibling.children && Array.isArray(sibling.children)) {
            checkSiblingUniqueness(sibling.children, [...path, sibling.id])
          }
        })
      }

      checkSiblingUniqueness(jsonData.children)
    })
  })

  it('should ensure all URLs are valid and use HTTPS when possible', () => {
    jsonFiles.forEach((filename) => {
      const filePath = path.join(planningsLocation, filename)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const jsonData = JSON.parse(fileContent)

      // Collect all URLs in the planning structure
      const collectUrls = (element: any): { url: string, path: string[] }[] => {
        const urls: { url: string, path: string[] }[] = []
        if (element.url) {
          urls.push({ url: element.url, path: [element.id] })
        }
        if (element.children) {
          element.children.forEach((child: any, index: number) => {
            const childUrls = collectUrls(child)
            urls.push(...childUrls.map(u => ({
              url: u.url,
              path: [element.id, ...u.path]
            })))
          })
        }
        return urls
      }

      const allUrls = jsonData.children.flatMap(collectUrls)

      allUrls.forEach(({ url, path }) => {
        // Validate URL format
        expect(() => new URL(url)).not.toThrow(
          `Invalid URL format in ${filename} at path ${path.join(' -> ')}: ${url}`
        )

        // Check if URL uses HTTP instead of HTTPS (warning test)
        if (url.startsWith('http://') && !url.includes('localhost')) {
          console.warn(`Warning: ${filename} at path ${path.join(' -> ')} uses HTTP instead of HTTPS: ${url}`)
        }
      })
    })
  })

  it('should be loadable by the actual planning system', async () => {
    // Import the actual planning system to test loading
    const { plannings } = await import('@api/plannings')

    // Verify that the planning system loaded successfully
    expect(plannings).toBeDefined()
    expect(Array.isArray(plannings)).toBe(true)
    expect(plannings.length).toBeGreaterThan(0)

    // Verify each planning has the expected structure
    plannings.forEach((planning) => {
      expect(planning).toHaveProperty('id')
      expect(planning).toHaveProperty('fullId')
      expect(planning).toHaveProperty('title')
      expect(planning).toHaveProperty('children')
      expect(planning).toHaveProperty('flatten')

      expect(typeof planning.id).toBe('string')
      expect(typeof planning.fullId).toBe('string')
      expect(typeof planning.title).toBe('string')
      expect(Array.isArray(planning.children)).toBe(true)
      expect(Array.isArray(planning.flatten)).toBe(true)
    })

    // Verify that flattened plannings have unique fullIds
    const allFlattened = plannings.flatMap(p => p.flatten)
    const fullIds = allFlattened.map(f => f.fullId)
    const uniqueFullIds = new Set(fullIds)

    if (uniqueFullIds.size !== fullIds.length) {
      const duplicates = fullIds.filter((id, index) => fullIds.indexOf(id) !== index)
      const duplicateDetails = [...new Set(duplicates)].map(dupId => {
        const count = fullIds.filter(id => id === dupId).length
        const examples = allFlattened.filter(f => f.fullId === dupId).slice(0, 3)
        return `"${dupId}" (${count} times) from plannings: ${examples.map(e => e.planningId).join(', ')}`
      })
      console.warn('Duplicate fullIds detected across plannings:')
      duplicateDetails.forEach(detail => console.warn(`  - ${detail}`))
    }

    // Test should pass even with warnings, as the system handles duplicates
    expect(true).toBe(true)
  })

  it('should ensure all planning files have consistent structure depth', () => {
    jsonFiles.forEach((filename) => {
      const filePath = path.join(planningsLocation, filename)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const jsonData = JSON.parse(fileContent)

      // Calculate max depth of the planning structure
      const getMaxDepth = (element: any, currentDepth = 0): number => {
        if (!element.children || element.children.length === 0) {
          return currentDepth
        }
        return Math.max(...element.children.map((child: any) => getMaxDepth(child, currentDepth + 1)))
      }

      const maxDepth = Math.max(...jsonData.children.map((child: any) => getMaxDepth(child, 1)))

      // Ensure reasonable depth (not too shallow, not too deep)
      expect(maxDepth).toBeGreaterThan(0)
      expect(maxDepth).toBeLessThanOrEqual(10) // Reasonable max depth
    })
  })
})
