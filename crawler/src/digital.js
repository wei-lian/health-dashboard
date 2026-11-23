import { load } from 'cheerio'
import { request } from './utils/request.js'

// 只提取页面实际给出的报价；单一报价不虚构价格区间。
export function parseProducts(html, type, limit) {
  const $ = load(html),
    items = [],
    seen = new Set()
  $('.price-row').each((_, element) => {
    const box = $(element).parent(),
      link = box.find('h3 a').first()
    const fullName = link.text().replace(/\s+/g, ' ').trim()
    const detail = link.find('span').text().trim()
    const model = fullName.replace(detail, '').trim()
    const href = link.attr('href')
    if (!model || !href || seen.has(model)) return
    const prices = [
      ...box
        .find('.price-type, .item-b2cprice a')
        .map((_, item) => $(item).text())
        .get(),
    ]
      .flatMap((text) =>
        (text.match(/\d[\d,]*(?:\.\d+)?/g) || []).map((value) => Number(value.replaceAll(',', ''))),
      )
      .filter((value) => value >= 100 && value <= 100000)
    if (!prices.length) return
    seen.add(model)
    const low = Math.min(...prices),
      high = Math.max(...prices)
    items.push({
      model,
      type,
      tag: type === 'phone' ? '手机公开报价' : '笔记本公开报价',
      config: /[（(]([^）)]+)[）)]/.exec(model)?.[1] || '配置以来源页面为准',
      storage: /[（(]([^）)]+)[）)]/.exec(model)?.[1] || '',
      priceRange: low === high ? `${low}（单一报价）` : `${low} – ${high}`,
      priceMin: low,
      priceMax: high,
      detail: detail || '来源列表未提供详细参数，请查看产品页面。',
      spec: {},
      scene: type === 'phone' ? '手机' : '笔记本',
      url: new URL(href, 'https://detail.zol.com.cn').href,
    })
  })
  return items.slice(0, limit)
}

export async function collect({ today, updatedAt, targetDate }) {
  const phones = parseProducts(
    await request('https://detail.zol.com.cn/cell_phone_index/subcate57_list_1.html'),
    'phone',
    5,
  )
  const laptops = parseProducts(
    await request('https://detail.zol.com.cn/notebook_index/subcate16_list_1.html'),
    'laptop',
    6,
  )
  return {
    date: today,
    targetDate,
    updatedAt,
    mode: 'live',
    source: 'ZOL 中关村在线 · 产品列表公开报价',
    phones,
    laptops,
    notice:
      '价格为公开渠道参考报价，随促销波动，仅供参考。区间取同一页面可见报价的最小值与最大值；只有一个报价时如实注明。数据是采集时快照，不是昨日历史价。',
  }
}
