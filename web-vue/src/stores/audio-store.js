import { reactive } from 'vue'
import { notify } from './local-store.js'
import { publicAssetUrl } from '../utils/deployment.js'

export const playback = reactive({
  key: '',
  label: '',
  kind: '',
  loading: false,
  playing: false,
  url: '',
  currentTime: 0,
  duration: 0,
  error: '',
  cooldown: false,
})
let audio,
  generation = 0,
  speechTimer

// 所有音源共用一个播放通道，单词和歌曲不会相互叠音。
export function stopAudio() {
  generation++
  clearTimeout(speechTimer)
  if ('speechSynthesis' in window) speechSynthesis.cancel()
  if (audio) {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }
  Object.assign(playback, { key: '', loading: false, playing: false, currentTime: 0, duration: 0 })
}

// 音频在点击时才联网加载，完整请求期间显示加载状态并防止重复激活。
async function playUrl(source, details) {
  if (playback.key === details.key && (playback.loading || playback.cooldown)) return
  if (playback.key === details.key && audio?.src && playback.kind !== 'tts') {
    if (playback.playing) {
      audio.pause()
      playback.playing = false
      return
    }
  } else {
    stopAudio()
    audio ||= new Audio()
    audio.preload = 'none'
    audio.src = publicAssetUrl(source)
    Object.assign(playback, { ...details, error: '', loading: true, playing: false })
  }
  const token = generation
  let timer
  playback.loading = true
  audio.ontimeupdate = () => {
    if (token === generation) playback.currentTime = audio.currentTime
  }
  audio.onloadedmetadata = () => {
    if (token === generation) playback.duration = Number.isFinite(audio.duration) ? audio.duration : 0
  }
  audio.onended = () => {
    if (token === generation) playback.playing = false
  }
  audio.onpause = () => {
    if (token === generation) playback.playing = false
  }
  try {
    await Promise.race([
      audio.play(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('音频连接超时')), 15000)
      }),
    ])
    if (token === generation) playback.playing = true
  } catch (error) {
    if (token !== generation) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    playback.error = error.message
    throw error
  } finally {
    clearTimeout(timer)
    if (token === generation) {
      playback.loading = false
      playback.cooldown = true
      setTimeout(() => {
        playback.cooldown = false
      }, 400)
    }
  }
}

// 仅播放平台明确提供的试听片段，无试听时直接使用平台入口。
export async function playSong(song) {
  if (!song.previewUrl) {
    notify('平台没有为这首歌提供可用试听，请打开音乐平台完整收听。')
    return
  }
  try {
    await playUrl(song.previewUrl, {
      key: `song:${song.id}`,
      kind: 'song',
      label: `${song.song} · ${song.artist}`,
      url: song.url,
    })
  } catch {
    notify('试听暂不可用，可能受地域或下架影响，可在平台完整收听。', 'error')
  }
}

// 系统语音作为词典音频失败后的兜底，选择可用英语声线。
function speak(text, slow) {
  stopAudio()
  if (!('speechSynthesis' in window)) {
    notify('浏览器不支持语音且词典音频不可用。', 'error')
    return
  }
  const token = generation
  const utterance = new SpeechSynthesisUtterance(text)
  const voices = speechSynthesis.getVoices().filter((voice) => /^en[-_]/i.test(voice.lang))
  utterance.voice = voices.find((voice) => /en-US/i.test(voice.lang)) || voices[0] || null
  utterance.lang = 'en-US'
  utterance.rate = slow ? 0.65 : 0.9
  Object.assign(playback, {
    key: `tts:${text}`,
    kind: 'tts',
    label: text,
    loading: true,
    playing: false,
    error: '',
    url: '',
  })
  utterance.onstart = () => {
    if (token === generation) {
      playback.loading = false
      playback.playing = true
    }
  }
  utterance.onend = () => {
    if (token === generation) {
      playback.loading = false
      playback.playing = false
      clearTimeout(speechTimer)
    }
  }
  utterance.onerror = (event) => {
    if (token === generation && !['interrupted', 'canceled'].includes(event.error)) {
      clearTimeout(speechTimer)
      playback.loading = false
      playback.playing = false
      notify('系统英语语音不可用，请安装英语语音包后重试。', 'error')
    }
  }
  speechSynthesis.speak(utterance)
  speechTimer = setTimeout(() => {
    if (token === generation) {
      stopAudio()
      notify('系统语音没有响应，请检查英语语音包。', 'error')
    }
  }, 60000)
}

// 单词优先词典音频，本机生成的慢速和例句语音可离线播放；缺失时回退浏览器 TTS。
export async function pronounce(word, { example = false, slow = false } = {}) {
  const text = example ? word.eg : word.w
  if (playback.loading && playback.label === text) return
  const source = example ? word.exampleAudio : slow ? word.slowAudio : word.audio
  if (source) {
    try {
      await playUrl(source, {
        key: `word:${word.w}:${example ? 'example' : slow ? 'slow' : 'normal'}`,
        kind: word.audioKind === 'system-tts' || example || slow ? 'system-voice' : 'word',
        label: text,
        url: word.audioSource || '',
      })
      return
    } catch {
      /* 发音资源不可用时继续用系统语音。 */
    }
  }
  speak(text, slow)
}

// 进度跳转只作用于媒体文件，系统 TTS 不提供伪进度。
export function seekAudio(value) {
  if (audio && Number.isFinite(audio.duration))
    audio.currentTime = Math.min(audio.duration, Math.max(0, Number(value)))
}
