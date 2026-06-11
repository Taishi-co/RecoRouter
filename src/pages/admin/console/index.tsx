import { useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  adminConsoleModules,
  adminConsolePageCount,
  adminDesignPageCount,
  adminModuleOrder,
  type AdminModuleKey,
  type AdminModuleTheme,
  type AdminPage,
  type AdminPageStatus,
} from './admin-pages'

const statusText: Record<AdminPageStatus, string> = {
  'shell-ready': '可使用',
  'capability-shell': '待配置',
}

const auditKeywords = ['审核', '导出', '支付', '退款', '转账', '分账', 'COS', '配置', '权限', '禁用']

export default function AdminConsolePage() {
  const [activeModule, setActiveModule] = useState<AdminModuleKey>('rt')
  const [activeGroup, setActiveGroup] = useState('全部')
  const [selectedPageKey, setSelectedPageKey] = useState(adminConsoleModules.rt.pages[0]?.key || '')

  const module = adminConsoleModules[activeModule]
  const groups = useMemo(() => ['全部', ...collectGroups(module.pages)], [module.pages])
  const visiblePages = useMemo(() => {
    if (activeGroup === '全部') {
      return module.pages
    }
    return module.pages.filter((page) => page.group === activeGroup)
  }, [activeGroup, module.pages])
  const selectedPage = visiblePages.find((page) => page.key === selectedPageKey) || visiblePages[0] || module.pages[0]
  const selectedNeedsAudit = selectedPage ? needsAudit(selectedPage) : false

  const handleModuleChange = (nextModule: AdminModuleKey) => {
    const nextRegistry = adminConsoleModules[nextModule]
    setActiveModule(nextModule)
    setActiveGroup('全部')
    setSelectedPageKey(nextRegistry.pages[0]?.key || '')
  }

  const handleGroupChange = (nextGroup: string) => {
    const nextPage =
      nextGroup === '全部'
        ? module.pages[0]
        : module.pages.find((page) => page.group === nextGroup)
    setActiveGroup(nextGroup)
    setSelectedPageKey(nextPage?.key || '')
  }

  const showActionToast = (action: string) => {
    if (!selectedPage) {
      return
    }
    Taro.showToast({
      title: `${selectedPage.title} ${action}`,
      icon: 'none',
    })
  }

  return (
    <View
      className="min-h-screen box-border px-4 py-4 text-gray-900"
      style={{ backgroundColor: module.theme.page, color: module.theme.ink }}
    >
      <View className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <View
          className="rounded-lg border px-4 py-4"
          style={{ backgroundColor: module.theme.surface, borderColor: module.theme.border }}
        >
          <View className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <View className="min-w-0">
              <Text className="block text-2xl font-black leading-tight" style={{ color: module.theme.ink }}>
                Web 管理运营端
              </Text>
              <Text className="mt-1 block text-sm font-semibold" style={{ color: module.theme.muted }}>
                三端运营管理：覆盖 {adminDesignPageCount + adminConsolePageCount} 个运营页面
              </Text>
            </View>
            <View className="flex flex-row flex-wrap gap-2">
              <StatusPill label={module.serviceLabel} theme={module.theme} />
              <StatusPill label={module.subtitle} theme={module.theme} />
            </View>
          </View>

          <View className="mt-4 flex flex-row flex-wrap gap-2">
            {adminModuleOrder.map((moduleKey) => {
              const item = adminConsoleModules[moduleKey]
              const active = activeModule === moduleKey
              return (
                <Button
                  key={moduleKey}
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  className="rounded-lg px-4"
                  style={{
                    backgroundColor: active ? item.theme.primary : item.theme.surface,
                    borderColor: item.theme.border,
                  }}
                  onClick={() => handleModuleChange(moduleKey)}
                >
                  <Text className="text-sm font-black" style={{ color: active ? '#FFFFFF' : item.theme.ink }}>
                    {item.title}
                  </Text>
                  <Text className="text-xs font-semibold" style={{ color: active ? '#E8EEF8' : item.theme.muted }}>
                    {item.designCount + item.capabilityCount}
                  </Text>
                </Button>
              )
            })}
          </View>
        </View>

        <View className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="业务页面" value={`${module.designCount}`} hint="覆盖日常运营流程" theme={module.theme} />
          <MetricCard label="平台能力" value={`${module.capabilityCount}`} hint="账号、审计和公共配置" theme={module.theme} />
          <MetricCard label="业务分组" value={`${groups.length - 1}`} hint="按常用工作区聚合" theme={module.theme} />
          <MetricCard label="业务范围" value={module.serviceLabel} hint={module.description} theme={module.theme} compact />
        </View>

        <View className="flex flex-col gap-3 xl:flex-row">
          <View className="flex min-w-0 flex-1 flex-col gap-3">
            <Card style={{ backgroundColor: module.theme.surface, borderColor: module.theme.border }}>
              <CardContent className="p-4">
                <View className="mb-3 flex flex-col gap-1">
                  <Text className="text-base font-black" style={{ color: module.theme.ink }}>
                    组筛选
                  </Text>
                  <Text className="text-xs font-semibold" style={{ color: module.theme.muted }}>
                    搜索和筛选限定在当前模块，避免跨业务域混查。
                  </Text>
                </View>
                <View className="flex flex-row flex-wrap gap-2">
                  {groups.map((group) => {
                    const active = activeGroup === group
                    return (
                      <Button
                        key={group}
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        className="rounded-lg"
                        style={{
                          backgroundColor: active ? module.theme.primary : module.theme.surface,
                          borderColor: module.theme.border,
                        }}
                        onClick={() => handleGroupChange(group)}
                      >
                        <Text className="text-xs font-black" style={{ color: active ? '#FFFFFF' : module.theme.ink }}>
                          {group}
                        </Text>
                      </Button>
                    )
                  })}
                </View>
              </CardContent>
            </Card>

            <Card style={{ backgroundColor: module.theme.surface, borderColor: module.theme.border }}>
              <CardContent className="p-4">
                <View className="mb-3 flex flex-row items-center justify-between gap-3">
                  <View>
                    <Text className="block text-base font-black" style={{ color: module.theme.ink }}>
                      页面列表
                    </Text>
                    <Text className="block text-xs font-semibold" style={{ color: module.theme.muted }}>
                      当前展示 {visiblePages.length} 页
                    </Text>
                  </View>
                  <StatusPill label={statusText[selectedPage?.status || 'shell-ready']} theme={module.theme} />
                </View>
                <View className="flex flex-col gap-2">
                  {visiblePages.map((page) => (
                    <PageListItem
                      key={page.key}
                      page={page}
                      active={selectedPage?.key === page.key}
                      theme={module.theme}
                      onClick={() => setSelectedPageKey(page.key)}
                    />
                  ))}
                </View>
              </CardContent>
            </Card>
          </View>

          <View className="w-full xl:w-96">
            <Card style={{ backgroundColor: module.theme.surface, borderColor: module.theme.border }}>
              <CardContent className="p-4">
                {selectedPage ? (
                  <View className="flex flex-col gap-4">
                    <View>
                      <Text className="block text-xs font-black uppercase" style={{ color: module.theme.accent }}>
                        {selectedPage.group}
                      </Text>
                      <Text className="mt-1 block text-2xl font-black leading-tight" style={{ color: module.theme.ink }}>
                        {selectedPage.title}
                      </Text>
                      <Text className="mt-2 block text-sm leading-relaxed" style={{ color: module.theme.muted }}>
                        {selectedPage.description}
                      </Text>
                    </View>

                    <View className="flex flex-col gap-2">
                      <DetailRow label="所属模块" value={module.title} theme={module.theme} />
                      <DetailRow label="所属分组" value={selectedPage.group} theme={module.theme} />
                      <DetailRow label="页面状态" value={statusText[selectedPage.status]} theme={module.theme} />
                      <DetailRow label="审计要求" value={selectedNeedsAudit ? '需要写审计日志' : '常规业务操作'} theme={module.theme} />
                    </View>

                    <View className="rounded-lg border p-3" style={{ borderColor: module.theme.border, backgroundColor: module.theme.accentSoft }}>
                      <Text className="block text-sm font-black" style={{ color: module.theme.ink }}>
                        操作提醒
                      </Text>
                      <Text className="mt-1 block text-xs leading-relaxed" style={{ color: module.theme.muted }}>
                        涉及资金、导出、配置和审核的操作会保留审计记录，方便后续复核。
                      </Text>
                    </View>

                    <View className="grid grid-cols-1 gap-2">
                      <Button
                        className="rounded-lg"
                        style={{ backgroundColor: module.theme.primary }}
                        onClick={() => showActionToast('已打开当前操作')}
                      >
                        <Text className="text-sm font-black text-white">开始处理</Text>
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-lg"
                        style={{ borderColor: module.theme.border, backgroundColor: module.theme.surface }}
                        onClick={() => showActionToast('权限项已定位')}
                      >
                        <Text className="text-sm font-black" style={{ color: module.theme.ink }}>
                          配置菜单权限
                        </Text>
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-lg"
                        style={{ borderColor: module.theme.border, backgroundColor: module.theme.surface }}
                        onClick={() => showActionToast('审计点已定位')}
                      >
                        <Text className="text-sm font-black" style={{ color: module.theme.ink }}>
                          查看审计点
                        </Text>
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View className="py-8 text-center">
                    <Text className="text-sm font-semibold" style={{ color: module.theme.muted }}>
                      暂无页面
                    </Text>
                  </View>
                )}
              </CardContent>
            </Card>
          </View>
        </View>
      </View>
    </View>
  )
}

