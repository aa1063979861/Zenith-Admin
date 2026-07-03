<!--------------------------------
 - @Author: Ronnie Zhang
 - @LastEditor: Ronnie Zhang
 - @LastEditTime: 2023/12/16 18:52:48
 - @Email: zclzone@outlook.com
 - Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 --------------------------------->

<template>
  <AppCard class="app-header flex items-center px-12" border-b="1px solid light_border dark:dark_border">
    <MenuCollapse />

    <AppTab class="top-tab-region min-w-0 w-0 flex-1 px-12" />

    <span v-if="!isMobile" class="mx-6 opacity-20">|</span>

    <div class="header-tools flex flex-shrink-0 items-center px-12 text-18">
      <BeginnerGuide v-if="!isMobile" />

      <ToggleTheme />

      <Fullscreen v-if="!isTabletOrBelow" />

      <ThemeSetting v-if="!isTabletOrBelow" class="mr-16" />

      <UserAvatar />
    </div>
  </AppCard>
</template>

<script setup>
import { ToggleTheme } from '@/components'
import { useResponsiveLayout } from '@/composables'
import { AppTab, BeginnerGuide, Fullscreen, MenuCollapse, UserAvatar } from '@/layouts/components'

const { isMobile, isTabletOrBelow } = useResponsiveLayout()
</script>
