import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common'
import { CreateDemandDto, UpdateDemandDto } from './dto/demands.dto'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { NotificationsService } from '../notifications/notification.service'
import { FareCalculationService, FareCalculationDetail } from '../fare-calculation/fare-calculation.service'
import { DemandTemplatesService } from '../demand-templates/demand-templates.service'

// 距离计算缓存接口
interface DistanceCache {
  distance: number
  estimated_fare: number
  route_type: 'non_highway' | 'estimated'
  route_duration: number
  polyline?: Array<{ latitude: number; longitude: number }>
  timestamp: number
}

@Injectable()
export class DemandsService {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly fareCalculationService: FareCalculationService,
    @Inject(forwardRef(() => DemandTemplatesService))
    private readonly demandTemplatesService: DemandTemplatesService
  ) {}

  // 内存缓存（基于起止点坐标）
  private distanceCache = new Map<string, DistanceCache>()
  private readonly CACHE_TTL = 3600000 // 缓存1小时

  // 计算两地距离（使用高德地图API，带缓存和重试）
  async calculateDistance(params: {
    pickup_lat: number
    pickup_lng: number
    delivery_lat: number
    delivery_lng: number
  }) {
    const { pickup_lat, pickup_lng, delivery_lat, delivery_lng } = params

    // 验证参数
    if (!pickup_lat || !pickup_lng || !delivery_lat || !delivery_lng) {
      throw new BadRequestException('请提供完整的经纬度坐标')
    }

    // 生成缓存键（考虑起止点顺序）
    const cacheKey = `${pickup_lat.toFixed(6)},${pickup_lng.toFixed(6)}-${delivery_lat.toFixed(6)},${delivery_lng.toFixed(6)}`

    // 检查缓存
    const cached = this.getCachedDistance(cacheKey)
    if (cached) {
      console.log('[DemandsService] 使用缓存数据:', cached)
      return {
        code: 200,
        message: '计算成功',
        data: {
          distance: cached.distance,
          distance_text: `${cached.distance.toFixed(2)}公里`,
          estimated_fare: cached.estimated_fare,
          route_type: cached.route_type,
          route_duration: cached.route_duration,
          duration_text: `约${Math.floor(cached.route_duration / 60)}分钟`,
          polyline: cached.polyline // 返回缓存的路线坐标点
        }
      }
    }

    try {
      // 带重试的API调用
      const result = await this.callAmapApiWithRetry(pickup_lat, pickup_lng, delivery_lat, delivery_lng, 2)

      // 缓存结果
      this.setCachedDistance(cacheKey, {
        distance: result.distance,
        estimated_fare: result.estimated_fare,
        route_type: 'non_highway',
        route_duration: result.route_duration,
        polyline: result.polyline,
        timestamp: Date.now()
      })

      return {
        code: 200,
        message: '计算成功',
        data: result
      }
    } catch (error) {
      console.error('[DemandsService] 距离计算失败，使用降级方案:', error)

      // 降级方案：使用直线距离估算
      const fallbackResult = this.calculateFallbackDistance(pickup_lat, pickup_lng, delivery_lat, delivery_lng)

      // 缓存降级结果（缓存时间较短，30分钟）
      this.setCachedDistance(cacheKey, {
        distance: fallbackResult.distance,
        estimated_fare: fallbackResult.estimated_fare,
        route_type: 'estimated',
        route_duration: fallbackResult.route_duration,
        polyline: fallbackResult.polyline,
        timestamp: Date.now()
      }, 1800000) // 30分钟

      return {
        code: 200,
        message: '计算成功（基于估算）',
        data: {
          ...fallbackResult,
          is_estimate: true
        }
      }
    }
  }

  // 带重试的高德地图API调用
  private async callAmapApiWithRetry(
    pickup_lat: number,
    pickup_lng: number,
    delivery_lat: number,
    delivery_lng: number,
    maxRetries: number
  ): Promise<any> {
    const apiKey = process.env.AMAP_API_KEY || 'demo'

    // 检测是否使用demo key
    if (apiKey === 'demo') {
      console.warn('[DemandsService] 警告：使用demo API key，建议配置AMAP_API_KEY环境变量')
    }

    const origin = `${pickup_lng},${pickup_lat}`
    const destination = `${delivery_lng},${delivery_lat}`

    // 优化API参数：strategy=10不走高速，避免拥堵
    const url = `https://restapi.amap.com/v3/direction/driving?origin=${origin}&destination=${destination}&strategy=10&extensions=all&key=${apiKey}`

    console.log(`[DemandsService] 调用高德地图API (重试次数: ${maxRetries}):`, url)

    let lastError: any = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(10000) // 10秒超时
        })
        const data = await response.json()

        console.log('[DemandsService] 高德地图API响应:', data)

        // 检查响应状态
        if (data.status !== '1') {
          throw new BadRequestException(`地图API错误: ${data.info}`)
        }

        // 获取路线距离
        if (!data.route || !data.route.paths || data.route.paths.length === 0) {
          throw new BadRequestException('无法获取路线信息')
        }

        const path = data.route.paths[0]
        const distanceMeters = parseInt(path.distance) // 距离（米）
        const durationSeconds = parseInt(path.duration) // 时间（秒）

        // 异常检测：如果距离过大（超过1000公里），可能存在错误
        const distanceKm = distanceMeters / 1000
        if (distanceKm > 1000) {
          console.warn('[DemandsService] 警告：计算距离过大，可能存在异常:', distanceKm)
        }

        // 提取路线坐标点（用于地图绘制）
        const polylinePoints = this.extractPolylinePoints(path.steps || [])

        return {
          distance: distanceKm,
          distance_text: `${distanceKm.toFixed(2)}公里`,
          estimated_fare: distanceKm * 1,
          route_type: 'non_highway',
          route_duration: durationSeconds,
          duration_text: `约${Math.floor(durationSeconds / 60)}分钟`,
          polyline: polylinePoints // 新增：返回路线坐标点
        }
      } catch (error) {
        lastError = error
        console.error(`[DemandsService] API调用失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, error)

        // 如果是最后一次尝试，抛出错误
        if (attempt === maxRetries) {
          throw error
        }

        // 等待1秒后重试
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    throw lastError
  }

  // 降级方案：直线距离估算
  private calculateFallbackDistance(pickup_lat: number, pickup_lng: number, delivery_lat: number, delivery_lng: number) {
    const straightDistance = this.calculateStraightDistance(pickup_lat, pickup_lng, delivery_lat, delivery_lng)

    // 直线距离 × 1.5 ≈ 城市道路实际距离（考虑道路曲折度）
    const estimatedDistance = straightDistance * 1.5
    const estimatedFare = estimatedDistance * 1

    // 改进时间估算：城市道路平均时速20-25公里/小时
    const avgSpeed = 22.5 // km/h
    const estimatedTime = Math.floor(estimatedDistance / avgSpeed * 60)

    console.log('[DemandsService] 使用降级方案计算距离:', {
      straight_distance: straightDistance.toFixed(2),
      estimated_distance: estimatedDistance.toFixed(2),
      estimated_fare: estimatedFare.toFixed(2),
      estimated_time_minutes: estimatedTime
    })

    return {
      distance: estimatedDistance,
      distance_text: `${estimatedDistance.toFixed(2)}公里`,
      estimated_fare: estimatedFare,
      route_type: 'estimated',
      route_duration: estimatedTime,
      duration_text: `约${estimatedTime}分钟`,
      polyline: [
        { latitude: pickup_lat, longitude: pickup_lng },
        { latitude: delivery_lat, longitude: delivery_lng }
      ] // 降级方案返回起止点直线
    }
  }

  // 计算直线距离（Haversine公式）
  private calculateStraightDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // 地球半径，单位：公里
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // 提取路线坐标点（从高德地图API响应中）
  private extractPolylinePoints(steps: any[]): Array<{ latitude: number; longitude: number }> {
    const points: Array<{ latitude: number; longitude: number }> = []

    for (const step of steps) {
      if (step.polyline) {
        // 高德地图polyline格式：经度,纬度;经度,纬度;...
        const coords = step.polyline.split(';').map((coord: string) => {
          const [lng, lat] = coord.split(',').map(Number)
          return { latitude: lat, longitude: lng }
        })
        points.push(...coords)
      }
    }

    // 如果没有提取到点，返回空数组
    return points
  }

  // 获取缓存
  private getCachedDistance(key: string): DistanceCache | null {
    const cached = this.distanceCache.get(key)
    if (!cached) {
      return null
    }

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.distanceCache.delete(key)
      return null
    }

    return cached
  }

  // 设置缓存
  private setCachedDistance(key: string, data: DistanceCache, ttl?: number) {
    this.distanceCache.set(key, {
      ...data,
      timestamp: Date.now()
    })

    // 设置过期清理
    const cacheTTL = ttl || this.CACHE_TTL
    setTimeout(() => {
      this.distanceCache.delete(key)
    }, cacheTTL)
  }

  async create(createDemandDto: CreateDemandDto) {
    const {
      merchant_id,
      cargo_name,
      cargo_type,
      weight,
      volume,
      pickup_time,
      pickup_address,
      pickup_location,
      delivery_address,
      delivery_location,
      remarks,
      pickup_lat,
      pickup_lng,
      delivery_lat,
      delivery_lng,
      estimated_distance,
      estimated_fare,
      cargo_photos
    } = createDemandDto

    // 验证用户是否存在
    const client = getSupabaseClient()
    const { data: user, error: userError } = await client
      .from('users')
      .select('id, role')
      .eq('id', merchant_id)
      .maybeSingle()

    if (userError || !user) {
      throw new BadRequestException('用户不存在')
    }

    // 验证用户角色
    if (user.role !== 'merchant') {
      throw new BadRequestException('只有需求方可以发布需求')
    }

    // 创建需求记录
    const { data: demand, error: insertError } = await client
      .from('demands')
      .insert({
        merchant_id,
        cargo_name,
        cargo_type,
        weight: parseFloat(weight),
        volume: parseFloat(volume),
        pickup_time,
        pickup_address,
        pickup_location: pickup_location ? JSON.parse(pickup_location) : null,
        delivery_address,
        delivery_location: delivery_location ? JSON.parse(delivery_location) : null,
        remarks,
        pickup_lat: pickup_lat || null,
        pickup_lng: pickup_lng || null,
        delivery_lat: delivery_lat || null,
        delivery_lng: delivery_lng || null,
        estimated_distance: estimated_distance || null,
        estimated_fare: estimated_fare || null,
        route_type: estimated_distance ? 'non_highway' : null,
        cargo_photos: cargo_photos || [], // 货品照片URL数组
        demand_source: 'merchant',
        status: 'pending', // 默认待接单
      })
      .select()
      .single()

    if (insertError) {
      throw new BadRequestException(`创建需求失败: ${insertError.message}`)
    }

    return {
      code: 200,
      message: '需求发布成功',
      data: demand
    }
  }

  async findByMerchantId(merchantId?: string) {
    const client = getSupabaseClient()

    let query = client.from('demands').select('*')

    if (merchantId) {
      query = query.eq('merchant_id', merchantId)
    }

    const { data: demands, error } = await query.order('created_at', { ascending: false })

    if (error) {
      throw new BadRequestException(`查询失败: ${error.message}`)
    }

    return {
      code: 200,
      message: '查询成功',
      data: demands || []
    }
  }

  async findByStatus(status: string) {
    const client = getSupabaseClient()

    const { data: demands, error } = await client
      .from('demands')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) {
      throw new BadRequestException(`查询失败: ${error.message}`)
    }

    return {
      code: 200,
      message: '查询成功',
      data: demands || []
    }
  }

  async findById(id: string) {
    const client = getSupabaseClient()
    const { data: demand, error } = await client
      .from('demands')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !demand) {
      throw new NotFoundException('需求不存在')
    }

    return {
      code: 200,
      message: '查询成功',
      data: demand
    }
  }

  async update(id: string, updateDemandDto: UpdateDemandDto) {
    const client = getSupabaseClient()

    // 检查需求是否存在
    const { data: existingDemand, error: checkError } = await client
      .from('demands')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (checkError || !existingDemand) {
      throw new NotFoundException('需求不存在')
    }

    // 更新需求信息
    const updateData: any = {
      cargo_name: updateDemandDto.cargo_name,
      cargo_type: updateDemandDto.cargo_type,
      weight: updateDemandDto.weight ? parseFloat(updateDemandDto.weight) : existingDemand.weight,
      volume: updateDemandDto.volume ? parseFloat(updateDemandDto.volume) : existingDemand.volume,
      pickup_time: updateDemandDto.pickup_time,
      pickup_address: updateDemandDto.pickup_address,
      pickup_location: updateDemandDto.pickup_location ? JSON.parse(updateDemandDto.pickup_location) : existingDemand.pickup_location,
      delivery_address: updateDemandDto.delivery_address,
      delivery_location: updateDemandDto.delivery_location ? JSON.parse(updateDemandDto.delivery_location) : existingDemand.delivery_location,
      remarks: updateDemandDto.remarks,
    }

    // 添加可选字段
    if (updateDemandDto.pickup_lat !== undefined) {
      updateData.pickup_lat = updateDemandDto.pickup_lat
    }
    if (updateDemandDto.pickup_lng !== undefined) {
      updateData.pickup_lng = updateDemandDto.pickup_lng
    }
    if (updateDemandDto.delivery_lat !== undefined) {
      updateData.delivery_lat = updateDemandDto.delivery_lat
    }
    if (updateDemandDto.delivery_lng !== undefined) {
      updateData.delivery_lng = updateDemandDto.delivery_lng
    }
    if (updateDemandDto.estimated_distance !== undefined) {
      updateData.estimated_distance = updateDemandDto.estimated_distance
    }
    if (updateDemandDto.estimated_fare !== undefined) {
      updateData.estimated_fare = updateDemandDto.estimated_fare
    }
    if (updateDemandDto.cargo_photos !== undefined) {
      updateData.cargo_photos = updateDemandDto.cargo_photos
    }

    const { data: demand, error: updateError } = await client
      .from('demands')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      throw new BadRequestException(`更新失败: ${updateError.message}`)
    }

    return {
      code: 200,
      message: '更新成功',
      data: demand
    }
  }

  async cancel(id: string, reason?: string) {
    const client = getSupabaseClient()

    // 检查需求是否存在
    const { data: existingDemand, error: checkError } = await client
      .from('demands')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (checkError || !existingDemand) {
      throw new NotFoundException('需求不存在')
    }

    // 检查需求状态
    if (existingDemand.status !== 'pending') {
      throw new BadRequestException('只有待接单的需求可以取消')
    }

    // 物理删除需求（不保留数据）
    const { error: deleteError } = await client
      .from('demands')
      .delete()
      .eq('id', id)

    if (deleteError) {
      throw new BadRequestException(`删除失败: ${deleteError.message}`)
    }

    return {
      code: 200,
      message: '需求已删除',
      data: { id }
    }
  }

  async accept(id: string, ownerId: string, vehicleId: string, farePrice: number, note?: string) {
    const client = getSupabaseClient()

    // 验证车主是否存在
    const { data: owner, error: ownerError } = await client
      .from('users')
      .select('id, role')
      .eq('id', ownerId)
      .maybeSingle()

    if (ownerError || !owner) {
      throw new BadRequestException('车主不存在')
    }

    // 验证用户角色
    if (owner.role !== 'owner') {
      throw new BadRequestException('只有车主可以接单')
    }

    // 检查需求是否存在
    const { data: existingDemand, error: checkError } = await client
      .from('demands')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (checkError || !existingDemand) {
      throw new NotFoundException('需求不存在')
    }

    // 检查需求状态
    if (existingDemand.status !== 'pending') {
      throw new BadRequestException('只有待接单的需求可以接单')
    }

    // 验证车辆是否存在且可用
    const { data: vehicle, error: vehicleError } = await client
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .eq('status', 'active')
      .maybeSingle()

    if (vehicleError || !vehicle) {
      throw new BadRequestException('所选车辆不存在或不可用')
    }

    // ✅ 增加调试日志
    console.log('========== 接单权限检查 (demands.service) ==========')
    console.log('1. 接单用户 ID:', ownerId)
    console.log('2. 车辆 ID:', vehicleId)
    console.log('3. 车辆车主 ID:', vehicle.owner_id)
    console.log('4. 车辆 current_renter_id:', vehicle.current_renter_id)
    console.log('5. 车辆 ownership_type:', vehicle.ownership_type)
    console.log('6. 车辆状态:', { status: vehicle.status, is_available: vehicle.is_available, trip_status: vehicle.trip_status })

    // 检查车辆是否已被出租（租赁状态检查）
    if (vehicle.current_renter_id) {
      // 查询最新的租赁关系
      const { data: activeRental } = await client
        .from('vehicle_rentals')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .eq('status', 'active')
        .maybeSingle()

      console.log('7. 租赁关系 ID:', activeRental?.id)
      console.log('8. 租赁关系 renter_id:', activeRental?.renter_id)
      console.log('9. 租赁关系 owner_id:', activeRental?.owner_id)
      console.log('10. 租赁关系 status:', activeRental?.status)
      console.log('11. 租赁到期时间:', activeRental?.rent_end_date)

      if (activeRental) {
        // 如果租赁状态为 active，检查当前用户是车主还是租户
        if (ownerId === activeRental.renter_id) {
          // 当前用户是租户，可以使用租赁车辆接单
          console.log('✓ 权限检查通过：租户使用租赁车辆接单')
          console.log('===================================')
        } else if (ownerId === vehicle.owner_id) {
          // 当前用户是车主，车辆已被租出，不能接单
          console.log('✗ 权限检查失败：车主不能使用已出租的车辆')
          console.log('===================================')
          throw new BadRequestException(
            `该车辆已租给租户，租赁到期时间为 ${activeRental.rent_end_date.split('T')[0]}，无法接单`
          )
        } else {
          // 当前用户既不是车主也不是租户，不能接单
          console.log('✗ 权限检查失败：无权使用该车辆')
          console.log('===================================')
          throw new BadRequestException(
            `该车辆已租给其他用户，您无权使用该车辆`
          )
        }
      } else {
        // 如果租赁状态不是 active（可能是 pending 或已归还），清除 current_renter_id
        console.log('⚠️ 租赁关系非 active 状态，清除 current_renter_id')
        console.log('===================================')
        await client
          .from('vehicles')
          .update({ current_renter_id: null })
          .eq('id', vehicleId)
      }
    } else {
      // 未出租车辆：检查是否属于接单用户
      if (vehicle.owner_id !== ownerId) {
        console.log('✗ 权限检查失败：车辆不属于接单用户')
        console.log('===================================')
        throw new BadRequestException('所选车辆不存在或不可用')
      }
      console.log('✓ 权限检查通过：自有车辆（未出租）')
      console.log('===================================')
    }

    // 检查车辆是否已在运输中
    if (vehicle.trip_status === 'in_transit') {
      throw new BadRequestException('该车辆正在运输中，无法接单')
    }

    // 获取需求距离
    let totalDistance = 0
    if (existingDemand.estimated_distance) {
      totalDistance = parseFloat(existingDemand.estimated_distance as any)
    } else if (existingDemand.pickup_lat && existingDemand.pickup_lng &&
               existingDemand.delivery_lat && existingDemand.delivery_lng) {
      // 如果没有预设距离，计算直线距离
      totalDistance = this.calculateStraightDistance(
        parseFloat(existingDemand.pickup_lat as any),
        parseFloat(existingDemand.pickup_lng as any),
        parseFloat(existingDemand.delivery_lat as any),
        parseFloat(existingDemand.delivery_lng as any)
      )
    }

    // 如果车主没有传入运费，则根据车辆定价自动计算
    let finalFarePrice = farePrice
    let calculationDetail: FareCalculationDetail | null = null
    let isCustomFare = true

    if (farePrice === undefined || farePrice === null) {
      try {
        const fareResult = await this.fareCalculationService.calculateFare(vehicleId, totalDistance)
        finalFarePrice = fareResult.total_fare
        calculationDetail = fareResult.calculation_detail
        isCustomFare = false
        console.log('[DemandsService] 自动计算运费:', fareResult)
      } catch (error) {
        console.error('[DemandsService] 自动计算运费失败，使用默认运费:', error)
        // 使用默认运费：距离 × 1
        finalFarePrice = totalDistance * 1
      }
    }

    // 开始事务：更新需求状态、创建订单、更新车辆状态
    const { data: demand, error: updateError } = await client
      .from('demands')
      .update({
        status: 'accepted',
        owner_id: ownerId
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      throw new BadRequestException(`接单失败: ${updateError.message}`)
    }

    const orderSource = existingDemand.demand_source || 'merchant'
    let requesterId = existingDemand.merchant_id
    if (orderSource === 'enterprise' && existingDemand.enterprise_id) {
      const { data: enterprise } = await client
        .from('enterprises')
        .select('admin_id')
        .eq('id', existingDemand.enterprise_id)
        .single()
      requesterId = enterprise?.admin_id || existingDemand.enterprise_id
    }

    // 创建订单
    const { data: order, error: orderError } = await client
      .from('orders')
      .insert({
        demand_id: id,
        merchant_id: orderSource === 'merchant' ? existingDemand.merchant_id : null,
        enterprise_id: orderSource === 'enterprise' ? existingDemand.enterprise_id : null,
        enterprise_demand_id: orderSource === 'enterprise' ? existingDemand.enterprise_demand_id : null,
        order_source: orderSource,
        owner_id: ownerId,
        vehicle_id: vehicleId,
        status: 'accepted',
        fare_price: finalFarePrice,
        calculated_fare: finalFarePrice,
        fare_calculation_detail: calculationDetail ? JSON.stringify(calculationDetail) : null,
        is_custom_fare: isCustomFare,
        merchant_confirmed: false,
        pickup_time: existingDemand.pickup_time,
        pickup_address: existingDemand.pickup_address,
        delivery_address: existingDemand.delivery_address,
        remarks: note || ''
      })
      .select()
      .single()

    if (orderError) {
      // 如果订单创建失败，回滚需求状态
      await client
        .from('demands')
        .update({ status: 'pending', owner_id: null })
        .eq('id', id)
      throw new BadRequestException(`创建订单失败: ${orderError.message}`)
    }

    // 给需求方发送通知
    try {
      if (requesterId) {
        await this.notificationsService.create({
          userId: requesterId,
          type: 'order_accepted',
          title: '您的需求已被接单',
          content: `您发布的"${existingDemand.cargo_name}"需求已被接单，运费：¥${farePrice.toFixed(2)}，请确认运费后车主将开始运输`,
          relatedOrderId: order.id,
          relatedDemandId: id
        })
      }
    } catch (notificationError) {
      console.error('[DemandsService] 创建通知失败:', notificationError)
      // 通知创建失败不影响接单流程
    }

    // 更新车辆状态为运输中
    const { error: vehicleUpdateError } = await client
      .from('vehicles')
      .update({ trip_status: 'in_transit' })
      .eq('id', vehicleId)

    if (vehicleUpdateError) {
      console.error('[DemandsService] 更新车辆状态失败:', vehicleUpdateError)
      // 不影响接单流程，仅记录日志
    }

    return {
      code: 200,
      message: '接单成功',
      data: {
        demand,
        order
      }
    }
  }

  async getMerchantStats(merchantId: string) {
    const client = getSupabaseClient()

    // 获取所有需求数据
    const { data: demands, error: demandsError } = await client
      .from('demands')
      .select('*')
      .eq('merchant_id', merchantId)

    if (demandsError) {
      throw new BadRequestException(`查询失败: ${demandsError.message}`)
    }

    // 统计各状态数量
    const statusCounts = {
      pending: 0,
      accepted: 0,
      in_transit: 0,
      completed: 0,
      cancelled: 0
    }

    // 统计货品类型
    const cargoTypeCounts = {
      normal: 0,
      fresh: 0,
      fragile: 0
    }

    // 计算总重量和总体积
    let totalWeight = 0
    let totalVolume = 0

    demands.forEach(demand => {
      // 状态统计
      if (demand.status in statusCounts) {
        statusCounts[demand.status as keyof typeof statusCounts]++
      }

      // 货品类型统计
      if (demand.cargo_type in cargoTypeCounts) {
        cargoTypeCounts[demand.cargo_type as keyof typeof cargoTypeCounts]++
      }

      // 重量和体积统计（仅统计已完成的需求）
      if (demand.status === 'completed') {
        totalWeight += demand.weight
        totalVolume += demand.volume
      }
    })

    // 获取最近的需求（最近5条）
    const { data: recentDemands, error: recentError } = await client
      .from('demands')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (recentError) {
      throw new BadRequestException(`查询最近需求失败: ${recentError.message}`)
    }

    return {
      code: 200,
      message: '查询成功',
      data: {
        total_demands: demands.length,
        status_counts: statusCounts,
        cargo_type_counts: cargoTypeCounts,
        total_weight: totalWeight,
        total_volume: totalVolume,
        recent_demands: recentDemands || []
      }
    }
  }

  async saveAsTemplate(id: string, templateName: string) {
    const client = getSupabaseClient()

    // 查询需求详情
    const { data: demand, error: demandError } = await client
      .from('demands')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (demandError || !demand) {
      throw new NotFoundException('需求不存在')
    }

    // 解析地址坐标
    const pickupLocation = typeof demand.pickup_location === 'string'
      ? JSON.parse(demand.pickup_location)
      : demand.pickup_location
    const deliveryLocation = typeof demand.delivery_location === 'string'
      ? JSON.parse(demand.delivery_location)
      : demand.delivery_location

    // 创建模板
    const templateData = {
      user_id: demand.merchant_id,
      template_name: templateName,
      cargo_name: demand.cargo_name,
      cargo_type: demand.cargo_type,
      weight: demand.weight,
      volume: demand.volume,
      pickup_address: demand.pickup_address,
      pickup_lat: pickupLocation.latitude,
      pickup_lng: pickupLocation.longitude,
      delivery_address: demand.delivery_address,
      delivery_lat: deliveryLocation.latitude,
      delivery_lng: deliveryLocation.longitude,
      remarks: demand.remarks,
      estimated_distance: demand.estimated_distance,
      estimated_fare: demand.estimated_fare,
      is_default: false
    }

    return this.demandTemplatesService.create(templateData)
  }
}
