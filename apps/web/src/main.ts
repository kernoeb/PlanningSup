import { createApp } from 'vue'
import App from './App.vue'
import { useTheme } from './composables/useTheme'
import './style.css'
import 'temporal-polyfill/global'
import '@fontsource-variable/roboto'

const { init } = useTheme()
init()

createApp(App).mount('#app')
