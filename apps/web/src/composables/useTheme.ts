import { createSharedComposable, useColorMode } from '@vueuse/core'
import { useUserPrefsSync } from '@web/composables/useUserPrefsSync'
import { computed, watch } from 'vue'

export const AVAILABLE_THEMES = ['light', 'dracula', 'dark', 'auto'] as const
export type UiTheme = (typeof AVAILABLE_THEMES)[number]

// i18n labels hoisted to avoid recreating per call
export const I18N_THEMES = {
  auto: 'Système',
  light: 'Clair',
  dracula: 'Dracula',
  dark: 'Sombre',
} as const

/**
 * Centralized theme management using VueUse's useColorMode
 *
 * - data-theme attribute: 'light' | 'dark' | 'dracula' (for DaisyUI)
 * - .is-dark class: added for 'dark' and 'dracula' (for Schedule X and custom CSS)
 * - "auto" mode chooses between dark and light
 */

function useTheme() {
  const theme = useColorMode({
    selector: 'html',
    attribute: 'data-theme',
    storageKey: 'settings.theme',
    emitAuto: true,
    modes: {
      dracula: 'dracula',
    },
  })

  watch(theme, (newTheme) => {
    console.log(`[Theme] Switched to theme: ${newTheme}`)
  }, { immediate: true, flush: 'sync' })

  // Darkness flag for consumers like Schedule X.
  const isDark = computed<boolean>(() => theme.value === 'dark' || theme.value === 'dracula')

  // Programmatic switching to an explicit theme.
  function setTheme(newTheme: typeof theme.value) {
    console.log(`[Theme] Setting theme to: ${newTheme}`)
    theme.value = newTheme
  }

  const { syncPref } = useUserPrefsSync()
  syncPref('theme', theme, {
    fromServerToLocal: (raw) => {
      if (typeof raw === 'string' && AVAILABLE_THEMES.includes(raw as UiTheme)) return raw as UiTheme
      return 'auto'
    },
    setLocal: setTheme,
    debounce: 500,
  })

  return {
    theme,
    isDark,
    i18nThemes: I18N_THEMES,
    setTheme,
  }
}

export const useSharedTheme = createSharedComposable(useTheme)
