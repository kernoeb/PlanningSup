import { fr } from 'vuetify/lib/locale'
import minifyTheme from 'minify-css-string'

const themeColors = {
  primary: '#1976d2',
  accent: '#424242',
  secondary: '#ff8f00',
  info: '#26a69a',
  warning: '#ffc107',
  error: '#dd2c00',
  success: '#00e676'
}

export default {
  theme: {
    dark: true,
    options: { customProperties: true, minifyTheme },
    themes: {
      dark: themeColors,
      light: themeColors
    }
  },
  lang: {
    locales: { fr },
    current: 'fr'
  }
}
