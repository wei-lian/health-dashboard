import { test } from 'node:test'
import assert from 'node:assert/strict'

test('音频加载互斥、失败解锁、切换取消与暂停继续', async () => {
  let resolvePlay,
    rejectPlay,
    calls = 0
  const instances = []
  const previousWindow = globalThis.window,
    previousAudio = globalThis.Audio
  globalThis.window = {}
  globalThis.Audio = class {
    src = ''
    duration = 30
    play() {
      calls++
      return new Promise((resolve, reject) => {
        resolvePlay = resolve
        rejectPlay = reject
      })
    }
    pause() {
      this.onpause?.()
    }
    load() {}
    removeAttribute() {
      this.src = ''
    }
    constructor() {
      instances.push(this)
    }
  }
  const { playback, playSong, stopAudio } = await import('../web-vue/src/stores/audio-store.js')
  const song = { id: 'one', song: '甲', artist: '乙', previewUrl: 'https://example.com/one.m4a' }
  try {
    const first = playSong(song)
    assert.equal(playback.loading, true)
    await playSong(song)
    assert.equal(calls, 1)
    rejectPlay(new Error('网络失败'))
    await first
    assert.equal(playback.loading, false)
    assert.equal(playback.playing, false)
    await new Promise((done) => setTimeout(done, 420))
    const second = playSong(song)
    resolvePlay()
    await second
    assert.equal(playback.playing, true)
    instances[0].onloadedmetadata()
    assert.equal(playback.duration, 30)
    await new Promise((done) => setTimeout(done, 420))
    await playSong(song)
    assert.equal(playback.playing, false)
    const resumed = playSong(song)
    resolvePlay()
    await resumed
    assert.equal(playback.playing, true)
    const switched = playSong({ ...song, id: 'two' })
    stopAudio()
    resolvePlay()
    await switched
    assert.equal(playback.key, '')
    assert.equal(playback.loading, false)
    assert.equal(playback.playing, false)
  } finally {
    stopAudio()
    globalThis.window = previousWindow
    globalThis.Audio = previousAudio
  }
})
