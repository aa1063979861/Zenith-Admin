export const UPLOAD_ROOT_DIR = 'uploads';
export const UPLOAD_URL_PREFIX = '/uploads/';

export const PROFILE_AVATAR_UPLOAD = {
  INCOMING_DIR: ['avatars', 'incoming'],
  STORAGE_DIR: 'avatars',
  MAX_BYTES: 2 * 1024 * 1024,
  ALLOWED_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
} as const;

export const EXCEL_IMPORT_UPLOAD = {
  MAX_BYTES: 20 * 1024 * 1024,
  ALLOWED_EXTENSIONS: ['.xls', '.xlsx'],
  BANK_STATEMENT_EXTENSIONS: ['.xlsx'],
} as const;

export const ARCHIVE_UPLOAD = {
  INCOMING_DIR: ['archive', 'incoming'],
  STORAGE_DIR: 'archive',
  MAX_BYTES: 200 * 1024 * 1024,
} as const;
