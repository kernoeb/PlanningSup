import { createApp } from 'vue'
import App from './App.vue'
import { useSharedTheme } from './composables/useTheme'
import './style.css'
import 'temporal-polyfill/global'
import '@fontsource-variable/roboto'

const { init } = useSharedTheme()
init()

createApp(App).mount('#app')
