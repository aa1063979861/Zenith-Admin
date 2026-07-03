<template>
  <CommonPage class="kdocs-immersive-page" title="金山历史文档" :show-header="false">
    <div class="kdocs-immersive">
      <div class="kdocs-commandbar">
        <div class="kdocs-current">
          <n-button circle quaternary size="small" @click="showDocDrawer = true">
            <i class="i-fe:list" />
          </n-button>
          <div class="kdocs-current-text">
            <strong>{{ activeLink?.name || '金山历史文档' }}</strong>
          </div>
        </div>

        <n-space class="kdocs-actions" :wrap="false">
          <n-button v-if="activeLink" size="small" tag="a" :href="activeLink.url" target="_blank" rel="noopener noreferrer" type="primary">
            <i class="i-fe:external-link mr-4" />
            打开金山文档
          </n-button>
          <n-button v-if="activeLink" secondary size="small" @click="reloadEmbeddedKdocs">
            <i class="i-fe:rotate-cw mr-4" />
            刷新当前文档
          </n-button>
        </n-space>
      </div>

      <iframe
        v-if="activeLink"
        :key="iframeKey"
        class="kdocs-frame"
        :src="activeLink.url"
        title="金山文档"
        allow="clipboard-read; clipboard-write; fullscreen"
      />

      <div v-if="!activeLink" class="kdocs-empty">
        <n-alert v-if="!links.length && !loading" type="warning" :bordered="false">
          请在系统参数 <strong>kdocs.history_links</strong> 中配置金山文档链接。
        </n-alert>
        <n-empty description="选择一个金山文档">
          <template #extra>
            <n-space justify="center">
              <n-button type="primary" @click="showDocDrawer = true">
                打开文档列表
              </n-button>
            </n-space>
          </template>
        </n-empty>
      </div>

      <n-drawer v-model:show="showDocDrawer" width="min(380px, 92vw)" placement="left">
        <n-drawer-content title="金山历史文档" closable body-content-style="padding: 0;">
          <div class="kdocs-drawer">
            <div class="kdocs-drawer-search">
              <n-input v-model:value="keyword" clearable placeholder="搜索文档名称、分类或备注" />
            </div>

            <div class="kdocs-doc-list">
              <button
                v-for="item in filteredLinks"
                :key="item.id"
                class="kdocs-doc-item"
                :class="{ 'kdocs-doc-item--active': activeLink?.id === item.id }"
                type="button"
                @click="selectLink(item)"
              >
                <span>{{ item.name }}</span>
                <small>{{ item.category || '金山文档' }}</small>
              </button>

              <n-empty v-if="!filteredLinks.length" description="没有匹配的文档" />
            </div>

            <div class="kdocs-drawer-footer">
              <n-button secondary block :loading="loading" @click="loadLinks">
                <i class="i-fe:refresh-cw mr-4" />
                刷新文档列表
              </n-button>
            </div>
          </div>
        </n-drawer-content>
      </n-drawer>
    </div>
  </CommonPage>
</template>

<script setup>
import { businessApi } from '../shared/api'

defineOptions({ name: 'KingsoftDocs' })

const loading = ref(false)
const keyword = ref('')
const links = ref([])
const activeLink = ref(null)
const iframeKey = ref(0)
const showDocDrawer = ref(false)

const filteredLinks = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text)
    return links.value
  return links.value.filter(item => `${item.name} ${item.category} ${item.remark}`.toLowerCase().includes(text))
})

onMounted(loadLinks)

async function loadLinks() {
  try {
    loading.value = true
    const { data = [] } = await businessApi.kdocs.historyLinks()
    links.value = data
    if (!activeLink.value || !data.some(item => item.id === activeLink.value.id))
      activeLink.value = data[0] || null
  }
  finally {
    loading.value = false
  }
}

function selectLink(item) {
  activeLink.value = item
  showDocDrawer.value = false
}

function reloadEmbeddedKdocs() {
  iframeKey.value += 1
}
</script>

<style scoped>
.kdocs-immersive-page :deep(.common-page-body) {
  overflow: hidden;
  margin: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: #fff;
  padding: 0 !important;
}

.kdocs-immersive {
  position: relative;
  display: grid;
  min-height: 0;
  height: 100%;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  background: #fff;
}

.kdocs-frame {
  grid-row: 2;
  display: block;
  width: 100%;
  min-height: 0;
  height: 100%;
  border: 0;
  background: #fff;
}

.kdocs-commandbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 6px 10px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.kdocs-current {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.kdocs-current-text {
  min-width: 0;
}

.kdocs-current-text strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kdocs-current-text strong {
  color: #0f172a;
  font-size: 13px;
  font-weight: 650;
  line-height: 20px;
}

.kdocs-actions {
  flex: 0 0 auto;
}

.kdocs-empty {
  grid-row: 2;
  display: grid;
  min-height: 0;
  place-content: center;
  gap: 12px;
  padding: 24px;
  background: #f8fafc;
}

.kdocs-drawer {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.kdocs-drawer-search {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.kdocs-doc-list {
  display: grid;
  align-content: start;
  gap: 8px;
  overflow: auto;
  padding: 12px;
}

.kdocs-doc-item {
  display: grid;
  width: 100%;
  min-height: 54px;
  align-content: center;
  gap: 3px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  padding: 9px 12px;
  text-align: left;
}

.kdocs-doc-item--active {
  border-color: #0f766e;
  background: #f0fdfa;
}

.kdocs-doc-item span,
.kdocs-doc-item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kdocs-doc-item span {
  color: #0f172a;
  font-size: 14px;
  font-weight: 650;
  line-height: 18px;
}

.kdocs-doc-item small {
  color: #64748b;
  font-size: 12px;
  line-height: 16px;
}

.kdocs-drawer-footer {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

@media (max-width: 900px) {
  .kdocs-commandbar {
    align-items: stretch;
    flex-direction: column;
  }

  .kdocs-actions {
    width: 100%;
    overflow-x: auto;
  }
}
</style>
