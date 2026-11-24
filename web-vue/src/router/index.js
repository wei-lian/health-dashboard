import { createRouter, createWebHashHistory } from 'vue-router'
import { getSession, loginDestination } from '../utils/auth-session.js'

export const navigation = [
  {
    path: '/',
    label: '今日总览',
    icon: 'dashboard',
    eyebrow: 'YOUR DAILY EDIT',
    title: '让每一天，都有一点新收获。',
    description: '照顾身体，保持好奇。从这一屏，开启今天。',
  },
  {
    path: '/records',
    label: '运动与睡眠',
    icon: 'activity',
    eyebrow: 'A LITTLE BETTER EVERY DAY',
    title: '把照顾自己，变成日常。',
    description: '记录每一次出发，也记录每一个好好休息的夜晚。',
  },
  {
    path: '/daily',
    label: '每日发现',
    icon: 'compass',
    eyebrow: 'STAY CURIOUS',
    title: '世界很大，每天了解一点。',
    description: '读热点、学知识，用三道小题唤醒大脑。',
  },
  {
    path: '/music',
    label: '热歌榜单',
    icon: 'music',
    eyebrow: 'THE DAILY CHART',
    title: '看看今天，大家在听什么。',
    description: '从每日榜单到累计回顾，发现值得收藏的旋律。',
  },
  {
    path: '/food',
    label: '美食与非遗',
    icon: 'food',
    eyebrow: 'A TASTE OF EVERYDAY',
    title: '认真吃饭，也是生活的灵感。',
    description: '一道家常菜，一段风土故事。让日常多一点滋味。',
  },
  {
    path: '/learn',
    label: '诗词与单词',
    icon: 'book',
    eyebrow: 'WORDS TO KEEP',
    title: '在文字里，遇见更大的世界。',
    description: '读一首诗，记一个词。把喜欢的句子留在身边。',
  },
  {
    path: '/digital',
    label: '数码行情',
    icon: 'monitor',
    eyebrow: 'THOUGHTFUL CHOICES',
    title: '理性种草，找到适合自己的。',
    description: '整理配置与参考区间，让每一次选择更从容。',
  },
  {
    path: '/meals',
    label: '每日菜单',
    icon: 'food',
    eyebrow: 'WHAT TO EAT TODAY',
    title: '今天吃什么，让选择轻松一点。',
    description: '收好你喜欢的外卖类型，犹豫时随机选一个。',
  },
  {
    path: '/settings',
    label: '设置与备份',
    icon: 'settings',
    eyebrow: 'MAKE IT YOURS',
    title: '你的生活，由你保管。',
    description: '管理本地数据，随时备份你的日常。',
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/login.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('../layouts/dashboard-layout.vue'),
      children: [
        { path: '/', component: () => import('../views/home.vue') },
        { path: '/records', component: () => import('../views/records.vue') },
        ...['daily', 'music', 'food', 'learn', 'digital'].map((path) => ({
          path: `/${path}`,
          component: () => import('../views/explore.vue'),
        })),
        { path: '/meals', component: () => import('../views/meals.vue') },
        { path: '/settings', component: () => import('../views/settings.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// 所有业务页面统一检查登录，深链接登录后返回原来的页面。
router.beforeEach((to) => {
  const session = getSession()
  if (!to.meta.public && !session)
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath }, replace: true }
  if (to.name === 'login' && session) return loginDestination(to.query.redirect)
})

export default router
