<!--------------------------------
 - @Author: Ronnie Zhang
 - @LastEditor: Ronnie Zhang
 - @LastEditTime: 2023/12/16 18:51:10
 - @Email: zclzone@outlook.com
 - Copyright © 2023 Ronnie Zhang(大脸怪) | https://isme.top
 --------------------------------->

<template>
  <AppCard class="app-header flex items-center px-12" border-b="1px solid light_border dark:dark_border">
    <MenuCollapse />

    <BreadCrumb class="top-breadcrumb-region min-w-0" />

    <div class="header-tools ml-auto flex flex-shrink-0 items-center px-12 text-18">
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
import { BeginnerGuide, BreadCrumb, Fullscreen, MenuCollapse, UserAvatar } from '@/layouts/components'

const { isMobile, isTabletOrBelow } = useResponsiveLayout()
</script>
