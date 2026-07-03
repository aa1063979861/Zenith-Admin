<!--------------------------------
 - @Author: Ronnie Zhang
 - @LastEditor: Ronnie Zhang
 - @LastEditTime: 2023/12/05 21:30:11
 - @Email: zclzone@outlook.com
 - Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 --------------------------------->

<template>
  <AppPage show-footer>
    <div class="profile-page">
      <section class="profile-hero">
        <div class="profile-identity">
          <div class="profile-avatar avatar-circle">
            <img v-if="avatarUrl" :src="avatarUrl" alt="">
            <span v-else>{{ avatarText }}</span>
          </div>
          <div class="profile-identity-main">
            <div class="profile-name">
              {{ displayName }}
            </div>
            <div class="profile-login">
              登录账号：{{ formatValue(userStore.username) }}
            </div>
            <div class="profile-tags">
              <n-tag size="small" :bordered="false" type="success">
                {{ accountTypeText }}
              </n-tag>
              <n-tag size="small" :bordered="false" type="info">
                {{ currentRoleText }}
              </n-tag>
              <n-tag size="small" :bordered="false" :type="accountStatusType">
                {{ accountStatusText }}
              </n-tag>
            </div>
          </div>
        </div>

        <n-space class="profile-actions">
          <n-button type="primary" secondary @click="openProfileModal">
            <i class="i-fe:edit mr-4" />
            修改资料
          </n-button>
          <n-button secondary @click="openPasswordModal">
            <i class="i-fe:lock mr-4" />
            修改密码
          </n-button>
        </n-space>
      </section>

      <section class="profile-layout">
        <div class="profile-main">
          <section class="profile-panel">
            <div class="profile-panel-title">
              账号资料
            </div>
            <div class="profile-info-list">
              <div v-for="item in accountRows" :key="item.label" class="profile-info-item">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </section>

          <section v-if="!userStore.userInfo?.builtIn" class="profile-panel">
            <div class="profile-panel-title">
              员工档案
            </div>
            <div class="profile-info-list">
              <div v-for="item in employeeRows" :key="item.label" class="profile-info-item">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </section>
        </div>

        <aside class="profile-side">
          <section class="profile-panel">
            <div class="profile-panel-title">
              当前角色
            </div>
            <div v-if="userStore.userInfo?.builtIn" class="profile-role-primary">
              <div class="profile-role-avatar avatar-circle">
                <img v-if="avatarUrl" :src="avatarUrl" alt="">
                <span v-else>{{ avatarText }}</span>
              </div>
              <div>
                <strong>超级管理员</strong>
                <span>系统内置账号</span>
              </div>
            </div>
            <div v-else-if="userStore.roles.length" class="profile-role-list">
              <n-tag
                v-for="role in userStore.roles"
                :key="role.id || role.code"
                size="small"
                :bordered="false"
                :type="role.code === userStore.currentRole?.code ? 'success' : 'default'"
              >
                {{ role.name }}
              </n-tag>
            </div>
            <n-empty v-else size="small" description="暂无普通角色" class="profile-empty" />
          </section>

          <section class="profile-panel">
            <div class="profile-panel-title">
              联系方式
            </div>
            <div class="profile-info-list">
              <div v-for="item in contactRows" :key="item.label" class="profile-info-item">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </section>

          <section v-if="userStore.userInfo?.builtIn" class="profile-panel">
            <div class="profile-panel-title">
              系统账号
            </div>
            <div class="profile-info-list">
              <div v-for="item in systemRows" :key="item.label" class="profile-info-item">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </div>

    <MeModal ref="pwdModalRef" title="修改密码" width="min(440px, calc(100vw - 32px))">
      <n-form
        ref="pwdFormRef"
        :model="pwdForm"
        :rules="passwordRules"
        label-placement="left"
        label-width="86"
        require-mark-placement="left"
      >
        <n-form-item label="原密码" path="oldPassword">
          <n-input v-model:value="pwdForm.oldPassword" type="password" placeholder="请输入原密码" show-password-on="mousedown" />
        </n-form-item>
        <n-form-item label="新密码" path="newPassword">
          <n-input v-model:value="pwdForm.newPassword" type="password" placeholder="请输入新密码" show-password-on="mousedown" />
        </n-form-item>
        <n-form-item label="确认密码" path="confirmPassword">
          <n-input v-model:value="pwdForm.confirmPassword" type="password" placeholder="请再次输入新密码" show-password-on="mousedown" />
        </n-form-item>
      </n-form>
    </MeModal>

    <MeModal ref="profileModalRef" title="修改资料" width="min(620px, calc(100vw - 32px))">
      <n-form ref="profileFormRef" :model="profileForm" :rules="profileRules" label-placement="left" label-width="86">
        <n-form-item label="头像" path="avatar">
          <div class="avatar-editor">
            <div class="avatar-editor-preview avatar-circle">
              <img v-if="profileAvatarUrl" :src="profileAvatarUrl" alt="">
              <span v-else>{{ avatarText }}</span>
            </div>
            <div class="avatar-editor-main">
              <label class="avatar-file-button">
                <i class="i-fe:upload mr-4" />
                上传图片
                <input class="avatar-file-input" type="file" accept=".png,.jpg,.jpeg,.webp,.gif" @change="handleAvatarFileChange">
              </label>
              <div class="avatar-preset-list">
                <button
                  v-for="preset in avatarPresets"
                  :key="preset.value"
                  type="button"
                  class="avatar-preset"
                  :class="{ 'is-active': profileForm.avatar === preset.value }"
                  :aria-label="preset.label"
                  @click="selectAvatar(preset.value)"
                >
                  <img :src="resolveUserAvatar(preset.value)" :alt="preset.label">
                </button>
                <button
                  type="button"
                  class="avatar-preset avatar-preset--text"
                  :class="{ 'is-active': !profileForm.avatar }"
                  aria-label="姓名首字"
                  @click="selectAvatar('')"
                >
                  {{ avatarText }}
                </button>
              </div>
              <n-input v-model:value="avatarAddress" size="small" placeholder="也可粘贴图片地址" clearable />
            </div>
          </div>
        </n-form-item>
        <n-form-item label="昵称" path="nickName">
          <n-input v-model:value="profileForm.nickName" placeholder="请输入显示名称" />
        </n-form-item>
        <n-form-item label="性别" path="gender">
          <n-select
            v-model:value="profileForm.gender"
            :options="genders"
            placeholder="请选择性别"
          />
        </n-form-item>
        <n-form-item label="地址" path="address">
          <n-input v-model:value="profileForm.address" placeholder="请输入地址" />
        </n-form-item>
        <n-form-item label="邮箱" path="email">
          <n-input v-model:value="profileForm.email" placeholder="请输入邮箱" />
        </n-form-item>
      </n-form>
    </MeModal>
  </AppPage>
