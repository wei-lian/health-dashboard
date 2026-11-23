import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

test(
  'Windows 英语语音生成正常、慢速和例句 WAV，输出有效且慢速更长',
  { skip: process.platform !== 'win32' },
  async () => {
    const folder = await mkdtemp(resolve(tmpdir(), 'dailydash-voice-'))
    try {
      const files = Object.fromEntries(
        ['normal', 'slow', 'example'].map((kind, index) => [kind, String(index + 1).repeat(24) + '.wav']),
      )
      const input = resolve(folder, 'input.json'),
        result = resolve(folder, 'result.json')
      await writeFile(
        input,
        JSON.stringify([
          { word: 'serendipity', example: 'Finding this little bookshop was pure serendipity.', files },
        ]),
      )
      await promisify(execFile)(
        'powershell.exe',
        [
          '-NoProfile',
          '-File',
          resolve('scripts/synthesize-words.ps1'),
          '-InputPath',
          input,
          '-OutputFolder',
          folder,
          '-ResultPath',
          result,
        ],
        { timeout: 30000, windowsHide: true },
      )
      const manifest = JSON.parse(await readFile(result, 'utf8'))
      assert.equal(manifest.length, 1)
      assert.ok(manifest[0].voice)
      const lengths = {}
      for (const [kind, file] of Object.entries(files)) {
        const bytes = await readFile(resolve(folder, file))
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF')
        assert.equal(bytes.toString('ascii', 8, 12), 'WAVE')
        assert.ok(bytes.length > 1000)
        lengths[kind] = bytes.length
      }
      assert.ok(lengths.slow > lengths.normal)
      assert.ok(lengths.example > lengths.normal)
    } finally {
      await rm(folder, { recursive: true, force: true })
    }
  },
)
