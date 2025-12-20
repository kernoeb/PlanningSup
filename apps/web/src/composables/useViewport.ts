import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'

const RESPONSIVE_BREAKPOINT = 700 // ScheduleX internal breakpoint

export function useViewport() {
  const {
    width: windowWidth,
    height: windowHeight,
  } = useWindowSize()

  const isSmallScreen = computed(() => windowWidth.value < RESPONSIVE_BREAKPOINT)

  return {
    isSmallScreen,
    windowWidth,
    windowHeight,
  }
}