</template>

<script setup>
import { MeModal } from '@/components'
import { useForm, useModal } from '@/composables'
import { useUserStore } from '@/store'
import { getUserInfo } from '@/store/helper'
import { formatDate, resolveAvatarText, resolveUserAvatar } from '@/utils'
import api from './api'

const userStore = useUserStore()
const avatarUrl = computed(() => resolveUserAvatar(userStore.avatar))
const avatarText = computed(() => resolveAvatarText(userStore.userInfo))
const displayName = computed(() => {
  if (userStore.userInfo?.builtIn)
    return '超级管理员'
  return userStore.userInfo?.employeeName || userStore.nickName || userStore.username || '-'
})
const accountTypeText = computed(() => userStore.userInfo?.builtIn ? '超级管理员' : '员工账号')
const currentRoleText = computed(() => userStore.userInfo?.builtIn ? '超级管理员' : (userStore.currentRole?.name || '未分配角色'))
const accountStatusText = computed(() => userStore.userInfo?.enable === false ? '已停用' : '已启用')
const accountStatusType = computed(() => userStore.userInfo?.enable === false ? 'error' : 'success')
const employeeStatusText = computed(() => {
  if (userStore.userInfo?.builtIn)
    return '系统内置'
  if (userStore.userInfo?.active === false)
    return '离职'
  return '在职'
})

const genders = [
  { label: '保密', value: 0 },
  { label: '男', value: 1 },
  { label: '女', value: 2 },
]
const avatarPresets = [
  { label: '青绿头像', value: 'preset:teal' },
  { label: '蓝色头像', value: 'preset:blue' },
  { label: '绿色头像', value: 'preset:green' },
  { label: '琥珀头像', value: 'preset:amber' },
  { label: '玫瑰头像', value: 'preset:rose' },
  { label: '石板头像', value: 'preset:slate' },
]

