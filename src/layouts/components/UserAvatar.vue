<!--------------------------------
 - @Author: Ronnie Zhang
 - @LastEditor: Ronnie Zhang
 - @LastEditTime: 2023/12/16 18:50:42
 - @Email: zclzone@outlook.com
 - Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 --------------------------------->

<template>
  <n-dropdown
    :show="showDropdown"
    :options="options"
    trigger="manual"
    placement="bottom-end"
    @clickoutside="showDropdown = false"
    @select="handleSelect"
  >
    <div id="user-dropdown" class="flex cursor-pointer items-center" @click.stop="showDropdown = !showDropdown">
      <span class="header-avatar">
        <img v-if="avatarUrl" :src="avatarUrl" alt="">
        <span v-else>{{ avatarText }}</span>
      </span>
      <div v-if="userStore.userInfo && !isTabletOrBelow" class="ml-12 flex-col flex-shrink-0 items-center">
        <span class="text-14">{{ displayName }}</span>
        <span class="text-12 opacity-50">[{{ identityName }}]</span>
      </div>
    </div>
  </n-dropdown>

  <RoleSelect ref="roleSelectRef" />
</template>

<script setup>
import { useResponsiveLayout } from '@/composables'
import { RoleSelect } from '@/layouts/components'
import { useAuthStore, useUserStore } from '@/store'
import { resolveAvatarText, resolveUserAvatar } from '@/utils'

const router = useRouter()
const userStore = useUserStore()
const authStore = useAuthStore()
const { isTabletOrBelow } = useResponsiveLayout()

const avatarUrl = computed(() => resolveUserAvatar(userStore.avatar))
const avatarText = computed(() => resolveAvatarText(userStore.userInfo))
const showDropdown = ref(false)

const displayName = computed(() => {
  if (userStore.userInfo?.builtIn)
    return '超级管理员'
  return userStore.nickName || userStore.username
})

const identityName = computed(() => {
  if (userStore.userInfo?.builtIn)
    return '超级管理员'
  return userStore.currentRole?.name || '未分配角色'
})

const canSwitchRole = computed(() => !userStore.userInfo?.builtIn && userStore.roles.length > 1)

const options = computed(() => [
  {
    label: '个人资料',
    key: 'profile',
    icon: () => h('i', { class: 'i-material-symbols:person-outline text-14' }),
  },
  ...(canSwitchRole.value
    ? [{
        label: '切换角色',
        key: 'toggleRole',
        icon: () => h('i', { class: 'i-basil:exchange-solid text-14' }),
      }]
    : []),
  {
    label: '退出登录',
    key: 'logout',
    icon: () => h('i', { class: 'i-mdi:exit-to-app text-14' }),
  },
])

const roleSelectRef = ref(null)
function handleSelect(key) {
  showDropdown.value = false
  switch (key) {
    case 'profile':
      router.push('/profile')
      break
    case 'toggleRole':
      roleSelectRef.value?.open({
        onOk() {
          location.reload()
        },
      })
      break
    case 'logout':
      $dialog.confirm({
        title: '提示',
        type: 'info',
        content: '确认退出？',
        async confirm() {
          await authStore.logout()
          $message.success('已退出登录')
        },
      })
      break
  }
}
</script>

<style scoped>
.header-avatar {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: #316c72;
  color: #fff;
  font-weight: 700;
}

.header-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
