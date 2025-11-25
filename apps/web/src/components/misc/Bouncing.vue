<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const INACTIVITY_MS = 60 * 60 * 1000
const BOUNCE_SPEED = 95
const EDGE_OFFSET = -4

const dvdRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)
const isEscaping = ref(false)

const position = { x: 0, y: 0 }
const velocity = { x: BOUNCE_SPEED, y: BOUNCE_SPEED * 0.72 }

let inactivityTimer: number | null = null
let animationFrame: number | null = null
let lastFrame = 0

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function setRandomStart() {
  const el = dvdRef.value
  if (!el) return

  const rect = el.getBoundingClientRect()

  const maxX = Math.max(EDGE_OFFSET, window.innerWidth - rect.width - EDGE_OFFSET)
  const maxY = Math.max(EDGE_OFFSET, window.innerHeight - rect.height - EDGE_OFFSET)

  position.x = Math.random() * maxX
  position.y = Math.random() * maxY

  el.style.transform = `translate(${position.x}px, ${position.y}px)`
}

function step(timestamp: number) {
  const el = dvdRef.value
  if (!isVisible.value || isEscaping.value || !el) return

  if (!lastFrame) {
    lastFrame = timestamp
    animationFrame = window.requestAnimationFrame(step)
    return
  }

  const deltaSeconds = (timestamp - lastFrame) / 1000
  lastFrame = timestamp

  const rect = el.getBoundingClientRect()
  const maxX = Math.max(EDGE_OFFSET, window.innerWidth - rect.width - EDGE_OFFSET)
  const maxY = Math.max(EDGE_OFFSET, window.innerHeight - rect.height - EDGE_OFFSET)

  let nextX = position.x + velocity.x * deltaSeconds
  let nextY = position.y + velocity.y * deltaSeconds

  if (nextX <= EDGE_OFFSET || nextX >= maxX) {
    velocity.x *= -1
    nextX = clamp(nextX, EDGE_OFFSET, maxX)
  }

  if (nextY <= EDGE_OFFSET || nextY >= maxY) {
    velocity.y *= -1
    nextY = clamp(nextY, EDGE_OFFSET, maxY)
  }

  position.x = nextX
  position.y = nextY

  el.style.transform = `translate(${position.x}px, ${position.y}px)`

  animationFrame = window.requestAnimationFrame(step)
}

function startBounce() {
  stopBounce()
  lastFrame = 0
  animationFrame = window.requestAnimationFrame(step)
}

function stopBounce() {
  if (animationFrame !== null) {
    window.cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
}

function hideEgg() {
  isVisible.value = false
  isEscaping.value = false
  stopBounce()
  resetInactivityTimer()
}

function launchEscape() {
  if (!isVisible.value || isEscaping.value) return

  isEscaping.value = true
  stopBounce()

  window.setTimeout(() => hideEgg(), 260)
}

async function startEgg() {
  if (isVisible.value) return
  isVisible.value = true
  isEscaping.value = false
  await nextTick()
  setRandomStart()
  startBounce()
}

function resetInactivityTimer() {
  if (inactivityTimer !== null) {
    window.clearTimeout(inactivityTimer)
    inactivityTimer = null
  }

  inactivityTimer = window.setTimeout(() => startEgg(), INACTIVITY_MS)
}

function handleActivity() {
  if (isVisible.value) {
    launchEscape()
    return
  }

  resetInactivityTimer()
}

function handleResize() {
  const el = dvdRef.value
  if (!isVisible.value || !el || isEscaping.value) return

  const rect = el.getBoundingClientRect()
  const maxX = Math.max(EDGE_OFFSET, window.innerWidth - rect.width - EDGE_OFFSET)
  const maxY = Math.max(EDGE_OFFSET, window.innerHeight - rect.height - EDGE_OFFSET)

  position.x = clamp(position.x, EDGE_OFFSET, maxX)
  position.y = clamp(position.y, EDGE_OFFSET, maxY)
  el.style.transform = `translate(${position.x}px, ${position.y}px)`
}

onMounted(() => {
  resetInactivityTimer()
  window.addEventListener('click', handleActivity, { capture: true })
  window.addEventListener('focus', handleActivity)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (inactivityTimer !== null) window.clearTimeout(inactivityTimer)
  stopBounce()
  window.removeEventListener('click', handleActivity, { capture: true })
  window.removeEventListener('focus', handleActivity)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div
    v-if="isVisible"
    class="dvd-overlay"
    :class="{ 'is-visible': !isEscaping, 'is-escaping': isEscaping }"
  >
    <div
      ref="dvdRef"
      class="dvd-logo"
      :class="{ 'is-escaping': isEscaping }"
    >
      <img
        alt="PlanningSup DVD"
        loading="lazy"
        src="/icon.png"
      >
    </div>
  </div>
</template>

<style scoped>
.dvd-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 60;
  opacity: 0;
  transition: opacity 0.45s ease-out;
}

.dvd-overlay.is-visible {
  opacity: 1;
}

.dvd-overlay.is-escaping {
  opacity: 0;
  transition: opacity 0.24s ease-in;
}

.dvd-logo {
  position: absolute;
  width: 108px;
  height: 108px;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.1));
  border-radius: 18px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(1px);
  will-change: transform;
}

.dvd-logo img {
  width: 84px;
  height: 84px;
  object-fit: contain;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.35));
  border-radius: 12px;
}

.dvd-logo.is-escaping {
  opacity: 0;
  transform: scale(0.94);
  transition: opacity 0.22s ease-in, transform 0.26s ease-out;
}
</style>
