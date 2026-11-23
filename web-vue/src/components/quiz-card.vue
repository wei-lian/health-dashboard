<script setup>
import { quizzes } from '../stores/content-store.js'
import { state, persist, sync } from '../stores/local-store.js'
const index = ref(0)
const answering = ref(-1)
const quiz = computed(() => quizzes[index.value])
const picked = computed(() => state.answers[quiz.value.id])
const score = computed(() => quizzes.filter((q) => state.answers[q.id] === q.answer).length)
const answered = computed(() => quizzes.filter((q) => state.answers[q.id] !== undefined).length)
watch(
  () => quizzes.map((q) => q.id).join(','),
  () => {
    index.value = 0
  },
)
// 同一道示例题只提交一次，结果与解析即时保存到本地。
async function answer(option) {
  if (picked.value !== undefined || answering.value !== -1) return
  answering.value = option
  try {
    await persist({ answers: { ...state.answers, [quiz.value.id]: option } })
  } finally {
    answering.value = -1
  }
}
</script>

<template>
  <article class="card quiz-card">
    <div class="card-head">
      <h2><AppIcon name="help" :size="18" />每日三题</h2>
      <span class="tiny-label">{{ index + 1 }} / 3</span>
    </div>
    <SourceStatus module="quiz" />
    <div class="quiz-content">
      <span class="pill mint">{{ quiz.category }}</span>
      <h3>{{ quiz.question }}</h3>
      <div class="quiz-options">
        <button
          v-for="(option, n) in quiz.options"
          :key="option"
          :disabled="picked !== undefined || sync.saving || !sync.online"
          :aria-busy="answering === n"
          :class="{
            correct: picked !== undefined && n === quiz.answer,
            incorrect: picked === n && n !== quiz.answer,
          }"
          @click="answer(n)"
        >
          <AppIcon v-if="answering === n" name="refresh" class="spinning" :size="16" /><span>{{
            'ABCD'[n]
          }}</span
          >{{ option }}<AppIcon v-if="picked !== undefined && n === quiz.answer" name="check" :size="17" />
        </button>
      </div>
      <div v-if="picked !== undefined" class="answer-detail" role="status">
        <strong>{{ picked === quiz.answer ? '答对了，知识 +1' : '再学一个知识点' }}</strong>
        <p>{{ quiz.explain }}</p>
        <small>{{ quiz.knowledge }}</small>
      </div>
    </div>
    <div class="card-bottom">
      <span class="muted">已答 {{ answered }} / {{ quizzes.length }} · 正确 {{ score }} 题</span
      ><button class="text-button" :disabled="picked === undefined || index === 2" @click="index++">
        下一题<AppIcon name="right" :size="15" />
      </button>
    </div>
  </article>
</template>
