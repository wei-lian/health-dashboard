export const defaultLearningPlan = { dailyNew: 20, dailyPoems: 1, dailyListening: 10 }

// 兼容旧备份，学习与待办字段使用独立白名单校验。
export function validateLearning(input, validDate) {
  const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max
  const string = (v, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max
  const optional = (v, max) => v === undefined || (typeof v === 'string' && v.length <= max)
  const list = (value, max, check, label) => {
    const records = value ?? []
    if (!Array.isArray(records) || records.length > max) throw new Error(`${label}数量或格式错误`)
    const ids = new Set()
    for (const item of records) {
      if (!item || !string(item.id) || ids.has(item.id) || !check(item))
        throw new Error(`${label}格式错误或 ID 重复`)
      ids.add(item.id)
    }
    return records
  }
  const p = input.learningPlan ?? defaultLearningPlan
  if (!integer(p.dailyNew, 1, 200) || !integer(p.dailyPoems, 0, 20) || !integer(p.dailyListening, 0, 300))
    throw new Error('学习目标超出范围')
  const wordProgress = list(
    input.wordProgress,
    30000,
    (i) =>
      string(i.word, 100) &&
      validDate(i.firstDate) &&
      validDate(i.lastDate) &&
      validDate(i.nextReview) &&
      integer(i.level, 0, 5) &&
      integer(i.attempts, 1, 100000) &&
      optional(i.sentence, 2000),
    '单词学习记录',
  ).map((i) => ({
    id: i.id,
    word: i.word,
    firstDate: i.firstDate,
    lastDate: i.lastDate,
    nextReview: i.nextReview,
    level: i.level,
    attempts: i.attempts,
    sentence: i.sentence || '',
  }))
  const studyHistory = list(
    input.studyHistory,
    20000,
    (i) =>
      validDate(i.id) &&
      ['newWords', 'reviewedWords', 'poems'].every(
        (k) => Array.isArray(i[k]) && i[k].length <= 30000 && i[k].every((v) => string(v)),
      ),
    '每日学习记录',
  ).map((i) => ({
    id: i.id,
    newWords: [...new Set(i.newWords)],
    reviewedWords: [...new Set(i.reviewedWords)],
    poems: [...new Set(i.poems)],
  }))
  const listeningLogs = list(
    input.listeningLogs,
    20000,
    (i) =>
      validDate(i.date) &&
      string(i.title) &&
      integer(i.minutes, 1, 600) &&
      optional(i.note, 2000) &&
      optional(i.source, 1000),
    '听力记录',
  ).map((i) => ({
    id: i.id,
    date: i.date,
    title: i.title,
    minutes: i.minutes,
    note: i.note || '',
    source: i.source || '',
  }))
  const todos = list(
    input.todos,
    20000,
    (i) =>
      validDate(i.date) &&
      string(i.title) &&
      ['personal', 'words', 'poetry', 'listening'].includes(i.category) &&
      integer(i.target, 1, 10000) &&
      integer(i.completed, 0, i.target) &&
      optional(i.note, 2000),
    '待办事项',
  ).map((i) => ({
    id: i.id,
    date: i.date,
    title: i.title,
    category: i.category,
    target: i.target,
    completed: i.completed,
    note: i.note || '',
  }))
  return {
    learningPlan: { dailyNew: p.dailyNew, dailyPoems: p.dailyPoems, dailyListening: p.dailyListening },
    wordProgress,
    studyHistory,
    listeningLogs,
    todos,
  }
}

// 采用日历日间隔复习；忘记的词当天重练，记住的词按 1/3/7/14/30 天安排。
export function scheduleWord(previous, word, rating, date, sentence = '') {
  if (!['again', 'remember'].includes(rating)) throw new Error('无效的复习评价')
  const level = rating === 'again' ? 0 : Math.min((previous?.level || 0) + 1, 5)
  const next = new Date(date + 'T12:00:00Z')
  next.setUTCDate(next.getUTCDate() + [0, 1, 3, 7, 14, 30][level])
  return {
    id: word,
    word,
    firstDate: previous?.firstDate || date,
    lastDate: date,
    nextReview: next.toISOString().slice(0, 10),
    level,
    attempts: (previous?.attempts || 0) + 1,
    sentence,
  }
}

// 新词额度只按首次学习计数；复习同一词多次也只计一次当天完成量。
export function dailyStudy(history, date) {
  return history.find((i) => i.id === date) || { id: date, newWords: [], reviewedWords: [], poems: [] }
}

// 首次接触计新词；复习忘记不计完成，当天新词重练成功也计入复习。
export function recordWordPractice(history, previous, word, rating, date) {
  const saved = dailyStudy(history, date)
  const day = {
    id: date,
    newWords: [...saved.newWords],
    reviewedWords: [...saved.reviewedWords],
    poems: [...saved.poems],
  }
  if (!previous || previous.firstDate === date) day.newWords = [...new Set([...day.newWords, word])]
  if (previous && (previous.firstDate !== date || previous.nextReview <= date)) {
    day.reviewedWords =
      rating === 'again'
        ? day.reviewedWords.filter((item) => item !== word)
        : [...new Set([...day.reviewedWords, word])]
  }
  return day
}

// 到期和逾期复习优先；新词顺序由本地词书固定，目标完成后停止新增。
export function wordQueue(words, progress, history, plan, date, mode = 'new') {
  const known = new Map(progress.map((i) => [i.word, i]))
  if (mode === 'review')
    return words
      .filter((w) => known.get(w.w)?.nextReview <= date)
      .sort((a, b) => known.get(a.w).nextReview.localeCompare(known.get(b.w).nextReview))
  return words
    .filter((w) => !known.has(w.w))
    .slice(0, Math.max(0, plan.dailyNew - dailyStudy(history, date).newWords.length))
}
