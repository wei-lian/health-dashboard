<script setup>
import { listeningLessons } from '../data/listening.js'
import { state, sync, persist, notify } from '../stores/local-store.js'
import { learningToday, listeningMinutes } from '../stores/learning-store.js'
import { pronounce, playback, stopAudio } from '../stores/audio-store.js'
const selected = ref(listeningLessons[0])
const transcript = ref(false)
const slow = ref(false)
const saving = ref(false)
const deleting = ref('')
const form = reactive({
  title: selected.value.title,
  date: learningToday.value,
  minutes: 1,
  source: '本地编辑短文 · 系统英语语音',
  note: '',
})
const logs = computed(() => [...state.listeningLogs].sort((a, b) => b.date.localeCompare(a.date)))
// 切换练习时停止旧语音，记录表单带入实际选择的内容。
function selectLesson(lesson) {
  stopAudio()
  selected.value = lesson
  transcript.value = false
  form.title = lesson.title
  form.source = '本地编辑短文 · 系统英语语音'
}
// 完成量由用户按实际练习登记，播放按钮不会自动虚增分钟数。
async function save() {
  if (saving.value) return
  saving.value = true
  try {
    if (
      await persist({
        listeningLogs: [
          ...state.listeningLogs,
          { ...form, title: form.title.trim(), id: crypto.randomUUID() },
        ],
      })
    ) {
      notify('听力记录已保存，待办进度已更新')
      form.note = ''
    }
  } finally {
    saving.value = false
  }
}
// 删除前展示明确确认，误记的听力量可从当天进度扣回。
async function remove(id) {
  if (saving.value) return
  saving.value = true
  try {
    if (await persist({ listeningLogs: state.listeningLogs.filter((i) => i.id !== id) })) {
      deleting.value = ''
      notify('已删除听力记录')
    }
  } finally {
    saving.value = false
  }
}
onUnmounted(stopAudio)
</script>
<template>
  <div class="study-space">
    <div class="study-banner">
      <div>
        <span class="eyebrow">LISTEN A LITTLE EVERY DAY</span>
        <h2>听见语境，让英语慢慢熟悉。</h2>
        <p>先听，再跟读，最后记录今天的练习。</p>
      </div>
      <div class="study-banner-count">
        <strong>{{ listeningMinutes }}</strong><span
          >/ {{ state.learningPlan.dailyListening }} 分钟 · 今日</span
        >
      </div>
    </div>
    <div class="study-two-columns">
      <article class="card study-panel">
        <h2>听什么？</h2>
        <p class="muted">6 篇本地短文 · 浏览器英语合成语音</p>
        <div class="lesson-list">
          <button
            v-for="lesson in listeningLessons"
            :key="lesson.id"
            :class="{ selected: selected.id === lesson.id }"
            @click="selectLesson(lesson)"
          >
            <AppIcon name="volume" :size="20" /><span
              ><strong>{{ lesson.title }}</strong
              ><small>{{ lesson.level }} · {{ lesson.text.split(' ').length }} 词</small></span
            ><AppIcon name="next" :size="16" />
          </button>
        </div>
      </article>
      <article class="card study-panel">
        <span class="pill mint">{{ selected.level }} · 听力练习</span>
        <h2>{{ selected.title }}</h2>
        <p class="muted">可以重复精听、跟读；支持自行记录播客、课程等其他内容。</p>
        <div class="button-group">
          <button
            class="button primary"
            :disabled="playback.loading"
            @click="pronounce({ w: selected.id, eg: selected.text }, { example: true, slow })"
          >
            <AppIcon :name="playback.loading ? 'refresh' : 'play'" :size="17" />{{
              playback.loading ? '准备语音…' : '播放短文'
            }}</button
          ><button class="button secondary" @click="stopAudio">停止</button
          ><label class="study-check"><input v-model="slow" type="checkbox" />慢速播放</label>
        </div>
        <button class="text-button" @click="transcript = !transcript">
          {{ transcript ? '收起原文和译文' : '查看原文和译文' }}
        </button>
        <div v-if="transcript" class="study-transcript">
          <p lang="en">{{ selected.text }}</p>
          <p>{{ selected.translation }}</p>
        </div>
        <p class="study-footnote">语音需要浏览器提供英语声线；播放失败会提示。练习时长按实际完成量填写。</p>
      </article>
    </div>
    <form class="card study-panel" @submit.prevent="save">
      <h2>记录我的听力</h2>
      <div class="study-form-grid">
        <label
          >听了什么<input
            v-model="form.title"
            required
            maxlength="200"
            placeholder="短文、播客、课程名称" /></label
        ><label>日期<input v-model="form.date" type="date" required /></label
        ><label
          >完成时长 · 分钟<input
            v-model.number="form.minutes"
            required
            type="number"
            min="1"
            max="600" /></label
        ><label
          >内容来源<input v-model="form.source" maxlength="1000" placeholder="平台、链接或本地内容" /></label
        ><label class="study-full"
          >收获与笔记<textarea
            v-model="form.note"
            rows="2"
            maxlength="2000"
            placeholder="记录听懂了什么、还想再练什么。"
          ></textarea>
        </label>
      </div>
      <button class="button primary" :disabled="saving || sync.saving || !sync.online" :aria-busy="saving">
        {{ saving ? '保存中…' : '保存听力记录' }}
      </button>
    </form>
    <article class="card study-panel">
      <h2>练习记录 · {{ logs.length }} 条</h2>
      <p v-if="!logs.length" class="study-empty">还没有听力记录，完成一次练习后记下来吧。</p>
      <div v-for="log in logs.slice(0, 100)" :key="log.id" class="study-record">
        <div>
          <strong>{{ log.title }}</strong>
          <p class="muted">{{ log.date }} · {{ log.minutes }} 分钟 · {{ log.source }}</p>
          <p>{{ log.note }}</p>
        </div>
        <div class="button-group">
          <template v-if="deleting === log.id"
            ><button
              class="text-button"
              :disabled="saving || sync.saving || !sync.online"
              @click="remove(log.id)"
            >
              确认删除</button
            ><button class="text-button" :disabled="saving" @click="deleting = ''">取消</button></template
          ><button v-else class="text-button muted" @click="deleting = log.id">删除</button>
        </div>
      </div>
      <p v-if="logs.length > 100" class="muted">显示最近 100 条，全部记录已纳入备份。</p>
    </article>
  </div>
</template>
