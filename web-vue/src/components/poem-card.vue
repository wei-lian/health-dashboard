<script setup>
import { poems } from '../stores/content-store.js'
import { state, toggleItem, notify, sync } from '../stores/local-store.js'
defineProps({ expanded: { type: Boolean, default: false } })
const index = ref(0)
const saving = ref(false)
async function saveFavorite() {
  if (saving.value) return
  saving.value = true
  try {
    await toggleItem('favorites', poem.value.id)
  } finally {
    saving.value = false
  }
}
const poem = computed(() => poems[index.value])
const saved = computed(() => state.favorites.includes(poem.value.id))
const notes = computed(() =>
  Array.isArray(poem.value.notes)
    ? poem.value.notes.map((item) => `${item.word}：${item.text}`).join('；') || '来源未提供注释。'
    : poem.value.notes,
)
watch(
  () => poems.length,
  () => {
    if (index.value >= poems.length) index.value = 0
  },
)
// 当日候选诗词全部浏览后停止切换，避免同日重复。
function next() {
  if (index.value < poems.length - 1) index.value++
  else notify('今天的诗已读完，慢慢回味吧。')
}
</script>

<template>
  <article class="card poem-card">
    <div class="card-head">
      <h2><AppIcon name="book" :size="18" />每日诗词</h2>
      <span class="tiny-label">A MOMENT OF POETRY</span>
    </div>
    <SourceStatus module="poetry" />
    <div class="poem-content">
      <span class="poem-stamp">诗</span>
      <h3>{{ poem.title }}</h3>
      <p class="poem-author">〔{{ poem.dynasty }}〕{{ poem.author }}</p>
      <div class="poem-lines">
        <p
          v-for="line in expanded ? poem.content : poem.content.slice(0, 2)"
          :key="line"
          :class="{ 'best-line': line === poem.bestLine }"
        >
          {{ line }}
        </p>
      </div>
      <span class="poem-watermark" aria-hidden="true">山</span>
    </div>
    <template v-if="expanded"
      ><div class="article-detail">
        <h4>白话译文</h4>
        <p>{{ poem.translation }}</p>
        <h4>注释</h4>
        <p>{{ notes }}</p>
        <h4>细读一首诗</h4>
        <p>{{ poem.appreciation }}</p>
      </div></template
    >
    <div class="card-bottom">
      <button class="text-button" @click="next">
        <AppIcon name="refresh" :size="14" />换一首
        <span class="muted">{{ index + 1 }}/{{ poems.length }}</span></button
      ><button
        class="text-button"
        :class="{ 'is-saved': saved }"
        :aria-pressed="saved"
        :disabled="saving || sync.saving || !sync.online"
        :aria-busy="saving"
        @click="saveFavorite"
      >
        <AppIcon :name="saving ? 'refresh' : 'heart'" :class="{ spinning: saving }" :size="15" />{{
          saved ? '已收藏' : '收藏诗词'
        }}
      </button>
    </div>
  </article>
</template>
