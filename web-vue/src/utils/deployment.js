export const isBrowserStorage = import.meta.env?.VITE_STORAGE_MODE === 'browser'

// 让内容和音频在 GitHub Pages 仓库子目录下仍能找到本站资源。
export function publicAssetUrl(value, base = import.meta.env?.BASE_URL || '/') {
  return typeof value === 'string' && /^\/(?:data|media|library)\//.test(value)
    ? base + value.slice(1)
    : value
}
