<script setup>
import { news, food, knowledge, devices, content } from '../stores/content-store.js'
import MusicView from './music-view.vue'
import { state, toggleItem } from '../stores/local-store.js'
const route = useRoute()
const category = ref('全部')
const foodTab = ref('today')
const deviceTab = ref('phone')
const knowledgeIndex = ref(0)
const showKnowledge = ref(false)
const showRecipe = ref(false)
const filteredNews = computed(() =>
  news.filter((item) => category.value === '全部' || item.category === category.value),
)
const article = computed(() => knowledge[knowledgeIndex.value])
watch(
  () => knowledge.length,
  () => {
    if (knowledgeIndex.value >= knowledge.length) knowledgeIndex.value = 0
  },
)
watch(
  () => route.path,
  () => {
    category.value = '全部'
  },
)
</script>

<template>
  <div class="explore-view">
    <div class="prototype-note">
      <AppIcon name="compass" :size="16" /><span
        >内容按来源与实际日期展示；采集失败时保留上次结果，首次无数据时明确标记示例。</span
      >
    </div>
    <template v-if="route.path === '/daily'"
      ><div class="content-grid daily-grid">
        <div>
          <article class="card">
            <div class="card-head">
              <h2>每日热点</h2>
              <span class="pill subtle">{{ news.length }} 条精选</span>
            </div>
            <SourceStatus module="hotNews" />
            <div class="filter-tabs">
              <button
                v-for="item in ['全部', '社会', '科技', '财经', '体育', '娱乐', '国际']"
                :key="item"
                :class="{ active: category === item }"
                @click="category = item"
              >
                {{ item }}
              </button>
            </div>
            <div class="news-list full-news">
              <a
                v-for="(item, n) in filteredNews"
                :key="item.id"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
                class="news-item"
                @click="!state.readNews.includes(item.id) && toggleItem('readNews', item.id)"
                ><span class="news-number">{{ String(n + 1).padStart(2, '0') }}</span>
                <div>
                  <div class="news-title">{{ item.title }}</div>
                  <p v-if="item.summary" class="news-summary">{{ item.summary }}</p>
                  <p>
                    <span class="news-category">{{ item.category }}</span>{{ item.source }} ·
                    {{ state.readNews.includes(item.id) ? '已读' : item.time }}
                  </p>
                </div>
                <AppIcon name="arrow" :size="17"
              /></a>
            </div>
          </article>
        </div>
        <div class="dashboard-column">
          <QuizCard />
          <article class="card knowledge-card">
            <SourceStatus module="knowledge" />
            <div class="sunset-art">
              <span></span>
              <div class="sunset-caption">WONDERS OF NATURE</div>
            </div>
            <div class="knowledge-copy">
              <span class="pill peach">{{ article.category }} · 每日科普</span>
              <h3>{{ article.title }}</h3>
              <p>{{ article.intro }}</p>
              <button class="text-button" @click="showKnowledge = !showKnowledge">
                {{ showKnowledge ? '收起知识' : '读懂这个小知识' }}<AppIcon name="right" :size="15" />
              </button>
              <div v-if="showKnowledge" class="article-detail">
                <p class="pre-line">{{ article.body }}</p>
                <div v-if="article.fact" class="memory-note">冷知识：{{ article.fact }}</div>
                <a
                  v-if="article.url"
                  :href="article.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-button"
                  >阅读原文<AppIcon name="external" :size="14"
                /></a>
                <small class="muted">{{ article.ref }}</small>
              </div>
              <button
                v-if="knowledge.length > 1"
                class="text-button muted knowledge-switch"
                @click="knowledgeIndex = (knowledgeIndex + 1) % knowledge.length"
              >
                <AppIcon name="refresh" :size="14" />换个主题
              </button>
            </div>
          </article>
        </div>
      </div></template
    >
    <template v-else-if="route.path === '/music'"><MusicView /></template>
    <template v-else-if="route.path === '/food'"
      ><div class="filter-tabs standalone">
        <button :class="{ active: foodTab === 'today' }" @click="foodTab = 'today'">今日一菜</button
        ><button :class="{ active: foodTab === 'heritage' }" @click="foodTab = 'heritage'">
          非遗里的中国味
        </button>
      </div>
      <article v-if="foodTab === 'today'" class="card recipe-card">
        <div class="food-art">
          <img v-if="food.img" :src="food.img" :alt="food.name" class="recipe-photo" /><template v-else>
            <svg viewBox="0 0 400 320" role="img" :aria-label="food.name + ' · 通用菜肴插画'">
              <ellipse cx="200" cy="264" rx="134" ry="22" fill="#d7c4a4" />
              <path d="M75 163h250c-3 145-245 145-250 0" fill="#f6f1e7" />
              <ellipse cx="200" cy="164" rx="126" ry="65" fill="#e8e0d0" />
              <ellipse cx="200" cy="164" rx="111" ry="52" fill="#ac5033" />
              <g fill="#c77c46">
                <rect x="123" y="132" width="42" height="34" rx="9" transform="rotate(-15 123 132)" />
                <rect x="205" y="137" width="40" height="36" rx="8" transform="rotate(20 205 137)" />
                <rect x="167" y="174" width="39" height="29" rx="8" />
              </g>
              <g fill="#dc6242">
                <path d="M155 129q25-40 47 8z" />
                <path d="M237 183q25-45 48-6z" />
                <path d="M108 178q25-34 39 6z" />
              </g>
              <g fill="#e4be73">
                <rect x="218" y="174" width="24" height="24" rx="5" />
                <rect x="167" y="143" width="23" height="23" rx="5" />
              </g>
              <g fill="#57774c">
                <path d="M183 157q-20-20-27-7 8 12 27 7M183 157q9-26 22-18-1 14-22 18" />
                <path d="M242 154q-11-21-19-12 3 12 19 12" />
              </g>
              <path
                d="M157 80c-20-25 17-24 3-50m43 48c-16-24 17-22 3-48m39 51c-14-23 15-23 3-44"
                stroke="#ffffff"
                stroke-width="5"
                opacity=".65"
                stroke-linecap="round"
              /></svg
            ><span>THE COMFORT OF HOME · 通用插画</span></template
          >
        </div>
        <div class="recipe-copy">
          <SourceStatus module="food" />
          <span class="eyebrow">TODAY'S RECIPE</span>
          <h2>{{ food.name }}</h2>
          <p>{{ food.description }}</p>
          <div class="recipe-tags">
            <span><AppIcon name="clock" :size="16" />{{ food.time }}</span
            ><span>难度 · {{ food.difficulty }}</span
            ><span>{{ food.region }}</span>
          </div>
          <a
            v-if="food.sourceUrl"
            :href="food.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-button"
            >菜谱原文与完整用量<AppIcon name="external" :size="14"
          /></a>
          <h3>准备这些食材</h3>
          <div class="ingredients">
            <span v-for="item in food.ingredients" :key="item[0]"
              >{{ item[0] }}<strong>{{ item[1] }}</strong></span
            >
          </div>
          <button class="button primary" @click="showRecipe = !showRecipe">
            {{ showRecipe ? '收起做法' : '今天就做这道菜' }}<AppIcon name="right" :size="17" />
          </button>
        </div>
        <div v-if="showRecipe" class="recipe-steps">
          <h3>慢慢来，好味道值得等待。</h3>
          <p v-for="(step, n) in food.steps" :key="step">
            <span>0{{ n + 1 }}</span
            >{{ step }}
          </p>
          <div class="memory-note">烹饪小贴士：{{ food.tip }}</div>
        </div>
      </article>
      <article v-else class="card heritage-card">
        <span class="eyebrow">FOOD & CULTURE</span>
        <h2>一碗兰州牛肉面，揉进百年手艺。</h2>
        <span class="pill sand">地方饮食文化 · 条目草图</span>
        <div class="article-detail">
          <h4>发源地</h4>
          <p>甘肃省兰州市。牛肉面与当地城市生活紧密相连，从清晨的面馆到街巷之间，构成鲜明的地方饮食记忆。</p>
          <h4>工艺与做法</h4>
          <p>
            面团经过和、醒、揉、溜、拉等工序，依靠手上功夫拉成不同粗细。配以清汤、牛肉片、白萝卜、辣椒油及香菜蒜苗，讲究汤清、面韧与搭配协调。
          </p>
          <h4>文化故事</h4>
          <p>
            一碗面连接着师徒传承与城市日常。食客可以按喜好选择面型，手工拉制的过程本身，也是地方饮食技艺的鲜活展示。
          </p>
          <div class="inline-notice">正式条目的非遗级别、批次与来源链接需对照官方名录核验后接入。</div>
        </div>
      </article></template
    >
    <template v-else-if="route.path === '/learn'"
      ><div class="learning-progress">
        <AppIcon name="book" :size="22" />
        <div>
          <strong>一点点积累，都会算数。</strong>
          <p>已收藏 {{ state.favorites.length }} 首诗 · 已掌握 {{ state.mastered.length }} 个单词</p>
        </div>
      </div>
      <div class="content-grid learning-grid"><PoemCard expanded /><WordCard expanded /></div>
      <article v-if="state.mastered.length" class="card mastered-list">
        <div class="card-head"><h2>已掌握的单词</h2></div>
        <div class="tag-cloud">
          <span v-for="word in state.mastered" :key="word" class="pill mint">{{ word }}</span>
        </div>
      </article></template
    >
    <template v-else-if="route.path === '/digital'"
      ><div class="toolbar">
        <div class="filter-tabs standalone">
          <button :class="{ active: deviceTab === 'phone' }" @click="deviceTab = 'phone'">手机</button
          ><button :class="{ active: deviceTab === 'laptop' }" @click="deviceTab = 'laptop'">电脑</button>
        </div>
        <span class="muted">{{
          content.files.digital ? '采集快照：' + content.files.digital.date : '尚未采集'
        }}</span>
      </div>
      <SourceStatus module="digital" />
      <div class="content-grid">
        <article
          v-for="device in devices.filter((d) => d.type === deviceTab)"
          :key="device.model"
          class="card device-card"
        >
          <div class="device-illustration">
            <div v-if="device.type === 'phone'" class="phone-shape"><i></i></div>
            <div v-else class="laptop-shape"><i></i></div>
          </div>
          <div class="device-copy">
            <span class="pill subtle">{{ device.tag }}</span>
            <h2>{{ device.model }}</h2>
            <p>{{ device.config }}</p>
            <div class="device-price"><small>¥</small>{{ device.priceRange || device.price }}</div>
            <p>{{ device.detail }}</p>
            <a
              v-if="device.url"
              :href="device.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-button"
              >查看产品与报价来源<AppIcon name="external" :size="15"
            /></a>
          </div>
        </article>
      </div>
      <p class="disclaimer">
        {{ content.files.digital?.notice || '暂无采集结果，当前设备为草图示例。' }}
      </p></template
    >
  </div>
</template>
