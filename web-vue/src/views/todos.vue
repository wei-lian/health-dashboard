<script setup>
import { state, persist, sync, notify } from '../stores/local-store.js'
import {
  learningToday,
  todayStudy,
  listeningMinutes,
  reviewQueue,
  loadVocabulary,
  library,
} from '../stores/learning-store.js'
const labels = { personal: '个人事项', words: '单词', poetry: '诗歌', listening: '听力' }
const filter = ref('all')
const saving = ref(false)
const deleting = ref('')
const editing = ref('')
const form = reactive({
  title: '',
  category: 'personal',
  date: learningToday.value,
  target: 1,
  completed: 0,
  note: '',
})
const autoTasks = computed(() => {
  const reviewed = todayStudy.value.reviewedWords
  const due = reviewQueue.value
  return [
    {
      title: '今日单词 · 学习新词',
      category: 'words',
      current: todayStudy.value.newWords.length,
      target: state.learningPlan.dailyNew,
      path: '/words',
      unit: '个',
    },
    {
      title: '单词复习 · 巩固记忆',
      category: 'words',
      current: reviewed.length,
      target: new Set([...reviewed, ...due.map((w) => w.w)]).size,
      path: '/words?mode=review',
      unit: '个',
    },
    {
      title: '读一首诗 · 留一点诗意',
      category: 'poetry',
      current: todayStudy.value.poems.length,
      target: state.learningPlan.dailyPoems,
      path: '/learn',
      unit: '首',
    },
    {
      title: '英语听力 · 每日练习',
      category: 'listening',
      current: listeningMinutes.value,
      target: state.learningPlan.dailyListening,
      path: '/listening',
      unit: '分钟',
    },
  ].filter((i) => i.target > 0)
})
const ownTasks = computed(() => [...state.todos].sort((a, b) => a.date.localeCompare(b.date)))
const visibleTasks = computed(() =>
  ownTasks.value.filter(
    (i) =>
      filter.value === 'all' ||
      (filter.value === 'done'
        ? i.completed >= i.target
        : filter.value === 'pending'
          ? i.completed < i.target
          : i.category === filter.value),
  ),
)
const dueToday = computed(() => state.todos.filter((i) => i.date <= learningToday.value))
const doneCount = computed(
  () =>
    autoTasks.value.filter((i) => i.current >= i.target).length +
    dueToday.value.filter((i) => i.completed >= i.target).length,
)
onMounted(loadVocabulary)
// 新建与编辑共享表单，失败不清空用户输入。
async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const item = { ...form, title: form.title.trim(), id: editing.value || crypto.randomUUID() }
    if (await persist({ todos: [...state.todos.filter((i) => i.id !== item.id), item] })) {
      reset()
      notify('待办事项已保存')
    }
  } finally {
    saving.value = false
  }
}
// 清理编辑上下文，日期默认保持今天。
function reset() {
  editing.value = ''
  Object.assign(form, {
    title: '',
    category: 'personal',
    date: learningToday.value,
    target: 1,
    completed: 0,
    note: '',
  })
}
// 把已有待办带入表单，可调整名称、日期、目标和完成量。
function edit(item) {
  editing.value = item.id
  Object.assign(form, item)
  document.getElementById('todo-title')?.focus()
}
// 完成按钮只改变自定义事项，自动学习任务必须从对应学习页面产生记录。
async function toggle(item) {
  if (saving.value) return
  saving.value = true
  try {
    if (
      await persist({
        todos: state.todos.map((i) =>
          i.id === item.id ? { ...i, completed: i.completed >= i.target ? 0 : i.target } : i,
        ),
      })
    )
      notify('待办进度已更新')
  } finally {
    saving.value = false
  }
}
// 删除前要求行内确认，不影响其他记录。
async function remove(id) {
  if (saving.value) return
  saving.value = true
  try {
    if (await persist({ todos: state.todos.filter((i) => i.id !== id) })) {
      deleting.value = ''
      if (editing.value === id) reset()
      notify('待办已删除')
    }
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <div class="study-space">
    <div class="study-banner">
      <div>
        <span class="eyebrow">MAKE ROOM FOR WHAT MATTERS</span>
        <h2>我的待办，把今天安排好。</h2>
        <p>{{ learningToday }} · 单词、诗歌、听力和自己的小事</p>
      </div>
      <div class="study-banner-count">
        <strong>{{ doneCount }}</strong><span>/ {{ autoTasks.length + dueToday.length }} 项 · 截至今日</span>
      </div>
    </div>
    <article class="card study-panel">
      <div class="study-word-top">
        <h2>每日学习清单</h2>
        <RouterLink class="text-button" to="/words"
          >调整学习目标<AppIcon name="next" :size="16"
        /></RouterLink>
      </div>
      <p class="muted">在学习页面完成后自动更新，无需重复打卡。</p>
      <p v-if="library.loading" class="muted" role="status">正在读取单词复习安排…</p>
      <p v-if="library.error" role="alert">
        复习安排暂时无法读取：{{ library.error }}
        <button class="text-button" @click="loadVocabulary">重试</button>
      </p>
      <div class="auto-task-grid">
        <RouterLink
          v-for="task in autoTasks"
          :key="task.title"
          :to="task.path"
          class="auto-task"
          :class="{ done: task.current >= task.target }"
          ><AppIcon
            :name="
              task.current >= task.target ? 'success' : task.category === 'listening' ? 'volume' : 'book'
            "
            :size="23" />
          <div>
            <strong>{{ task.title }}</strong>
            <p>
              {{ task.current }} / {{ task.target }} {{ task.unit }} ·
              {{ task.current >= task.target ? '已完成' : '去完成' }}
            </p>
            <progress :value="Math.min(task.current, task.target)" :max="task.target"></progress>
          </div>
          <AppIcon name="next" :size="16"
        /></RouterLink>
      </div>
    </article>
    <form class="card study-panel" @submit.prevent="save">
      <h2>{{ editing ? '编辑待办事项' : '添加我的待办' }}</h2>
      <div class="study-form-grid">
        <label
          >事项名称<input
            id="todo-title"
            v-model="form.title"
            required
            maxlength="200"
            placeholder="例如背诵静夜思、整理房间、练习一课听力" /></label
        ><label
          >分类<select v-model="form.category">
            <option v-for="(label, key) in labels" :key="key" :value="key">{{ label }}</option>
          </select></label
        ><label>计划日期<input v-model="form.date" type="date" required /></label
        ><label
          >目标数量<input v-model.number="form.target" required type="number" min="1" max="10000" /></label
        ><label
          >已完成数量<input
            v-model.number="form.completed"
            required
            type="number"
            min="0"
            :max="form.target" /></label
        ><label>备注<input v-model="form.note" maxlength="2000" placeholder="内容、单位或执行安排" /></label>
      </div>
      <div class="button-group">
        <button class="button primary" :disabled="saving || sync.saving || !sync.online" :aria-busy="saving">
          {{ saving ? '保存中…' : editing ? '保存修改' : '添加待办' }}</button><button
          v-if="editing"
          type="button"
          class="button secondary"
          :disabled="saving"
          @click="reset"
        >
          取消编辑
        </button>
      </div>
    </form>
    <article class="card study-panel">
      <div class="study-word-top">
        <h2>我的事项 · {{ state.todos.length }}</h2>
        <select v-model="filter" aria-label="筛选待办">
          <option value="all">全部事项</option>
          <option value="pending">未完成</option>
          <option value="done">已完成</option>
          <option v-for="(label, key) in labels" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
      <p v-if="!visibleTasks.length" class="study-empty">暂无符合条件的待办，给今天添加一件小事吧。</p>
      <div
        v-for="item in visibleTasks"
        :key="item.id"
        class="study-record"
        :class="{ 'todo-done': item.completed >= item.target }"
      >
        <button
          class="todo-checkbox"
          :disabled="saving || sync.saving || !sync.online"
          :aria-label="(item.completed >= item.target ? '重新打开：' : '完成：') + item.title"
          :aria-pressed="item.completed >= item.target"
          @click="toggle(item)"
        >
          <AppIcon v-if="item.completed >= item.target" name="check" :size="18" />
        </button>
        <div class="todo-copy">
          <strong>{{ item.title }}</strong>
          <p class="muted">
            {{ labels[item.category] }} · {{ item.date }} · {{ item.completed }} / {{ item.target
            }}<span v-if="item.date < learningToday && item.completed < item.target" class="todo-overdue">
              · 已逾期</span
            >
          </p>
          <p v-if="item.note">{{ item.note }}</p>
        </div>
        <div class="button-group">
          <button class="text-button" :disabled="saving" @click="edit(item)">编辑</button
          ><template v-if="deleting === item.id"
            ><button
              class="text-button"
              :disabled="saving || sync.saving || !sync.online"
              @click="remove(item.id)"
            >
              确认删除</button
            ><button class="text-button" :disabled="saving" @click="deleting = ''">取消</button></template
          ><button v-else class="text-button muted" @click="deleting = item.id">删除</button>
        </div>
      </div>
    </article>
  </div>
</template>
