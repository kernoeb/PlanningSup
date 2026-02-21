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
  <div class="join w-fit">
    <a
      class="join-item btn btn-sm btn-ghost bg-base-200/60 no-underline gap-2"
      :href="`https://github.com/${user}/${repo}`"
      rel="noopener noreferrer"
      target="_blank"
    >
      <Star aria-hidden="true" class="size-4" />
      Mettre une étoile
    </a>
    <a
      v-if="stars !== null"
      class="join-item btn btn-sm btn-ghost bg-base-200/60 no-underline"
      :href="`https://github.com/${user}/${repo}/stargazers`"
      rel="noopener noreferrer"
      target="_blank"
    >
      {{ stars }}
    </a>
  </div>
</template>
