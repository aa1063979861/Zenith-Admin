import { TextDecoder } from 'node:util';

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const CJK_TEXT_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/u;

export function normalizeUploadFileName(originalName?: string | null) {
  const value = String(originalName || '').trim();
  if (!value || CJK_TEXT_PATTERN.test(value))
    return value;

  try {
    const decoded = utf8Decoder.decode(Buffer.from(value, 'latin1')).trim();
    return CJK_TEXT_PATTERN.test(decoded) ? decoded : value;
  }
  catch {
    return value;
  }
}