const genderText = computed(() => genders.find(item => item.value === userStore.userInfo?.gender)?.label || '保密')
const accountRows = computed(() => [
  { label: '登录账号', value: formatValue(userStore.username) },
  { label: '显示名称', value: formatValue(userStore.nickName) },
  { label: '账号类型', value: accountTypeText.value },
  { label: '账号状态', value: accountStatusText.value },
])
const employeeRows = computed(() => [
  { label: '员工姓名', value: formatValue(userStore.userInfo?.employeeName) },
  { label: '工号', value: formatValue(userStore.userInfo?.employeeNo) },
  { label: '部门', value: formatValue(userStore.userInfo?.departmentName) },
  { label: '职位', value: formatValue(userStore.userInfo?.positionName) },
  { label: '人事状态', value: employeeStatusText.value },
  { label: '入职日期', value: userStore.userInfo?.entryDate ? formatDate(userStore.userInfo.entryDate) : '-' },
])
const contactRows = computed(() => [
  { label: '性别', value: genderText.value },
  { label: '手机号', value: formatValue(userStore.userInfo?.phone) },
  { label: '邮箱', value: formatValue(userStore.userInfo?.email) },
  { label: '地址', value: formatValue(userStore.userInfo?.address) },
])
const systemRows = computed(() => [
  { label: '账号归属', value: '系统内置' },
  { label: '权限范围', value: '全部权限' },
])

const requiredRule = {
  required: true,
  message: '此为必填项',
  trigger: ['blur', 'change'],
}
const [pwdModalRef] = useModal()
const [pwdFormRef, pwdForm, pwdValidation] = useForm(createPasswordForm())
const [profileModalRef] = useModal()
const [profileFormRef, profileForm, profileValidation] = useForm(createProfileForm())
const profileAvatarUrl = computed(() => resolveUserAvatar(profileForm.value.avatar))
const avatarAddress = computed({
  get() {
    return isPresetAvatar(profileForm.value.avatar) ? '' : profileForm.value.avatar
  },
  set(value) {
    profileForm.value.avatar = value || ''
  },
})
const emailRule = {
  trigger: ['blur', 'input'],
  validator(_rule, value) {
    if (!value)
      return true
    return isValidEmail(value) || new Error('请输入正确的邮箱')
  },
}
const passwordRules = {
  oldPassword: requiredRule,
  newPassword: requiredRule,
  confirmPassword: [
    requiredRule,
    {
      trigger: ['blur', 'input'],
      validator(_rule, value) {
        return value === pwdForm.value.newPassword || new Error('两次输入的新密码不一致')
      },
    },
  ],
}
const profileRules = {
  nickName: requiredRule,
  email: emailRule,
}

function openPasswordModal() {
  Object.assign(pwdForm.value, createPasswordForm())
  pwdModalRef.value?.open({ onOk: handlePwdSave })
}

async function handlePwdSave() {
  if (!(await validateForm(pwdValidation)))
    return false
  await api.changePassword({
    oldPassword: pwdForm.value.oldPassword,
    newPassword: pwdForm.value.newPassword,
  })
  $message.success('密码修改成功')
  Object.assign(pwdForm.value, createPasswordForm())
}

function openProfileModal() {
  syncProfileForm()
  profileModalRef.value?.open({ onOk: handleProfileSave })
}

function selectAvatar(avatar) {
  profileForm.value.avatar = avatar
}

async function handleAvatarFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file)
    return
  if (file.size > 2 * 1024 * 1024) {
    $message.warning('头像图片不能超过 2MB')
    return
  }

  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.uploadAvatar(userStore.userId, formData)
  profileForm.value.avatar = data?.avatar || ''
  $message.success('头像已上传')
}

async function handleProfileSave() {
  if (!(await validateForm(profileValidation)))
    return false
  await api.updateProfile({
    id: profileForm.value.id,
    avatar: profileForm.value.avatar.trim(),
    nickName: profileForm.value.nickName.trim(),
    gender: profileForm.value.gender,
    address: profileForm.value.address.trim(),
    email: profileForm.value.email.trim(),
  })
  $message.success('资料修改成功')
  await refreshUserInfo()
}