function collectGroups(pages: readonly AdminPage[]) {
  const groups: string[] = []
  pages.forEach((page) => {
    if (!groups.includes(page.group)) {
      groups.push(page.group)
    }
  })
  return groups
}

function needsAudit(page: AdminPage) {
  return page.service === 'platform-api' || auditKeywords.some((keyword) => page.title.includes(keyword))
}

function MetricCard({
  label,
  value,
  hint,
  theme,
  compact = false,
}: {
  label: string
  value: string
  hint: string
  theme: AdminModuleTheme
  compact?: boolean
}) {
  return (
    <Card style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
      <CardContent className="p-4">
        <Text className="block text-xs font-black" style={{ color: theme.muted }}>
          {label}
        </Text>
        <Text className={compact ? 'mt-2 block text-base font-black leading-tight' : 'mt-2 block text-3xl font-black leading-tight'} style={{ color: theme.primary }}>
          {value}
        </Text>
        <Text className="mt-2 block text-xs font-semibold leading-relaxed" style={{ color: theme.muted }}>
          {hint}
        </Text>
      </CardContent>
    </Card>
  )
}

function PageListItem({
  page,
  active,
  theme,
  onClick,
}: {
  page: AdminPage
  active: boolean
  theme: AdminModuleTheme
  onClick: () => void
}) {
  return (
    <View
      className="rounded-lg border px-3 py-3"
      hoverClass="opacity-80"
      style={{
        backgroundColor: active ? theme.accentSoft : theme.surface,
        borderColor: active ? theme.primary : theme.border,
      }}
      onClick={onClick}
    >
      <View className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <View className="min-w-0 flex-1">
          <Text className="block text-sm font-black" style={{ color: theme.ink }}>
            {page.title}
          </Text>
          <Text className="mt-1 block text-xs font-semibold" style={{ color: theme.muted }}>
            {page.group} / {serviceName(page.service)}
          </Text>
        </View>
        <View className="flex flex-row flex-wrap gap-2">
          <MiniPill label={statusText[page.status]} theme={theme} active={active} />
          <MiniPill label={needsAudit(page) ? '需审计' : '常规'} theme={theme} active={false} />
        </View>
      </View>
    </View>
  )
}

