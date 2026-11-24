<script setup>
import { state, sync, persist, notify } from '../stores/local-store.js'
const plan = reactive({ ...state.learningPlan })
const saving = ref(false)
watch(
  () => state.learningPlan,
  (value) => Object.assign(plan, value),
)
// 目标保存后立即影响学习队列与每日待办。
async function save() {
  if (saving.value) return
  saving.value = true
  try {
    if (await persist({ learningPlan: { ...plan } })) notify('每日学习目标已保存')
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <form class="card study-plan" @submit.prevent="save">
    <div>
      <span class="eyebrow">MY DAILY PLAN</span>
      <h2>每天一点，慢慢积累。</h2>
      <p class="muted">目标会自动汇入“我的待办”，学习记录同步更新进度。</p>
    </div>
    <div class="study-plan-fields">
      <label
        >每日新词 · 个<input v-model.number="plan.dailyNew" required type="number" min="1" max="200"
      /></label>
      <label
        >每日诗词 · 首<input v-model.number="plan.dailyPoems" required type="number" min="0" max="20"
      /></label>
      <label
        >每日听力 · 分钟<input v-model.number="plan.dailyListening" required type="number" min="0" max="300"
      /></label>
      <button class="button primary" :disabled="saving || sync.saving || !sync.online" :aria-busy="saving">
        {{ saving ? '保存中…' : '保存目标' }}
      </button>
    </div>
  </form>
</template>
