import { ref } from 'vue'

const isAppScrolled = ref(false)

export function useAppScroll() {
  function handleScroll(e: Event) {
    const target = e.target as HTMLElement
    isAppScrolled.value = target.scrollTop > 20
  }

  function setIsScrolled(value: boolean) {
    isAppScrolled.value = value
  }

  return {
    isAppScrolled,
    handleScroll,
    setIsScrolled,
  }
}