function serviceName(service: AdminPage['service']) {
  if (service === 'vehicle-api') return '无人车业务'
  if (service === 'mall-api') return '商城业务'
  return '平台治理'
}

function DetailRow({ label, value, theme }: { label: string; value: string; theme: AdminModuleTheme }) {
  return (
    <View className="rounded-lg border px-3 py-2" style={{ borderColor: theme.border }}>
      <Text className="block text-xs font-black" style={{ color: theme.muted }}>
        {label}
      </Text>
      <Text className="mt-1 block break-words text-sm font-semibold" style={{ color: theme.ink }}>
        {value}
      </Text>
    </View>
  )
}

function StatusPill({ label, theme }: { label: string; theme: AdminModuleTheme }) {
  return (
    <View className="rounded-lg px-3 py-2" style={{ backgroundColor: theme.accentSoft }}>
      <Text className="text-xs font-black" style={{ color: theme.primary }}>
        {label}
      </Text>
    </View>
  )
}

function MiniPill({ label, theme, active }: { label: string; theme: AdminModuleTheme; active: boolean }) {
  return (
    <View
      className="max-w-full rounded-lg px-2 py-1"
      style={{ backgroundColor: active ? theme.primary : theme.accentSoft }}
    >
      <Text className="text-xs font-black" style={{ color: active ? '#FFFFFF' : theme.muted }}>
        {label}
      </Text>
    </View>
  )
}
