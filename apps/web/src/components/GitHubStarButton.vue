<script lang="ts" setup>
import { Star } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'

defineOptions({ name: 'GitHubStarButton' })

const props = withDefaults(defineProps<{
  user: string
  repo: string
}>(), {})

const stars = ref<string | null>(null)

onMounted(async () => {
  try {
    const res = await fetch(`https://api.github.com/repos/${props.user}/${props.repo}`)
    if (!res.ok) return
    const data = await res.json()
    const count = data.stargazers_count as number
    stars.value = count >= 1000 ? `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k` : count.toLocaleString()
  } catch {
    // silently ignore
  }
})
</script>

<template>
  <div class="gh-wrapper">
    <a
      class="gh-btn"
      :href="`https://github.com/${user}/${repo}`"
      rel="noopener noreferrer"
      target="_blank"
    >
      <Star aria-hidden="true" class="gh-star-icon" />
      <span>Mettre une étoile</span>
    </a>
    <a
      v-if="stars !== null"
      class="gh-count"
      :href="`https://github.com/${user}/${repo}/stargazers`"
      rel="noopener noreferrer"
      target="_blank"
    >
      {{ stars }}
    </a>
  </div>
</template>

<style scoped>
.gh-wrapper {
  display: inline-flex;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.gh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  color: #24292f;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  background-color: #ebf0f4;
  background-image: linear-gradient(180deg, #f6f8fa, #ebf0f4);
  border: 1px solid rgba(27, 31, 36, 0.15);
  border-radius: 6px;
  transition: background-color 0.1s;
}

.gh-btn:hover {
  background-color: #e0e6eb;
  background-image: linear-gradient(180deg, #f0f3f6, #e0e6eb);
}

.gh-btn:active {
  background-color: #d2d8de;
  background-image: none;
  box-shadow: inset 0 1px 0 rgba(27, 31, 36, 0.1);
}

.gh-star-icon {
  width: 16px;
  height: 16px;
  color: #656d76;
}

.gh-count {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  margin-left: -1px;
  color: #24292f;
  text-decoration: none;
  white-space: nowrap;
  background-color: #fff;
  border: 1px solid rgba(27, 31, 36, 0.15);
  border-radius: 0 6px 6px 0;
}

.gh-count:hover {
  color: #0969da;
}

.gh-btn:has(+ .gh-count) {
  border-radius: 6px 0 0 6px;
}
</style>
