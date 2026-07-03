import { pinyin } from 'pinyin-pro';

export function createDictionaryItemCode(name: string) {
  const source = name.trim();
  if (!source)
    return '';

  const initials = pinyin(source, { pattern: 'first', toneType: 'none', type: 'array' })
    .join('')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  return initials ? `${initials}_Code` : '';
}
