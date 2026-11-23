import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { root, paths } from './paths.js'
import { atomicJson, readJson } from './storage.js'

const execute = promisify(execFile)

// Windows 上用已安装的英语声线生成离线 WAV，不依赖浏览器语音服务。
export async function synthesizeWords(words) {
  if (process.platform !== 'win32')
    return { count: 0, warning: '当前系统不生成 Windows 离线语音，使用词典音频或浏览器 TTS。' }
  const id = randomUUID(),
    input = resolve(paths.state, `${id}-voice-in.json`),
    result = resolve(paths.state, `${id}-voice-out.json`)
  const folder = resolve(paths.public, 'media/audio')
  await mkdir(folder, { recursive: true })
  const jobs = words.map((word) => ({
    word: word.w,
    example: word.eg,
    files: Object.fromEntries(
      ['normal', 'slow', 'example'].map((variant) => [
        variant,
        createHash('sha256')
          .update(`v1:${variant}:${variant === 'example' ? word.eg : word.w}`)
          .digest('hex')
          .slice(0, 24) + '.wav',
      ]),
    ),
  }))
  try {
    await atomicJson(input, jobs)
    await execute(
      'powershell.exe',
      [
        '-NoProfile',
        '-File',
        resolve(root, 'scripts/synthesize-words.ps1'),
        '-InputPath',
        input,
        '-OutputFolder',
        folder,
        '-ResultPath',
        result,
      ],
      { timeout: 120000, windowsHide: true, maxBuffer: 1024 * 1024 },
    )
    const generated = await readJson(result)
    for (const item of generated) {
      const word = words.find((entry) => entry.w === item.word)
      if (!word) continue
      if (!word.audio) {
        word.audio = `/media/audio/${item.files.normal}`
        word.audioKind = 'system-tts'
        word.audioVoice = item.voice
      }
      word.slowAudio = `/media/audio/${item.files.slow}`
      word.exampleAudio = `/media/audio/${item.files.example}`
    }
    return { count: generated.length, warning: '' }
  } catch (error) {
    return { count: 0, warning: `本机英语语音生成失败，继续使用浏览器 TTS：${error.message.slice(0, 150)}` }
  } finally {
    await rm(input, { force: true })
    await rm(result, { force: true })
  }
}
