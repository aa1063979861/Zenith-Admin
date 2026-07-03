<template>
  <CommonPage back class="zenith-data-page">
    <n-space class="mb-12" align="center">
      <NButton secondary @click="router.back()">
        <i class="i-fe:arrow-left mr-4" />
        返回
      </NButton>
      <NTag type="primary">
        {{ roleName }}
      </NTag>
    </n-space>
    <RoleUserTable :role-id="roleId" :role-name="roleName" />
  </CommonPage>
</template>

<script setup>
import { NButton, NTag } from 'naive-ui'
import RoleUserTable from './components/RoleUserTable.vue'

defineOptions({ name: 'RoleUser' })

const route = useRoute()
const router = useRouter()

const roleId = computed(() => Number(route.params.roleId))
const roleName = computed(() => String(route.query.roleName || '角色授权'))
</script>
