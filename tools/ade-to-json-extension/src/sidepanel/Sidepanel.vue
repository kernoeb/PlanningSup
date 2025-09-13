<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onMessage, sendMessage } from 'webext-bridge/popup'

interface TreeNode {
  id: string
  title: string
  edts?: TreeNode[]
  url?: string
}

const parentLabel = ref('IUT - Vannes')
const availableLabels = ref<string[]>([])
const isExpanding = ref(false)
const status = ref('')
const lastResult = ref<TreeNode[] | null>(null)
const showDropdown = ref(false)

const activeIndex = ref(-1)
function removeAccents(str: string): string {
  return str ? str.normalize('NFD').replace(/[\u0300-\u036F]/g, '') : ''
}
const filteredLabels = computed(() => {
  const q = removeAccents(parentLabel.value).toLowerCase()
  if (!q)
    return availableLabels.value.slice()
  return availableLabels.value.filter(l => removeAccents(l).toLowerCase().includes(q))
})
function onFocus() {
  activeIndex.value = filteredLabels.value.length > 0 ? 0 : -1
  showDropdown.value = filteredLabels.value.length > 0
}
function onInput() {
  activeIndex.value = filteredLabels.value.length > 0 ? 0 : -1
  showDropdown.value = filteredLabels.value.length > 0
}
function moveActive(delta: number) {
  const n = filteredLabels.value.length
  if (n === 0) {
    activeIndex.value = -1
    return
  }
  if (activeIndex.value === -1) {
    activeIndex.value = delta > 0 ? 0 : n - 1
    return
  }
  activeIndex.value = (activeIndex.value + delta + n) % n
}
function selectActive() {
  if (activeIndex.value >= 0 && activeIndex.value < filteredLabels.value.length)
    selectLabel(filteredLabels.value[activeIndex.value])
}

const injectedTabs = new Set<number>()

function getOriginPattern(urlStr: string | undefined): string | null {
  try {
    if (!urlStr)
      return null
    const u = new URL(urlStr)
    if (u.protocol === 'http:' || u.protocol === 'https:')
      return `${u.origin}/*`
  }
  catch {}
  return null
}

async function ensureContentScriptInjected(): Promise<number | null> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    const tab = tabs[0]
    const tabId = tab?.id
    if (!tabId)
      return null

    if (injectedTabs.has(tabId)) {
      // Verify the content script bridge is ready; reinject if needed
      let ready = false
      for (let i = 0; i < 10 && !ready; i++) {
        try {
          const res = await sendMessage('ping', {}, `content-script@${tabId}`)
          ready = !!(res as any)?.ready
        }
        catch {}
        if (!ready)
          await new Promise(r => setTimeout(r, 100))
      }
      if (ready)
        return tabId

      // Try a re-injection once if the bridge is not ready
      try {
        await browser.scripting.executeScript({
          target: { tabId },
          files: ['dist/contentScripts/index.global.js'],
        })
      }
      catch {}
    }

    // Try to inject directly
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['dist/contentScripts/index.global.js'],
    })

    // Wait for webext-bridge content script handlers to register
    {
      let ok = false
      for (let i = 0; i < 10 && !ok; i++) {
        try {
          const res = await sendMessage('ping', {}, `content-script@${tabId}`)
          ok = !!(res as any)?.ready
        }
        catch {}
        if (!ok)
          await new Promise(r => setTimeout(r, 100))
      }
      if (!ok)
        throw new Error('content-script bridge not ready yet')
    }

    injectedTabs.add(tabId)
    return tabId
  }
  catch {
    // Attempt to request origin permission and retry once
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true })
      const tab = tabs[0]
      const tabId = tab?.id
      const origin = getOriginPattern(tab?.url)
      if (!tabId || !origin) {
        status.value = '❌ Unsupported tab or missing permission to run on this page.'
        return null
      }

      const hasPerm = await browser.permissions.contains?.({ origins: [origin] }).catch(() => false)
      if (!hasPerm) {
        const granted = await browser.permissions.request?.({ origins: [origin] }).catch(() => false)
        if (!granted) {
          status.value = `❌ Permission required to run on ${origin}`
          return null
        }
      }

      await browser.scripting.executeScript({
        target: { tabId },
        files: ['dist/contentScripts/index.global.js'],
      })

      // Wait for webext-bridge content script handlers to register
      {
        let ok = false
        for (let i = 0; i < 10 && !ok; i++) {
          try {
            const res = await sendMessage('ping', {}, `content-script@${tabId}`)
            ok = !!(res as any)?.ready
          }
          catch {}
          if (!ok)
            await new Promise(r => setTimeout(r, 100))
        }
        if (!ok) {
          status.value = '❌ Content script did not become ready after injection.'
          return null
        }
      }

      injectedTabs.add(tabId)
      return tabId
    }
    catch (e) {
      console.error('Failed to inject content script:', e)
      status.value = '❌ Failed to inject content script into the active tab.'
      return null
    }
  }
}

async function getAvailableLabels() {
  try {
    const tabId = await ensureContentScriptInjected()
    if (!tabId)
      return

    const response = await sendMessage('getAvailableLabels', {}, `content-script@${tabId}`) as unknown as { labels?: string[] }
    availableLabels.value = response?.labels ?? []
  }
  catch (error) {
    console.error('Failed to get available labels:', error)
    status.value = 'Error: Could not fetch available labels'
  }
}

