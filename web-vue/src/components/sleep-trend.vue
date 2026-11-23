<script setup>
import { localDate } from '../utils/health.js'
import { durationText } from '../utils/personal-insights.js'

const props = defineProps({ records: { type: Array, required: true } })
const period = ref(7)
const selectedDate = ref('')
const days = computed(() => {
  const records = new Map(props.records.map((record) => [record.date, record]))
  return Array.from({ length: period.value }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (period.value - 1 - index))
    const key = localDate(date)
    return {
      date: key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      record: records.get(key),
    }
  })
})
const recorded = computed(() => days.value.filter((day) => day.record))
const average = computed(() =>
  recorded.value.length
    ? Math.round(recorded.value.reduce((sum, day) => sum + day.record.duration, 0) / recorded.value.length)
    : null,
)
const chartMax = computed(
  () => Math.ceil(Math.max(720, ...recorded.value.map((day) => day.record.duration)) / 120) * 120,
)
const ticks = computed(() => [0, chartMax.value / 2, chartMax.value])
const selected = computed(() => days.value.find((day) => day.date === selectedDate.value))

// 共用分钟坐标，让实际时长与 7–9 小时参考区间使用同一比例。
function chartY(minutes) {
  return 170 - (minutes / chartMax.value) * 140
}

// 日期说明同时用于悬停提示、键盘阅读和点击后的详情。
function dayDescription(day) {
  return day.record
    ? `${day.date} · ${durationText(day.record.duration)} · ${day.record.bed} 入睡，${day.record.wake} 起床`
    : `${day.date} · 未记录`
}
</script>

<template>
  <article class="card sleep-trend">
    <div class="card-head">
      <h2>睡眠趋势</h2>
      <div class="segmented" role="group" aria-label="睡眠趋势时间范围">
        <button :class="{ active: period === 7 }" :aria-pressed="period === 7" @click="period = 7">
          近 7 天
        </button>
        <button :class="{ active: period === 30 }" :aria-pressed="period === 30" @click="period = 30">
          近 30 天
        </button>
      </div>
    </div>
    <div class="sleep-summary">
      <div>
        <span>平均睡眠</span>
        <p>
          <template v-if="average !== null">
            <strong>{{ Math.floor(average / 60) }}</strong> 小时 <strong>{{ average % 60 }}</strong> 分钟
          </template>
          <template v-else><strong>—</strong> 暂无记录</template>
        </p>
      </div>
      <span>已记录 {{ recorded.length }} / {{ period }} 晚</span>
    </div>
    <div class="sleep-legend">
      <span><i class="sleep-duration-key"></i>睡眠时长</span>
      <span><i class="sleep-reference-key"></i>成人参考 7–9 小时</span>
    </div>
    <div class="sleep-chart-scroll" :class="{ 'sleep-chart-month': period === 30 }">
      <svg
        class="sleep-chart"
        viewBox="0 0 600 210"
        role="group"
        :aria-label="`近 ${period} 天睡眠趋势，已记录 ${recorded.length} 晚，${average === null ? '暂无平均时长' : '平均 ' + durationText(average)}`"
      >
        <rect
          x="45"
          :y="chartY(540)"
          width="535"
          :height="chartY(420) - chartY(540)"
          class="sleep-reference"
        />
        <g v-for="tick in ticks" :key="tick">
          <line x1="45" :y1="chartY(tick)" x2="580" :y2="chartY(tick)" class="sleep-grid-line" />
          <text x="35" :y="chartY(tick) + 4" text-anchor="end" class="sleep-axis">{{ tick / 60 }}h</text>
        </g>
        <g
          v-for="(day, index) in days"
          :key="day.date"
          class="sleep-chart-day"
          tabindex="0"
          :aria-label="dayDescription(day)"
          @mouseenter="selectedDate = day.date"
          @focus="selectedDate = day.date"
          @click="selectedDate = day.date"
        >
          <title>{{ dayDescription(day) }}</title>
          <rect
            :x="45 + (index * 535) / period"
            y="20"
            :width="535 / period"
            height="155"
            class="sleep-hit-area"
          />
          <rect
            v-if="day.record"
            :x="45 + ((index + 0.5) * 535) / period - Math.min(16, 180 / period)"
            :y="chartY(day.record.duration)"
            :width="Math.min(32, 360 / period)"
            :height="170 - chartY(day.record.duration)"
            rx="3"
            class="sleep-bar"
          />
          <circle v-else :cx="45 + ((index + 0.5) * 535) / period" cy="170" r="2.5" class="sleep-missing" />
          <text
            v-if="period === 7 || index % 5 === 0 || index === period - 1"
            :x="45 + ((index + 0.5) * 535) / period"
            y="196"
            text-anchor="middle"
            class="sleep-axis"
          >
            {{ day.label }}
          </text>
        </g>
      </svg>
    </div>
    <p v-if="!recorded.length" class="chart-empty-label">
      这段时间还没有睡眠记录，记下一个好好休息的夜晚吧。
    </p>
    <p class="sleep-chart-detail" aria-live="polite">
      {{ selected ? dayDescription(selected) : '悬停或点按图表，查看每日睡眠详情。' }}
    </p>
    <p class="sleep-chart-note">按起床日统计，未记录日期不计入均值。</p>
  </article>
</template>

<style scoped>
.sleep-summary {
  display: flex;
  align-items: end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 18px 22px 0;
  color: #899388;
  font-size: 0.75rem;
}
.sleep-summary p {
  margin: 5px 0 0;
  color: #899388;
  font-size: 0.875rem;
}
.sleep-summary strong {
  color: #62879a;
  font-size: 2rem;
  font-weight: 500;
}
.sleep-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px 22px 0;
  color: #899388;
  font-size: 0.75rem;
}
.sleep-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.sleep-legend i {
  width: 9px;
  height: 9px;
  border-radius: 2px;
}
.sleep-duration-key,
.sleep-bar {
  fill: #7c9eaf;
  background: #7c9eaf;
}
.sleep-reference-key,
.sleep-reference {
  fill: #edf2e5;
  background: #edf2e5;
}
.sleep-chart-scroll {
  overflow-x: auto;
  margin: 0 12px;
}
.sleep-chart {
  display: block;
  width: 100%;
}
.sleep-chart-month .sleep-chart {
  min-width: 600px;
}
.sleep-axis {
  fill: #899388;
  font-size: 12px;
}
.sleep-grid-line {
  stroke: #e4eae5;
  stroke-dasharray: 3 4;
}
.sleep-missing {
  fill: #dce4e6;
}
.sleep-hit-area {
  fill: transparent;
}
.sleep-chart-day:hover .sleep-bar,
.sleep-chart-day:focus .sleep-bar {
  fill: #4f788d;
}
.sleep-chart-day:focus:not(:focus-visible) {
  outline: none;
}
.sleep-chart-detail,
.sleep-chart-note {
  margin: 0;
  padding: 0 22px 12px;
  color: #7e929b;
  font-size: 0.75rem;
  line-height: 1.8;
}
.sleep-chart-note {
  padding-bottom: 20px;
  color: #9da58d;
}
@media (max-width: 760px) {
  .sleep-chart-scroll:not(.sleep-chart-month) .sleep-axis {
    font-size: 18px;
  }
}
</style>
