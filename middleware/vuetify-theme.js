export default function ({ app }) {
  if (process.server) {
    const theme = app.$cookies.get('theme')
    if (theme !== undefined) {
      app.vuetify.framework.theme.dark = theme
    }
  }
}
