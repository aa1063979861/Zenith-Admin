import api from '@/api'

export async function getUserInfo() {
  const res = await api.getUser()
  const { id, username, profile, roles, currentRole } = res.data || {}
  return {
    id,
    username,
    enable: res.data?.enable,
    avatar: profile?.avatar,
    nickName: profile?.nickName,
    employeeName: profile?.employeeName,
    employeeNo: profile?.employeeNo,
    departmentName: profile?.departmentName,
    positionName: profile?.positionName,
    phone: profile?.phone,
    entryDate: profile?.entryDate,
    active: profile?.active,
    userKind: res.data?.userKind,
    builtIn: res.data?.builtIn,
    gender: profile?.gender,
    address: profile?.address,
    email: profile?.email,
    roles,
    currentRole,
  }
}

export async function getPermissions() {
  try {
    const res = await api.getRolePermissions()
    return res?.data || []
  }
  catch (error) {
    console.error(error)
    return []
  }
}

export async function getRuntimeConfig() {
  try {
    const res = await api.getRuntimeConfig()
    return res?.data || null
  }
  catch (error) {
    console.error(error)
    return null
  }
}
