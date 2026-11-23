import { run } from './src/runner.js'

const args = process.argv.slice(2)
// 统一入口，默认全部模块；可单独重试一个模块。
run({
  force: args.includes('--force'),
  publishOnly: args.includes('--publish-only'),
  module: args.find((arg) => arg.startsWith('--module='))?.split('=')[1],
  targetDate: args.find((arg) => arg.startsWith('--date='))?.split('=')[1],
})
  .then((result) => {
    if (result?.failed) process.exitCode = 1
  })
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
