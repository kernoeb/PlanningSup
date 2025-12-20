import { ref } from 'vue'

const isAppScrolled = ref(false)

export function useAppScroll() {
  function handleScroll(e: Event) {
    const target = e.target as HTMLElement
    isAppScrolled.value = target.scrollTop > 17 // calendar logo location
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
