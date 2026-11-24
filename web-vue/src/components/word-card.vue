<script setup>
import { words } from '../stores/content-store.js'
import { state, toggleItem, sync } from '../stores/local-store.js'
import { playback, pronounce } from '../stores/audio-store.js'
defineProps({ expanded: { type: Boolean, default: false } })
const index = ref(0)
const marking = ref(false)
async function markWord() {
  if (marking.value) return
  marking.value = true
  try {
    await toggleItem('mastered', word.value.w)
  } finally {
    marking.value = false
  }
}
const word = computed(() => words[index.value])
const busy = computed(() => playback.loading && playback.label === word.value.w)
watch(
  () => words.length,
  () => {
    if (index.value >= words.length) index.value = 0
  },
)
</script>

<template>
  <article class="card word-card">
    <div class="card-head">
      <h2><AppIcon name="book" :size="18" />每日单词</h2>
      <RouterLink class="text-button" to="/words">去背单词<AppIcon name="next" :size="15" /></RouterLink>
    </div>
    <SourceStatus module="englishWord" />
    <div class="word-content">
      <div class="word-title">
        <h3>{{ word.w }}</h3>
        <button
          class="icon-button audio-button"
          :aria-label="'朗读 ' + word.w"
          :disabled="busy"
          :aria-busy="busy"
          @click="pronounce(word)"
        >
          <AppIcon :name="busy ? 'refresh' : 'volume'" :class="{ spinning: busy }" :size="18" />
        </button>
      </div>
      <p class="phonetic">
        {{ word.phonetic }} <span>{{ word.pos }}</span>
      </p>
      <p class="word-meaning">{{ word.cn }}</p>
      <div class="pronunciation-actions">
        <button class="text-button" :disabled="busy" @click="pronounce(word)">
          <AppIcon name="volume" :size="14" />{{
            word.audioKind === 'system-tts' ? '本机英语发音' : word.audio ? '真人发音' : '英语朗读'
          }}</button
        ><button class="text-button" :disabled="busy" @click="pronounce(word, { slow: true })">
          慢速朗读</button
        ><button
          class="text-button"
          :disabled="playback.loading && playback.label === word.eg"
          @click="pronounce(word, { example: true })"
        >
          读例句
        </button>
      </div>
      <blockquote>{{ word.eg }}</blockquote>
      <p v-if="expanded" class="muted">{{ word.egCn }}</p>
      <p v-if="expanded" class="memory-note">记忆点：{{ word.memory }}</p>
      <p v-if="expanded && word.audioSource" class="audio-credit">
        发音来源：<a :href="word.audioSource" target="_blank" rel="noopener noreferrer"
          >Wikimedia / Free Dictionary</a
        ><a
          v-if="word.audioLicense?.url"
          :href="word.audioLicense.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          · {{ word.audioLicense.name }}</a
        >
      </p>
    </div>
    <div class="card-bottom">
      <button
        class="text-button"
        :class="{ 'is-saved': state.mastered.includes(word.w) }"
        :disabled="marking || sync.saving || !sync.online"
        :aria-busy="marking"
        @click="markWord"
      >
        <AppIcon :name="marking ? 'refresh' : 'check'" :class="{ spinning: marking }" :size="15" />{{
          state.mastered.includes(word.w) ? '已掌握' : '标记掌握'
        }}
      </button>
      <div class="pager">
        <button class="icon-button small" aria-label="上一个单词" :disabled="index === 0" @click="index--">
          <AppIcon name="prev" :size="17" /></button
        ><button
          class="icon-button small"
          aria-label="下一个单词"
          :disabled="index >= words.length - 1"
          @click="index++"
        >
          <AppIcon name="next" :size="17" />
        </button>
      </div>
    </div>
  </article>
</template>
