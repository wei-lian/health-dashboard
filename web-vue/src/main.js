import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import './styles/main.css'
import './styles/content.css'
import './styles/responsive.css'
import './styles/media.css'
import './styles/layout.css'
import './styles/personal.css'

createApp(App).use(router).mount('#app')
