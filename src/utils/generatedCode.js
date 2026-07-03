import { pinyin } from 'pinyin-pro'

export function createGeneratedCode(name) {
  const source = String(name || '').trim()
  if (!source)
    return ''
  const initials = pinyin(source, { pattern: 'first', toneType: 'none', type: 'array' })
    .join('')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
  return initials ? `${initials}_Code` : ''
}
