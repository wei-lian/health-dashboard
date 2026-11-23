<script setup>
import { state } from '../stores/local-store.js'
import { generateInsights, durationText } from '../utils/personal-insights.js'
const now = ref(new Date())
const dayTimer = setInterval(() => {
  now.value = new Date()
}, 30000)
onUnmounted(() => clearInterval(dayTimer))
const insights = computed(() => generateInsights(state, now.value))
</script>
<template>
  <article class="card health-insights">
    <div class="card-head">
      <h2><AppIcon name="activity" :size="19" />基于我的记录生成建议</h2>
      <span class="pill mint">保存后自动更新</span>
    </div>
    <div class="insights-body">
      <p class="insights-period">{{ insights.start }} — {{ insights.end }} · 近 7 天</p>
      <div class="insight-metrics">
        <div>
          <strong>{{ insights.sportMinutes }}<small> 分钟</small></strong
          ><span>已记录 {{ insights.activeDays }} 天运动</span>
        </div>
        <div>
          <strong>{{ insights.sleepNights }}<small> / 7 晚</small></strong
          ><span>实际睡眠记录覆盖</span>
        </div>
        <div>
          <strong>{{
            insights.averageSleep === null ? '—' : durationText(insights.averageSleep)
          }}</strong><span>已记录夜晚平均时长</span>
        </div>
      </div>
      <div class="insight-list">
        <section
          v-for="item in insights.recommendations"
          :key="item.id"
          class="insight-item"
          :class="{ attention: item.tone === 'attention' }"
        >
          <h3>{{ item.title }}</h3>
          <p class="insight-evidence">依据：{{ item.evidence }}</p>
          <p>{{ item.action }}</p>
        </section>
      </div>
      <p class="insight-method">
        建议由本机规则根据你的真实记录即时计算，不调用外部
        AI，不补齐缺失数据。按一般成年人提供参考；年龄、疾病、轮班等情况可能需要不同目标。记录总时长不等同于指南达标评估。
      </p>
      <div class="insight-sources">
        <a
          href="https://www.who.int/news-room/fact-sheets/detail/physical-activity"
          target="_blank"
          rel="noopener noreferrer"
          >WHO 身体活动参考</a
        ><a
          href="https://www.nhs.uk/live-well/sleep-and-tiredness/how-to-get-to-sleep/"
          target="_blank"
          rel="noopener noreferrer"
          >NHS 成人睡眠参考</a
        >
      </div>
    </div>
  </article>
</template>
