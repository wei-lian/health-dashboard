<script setup>
import { playback, stopAudio, seekAudio, playSong } from '../stores/audio-store.js'
import { content } from '../stores/content-store.js'
const currentSong = computed(() =>
  [
    ...(content.files.songRank?.currentTop100 || []),
    ...(content.files.songRank?.dailyTop10 || []),
    ...(content.files.songRank?.yearlyTop100 || []),
    ...Object.values(content.files.songRank?.monthly || {}).flat(),
  ].find((song) => `song:${song.id}` === playback.key),
)
const time = (value) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
</script>

<template>
  <div v-if="playback.key" class="media-player" aria-label="音频播放器">
    <div class="player-label">
      <AppIcon :name="playback.kind === 'song' ? 'music' : 'volume'" :size="20" />
      <div>
        <strong>{{ playback.label }}</strong><small>{{
          playback.loading
            ? '音频加载中…'
            : playback.kind === 'song'
              ? 'Apple 公开试听片段 · 非整曲'
              : playback.kind === 'tts'
                ? '浏览器英语语音'
                : playback.kind === 'system-voice'
                  ? '本机生成的离线英语语音'
                  : '词典真人发音'
        }}</small>
      </div>
    </div>
    <input
      v-if="playback.duration"
      type="range"
      aria-label="播放进度"
      min="0"
      :max="playback.duration"
      :value="playback.currentTime"
      @input="seekAudio($event.target.value)"
    /><span v-if="playback.duration" class="player-time"
      >{{ time(playback.currentTime) }} / {{ time(playback.duration) }}</span
    ><button
      v-if="currentSong"
      class="icon-button"
      :aria-label="playback.playing ? '暂停试听' : '继续试听'"
      :disabled="playback.loading || playback.cooldown"
      @click="playSong(currentSong)"
    >
      <AppIcon
        :name="playback.loading ? 'refresh' : playback.playing ? 'pause' : 'play'"
        :class="{ spinning: playback.loading }"
        :size="19"
      /></button
    ><a
      v-if="playback.kind === 'song' && playback.url"
      :href="playback.url"
      target="_blank"
      rel="noopener noreferrer"
      class="text-button"
      >完整收听<AppIcon name="external" :size="14" /></a
    ><button class="icon-button" aria-label="停止并关闭播放器" @click="stopAudio">
      <AppIcon name="close" :size="18" />
    </button>
  </div>
</template>
