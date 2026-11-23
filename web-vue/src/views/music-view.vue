<script setup>
import { content, songs } from '../stores/content-store.js'
const mode = ref('daily'),
  month = ref('')
const data = computed(() => content.files.songRank)
const months = computed(() =>
  Object.keys(data.value?.monthly || {})
    .sort()
    .reverse(),
)
watch(
  months,
  (values) => {
    if (!values.includes(month.value)) month.value = values[0] || ''
  },
  { immediate: true },
)
const list = computed(() =>
  mode.value === 'daily'
    ? songs
    : mode.value === 'monthly'
      ? data.value?.monthly?.[month.value] || []
      : data.value?.yearlyTop100 || [],
)
</script>

<template>
  <article class="card">
    <div class="card-head">
      <h2><AppIcon name="music" :size="19" />热歌与试听</h2>
      <div class="segmented">
        <button
          v-for="(label, key) in { daily: '每日 Top 10', monthly: '月度累计', yearly: '年度累计' }"
          :key="key"
          :class="{ active: mode === key }"
          @click="mode = key"
        >
          {{ label }}
        </button>
      </div>
    </div>
    <SourceStatus module="songRank" />
    <div class="music-toolbar">
      <div>
        <h3>
          {{
            mode === 'daily'
              ? '这一刻，发现好旋律'
              : mode === 'monthly'
                ? '每个月，都有一首记忆'
                : '这一年，值得记住的声音'
          }}
        </h3>
        <p>
          {{
            mode === 'daily'
              ? `快照日期 ${data?.date || '尚未采集'}`
              : `本机从 ${data?.startedAt || '首次采集'} 开始累计`
          }}
        </p>
      </div>
      <label v-if="mode === 'monthly'" class="inline-label"
        >月份<select v-model="month">
          <option v-for="value in months" :key="value" :value="value">{{ value }}</option>
        </select></label
      >
    </div>
    <SongList v-if="list.length" :songs="list" large />
    <div v-else class="empty-state">
      <h3>这个时间段还没有采集记录</h3>
      <p>每日运行后会逐步积累，不会补造历史数据。</p>
    </div>
    <div class="inline-notice">
      {{ data?.notice || '榜单尚未生成，请先运行 npm run crawler。'
      }}<br />带播放按钮的歌曲可以在本页试听；灰色按钮表示平台暂未提供片段，可用右侧链接打开平台。
    </div>
  </article>
</template>
