<script setup>
import {
  library,
  loadVocabulary,
  newQueue,
  reviewQueue,
  todayStudy,
  rateWord,
  learningToday,
} from '../stores/learning-store.js'
import { state, sync, persist, notify } from '../stores/local-store.js'
import { pronounce, playback, stopAudio } from '../stores/audio-store.js'
const route = useRoute()
const mode = ref(['new', 'review', 'library'].includes(route.query.mode) ? route.query.mode : 'new')
watch(
  () => route.query.mode,
  (value) => {
    if (['new', 'review', 'library'].includes(value)) mode.value = value
  },
)
const keyword = ref('')
const page = ref(1)
const selected = ref(null)
const revealed = ref(false)
const sentence = ref('')
const saving = ref(false)
const queue = computed(() => (mode.value === 'review' ? reviewQueue.value : newQueue.value))
const word = computed(() => (mode.value === 'library' ? selected.value : queue.value[0]))
const previous = computed(() => state.wordProgress.find((i) => i.word === word.value?.w))
const matches = computed(() =>
  library.words.filter(
    (w) =>
      !keyword.value.trim() || `${w.w} ${w.cn}`.toLowerCase().includes(keyword.value.trim().toLowerCase()),
  ),
)
const pages = computed(() => Math.max(1, Math.ceil(matches.value.length / 30)))
const visibleWords = computed(() => matches.value.slice((page.value - 1) * 30, page.value * 30))
watch(keyword, () => {
  page.value = 1
})
watch(
  () => [word.value?.w, mode.value, learningToday.value],
  () => {
    revealed.value = mode.value === 'library'
    sentence.value = previous.value?.sentence || ''
  },
)
onMounted(loadVocabulary)
onUnmounted(stopAudio)
// 评分和个人造句共同写入文件，失败时保留当前卡片。
async function rate(rating) {
  if (saving.value || !word.value) return
  saving.value = true
  try {
    const current = word.value.w
    if (await rateWord(current, rating, sentence.value.trim())) {
      stopAudio()
      revealed.value = false
      sentence.value = state.wordProgress.find((i) => i.word === word.value?.w)?.sentence || ''
      notify(rating === 'again' ? '已加入今日复习，请到复习页再练一次' : '已记录，下次复习已安排')
    }
  } finally {
    saving.value = false
  }
}
// 已学单词可在词库中单独修改造句，不重复计算学习量。
async function saveSentence() {
  if (saving.value || !previous.value) return
  saving.value = true
  try {
    if (
      await persist({
        wordProgress: state.wordProgress.map((i) =>
          i.word === word.value.w ? { ...i, sentence: sentence.value.trim() } : i,
        ),
      })
    )
      notify('个人造句已保存')
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <div class="study-space">
    <LearningPlan />
    <div class="study-metrics">
      <article>
        <span>今日新词</span
        ><strong
          >{{ todayStudy.newWords.length }} <small>/ {{ state.learningPlan.dailyNew }}</small></strong
        >
      </article>
      <article>
        <span>到期复习</span><strong>{{ reviewQueue.length }} <small>个</small></strong>
      </article>
      <article>
        <span>累计学习</span><strong>{{ state.wordProgress.length }} <small>个</small></strong>
      </article>
      <article>
        <span>本地词库</span><strong>{{ library.words.length.toLocaleString() }} <small>个</small></strong>
      </article>
    </div>
    <div class="filter-tabs standalone">
      <button :class="{ active: mode === 'new' }" @click="mode = 'new'">学习新词</button>
      <button :class="{ active: mode === 'review' }" @click="mode = 'review'">
        到期复习 · {{ reviewQueue.length }}
      </button>
      <button :class="{ active: mode === 'library' }" @click="mode = 'library'">全部词库</button>
    </div>
    <p v-if="library.loading" class="card study-empty" role="status">正在读取本地词库…</p>
    <div v-else-if="library.error" class="card study-empty" role="alert">
      {{ library.error }}<button class="button secondary" @click="loadVocabulary">重新读取</button>
    </div>
    <template v-else>
      <div v-if="mode === 'library'" class="card study-library">
        <label class="study-search"
          ><AppIcon name="search" :size="18" /><input
            v-model="keyword"
            type="search"
            placeholder="搜索英文或中文释义"
            aria-label="搜索词库"
        /></label>
        <div class="word-library-grid">
          <button
            v-for="item in visibleWords"
            :key="item.w"
            :class="{ selected: word?.w === item.w }"
            @click="selected = item"
          >
            <strong>{{ item.w }}</strong><span>{{ item.cn }}</span>
          </button>
        </div>
        <p v-if="!matches.length" class="study-empty">没有找到匹配的单词。</p>
        <div class="study-pagination">
          <button class="button secondary" :disabled="page === 1" @click="page--">上一页</button
          ><span>共 {{ matches.length }} 词 · {{ page }} / {{ pages }}</span
          ><button class="button secondary" :disabled="page >= pages" @click="page++">下一页</button>
        </div>
      </div>
      <article v-if="word" class="card study-word" :aria-busy="saving">
        <div class="study-word-top">
          <span class="pill mint">{{
            mode === 'review' ? '间隔复习' : mode === 'library' ? '词条详情' : '今日新词'
          }}</span><span class="muted">{{ word.book }}</span>
        </div>
        <h2>{{ word.w }}</h2>
        <p class="phonetic">
          美 /{{ word.usphone || word.phonetic }}/ · 英 /{{ word.ukphone || word.phonetic }}/
        </p>
        <div class="button-group">
          <button class="text-button" :disabled="playback.loading" @click="pronounce(word)">
            <AppIcon name="volume" :size="17" />朗读单词</button
          ><button class="text-button" :disabled="playback.loading" @click="pronounce(word, { slow: true })">
            慢速
          </button>
        </div>
        <button v-if="!revealed" class="button primary reveal-button" @click="revealed = true">
          想好了吗？查看释义与例句
        </button>
        <div v-else class="study-answer">
          <p class="study-definition">{{ word.cn }}</p>
          <div v-for="(example, index) in word.sentences" :key="index" class="study-example">
            <p>{{ example.en }}</p>
            <small>{{ example.cn }}</small>
          </div>
          <button
            class="text-button"
            :disabled="playback.loading"
            @click="pronounce(word, { example: true })"
          >
            <AppIcon name="volume" :size="16" />朗读例句
          </button>
          <div v-if="word.detail.phrase?.phrases?.length" class="study-example">
            <strong>常用搭配</strong>
            <p v-for="phrase in word.detail.phrase.phrases.slice(0, 6)" :key="phrase.pContent">
              {{ phrase.pContent }} · {{ phrase.pCn }}
            </p>
          </div>
          <p v-if="word.detail.remMethod?.val" class="memory-note">
            记忆提示：{{ word.detail.remMethod.val }}
          </p>
          <label class="study-sentence"
            >我的造句<textarea
              v-model="sentence"
              rows="3"
              maxlength="2000"
              placeholder="试着用这个单词写一句英文，随学习记录一起保存。"
            ></textarea>
          </label>
          <p v-if="previous" class="muted">
            已练习 {{ previous.attempts }} 次 · 下次复习 {{ previous.nextReview }} · 熟悉度
            {{ previous.level }}/5
          </p>
          <div class="button-group">
            <template v-if="mode !== 'library'"
              ><button
                class="button secondary"
                :disabled="saving || sync.saving || !sync.online"
                @click="rate('again')"
              >
                {{ saving ? '保存中…' : '没记住 · 今日再练' }}</button
              ><button
                class="button primary"
                :disabled="saving || sync.saving || !sync.online"
                @click="rate('remember')"
              >
                {{ saving ? '保存中…' : '记住了 · 下一个' }}
              </button></template
            >
            <button
              v-else-if="previous"
              class="button primary"
              :disabled="saving || sync.saving || !sync.online"
              @click="saveSentence"
            >
              {{ saving ? '保存中…' : '保存我的造句' }}
            </button>
            <button
              v-else
              class="button primary"
              :disabled="
                saving ||
                sync.saving ||
                !sync.online ||
                todayStudy.newWords.length >= state.learningPlan.dailyNew
              "
              @click="rate('remember')"
            >
              记录学习与造句
            </button>
          </div>
        </div>
      </article>
      <div v-else-if="mode !== 'library'" class="card study-empty">
        <AppIcon name="success" :size="34" />
        <h2>{{ mode === 'review' ? '本轮到期复习已完成' : '今日新词目标已完成' }}</h2>
        <p>随时到词库查看释义和造句，也可以调整每日目标。</p>
        <button class="button secondary" @click="mode = mode === 'new' ? 'review' : 'library'">
          {{ mode === 'new' ? '去复习' : '浏览词库' }}
        </button>
      </div>
      <p class="study-footnote">
        {{ library.source }} ·
        音标、释义、双语例句及上游补充信息均保存在项目文件中。朗读使用浏览器英语语音；个人造句由自己练习填写。
      </p>
    </template>
  </div>
</template>
