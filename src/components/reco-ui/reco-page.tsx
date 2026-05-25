import Taro from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import {
  Bell,
  Building2,
  Calendar,
  Car,
  ChartColumn,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  House,
  KeyRound,
  Lock,
  Map,
  MapPin,
  Navigation,
  Package,
  Phone,
  Plus,
  Route,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  TriangleAlert,
  Truck,
  UserRound,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import designData from '@/data/reco-ui-pages.json'

type Tone = 'blue' | 'cyan' | 'green' | 'orange' | 'red' | 'indigo' | 'slate'

interface RecoUiData {
  pages: RecoPageSpec[]
}

interface RecoPageSpec {
  path: string
  title: string
  subtitle?: string
  brand?: string
  variant?: 'landing' | 'merchant' | 'owner' | 'enterprise' | 'admin' | 'public'
  activeNav?: string
  nav?: NavItem[]
  sections: RecoSection[]
}

interface NavItem {
  label: string
  icon?: string
  target?: string
}

type RecoSection =
  | { type: 'hero'; title: string; subtitle?: string; stats?: MetricItem[] }
  | { type: 'metrics'; items: MetricItem[] }
  | { type: 'tabs'; items: string[]; active?: string }
  | { type: 'fields'; items: FieldItem[] }
  | { type: 'cards'; title?: string; items: CardItem[] }
  | { type: 'actions'; title?: string; items: ActionItem[] }
  | { type: 'timeline'; title?: string; items: TimelineItem[] }
  | { type: 'notice'; title: string; body: string; tone?: Tone }
  | { type: 'form'; title?: string; fields: FieldItem[]; action?: string }
  | { type: 'chart'; title: string; items: ProgressItem[] }
  | { type: 'map'; title: string; points: FieldItem[]; action?: string }
  | { type: 'toggles'; title?: string; items: ToggleItem[] }

interface MetricItem {
  label: string
  value: string
  caption?: string
  tone?: Tone
}

interface FieldItem {
  label: string
  value: string
  helper?: string
  tone?: Tone
  icon?: string
}

interface CardItem {
  title: string
  subtitle?: string
  meta?: string
  status?: string
  amount?: string
  action?: string
  target?: string
  tone?: Tone
  icon?: string
  details?: FieldItem[]
}

interface ActionItem {
  label: string
  target?: string
  tone?: Tone
  icon?: string
  variant?: 'primary' | 'secondary'
}

interface TimelineItem {
  time: string
  title: string
  detail?: string
  tone?: Tone
}

interface ProgressItem {
  label: string
  value: string
  percent: number
  tone?: Tone
}

interface ToggleItem {
  label: string
  value: string
  checked: boolean
  tone?: Tone
}

const iconMap = {
  bell: Bell,
  building: Building2,
  calendar: Calendar,
  car: Car,
  chart: ChartColumn,
  check: CircleCheck,
  clipboard: ClipboardList,
  clock: Clock,
  credit: CreditCard,
  demand: Package,
  file: FileText,
  home: House,
  key: KeyRound,
  lock: Lock,
  map: Map,
  marker: MapPin,
  money: CircleDollarSign,
  navigation: Navigation,
  phone: Phone,
  plus: Plus,
  route: Route,
  search: Search,
  settings: Settings,
  shield: ShieldCheck,
  sliders: SlidersHorizontal,
  store: Store,
  truck: Truck,
  user: UserRound,
  users: Users,
  wallet: Wallet,
  warehouse: Warehouse,
  warning: TriangleAlert,
}

const toneText: Record<Tone, string> = {
  blue: 'text-blue-600',
  cyan: 'text-cyan-600',
  green: 'text-emerald-600',
  orange: 'text-amber-600',
  red: 'text-red-600',
  indigo: 'text-indigo-600',
  slate: 'text-slate-700',
}

const toneBg: Record<Tone, string> = {
  blue: 'bg-blue-50',
  cyan: 'bg-cyan-50',
  green: 'bg-emerald-50',
  orange: 'bg-amber-50',
  red: 'bg-red-50',
  indigo: 'bg-indigo-50',
  slate: 'bg-slate-100',
}

const toneBorder: Record<Tone, string> = {
  blue: 'border-blue-100',
  cyan: 'border-cyan-100',
  green: 'border-emerald-100',
  orange: 'border-amber-100',
  red: 'border-red-100',
  indigo: 'border-indigo-100',
  slate: 'border-slate-200',
}

const toneHex: Record<Tone, string> = {
  blue: '#0062FF',
  cyan: '#06B6D4',
  green: '#10B981',
  orange: '#F59E0B',
  red: '#EF4444',
  indigo: '#4F46E5',
  slate: '#334155',
}

const allSpecs = (designData as RecoUiData).pages

export const getRecoPageSpec = (path: string) => allSpecs.find((page) => page.path === path)

const navigateToTarget = (target?: string) => {
  if (!target) return
  Taro.navigateTo({ url: `/${target}` })
}

const IconGlyph = ({ name, tone = 'blue', size = 18 }: { name?: string; tone?: Tone; size?: number }) => {
  const Icon = name ? iconMap[name as keyof typeof iconMap] : undefined
  if (!Icon) return null

  return <Icon size={size} color={toneHex[tone]} strokeWidth={2.2} />
}

const StatusBar = () => (
  <View className="flex flex-row items-center justify-between px-5 pt-3 pb-2">
    <Text className="block text-xs font-semibold text-slate-900">9:41</Text>
    <View className="flex flex-row items-center gap-1">
      <View className="size-2 rounded-full bg-slate-900" />
      <View className="size-2 rounded-full bg-slate-900" />
      <View className="h-2 w-4 rounded-full bg-slate-900" />
    </View>
  </View>
)

const Header = ({ spec }: { spec: RecoPageSpec }) => {
  const isEnterprise = spec.variant === 'enterprise'
  const isOwner = spec.variant === 'owner'
  const titleTone = isEnterprise ? 'text-slate-50' : 'text-slate-950'
  const subTone = isEnterprise ? 'text-blue-100' : 'text-slate-500'

  return (
    <View
      className={
        isEnterprise
          ? 'mx-3 rounded-3xl bg-blue-600 px-4 py-4 shadow-lg shadow-blue-200'
          : isOwner
            ? 'mx-3 rounded-3xl bg-white px-4 py-4 shadow-sm'
            : 'px-5 pb-3'
      }
    >
      <View className="flex flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className={`block text-xl font-bold ${titleTone}`}>{spec.title}</Text>
          {spec.subtitle ? <Text className={`mt-1 block text-xs ${subTone}`}>{spec.subtitle}</Text> : null}
        </View>
        {spec.brand ? (
          <View className="rounded-full bg-white bg-opacity-90 px-3 py-1">
            <Text className="block text-xs font-semibold text-blue-600">{spec.brand}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const Metrics = ({ items }: { items: MetricItem[] }) => (
  <View className="grid grid-cols-3 gap-2">
    {items.map((item) => {
      const tone = item.tone || 'blue'
      return (
        <Card key={`${item.label}-${item.value}`} className={`rounded-2xl border ${toneBorder[tone]} ${toneBg[tone]}`}>
          <CardContent className="p-3">
            <Text className={`block text-xl font-bold ${toneText[tone]}`}>{item.value}</Text>
            <Text className="mt-1 block text-xs font-medium text-slate-700">{item.label}</Text>
            {item.caption ? <Text className="mt-1 block text-xs text-slate-400">{item.caption}</Text> : null}
          </CardContent>
        </Card>
      )
    })}
  </View>
)

const Tabs = ({ items, active }: { items: string[]; active?: string }) => (
  <View className="flex flex-row gap-2 overflow-hidden">
    {items.map((item) => {
      const selected = active ? active === item : items[0] === item
      return (
        <View key={item} className={selected ? 'rounded-full bg-blue-600 px-4 py-2' : 'rounded-full bg-white px-4 py-2'}>
          <Text className={selected ? 'block text-xs font-semibold text-white' : 'block text-xs font-semibold text-slate-500'}>
            {item}
          </Text>
        </View>
      )
    })}
  </View>
)

const Fields = ({ items }: { items: FieldItem[] }) => (
  <View className="flex flex-col gap-3">
    {items.map((item) => {
      const tone = item.tone || 'slate'
      return (
        <View key={`${item.label}-${item.value}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <View className="flex flex-row items-center gap-2">
            <IconGlyph name={item.icon} tone={tone} size={16} />
            <Text className="block text-xs font-semibold text-slate-500">{item.label}</Text>
          </View>
          <Text className="mt-1 block text-sm font-semibold text-slate-950">{item.value}</Text>
          {item.helper ? <Text className="mt-1 block text-xs text-slate-400">{item.helper}</Text> : null}
        </View>
      )
    })}
  </View>
)

const Cards = ({ title, items }: { title?: string; items: CardItem[] }) => (
  <View className="flex flex-col gap-3">
    {title ? <Text className="block text-base font-bold text-slate-950">{title}</Text> : null}
    {items.map((item) => {
      const tone = item.tone || 'blue'
      return (
        <Card
          key={`${item.title}-${item.subtitle || item.amount || ''}`}
          className="rounded-3xl border border-slate-100 bg-white shadow-sm"
          onClick={() => navigateToTarget(item.target)}
        >
          <CardContent className="p-4">
            <View className="flex flex-row items-start gap-3">
              <View className={`flex size-10 items-center justify-center rounded-2xl ${toneBg[tone]}`}>
                <IconGlyph name={item.icon || 'route'} tone={tone} />
              </View>
              <View className="flex-1">
                <View className="flex flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="block text-sm font-bold text-slate-950">{item.title}</Text>
                    {item.subtitle ? <Text className="mt-1 block text-xs text-slate-500">{item.subtitle}</Text> : null}
                  </View>
                  {item.status ? (
                    <Badge className={`${toneBg[tone]} ${toneText[tone]} border-0`}>
                      <Text className="text-xs font-semibold">{item.status}</Text>
                    </Badge>
                  ) : null}
                </View>
                {item.meta || item.amount ? (
                  <View className="mt-3 flex flex-row items-center justify-between gap-2">
                    {item.meta ? <Text className="block text-xs text-slate-400">{item.meta}</Text> : <View />}
                    {item.amount ? <Text className={`block text-base font-bold ${toneText[tone]}`}>{item.amount}</Text> : null}
                  </View>
                ) : null}
                {item.details ? (
                  <View className="mt-3 grid grid-cols-2 gap-2">
                    {item.details.map((detail) => (
                      <View key={`${detail.label}-${detail.value}`} className="rounded-xl bg-slate-50 px-3 py-2">
                        <Text className="block text-xs text-slate-400">{detail.label}</Text>
                        <Text className="mt-1 block text-xs font-semibold text-slate-800">{detail.value}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {item.action ? (
                  <View className="mt-3 flex flex-row items-center justify-between">
                    <Text className={`block text-xs font-semibold ${toneText[tone]}`}>{item.action}</Text>
                    <ChevronRight size={16} color={toneHex[tone]} />
                  </View>
                ) : null}
              </View>
            </View>
          </CardContent>
        </Card>
      )
    })}
  </View>
)

const Actions = ({ title, items }: { title?: string; items: ActionItem[] }) => (
  <View className="flex flex-col gap-3">
    {title ? <Text className="block text-base font-bold text-slate-950">{title}</Text> : null}
    <View className="grid grid-cols-2 gap-3">
      {items.map((item) => {
        const tone = item.tone || 'blue'
        const primary = item.variant === 'primary'
        return (
          <Button
            key={item.label}
            className={primary ? 'h-16 rounded-2xl bg-blue-600' : 'h-16 rounded-2xl border border-slate-100 bg-white'}
            variant={primary ? 'default' : 'outline'}
            onClick={() => navigateToTarget(item.target)}
          >
            <View className="flex flex-row items-center justify-center gap-2">
              <IconGlyph name={item.icon} tone={primary ? 'slate' : tone} size={16} />
              <Text className={primary ? 'block text-sm font-semibold text-white' : 'block text-sm font-semibold text-slate-800'}>
                {item.label}
              </Text>
            </View>
          </Button>
        )
      })}
    </View>
  </View>
)

const Timeline = ({ title, items }: { title?: string; items: TimelineItem[] }) => (
  <View className="rounded-3xl bg-white p-4 shadow-sm">
    {title ? <Text className="block text-base font-bold text-slate-950">{title}</Text> : null}
    <View className="mt-3 flex flex-col gap-4">
      {items.map((item) => {
        const tone = item.tone || 'blue'
        return (
          <View key={`${item.time}-${item.title}`} className="flex flex-row gap-3">
            <View className={`mt-1 size-3 rounded-full ${toneBg[tone]} border ${toneBorder[tone]}`} />
            <View className="flex-1">
              <Text className="block text-xs font-semibold text-slate-400">{item.time}</Text>
              <Text className="mt-1 block text-sm font-bold text-slate-900">{item.title}</Text>
              {item.detail ? <Text className="mt-1 block text-xs text-slate-500">{item.detail}</Text> : null}
            </View>
          </View>
        )
      })}
    </View>
  </View>
)

const FormPreview = ({ title, fields, action }: { title?: string; fields: FieldItem[]; action?: string }) => (
  <View className="rounded-3xl bg-white p-4 shadow-sm">
    {title ? <Text className="block text-base font-bold text-slate-950">{title}</Text> : null}
    <View className="mt-3 flex flex-col gap-3">
      {fields.map((field) => (
        <View key={`${field.label}-${field.value}`}>
          <Label className="mb-2 block text-xs font-semibold text-slate-500">{field.label}</Label>
          <Input className="rounded-2xl bg-slate-50" disabled value={field.value} />
          {field.helper ? <Text className="mt-1 block text-xs text-slate-400">{field.helper}</Text> : null}
        </View>
      ))}
      {action ? (
        <Button className="mt-1 h-12 rounded-2xl bg-blue-600">
          <Text className="block text-sm font-semibold text-white">{action}</Text>
        </Button>
      ) : null}
    </View>
  </View>
)

const Chart = ({ title, items }: { title: string; items: ProgressItem[] }) => (
  <View className="rounded-3xl bg-white p-4 shadow-sm">
    <Text className="block text-base font-bold text-slate-950">{title}</Text>
    <View className="mt-4 flex flex-col gap-4">
      {items.map((item) => {
        const tone = item.tone || 'blue'
        return (
          <View key={item.label}>
            <View className="mb-2 flex flex-row items-center justify-between">
              <Text className="block text-xs font-semibold text-slate-700">{item.label}</Text>
              <Text className={`block text-xs font-bold ${toneText[tone]}`}>{item.value}</Text>
            </View>
            <Progress value={item.percent} className="h-2 rounded-full" />
          </View>
        )
      })}
    </View>
  </View>
)

const MapPreview = ({ title, points, action }: { title: string; points: FieldItem[]; action?: string }) => (
  <View className="rounded-3xl bg-slate-950 p-4 shadow-sm">
    <View className="flex flex-row items-center justify-between">
      <Text className="block text-base font-bold text-white">{title}</Text>
      <Navigation size={18} color="#06B6D4" />
    </View>
    <View className="my-4 h-28 rounded-3xl bg-slate-800 px-4 py-3">
      <View className="h-full rounded-2xl border border-dashed border-cyan-300 border-opacity-60" />
    </View>
    <Fields items={points} />
    {action ? (
      <Button className="mt-4 h-12 rounded-2xl bg-cyan-500">
        <Text className="block text-sm font-semibold text-white">{action}</Text>
      </Button>
    ) : null}
  </View>
)

const Toggles = ({ title, items }: { title?: string; items: ToggleItem[] }) => (
  <View className="rounded-3xl bg-white p-4 shadow-sm">
    {title ? <Text className="block text-base font-bold text-slate-950">{title}</Text> : null}
    <View className="mt-3 flex flex-col gap-3">
      {items.map((item) => (
        <View key={item.label} className="flex flex-row items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
          <View>
            <Text className="block text-sm font-semibold text-slate-900">{item.label}</Text>
            <Text className="mt-1 block text-xs text-slate-500">{item.value}</Text>
          </View>
          <Switch checked={item.checked} disabled />
        </View>
      ))}
    </View>
  </View>
)

const Notice = ({ title, body, tone = 'blue' }: { title: string; body: string; tone?: Tone }) => (
  <View className={`rounded-3xl border p-4 ${toneBg[tone]} ${toneBorder[tone]}`}>
    <Text className={`block text-sm font-bold ${toneText[tone]}`}>{title}</Text>
    <Text className="mt-2 block text-xs leading-5 text-slate-600">{body}</Text>
  </View>
)

const Hero = ({ title, subtitle, stats }: { title: string; subtitle?: string; stats?: MetricItem[] }) => (
  <View className="mx-3 rounded-3xl bg-blue-600 px-5 py-6 shadow-lg shadow-blue-200">
    <Text className="block text-2xl font-bold text-white">{title}</Text>
    {subtitle ? <Text className="mt-2 block text-sm leading-5 text-blue-100">{subtitle}</Text> : null}
    {stats ? (
      <View className="mt-5">
        <Metrics items={stats} />
      </View>
    ) : null}
  </View>
)

const renderSection = (section: RecoSection) => {
  switch (section.type) {
    case 'hero':
      return <Hero key={`${section.type}-${section.title}`} title={section.title} subtitle={section.subtitle} stats={section.stats} />
    case 'metrics':
      return <Metrics key={`${section.type}-${section.items.map((item) => item.label).join('-')}`} items={section.items} />
    case 'tabs':
      return <Tabs key={`${section.type}-${section.items.join('-')}`} items={section.items} active={section.active} />
    case 'fields':
      return <Fields key={`${section.type}-${section.items.map((item) => item.label).join('-')}`} items={section.items} />
    case 'cards':
      return <Cards key={`${section.type}-${section.title || section.items[0]?.title}`} title={section.title} items={section.items} />
    case 'actions':
      return <Actions key={`${section.type}-${section.title || section.items[0]?.label}`} title={section.title} items={section.items} />
    case 'timeline':
      return <Timeline key={`${section.type}-${section.title}`} title={section.title} items={section.items} />
    case 'notice':
      return <Notice key={`${section.type}-${section.title}`} title={section.title} body={section.body} tone={section.tone} />
    case 'form':
      return <FormPreview key={`${section.type}-${section.title}`} title={section.title} fields={section.fields} action={section.action} />
    case 'chart':
      return <Chart key={`${section.type}-${section.title}`} title={section.title} items={section.items} />
    case 'map':
      return <MapPreview key={`${section.type}-${section.title}`} title={section.title} points={section.points} action={section.action} />
    case 'toggles':
      return <Toggles key={`${section.type}-${section.title}`} title={section.title} items={section.items} />
    default:
      return null
  }
}

const BottomNav = ({ nav, active }: { nav?: NavItem[]; active?: string }) => {
  if (!nav || nav.length === 0) return null

  return (
    <View className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-100 bg-white bg-opacity-95 px-3 pb-3 pt-2">
      <View className="grid grid-cols-5 gap-1">
        {nav.map((item) => {
          const selected = active === item.label
          return (
            <View
              key={item.label}
              className={selected ? 'rounded-2xl bg-blue-50 px-1 py-2' : 'rounded-2xl px-1 py-2'}
              onClick={() => navigateToTarget(item.target)}
            >
              <View className="items-center">
                <IconGlyph name={item.icon} tone={selected ? 'blue' : 'slate'} size={17} />
                <Text className={selected ? 'mt-1 block text-center text-xs font-semibold text-blue-600' : 'mt-1 block text-center text-xs font-medium text-slate-400'}>
                  {item.label}
                </Text>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

export const RecoDesignPage = ({ path }: { path: string }) => {
  const spec = getRecoPageSpec(path)

  if (!spec) {
    return (
      <View className="min-h-screen bg-slate-50 p-5">
        <Text className="block text-base font-semibold text-slate-900">未找到页面设计</Text>
        <Text className="mt-2 block text-xs text-slate-500">{path}</Text>
      </View>
    )
  }

  const landing = spec.variant === 'landing'

  return (
    <View className={landing ? 'min-h-screen bg-blue-50' : 'min-h-screen bg-slate-100'}>
      <ScrollView scrollY className="min-h-screen pb-24">
        <StatusBar />
        {!landing ? <Header spec={spec} /> : null}
        <View className="flex flex-col gap-4 px-3 pb-28 pt-3">
          {spec.sections.map(renderSection)}
        </View>
      </ScrollView>
      <BottomNav nav={spec.nav} active={spec.activeNav} />
    </View>
  )
}
