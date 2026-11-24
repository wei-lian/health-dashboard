import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import './styles/main.css'
import './styles/content.css'
import './styles/responsive.css'
import './styles/media.css'
import './styles/layout.css'
import './styles/personal.css'
import './styles/learning.css'

const app = createApp(App).use(router)
// 首次导航守卫完成后再渲染，避免未登录时闪现业务页面。
router.isReady().then(() => app.mount('#app'))
