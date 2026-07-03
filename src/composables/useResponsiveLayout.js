import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'

const TABLET_MAX_WIDTH = 1023
const MOBILE_MAX_WIDTH = 767

export function useResponsiveLayout() {
  const { width, height } = useWindowSize()

  const isTabletOrBelow = computed(() => width.value <= TABLET_MAX_WIDTH)
  const isMobile = computed(() => width.value <= MOBILE_MAX_WIDTH)

  return {
    width,
    height,
    isTabletOrBelow,
    isMobile,
  }
}
