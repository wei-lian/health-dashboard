import { collect as hotNews } from './hot-news.js'
import { collect as quiz } from './quiz.js'
import { collect as knowledge } from './knowledge.js'
import { collect as songRank } from './song-rank.js'
import { collect as food } from './food.js'
import { collect as poetry } from './poetry.js'
import { collect as englishWord } from './english-word.js'
import { collect as digital } from './digital.js'

export const modules = Object.entries({
  hotNews,
  quiz,
  knowledge,
  songRank,
  food,
  poetry,
  englishWord,
  digital,
}).map(([name, collect]) => ({ name, collect }))
