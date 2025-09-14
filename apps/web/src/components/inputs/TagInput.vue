<script setup lang="ts">
import { ref } from 'vue'

defineOptions({ name: 'TagInput' })

const props = withDefaults(defineProps<{
  modelValue?: string[]
  placeholder?: string
  helper?: string
}>(), {
  modelValue: () => [],
  placeholder: 'Type and press Enter or comma…',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const inputValue = ref('')

function normalizeToken(token: string) {
  return token.trim()
}

function hasToken(targets: string[], value: string) {
  const needle = value.toLowerCase()
  return targets.some(t => t.toLowerCase() === needle)
}

function addTokens(tokens: string[]) {
  if (!tokens.length) return
  const next = props.modelValue.slice()
  for (const raw of tokens) {
    const t = normalizeToken(raw)
    if (!t) continue
    if (!hasToken(next, t)) next.push(t)
  }
  if (next.length !== props.modelValue.length) {
    emit('update:modelValue', next)
  }
}

function commitInput() {
  const raw = inputValue.value
  if (!raw) return
  // Split by comma to support multiple at once
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean)
  addTokens(parts)
  inputValue.value = ''
}

function removeTag(index: number) {
  const next = props.modelValue.slice()
  next.splice(index, 1)
  emit('update:modelValue', next)
}

function onKeydown(e: KeyboardEvent) {
  // Support comma as commit key
  if (e.key === ',') {
    e.preventDefault()
    commitInput()
  }
  // Optional UX: Backspace removes last tag when input is empty
  if (e.key === 'Backspace' && inputValue.value.length === 0 && props.modelValue.length > 0) {
    e.preventDefault()
    removeTag(props.modelValue.length - 1)
  }
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') ?? ''
  if (!text) return
  // If pasted text contains a comma, we parse the parts and prevent default paste
  if (text.includes(',')) {
    e.preventDefault()
    const parts = text.split(',').map(s => s.trim()).filter(Boolean)
    addTokens(parts)
  }
}
</script>

<template>
  <div class="form-control w-full">
    <!-- Tags -->
    <div class="flex flex-wrap gap-2 mb-2" role="list">
      <span
        v-for="(tag, idx) in modelValue"
        :key="`${tag}_${idx}`"
        class="badge badge-outline items-center gap-1 pl-2 pr-1"
        role="listitem"
      >
        <span class="truncate max-w-xs leading-tight text-xs">{{ tag }}</span>
        <button
          :aria-label="`Remove tag ${tag}`"
          class="ml-0.5 inline-flex items-center justify-center h-3 w-3 rounded-full p-0 text-[9px] leading-none hover:bg-base-300/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 transition-colors cursor-pointer"
          type="button"
          @click="removeTag(idx)"
        >
          ✕
        </button>
      </span>
    </div>

    <!-- Input -->
    <input
      v-model="inputValue"
      :aria-describedby="helper ? 'tag-helper' : undefined"
      aria-label="Add tag"
      autocapitalize="off"
      autocomplete="off"
      class="input input-bordered w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      :placeholder="placeholder"
      spellcheck="false"
      type="text"
      @blur="commitInput()"
      @keydown="onKeydown"
      @keydown.enter.prevent="commitInput()"
      @paste="onPaste"
    >

    <p v-if="helper" id="tag-helper" class="text-xs text-base-content/60 mt-1">
      {{ helper }}
    </p>
  </div>
</template>
