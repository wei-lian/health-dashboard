<script setup>
import { state, persist, notify, sync } from '../stores/local-store.js'
import { localDate } from '../utils/health.js'
const kind = ref('')
const editing = ref(null)
const tab = ref('sports')
const pendingDelete = ref('')
const period = ref('week')
const items = computed(() => [...state[tab.value]].sort((a, b) => b.date.localeCompare(a.date)))
const deleting = ref('')
const days = computed(() =>
  Array.from({ length: period.value === 'week' ? 7 : 30 }, (_, n) => {
    const date = new Date()
    date.setDate(date.getDate() - ((period.value === 'week' ? 7 : 30) - 1 - n))
    const key = localDate(date)
    return {
      date: key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      value: state.sports.filter((item) => item.date === key).reduce((sum, item) => sum + item.duration, 0),
    }
  }),
)
const total = computed(() => days.value.reduce((sum, day) => sum + day.value, 0))
const chartMax = computed(() => Math.max(60, ...days.value.map((day) => day.value)))

// 删除操作在行内二次确认，避免误删健康记录。
async function remove(id) {
  if (deleting.value) return
  deleting.value = id
  if (await persist({ [tab.value]: state[tab.value].filter((item) => item.id !== id) })) {
    pendingDelete.value = ''
    notify('记录已删除')
  }
  deleting.value = ''
}
// 编辑弹窗复用录入表单。
function edit(item) {
  editing.value = item
  kind.value = tab.value === 'sports' ? 'sport' : 'sleep'
}
function open(value) {
  editing.value = null
  kind.value = value
}
// 关闭表单并清空编辑目标。
function close() {
  kind.value = ''
  editing.value = null
}
</script>

<template>
  <div>
    <div class="toolbar">
      <div class="soft-note">
        <AppIcon name="shield" :size="17" />{{
          sync.mode === 'browser'
            ? '记录保存在当前浏览器，请定期下载备份'
            : '记录自动保存到电脑文件，跨浏览器同步'
        }}
      </div>
      <div class="button-group">
        <button class="button secondary" @click="open('sleep')">
          <AppIcon name="moon" :size="17" />记录睡眠</button
        ><button class="button primary" @click="open('sport')">
          <AppIcon name="plus" :size="17" />记一笔运动
        </button>
      </div>
    </div>
    <HealthSummary @record="open" />
    <div class="content-grid">
      <div class="dashboard-column">
        <article class="card">
          <div class="card-head">
            <h2>运动趋势</h2>
            <div class="segmented">
              <button :class="{ active: period === 'week' }" @click="period = 'week'">近 7 天</button
              ><button :class="{ active: period === 'month' }" @click="period = 'month'">近 30 天</button>
            </div>
          </div>
          <div class="chart-summary">
            <strong>{{ total }}</strong> 分钟<span
              >记录折算日均 {{ Math.round(total / days.length) }} 分钟 · 打卡
              {{ days.filter((d) => d.value > 0).length }} 天</span
            >
          </div>
          <svg
            class="trend-chart"
            viewBox="0 0 600 200"
            role="img"
            :aria-label="`近 ${days.length} 天运动总时长 ${total} 分钟`"
          >
            <line
              v-for="y in [35, 75, 115, 155]"
              :key="y"
              x1="20"
              :y1="y"
              x2="580"
              :y2="y"
              stroke="#e9ede6"
              stroke-dasharray="3 4"
            />
            <g v-for="(day, n) in days" :key="day.date">
              <rect
                :x="22 + (n * 560) / days.length"
                :y="155 - (day.value / chartMax) * 120"
                :width="Math.min(32, 440 / days.length)"
                :height="Math.max(2, (day.value / chartMax) * 120)"
                rx="3"
                :fill="day.value ? '#46856b' : '#e6ece3'"
              >
                <title>{{ day.date }} · {{ day.value }} 分钟</title>
              </rect>
              <text
                v-if="days.length === 7 || n % 5 === 0"
                :x="22 + (n * 560) / days.length"
                y="183"
                fill="#899388"
                font-size="11"
              >
                {{ day.label }}
              </text>
            </g>
          </svg>
          <div v-if="total === 0" class="chart-empty-label">还没有运动记录，记下第一次出发吧。</div>
        </article>
        <SleepTrend :records="state.sleeps" />
      </div>
      <HealthInsights />
    </div>
    <article class="card records-table">
      <div class="card-head">
        <h2>我的记录</h2>
        <div class="segmented">
          <button :class="{ active: tab === 'sports' }" @click="tab = 'sports'">运动</button
          ><button :class="{ active: tab === 'sleeps' }" @click="tab = 'sleeps'">睡眠</button>
        </div>
      </div>
      <div v-if="!items.length" class="empty-state">
        <span class="mini-icon mint"
          ><AppIcon :name="tab === 'sports' ? 'activity' : 'moon'" :size="26"
        /></span>
        <h3>你的日常，从第一条记录开始。</h3>
        <p>不用追求完美，记下来就是进步。</p>
        <button class="button secondary" @click="open(tab === 'sports' ? 'sport' : 'sleep')">
          添加第一条记录
        </button>
      </div>
      <div v-for="item in items" :key="item.id" class="record-row">
        <div>
          <strong>{{ item.date }}</strong>
          <p>
            {{ tab === 'sports' ? item.type + ' · ' + item.intensity : item.bed + ' → ' + item.wake
            }}<span v-if="item.note"> · {{ item.note }}</span>
          </p>
        </div>
        <strong>{{ item.duration }} <small>分钟</small></strong>
        <div class="button-group">
          <button class="text-button" @click="edit(item)">编辑</button
          ><template v-if="pendingDelete === item.id"
            ><button
              class="text-button danger"
              :disabled="sync.saving || !sync.online"
              :aria-busy="deleting === item.id"
              @click="remove(item.id)"
            >
              <AppIcon v-if="deleting === item.id" name="refresh" class="spinning" :size="15" />{{
                deleting === item.id ? '正在删除…' : '确认删除'
              }}</button
            ><button class="text-button" @click="pendingDelete = ''">取消</button></template
          ><button v-else class="text-button muted" @click="pendingDelete = item.id">删除</button>
        </div>
      </div>
    </article>
    <p class="disclaimer">
      建议依据实际填写的记录和一般成年人健康参考生成，不构成医疗诊断；持续失眠、明显疲劳或运动不适请就医。
    </p>
    <RecordDialog v-if="kind" :kind="kind" :record="editing" @close="close" />
  </div>
</template>
