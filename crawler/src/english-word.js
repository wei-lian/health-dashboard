import { resolve } from 'node:path'
import { requestJson, cacheAsset } from './utils/request.js'
import { readJson } from './utils/storage.js'
import { paths, dayIndex } from './utils/paths.js'
import { synthesizeWords } from './utils/local-voice.js'

// 中文释义与例句来自本地编辑词表；音标和真人发音从开放词典补齐。
export async function collect({ targetDate, updatedAt, previous }) {
  const local = await readJson(resolve(paths.data, 'curated.json'))
  const words = [],
    warnings = []
  const offset =
    (((dayIndex(targetDate) * 10) % local.words.length) + local.words.length) % local.words.length
  for (let index = 0; index < Math.min(10, local.words.length); index++) {
    const word = { ...local.words[(offset + index) % local.words.length] }
    try {
      const entries = await requestJson(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.w)}`,
      )
      const entry = entries[0]
      if (!entry?.word) throw new Error('词典未返回有效词条')
      const pronunciation =
        entry.phonetics?.find((item) => item.audio?.includes('-us.')) ||
        entry.phonetics?.find((item) => item.audio)
      word.phonetic = pronunciation?.text || entry.phonetic || word.phonetic
      word.dictionaryUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${word.w}`
      const part = word.pos.startsWith('v') ? 'verb' : word.pos.startsWith('adj') ? 'adjective' : 'noun'
      word.dictionaryDefinition =
        (entry.meanings?.find((item) => item.partOfSpeech === part) || entry.meanings?.[0])?.definitions?.[0]
          ?.definition || ''
      if (pronunciation?.audio) {
        word.audio = await cacheAsset(
          pronunciation.audio.startsWith('//') ? `https:${pronunciation.audio}` : pronunciation.audio,
          'audio',
        )
        word.audioSource = pronunciation.sourceUrl || word.dictionaryUrl
        word.audioLicense = pronunciation.license || entry.license || null
        word.audioKind = 'dictionary'
      }
    } catch (error) {
      const old = previous?.words?.find((entry) => entry.w === word.w)
      if (old?.audio)
        Object.assign(word, {
          audio: old.audio,
          audioKind: old.audioKind,
          audioVoice: old.audioVoice,
          audioSource: old.audioSource,
          audioLicense: old.audioLicense,
        })
      warnings.push(`${word.w}: ${error.message}`)
    }
    words.push(word)
  }
  const generated = await synthesizeWords(words)
  return {
    date: targetDate,
    updatedAt,
    source: '本地双语词表 + Free Dictionary API + 本机英语语音',
    mode: warnings.length ? 'degraded' : 'live',
    warning: [
      warnings.length ? `${warnings.length} 个词的联网补全或词典音频不可用。` : '',
      generated.count
        ? `已生成 ${generated.count} 个单词的本机离线英语语音（正常、慢速和例句）。`
        : generated.warning,
    ]
      .filter(Boolean)
      .join(' '),
    words,
  }
}
