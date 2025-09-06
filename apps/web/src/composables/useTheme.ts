import { useLocalStorage } from '@vueuse/core'
import { computed, watch, watchEffect } from 'vue'

export type UiTheme = 'light' | 'dracula' | 'black'

const STORAGE_KEY = 'ui.theme'
const DEFAULT_THEME: UiTheme = 'black'
const DARK_THEMES = new Set<UiTheme>(['black', 'dracula'])
export const AVAILABLE_THEMES: readonly UiTheme[] = ['light', 'dracula', 'black'] as const

function isValidTheme(value: string | null | undefined): value is UiTheme {
  return value === 'light' || value === 'dracula' || value === 'black'
}

function normalizeTheme(value: string | null | undefined): UiTheme {
  return isValidTheme(value) ? value : DEFAULT_THEME
}

/**
 * Apply the theme to the <html> element through:
 * - data-theme attribute (used by DaisyUI)
 * - is-dark class (used by Schedule X and custom CSS)
 */
function applyThemeToDom(theme: UiTheme) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.setAttribute('data-theme', theme)
  if (DARK_THEMES.has(theme)) el.classList.add('is-dark')
  else el.classList.remove('is-dark')
}

/**
 * useTheme composable
 * - Persists the selected UI theme to localStorage
 * - Applies the theme to the DOM (DaisyUI + .is-dark flag)
 * - Exposes helpers to change the theme and initialize early
 */
export function useTheme() {
  // Persisted theme
  const theme = useLocalStorage<UiTheme>(STORAGE_KEY, DEFAULT_THEME)

  // Derived darkness flag
  const isDark = computed<boolean>(() => DARK_THEMES.has(theme.value))

  const i18nThemes = {
    light: 'Clair',
    dracula: 'Dracula',
    black: 'Noir',
  }

  // Keep storage sanitized if someone manually edited localStorage
  watch(
    theme,
    (val) => {
      const normalized = normalizeTheme(val)
      if (normalized !== val) theme.value = normalized
    },
    { immediate: true },
  )

  // Reactively apply the theme whenever it changes
  watchEffect(() => {
    applyThemeToDom(theme.value)
  })

  /**
   * Programmatically set the theme
   */
  function setTheme(next: UiTheme) {
    theme.value = next
  }

  /**
   * Initialize early (e.g., call in main.ts before mount, or via inline script in index.html)
   * Ensures the DOM reflects the stored theme ASAP to minimize FOUC.
   */
  function init() {
    const normalized = normalizeTheme(theme.value)
    if (normalized !== theme.value) theme.value = normalized
    applyThemeToDom(normalized)
  }

  return {
    theme,
    isDark,
    setTheme,
    i18nThemes,
    init,
  }
}
