import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { i18n } from './i18n'
import { router } from './router'
import { useRoomStore } from './stores/rooms'
import { loadFonts } from 'virtual:locales'

const app = createApp(App)
app.use(createPinia())
// Open the room stream before anything renders; the rest of the page loads beside it
useRoomStore().connect()
// Self-hosted web fonts; text shows in system fonts until they arrive
loadFonts()
app.use(router)
app.use(i18n)
app.mount('#app')
