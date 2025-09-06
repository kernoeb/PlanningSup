import { useColorMode } from '@vueuse/core'
import { computed } from 'vue'

export type UiTheme = 'light' | 'dracula' | 'black'
export const AVAILABLE_THEMES: readonly UiTheme[] = ['light', 'dracula', 'black'] as const

const LEGACY_STORAGE_KEY = 'ui.theme' // old key storing 'black' | 'light' | 'dracula'

/**
 * Centralized theme management using VueUse's useColorMode
 *
 * - data-theme attribute: 'light' | 'black' | 'dracula' (for DaisyUI)
 * - .is-dark class: added for 'black' and 'dracula' (for Schedule X and custom CSS)
 * - "auto" mode chooses between dark (mapped to 'black') and light
 */
export function useTheme() {
  const mode = useColorMode<'dracula'>({
    selector: 'html',
    attribute: 'data-theme',
    storageKey: 'ui.theme.store', // new key; separate from legacy
    // Map the attribute values directly so DaisyUI receives a valid theme name.
    // Here, dark -> "black" to match our DaisyUI custom theme.
    modes: {
      dark: 'black',
      light: 'light',
      dracula: 'dracula',
    },
    // Use the default handler to apply the attribute and disable transitions,
    // then toggle our custom .is-dark flag for dark-like themes.
    onChanged: (next, defaultHandler) => {
      defaultHandler(next)
      if (typeof document === 'undefined') return
      const el = document.documentElement
      if (next === 'dark' || next === 'dracula') el.classList.add('is-dark')
      else el.classList.remove('is-dark')
    },
  })

  // One-time migration from legacy storage (ui.theme) to the new storage key.
  if (typeof window !== 'undefined') {
    try {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY) as UiTheme | null
      const hasNew = localStorage.getItem('ui.theme.store') != null
      if (legacy && !hasNew) {
        // Map legacy 'black' to 'dark', others as-is.
        const mapped: 'dark' | 'light' | 'dracula'
          = legacy === 'black' ? 'dark' : legacy
        mode.store.value = mapped
        mode.value = mapped
        localStorage.removeItem(LEGACY_STORAGE_KEY)
      }
    } catch {
      // ignore access errors (private mode / disabled storage)
    }
  }

  // Applied theme name as used by DaisyUI (light | black | dracula).
  // Note: when reading, mode.value returns the resolved mode (dark|light|dracula),
  // so we only need to map 'dark' -> 'black' for display and consumers.
  const theme = computed<UiTheme>(() =>
    mode.value === 'dark' ? 'black' : (mode.value as UiTheme),
  )

  // Darkness flag for consumers like Schedule X.
  const isDark = computed<boolean>(() => mode.value === 'dark' || mode.value === 'dracula')

  // i18n labels
  const i18nThemes = {
    system: 'Système',
    light: 'Clair',
    dracula: 'Dracula',
    black: 'Noir',
  } as const

  // Programmatic switching to an explicit theme.
  function setTheme(next: UiTheme) {
    mode.value = (next === 'black' ? 'dark' : next) as any
  }

  // Switch back to system preference (auto).
  function setAuto() {
    mode.value = 'auto'
  }

  // Early init to minimize FOUC. Apply the current mode to the DOM immediately.
  function init() {
    if (typeof document === 'undefined') return
    const el = document.documentElement
    const current = mode.value as 'dark' | 'light' | 'dracula'
    const themeAttr = current === 'dark' ? 'black' : current
    el.setAttribute('data-theme', themeAttr)
    if (current === 'dark' || current === 'dracula') el.classList.add('is-dark')
    else el.classList.remove('is-dark')
  }

  return {
    // Applied theme (light | black | dracula)
    theme,
    // Darkness flag
    isDark,
    // Labels and helpers
    i18nThemes,
    setTheme,
    setAuto,
    // Expose the underlying useColorMode return for advanced cases
    mode,
    // FOUC prevention
    init,
  }
}
