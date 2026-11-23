<script setup>
import { playback, playSong } from '../stores/audio-store.js'
defineProps({ songs: { type: Array, required: true }, large: { type: Boolean, default: false } })
</script>

<template>
  <div>
    <div v-for="(song, index) in songs" :key="song.id || song.song" class="song-row" :class="{ large }">
      <span class="song-rank" :class="{ first: index < 3 }">{{
        String(index + 1).padStart(2, '0')
      }}</span><span class="album-art" :class="song.color || ['sage', 'sand', 'blue', 'rose'][index % 4]"
        ><AppIcon name="music" :size="20"
      /></span>
      <div class="song-info">
        <strong>{{ song.song }}</strong><small>{{ song.artist }}</small>
      </div>
      <span v-if="song.heat" class="song-trend">{{ song.heat }} 分</span
      ><button
        class="icon-button"
        :aria-label="
          playback.key === `song:${song.id}` && playback.playing ? '暂停 ' + song.song : '试听 ' + song.song
        "
        :disabled="
          !song.previewUrl || (playback.key === `song:${song.id}` && (playback.loading || playback.cooldown))
        "
        :aria-busy="playback.key === `song:${song.id}` && playback.loading"
        :title="song.previewUrl ? '播放平台公开试听片段' : '平台未提供试听，可打开平台收听'"
        @click="playSong(song)"
      >
        <AppIcon
          :name="
            playback.key === `song:${song.id}` && playback.loading
              ? 'refresh'
              : playback.key === `song:${song.id}` && playback.playing
                ? 'pause'
                : 'play'
          "
          :class="{ spinning: playback.key === `song:${song.id}` && playback.loading }"
          :size="17"
        /></button
      ><a
        :href="
          song.url ||
          'https://music.163.com/#/search/m/?s=' + encodeURIComponent(song.song + ' ' + song.artist)
        "
        target="_blank"
        rel="noopener noreferrer"
        class="icon-button small"
        :aria-label="'在平台收听 ' + song.song"
        ><AppIcon name="external" :size="16"
      /></a>
    </div>
  </div>
</template>
