/* eslint-disable no-console */
import { onMessage, sendMessage } from 'webext-bridge/content-script'

interface TreeNode {
  id: string
  title: string
  children?: TreeNode[]
  url?: string
}

/** Shape of a `resources/plannings/*.json` file. */
interface Planning {
  title: string
  group?: string
  children: TreeNode[]
}

interface TreeResult {
  success: boolean
  data?: Planning
  error?: string
}

class TreeExpander {
  private discoveredProjectId = -1
  private isProjectDiscoveryComplete = false
  private baseURL = ''
  private observer: MutationObserver | null = null
  private lastSentLabels: string[] | null = null
  private readonly collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' })

  constructor() {
    this.baseURL = `${window.location.origin}/jsp/custom/modules/plannings/anonymous_cal.jsp`
    console.log(`Guessed API base URL: ${this.baseURL}`)
    this.initObserver()
  }

  private initObserver() {
    const targetNode = document.querySelector('.x-grid3-scroller')
    if (!targetNode) {
      // If the node isn't there yet, notify once and retry after a short delay.
      this.sendAvailableLabels()
      setTimeout(() => this.initObserver(), 500)
      return
    }

    this.observer = new MutationObserver(() => {
      this.sendAvailableLabels()
    })

    this.observer.observe(targetNode, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded', 'aria-label'] })
    // Send initial labels once observer is set up
    this.sendAvailableLabels()
  }

  private async sendAvailableLabels() {
    const labels = this.getAvailableParentLabels()
    // Always send on first load and whenever the list changes (including empty)
    if (this.lastSentLabels === null || JSON.stringify(labels) !== JSON.stringify(this.lastSentLabels)) {
      try {
        await sendMessage('labels-updated', { labels }, 'sidepanel')
      }
      catch {
        // Sidepanel might not be open yet; ignore
      }
      this.lastSentLabels = labels
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms))
  }

  private removeAccents(str: string): string {
    return str ? str.normalize('NFD').replace(/[\u0300-\u036F]/g, '') : ''
  }

  private cleanText(str: string): string {
    return this.removeAccents(str).replace(/[/&,().\s]/g, '').toLowerCase()
  }

