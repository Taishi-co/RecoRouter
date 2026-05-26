import type { ComponentType, PropsWithChildren, ReactNode } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import { Bell } from 'lucide-react-taro'
import { cn } from '@/lib/utils'
import { getPageHeaderPaddingRight, getPageHeaderPaddingTop } from '@/lib/safe-area'

type ShellIcon = ComponentType<any>

interface AppPageShellProps extends PropsWithChildren {
  title: string
  subtitle?: string
  icon?: ShellIcon
  iconColor?: string
  right?: ReactNode
  bottom?: ReactNode
  className?: string
  contentClassName?: string
  headerClassName?: string
  scroll?: boolean
}

export const AppPageShell = ({
  title,
  subtitle = 'RecoRouter 小程序',
  icon: Icon = Bell,
  iconColor = '#0062FF',
  right,
  bottom,
  className,
  contentClassName,
  headerClassName,
  scroll = true,
  children,
}: AppPageShellProps) => {
  const headerPaddingTop = getPageHeaderPaddingTop()
  const headerPaddingRight = getPageHeaderPaddingRight()
  const content = (
    <View
      className={cn('box-border overflow-x-hidden mx-4 py-3 flex flex-col gap-3', contentClassName)}
      style={{
        boxSizing: 'border-box',
        overflowX: 'hidden',
        width: 'calc(100% - 32px)',
        marginLeft: '16px',
        marginRight: '16px',
      }}
    >
      {children}
    </View>
  )

  return (
    <View
      className={cn('min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-gray-50 text-gray-900', className)}
      style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}
    >
      <View
        className={cn('bg-white px-4 pb-3 overflow-hidden', headerClassName)}
        style={{ paddingTop: `${headerPaddingTop}px`, paddingRight: `${headerPaddingRight}px` }}
      >
        <View className="flex items-center justify-between gap-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <View className="min-w-0 flex-1" style={{ flex: '1 1 0', minWidth: 0 }}>
            <Text className="block text-xl font-black text-gray-900 leading-tight">
              {title}
            </Text>
            <Text className="block text-xs font-semibold text-gray-500 mt-1">
              {subtitle}
            </Text>
          </View>
          {right ? <View className="flex-shrink-0" style={{ flexShrink: 0 }}>{right}</View> : (
            <View className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Icon size={20} color={iconColor} strokeWidth={2.3} />
            </View>
          )}
        </View>
      </View>

      {scroll ? (
        <ScrollView
          scrollY
          className={cn('flex-1 min-h-0 w-full max-w-full overflow-x-hidden', bottom ? 'pb-24' : 'pb-4')}
          style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}
        >
          {content}
        </ScrollView>
      ) : (
        <View className={bottom ? 'pb-24' : 'pb-4'}>
          {content}
        </View>
      )}

      {bottom}
    </View>
  )
}