async function expandTree() {
  if (!parentLabel.value.trim()) {
    status.value = 'Please enter a parent label'
    return
  }

  isExpanding.value = true
  status.value = 'Expanding tree and generating JSON...'

  try {
    const tabId = await ensureContentScriptInjected()
    if (!tabId) {
      throw new Error('Could not prepare the page to run the extension.')
    }

    const result = await sendMessage('expandTree', { parentLabel: parentLabel.value }, `content-script@${tabId}`) as unknown as { success: boolean, data?: TreeNode[], error?: string }

    if (result.success) {
      lastResult.value = result.data ?? null
      status.value = `✅ Success! Generated JSON for "${parentLabel.value}" and copied to clipboard.`
    }
    else {
      status.value = `❌ Error: ${result.error}`
      lastResult.value = null
    }
  }
  catch (error) {
    console.error('Failed to expand tree:', error)
    status.value = `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    lastResult.value = null
  }
  finally {
    isExpanding.value = false
  }
}

async function copyLastResult() {
  if (!lastResult.value) {
    status.value = 'No data to copy'
    return
  }

  try {
    const jsonString = JSON.stringify(lastResult.value, null, 2)
    const result = await sendMessage('copy-to-clipboard', { text: jsonString }, 'background') as unknown as { success: boolean, error?: string }

    if (result.success) {
      status.value = '✅ JSON copied to clipboard successfully!'
    }
    else {
      status.value = `❌ Copy failed: ${result.error}`
    }
  }
  catch (error) {
    console.error('Failed to copy result:', error)
    status.value = `❌ Copy failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

function selectLabel(label: string) {
  parentLabel.value = label
  showDropdown.value = false
  activeIndex.value = -1
}

function handleBlur() {
  setTimeout(() => {
    showDropdown.value = false
  }, 200)
}

onMessage('labels-updated', (payload) => {
  const labels = ((payload?.data as { labels?: string[] } | null)?.labels) ?? []
  availableLabels.value = labels
  if ((document.activeElement as HTMLElement | null)?.id === 'parentLabel') {
    activeIndex.value = filteredLabels.value.length > 0 ? 0 : -1
    showDropdown.value = filteredLabels.value.length > 0
  }
})

onMounted(() => {
  getAvailableLabels()
})
</script>

<template>
  <main class="px-4 py-5 text-gray-700">
    <div class="flex items-center justify-center mb-4">
      <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h1 class="text-lg font-semibold text-gray-900">
        ADE Tree Generator
      </h1>
    </div>

    <div class="space-y-4">
      <div>
        <label for="parentLabel" class="block text-sm font-medium text-gray-700 mb-2">
          Parent Label
        </label>
        <div class="relative">
          <input
            id="parentLabel"
            v-model="parentLabel"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. IUT - Vannes"
            @focus="onFocus"
            @input="onInput"
            @keydown.down.prevent="moveActive(1)"
            @keydown.up.prevent="moveActive(-1)"
            @keydown.enter.prevent="selectActive()"
            @keydown.esc.prevent="showDropdown = false"
            @blur="handleBlur"
          >

          <div
            v-if="showDropdown && filteredLabels.length > 0"
            class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            <div
              v-for="(label, idx) in filteredLabels"
              :key="label"
              class="px-3 py-2 cursor-pointer text-sm"
              :class="{ 'bg-blue-50 text-blue-900': idx === activeIndex, 'hover:bg-gray-100': idx !== activeIndex }"
              @click="selectLabel(label)"
              @mouseenter="activeIndex = idx"
            >
              {{ label }}
            </div>
          </div>
        </div>

        <button
          v-if="availableLabels.length > 0"
          class="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
          @click="showDropdown = !showDropdown"
        >
          {{ showDropdown ? 'Hide' : 'Show' }} available options ({{ availableLabels.length }})
        </button>
      </div>

      <div class="flex space-x-2">
        <button
          :disabled="isExpanding || !parentLabel.trim()"
          class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="expandTree"
        >
          <span v-if="isExpanding" class="flex items-center justify-center">
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Expanding...
          </span>
          <span v-else>Expand & Generate</span>
        </button>

        <button
          :disabled="!lastResult"
          class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Copy last result to clipboard"
          @click="copyLastResult"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>

        <button
          class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          title="List auto-updates. Click to refresh now"
          @click="getAvailableLabels"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div
        v-if="status"
        class="p-3 rounded-md text-sm"
        :class="{
          'bg-green-50 text-green-800 border border-green-200': status.includes('✅'),
          'bg-red-50 text-red-800 border border-red-200': status.includes('❌'),
          'bg-blue-50 text-blue-800 border border-blue-200': !status.includes('✅') && !status.includes('❌'),
        }"
      >
        {{ status }}
      </div>

      <div v-if="lastResult" class="text-xs text-gray-500 bg-gray-50 p-2 rounded">
        <strong>Last generated:</strong> {{ lastResult.length }} root item(s) with
        {{ lastResult.reduce((acc, item) => acc + (item.edts?.length || 0), 0) }} child items
      </div>

      <div class="text-xs text-gray-500 text-center pt-2 border-t border-gray-200">
        Navigate to an ADE calendar page and use this extension to expand tree structures and generate JSON with iCal URLs.
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Additional custom styles if needed */
</style>