async function refreshUserInfo() {
  const user = await getUserInfo()
  userStore.setUser(user)
  syncProfileForm()
}

function syncProfileForm() {
  Object.assign(profileForm.value, createProfileForm())
}

function createPasswordForm() {
  return {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  }
}

function createProfileForm() {
  return {
    id: userStore.userId,
    avatar: userStore.avatar || '',
    nickName: userStore.nickName || '',
    gender: userStore.userInfo?.gender ?? 0,
    address: userStore.userInfo?.address || '',
    email: userStore.userInfo?.email || '',
  }
}

function formatValue(value) {
  return value === null || value === undefined || value === '' ? '-' : value
}

function isPresetAvatar(avatar) {
  return typeof avatar === 'string' && avatar.startsWith('preset:')
}

async function validateForm(validate) {
  try {
    await validate()
    return true
  }
  catch {
    return false
  }
}

function isValidEmail(value) {
  const text = String(value).trim()
  const atIndex = text.indexOf('@')
  const dotIndex = text.lastIndexOf('.')
  return !text.includes(' ') && atIndex > 0 && dotIndex > atIndex + 1 && dotIndex < text.length - 1
}
</script>

<style scoped>
.avatar-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: #316c72;
  color: #fff;
}

.avatar-circle img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.profile-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border: 1px solid rgba(var(--zenith-primary-color), 0.12);
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(var(--zenith-primary-color), 0.08), transparent 38%), #fff;
  padding: 22px 24px;
  box-shadow: 0 12px 26px rgba(15, 35, 52, 0.045);
}

.profile-identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 18px;
}

.profile-avatar {
  flex: 0 0 auto;
  width: 92px;
  height: 92px;
  font-size: 34px;
  font-weight: 700;
}

.profile-identity-main {
  min-width: 0;
}

.profile-name {
  color: #102a43;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.25;
}

.profile-login {
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
}

.profile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.profile-actions {
  flex: 0 0 auto;
}

.profile-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 14px;
}

.profile-main,
.profile-side {
  display: grid;
  align-content: start;
  gap: 14px;
}

.profile-panel {
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: #fff;
}

.profile-panel-title {
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  color: #1f2937;
  font-size: 16px;
  font-weight: 700;
  padding: 15px 18px;
}

.profile-info-list {
  display: grid;
  gap: 0;
}

.profile-info-item {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  padding: 12px 18px;
}

.profile-info-item:last-child {
  border-bottom: 0;
}

.profile-info-item span {
  color: #64748b;
}

.profile-info-item strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #1f2937;
  font-weight: 600;
}

.profile-role-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 18px;
}

.profile-role-primary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px;
}

.profile-role-avatar {
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  font-size: 18px;
  font-weight: 700;
}

.profile-role-primary strong,
.profile-role-primary span {
  display: block;
}

.profile-role-primary strong {
  color: #1f2937;
  font-weight: 700;
}

.profile-role-primary span {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

.profile-empty {
  padding: 18px 0;
}

.avatar-editor {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 16px;
  width: 100%;
}

.avatar-editor-preview {
  width: 72px;
  height: 72px;
  font-size: 28px;
  font-weight: 700;
}

.avatar-editor-main {
  display: grid;
  min-width: 0;
  gap: 10px;
}

.avatar-file-button {
  display: inline-flex;
  width: max-content;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(var(--zenith-primary-color), 0.28);
  border-radius: 6px;
  background: rgba(var(--zenith-primary-color), 0.07);
  color: #316c72;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  padding: 8px 12px;
}

.avatar-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.avatar-preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.avatar-preset {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: 50%;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.avatar-preset.is-active {
  border-color: #316c72;
}

.avatar-preset img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-preset--text {
  background: #316c72;
  color: #fff;
  font-weight: 700;
}

@media (max-width: 767px) {
  .profile-hero,
  .profile-identity {
    align-items: flex-start;
    flex-direction: column;
  }

  .profile-hero {
    padding: 18px;
  }

  .profile-actions {
    width: 100%;
  }

  .profile-layout {
    grid-template-columns: 1fr;
  }

  .profile-info-item {
    grid-template-columns: 88px minmax(0, 1fr);
  }

  .avatar-editor {
    grid-template-columns: 1fr;
  }
}
</style>