  /**
   * ADE stamps the academic year on many labels ("Groupe 1 26/27"). It would end up
   * in the id, so every group would look new again next September.
   */
  private stripYear(str: string): string {
    return str
      .replace(/[\s(-]+(?:20)?\d{2}\s*[/-]\s*(?:20)?\d{2}\)?\s*$/, '')
      // A bare "2627" is only a year when the two halves run on from each other.
      .replace(/[\s(-]+(\d{2})(\d{2})\)?\s*$/, (match, start: string, end: string) =>
        Number(end) === Number(start) + 1 ? '' : match)
      .trim()
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      // Delegate clipboard write to background offscreen document to avoid focus/user-gesture issues
      const result = await sendMessage('copy-to-clipboard', { text }, 'background') as unknown as { success: boolean, error?: string }
      if (!result.success) {
        throw new Error(result.error || 'Clipboard copy failed via offscreen document')
      }
    }
    catch (error) {
      console.warn('Clipboard write failed:', error)
      throw error
    }
  }

  private waitForNodeToExpand(node: Element): Promise<void> {
    return new Promise((resolve) => {
      const timeout = 5000
      const interval = 100
      let elapsedTime = 0

      const checkInterval = setInterval(() => {
        if (!node || node.getAttribute('aria-expanded') === 'true') {
          clearInterval(checkInterval)
          resolve()
        }
        else if (elapsedTime >= timeout) {
          clearInterval(checkInterval)
          console.warn(`Warning: Node "${node.getAttribute('aria-label')}" did not confirm expansion.`)
          resolve()
        }
        elapsedTime += interval
      }, interval)
    })
  }

  private async findValidProjectId(resourceId: number): Promise<void> {
    console.log(`Phase 5.1: Searching for a valid projectId using resourceId ${resourceId}...`)

    for (let i = 0; i <= 10; i++) {
      const testUrl = `${this.baseURL}?resources=${resourceId}&projectId=${i}&calType=ical&firstDate=2023-01-01&lastDate=2023-01-02`
      console.log(`  -> Trying projectId=${i}...`)

      try {
        const response = await fetch(testUrl)
        const text = await response.text()

        if (response.ok && text.startsWith('BEGIN:VCALENDAR')) {
          console.log(`  ✅ SUCCESS! Found valid projectId: ${i}. Using this for all subsequent URLs.`)
          this.discoveredProjectId = i
          this.isProjectDiscoveryComplete = true
          return
        }
        else {
          console.log(`  -> Failed (Response was not a valid iCal file).`)
        }
      }
      catch (error) {
        console.warn(`  -> Fetch failed for projectId=${i}:`, error)
      }
    }

    console.warn(`Warning: Could not discover a valid projectId after trying 0-10. Defaulting to 0.`)
    this.discoveredProjectId = 0
    this.isProjectDiscoveryComplete = true
  }

  /**
   * Sort siblings by title and settle their ids, so two exports of the same tree
   * give the same file whatever order ADE walked it in.
   */
  private finalise(nodes: TreeNode[]): TreeNode[] {
    const kept = nodes.filter(node => node.url || (node.children && node.children.length > 0))
    kept.sort((a, b) => this.collator.compare(a.title, b.title))

    const usedIds = new Set<string>()
    for (const node of kept) {
      let id = node.id
      for (let i = 2; usedIds.has(id); i++) id = `${node.id}-${i}`
      usedIds.add(id)
      node.id = id
      if (node.children)
        node.children = this.finalise(node.children)
    }

    return kept
  }

  private async generateAndCopyJson(startNode: Element, title: string, group: string): Promise<Planning> {
    console.log('Phase 5: Parsing the DOM and generating JSON...')

    const folderLabel = startNode.getAttribute('aria-label') || ''
    const root: TreeNode = { id: '', title: folderLabel, children: [] }

    const path = [root]
    const parentLevel = Number.parseInt(startNode.getAttribute('aria-level') || '0', 10)
    let currentNode = startNode.nextElementSibling

    while (currentNode) {
      const currentLevel = Number.parseInt(currentNode.getAttribute('aria-level') || '0', 10)
      if (Number.isNaN(currentLevel) || currentLevel <= parentLevel)
        break

      const targetPathLength = currentLevel - parentLevel
      while (path.length > targetPathLength) {
        path.pop()
      }

      const currentParent = path[path.length - 1]
      if (!currentParent || !Array.isArray(currentParent.children)) {
        console.error('Parsing Error: Could not find valid parent for node:', currentNode)
        currentNode = currentNode.nextElementSibling
        continue
      }

      const childLabel = currentNode.getAttribute('aria-label')
      if (!childLabel) {
        currentNode = currentNode.nextElementSibling
        continue
      }

      const cleanLabel = this.stripYear(childLabel)
      const isFolder = currentNode.querySelector('img.x-tree3-node-joint[style*="url("]') !== null

      if (isFolder) {
        const newFolder: TreeNode = { id: this.cleanText(cleanLabel), title: cleanLabel, children: [] }
        currentParent.children.push(newFolder)
        path.push(newFolder)
      }
      else {
        const idBearingElement = currentNode.querySelector('div.x-tree3-node')
        const childIdString = idBearingElement?.id.match(/_(\d+)$/)?.[1]
        const childId = childIdString ? Number.parseInt(childIdString, 10) : 0

        if (childId <= 0) {
          throw new Error(`Unable to generate URL for "${childLabel}" (missing resource ID). Please refresh the page and try again.`)
        }

        if (!this.isProjectDiscoveryComplete) {
          await this.findValidProjectId(childId)
        }

        // A label made only of separators would slug to nothing; fall back to the resource id.
        currentParent.children.push({
          id: this.cleanText(cleanLabel) || `r${childId}`,
          title: cleanLabel,
          url: `${this.baseURL}?resources=${childId}&projectId=${this.discoveredProjectId}&calType=ical&firstDate={date-start}&lastDate={date-end}`,
        })
      }
      currentNode = currentNode.nextElementSibling
    }

    const children = this.finalise(root.children!)
    if (children.length === 0) {
      throw new Error(`No timetable found under "${folderLabel}".`)
    }

    return group ? { title, group, children } : { title, children }
  }

  async expandAndCopyTree(parentLabel: string, title: string, group: string): Promise<TreeResult> {
    try {
      const scroller = document.querySelector('.x-grid3-scroller') as HTMLElement
      if (!scroller) {
        throw new Error('Could not find the grid\'s scroll container (.x-grid3-scroller).')
      }

      console.log('Phase 1: Applying CSS trick...')
      const originalCssText = scroller.style.cssText

      try {
        scroller.style.overflow = 'hidden'
        scroller.style.height = '100000px'
        scroller.style.width = '10000px'
        scroller.style.position = 'fixed'
        scroller.style.top = '0'
        scroller.style.transform = 'scale(0.1)'
        scroller.style.transformOrigin = '0% 0%'
        await this.delay(500)

        const initialParent = document.querySelector(`.x-grid3-row[aria-label="${parentLabel}"]`)
        if (!initialParent) {
          throw new Error(`Initial parent element with aria-label "${parentLabel}" not found.`)
        }

        if (initialParent.getAttribute('aria-expanded') !== 'true') {
          console.log(`Phase 2: Parent "${parentLabel}" is collapsed. Performing initial expansion...`)
          const joint = initialParent.querySelector('img.x-tree3-node-joint[style*="url("]') as HTMLElement
          if (joint) {
            joint.click()
          }
          else {
            console.log(`...Parent "${parentLabel}" is a leaf node.`)
            const result = await this.generateAndCopyJson(initialParent, title, group)
            return { success: true, data: result }
          }
        }
        else {
          console.log(`Phase 2: Parent "${parentLabel}" is already expanded.`)
        }

        console.log('Phase 3: Waiting for tree to be responsive...')
        await new Promise<void>((resolve) => {
          const parentLevel = Number.parseInt(initialParent.getAttribute('aria-level') || '0', 10)
          const timeout = 15000
          const interval = 250
          let elapsedTime = 0

          const checkInterval = setInterval(() => {
            const firstChild = initialParent.nextElementSibling
            if (firstChild && Number.parseInt(firstChild.getAttribute('aria-level') || '0', 10) > parentLevel) {
              clearInterval(checkInterval)
              console.log('...Tree is responsive.')
              resolve()
            }
            else if (elapsedTime >= timeout) {
              clearInterval(checkInterval)
              console.warn(`...Timeout. Assuming leaf node.`)
              resolve()
            }
            elapsedTime += interval
          }, interval)
        })

        console.log(`Phase 4: Starting full expansion...`)
        let expansionCount = 0

        while (true) {
          let nextNodeToClick: Element | null = null
          let currentNode: Element | null = initialParent
          const parentLevel = Number.parseInt(initialParent.getAttribute('aria-level') || '0', 10)

          while (currentNode) {
            const currentLevel = Number.parseInt(currentNode.getAttribute('aria-level') || '0', 10)
            if (currentNode !== initialParent && (Number.isNaN(currentLevel) || currentLevel <= parentLevel))
              break

            if (currentNode.getAttribute('aria-expanded') !== 'true') {
              const joint = currentNode.querySelector('img.x-tree3-node-joint[style*="url("]')
              if (joint) {
                nextNodeToClick = currentNode
                break
              }
            }
            currentNode = currentNode.nextElementSibling
          }

          if (nextNodeToClick) {
            const label = nextNodeToClick.getAttribute('aria-label') || '(No Label)'
            console.log(`[${++expansionCount}] Clicking: "${label}"`)
            const joint = nextNodeToClick.querySelector('img.x-tree3-node-joint') as HTMLElement
            joint.click()
            await this.waitForNodeToExpand(nextNodeToClick)
          }
          else {
            console.log(`✅ Final scan complete. No more unexpanded nodes found.`)
            break
          }
        }

        console.log(`Total nodes newly expanded: ${expansionCount}.`)

        console.log('Phase 4.5: Priming the tree to ensure all nodes are fully initialized...')
        const primer = initialParent.querySelector('.x-tree3-node-text') as HTMLElement
        if (primer) {
          primer.click()
          await this.delay(250)
          console.log('...Priming complete.')
        }
        else {
          console.warn('...Could not find priming element. Parsing may be incomplete.')
        }

        const result = await this.generateAndCopyJson(initialParent, title, group)

        const jsonString = `${JSON.stringify(result, null, 2)}\n`
        console.log('--- Generated JSON ---')
        console.log(jsonString)

        await this.copyToClipboard(jsonString)
        console.log('✅ JSON copied to clipboard successfully!')

        return { success: true, data: result }
      }
      finally {
        console.log('Phase 6: Restoring original scroller styles...')
        scroller.style.cssText = originalCssText
        console.log('✨ Done.')
      }
    }
    catch (error) {
      console.error('❌ An error occurred during the process:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  getAvailableParentLabels(): string[] {
    const parentElements = document.querySelectorAll('.x-grid3-row[aria-label]:has(img.x-tree3-node-joint[style*="url("])')
    return Array.from(parentElements).map(el => el.getAttribute('aria-label')).filter(Boolean) as string[]
  }
}

let treeExpander: TreeExpander | null = null

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    treeExpander = new TreeExpander()
  })
}
else {
  treeExpander = new TreeExpander()
}

// Listen for messages from popup
onMessage('expandTree', async (payload) => {
  if (!treeExpander) {
    treeExpander = new TreeExpander()
  }

  const data = payload?.data as { parentLabel?: string, title?: string, group?: string } | null
  const parent = data?.parentLabel ?? ''
  const result = await treeExpander.expandAndCopyTree(parent, data?.title?.trim() || parent, data?.group?.trim() ?? '')
  return result
})

onMessage('getAvailableLabels', async () => {
  if (!treeExpander) {
    treeExpander = new TreeExpander()
  }

  const labels = treeExpander.getAvailableParentLabels()
  return { labels }
})

onMessage('ping', async () => {
  if (!treeExpander) {
    treeExpander = new TreeExpander()
  }
  // Simple readiness/probe handler
  return { ready: true }
})
