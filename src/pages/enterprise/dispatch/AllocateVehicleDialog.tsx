import { View, Text, ScrollView } from '@tarojs/components'
import { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'

interface Vehicle {
  id: string
  vehicle_code: string
  vehicle_type: string
  load_capacity: number
  current_location: string
  usage_mode: 'internal' | 'external'
  trip_status: string
}

interface AllocateVehicleDialogProps {
  open: boolean
  onClose: () => void
  vehicles: Vehicle[]
  selectedVehicles: string[]
  onToggleVehicle: (vehicleId: string) => void
  onConfirm: () => void
  confirming?: boolean
}

const AllocateVehicleDialog: FC<AllocateVehicleDialogProps> = ({
  open,
  onClose,
  vehicles,
  selectedVehicles,
  onToggleVehicle,
  onConfirm,
  confirming = false,
}) => {
  const getUsageModeText = (usageMode: string) => {
    if (usageMode === 'external') return '外部'
    return '自有'
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>分配车辆</DialogTitle>
        </DialogHeader>

        <ScrollView scrollY className="max-h-80 my-4">
          {vehicles.length === 0 ? (
            <View className="text-center py-8">
              <Text className="block text-gray-500 text-sm">暂无可用车辆</Text>
            </View>
          ) : (
            <View className="space-y-2">
              {vehicles.map((vehicle) => {
                const isSelected = selectedVehicles.includes(vehicle.id)
                const isAvailable = vehicle.trip_status === 'idle'

                return (
                  <View
                    key={vehicle.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${isAvailable ? 'border-border' : 'border-border bg-muted'}`}
                  >
                    <View className="flex items-center flex-1">
                      <Checkbox
                        checked={isSelected}
                        disabled={!isAvailable}
                        onCheckedChange={() => onToggleVehicle(vehicle.id)}
                      />
                      <View className="ml-3 flex-1">
                        <Text className="text-sm font-medium block">
                          {vehicle.vehicle_code} {vehicle.vehicle_type}
                        </Text>
                        <View className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">
                            <Text className="text-xs">{getUsageModeText(vehicle.usage_mode)}</Text>
                          </Badge>
                          <Text className="text-xs text-gray-500">
                            {vehicle.load_capacity}公斤 · {vehicle.current_location}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {!isAvailable && (
                      <Text className="text-xs text-gray-400">执行中</Text>
                    )}
                  </View>
                )
              })}
            </View>
          )}
        </ScrollView>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <Text>取消</Text>
          </Button>
          <Button onClick={onConfirm} disabled={selectedVehicles.length === 0 || confirming}>
            <Text>{confirming ? '分配中...' : '确认分配'}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AllocateVehicleDialog
