import { Text, View } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Action {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

interface FixedActionBarProps {
  actions: Action[]
  className?: string
}

export const FixedActionBar = ({ actions, className }: FixedActionBarProps) => (
  <View
    className={cn('fixed inset-x-0 bottom-0 z-50 bg-transparent px-4 pt-3 pointer-events-none', className)}
    style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
  >
    <View className="pointer-events-auto mx-auto flex max-w-sm gap-3">
      {actions.map((action) => (
        <Button
          key={action.label}
          className={cn(
            'flex-1 h-12 rounded-full shadow-lg transition-all duration-300 active:scale-95',
            action.variant === 'secondary' && 'bg-gray-100',
            action.variant === 'danger' && 'bg-red-500',
            (!action.variant || action.variant === 'primary') && 'bg-primary',
          )}
          disabled={action.disabled}
          onClick={action.onClick}
        >
          <Text className={cn('text-sm font-bold', action.variant === 'secondary' ? 'text-gray-700' : 'text-white')}>
            {action.label}
          </Text>
        </Button>
      ))}
    </View>
  </View>
)
