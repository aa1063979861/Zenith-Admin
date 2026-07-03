const avatarPresets = {
  'preset:teal': ['#155E63', '#7BD1C7', '#F3FAF9'],
  'preset:blue': ['#1E4E8C', '#8EC5FF', '#F4F8FF'],
  'preset:green': ['#2F6B4F', '#A7E3B4', '#F5FBF6'],
  'preset:amber': ['#9A5B16', '#F5C56B', '#FFF8EA'],
  'preset:rose': ['#8A3A55', '#F0A8BF', '#FFF3F7'],
  'preset:slate': ['#334155', '#CBD5E1', '#F8FAFC'],
}

export function resolveUserAvatar(avatar) {
  const value = typeof avatar === 'string' ? avatar.trim() : ''
  if (avatarPresets[value])
    return createPresetAvatar(avatarPresets[value])
  return value || undefined
}

export function resolveAvatarText(user) {
  if (!user)
    return '?'

  const name = user.builtIn ? '超级管理员' : (user.employeeName || user.nickName || user.username || '')
  const normalized = String(name).trim()
  return normalized ? normalized[0] : '?'
}

function createPresetAvatar([base, accent, surface]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="${base}"/><circle cx="68" cy="30" r="22" fill="${accent}" opacity=".42"/><path d="M22 66c10-21 38-28 54-9 4 5 3 13-4 16-15 8-37 7-50-7z" fill="${surface}" opacity=".9"/><circle cx="38" cy="36" r="14" fill="${surface}" opacity=".82"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
