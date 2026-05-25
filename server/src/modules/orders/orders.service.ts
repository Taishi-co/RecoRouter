import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common'
import { CreateOrderDto } from './dto/orders.dto'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createFileStorage } from '@/storage/file-storage'
import { NotificationsService } from '../notifications/notification.service'

@Injectable()
export class OrdersService {
  constructor(
    private readonly notificationsService: NotificationsService
  ) {}
  async create(createOrderDto: CreateOrderDto) {
    const { demand_id, vehicle_id, owner_id } = createOrderDto

    const client = getSupabaseClient()

    // 检查需求是否存在
    const { data: demand, error: demandError } = await client
      .from('demands')
      .select('*')
      .eq('id', demand_id)
      .maybeSingle()

    if (demandError || !demand) {
      throw new NotFoundException('需求不存在')
    }

    // 检查需求状态
    if (demand.status !== 'pending') {
      throw new BadRequestException('该需求已被接单或取消')
    }

    // 检查车辆是否存在且可用
    const { data: vehicle, error: vehicleError } = await client
      .from('vehicles')
      .select('*')
      .eq('id', vehicle_id)
      .maybeSingle()

    if (vehicleError || !vehicle) {
      throw new NotFoundException('车辆不存在')
    }

    if (vehicle.status !== 'active') {
      throw new BadRequestException('车辆不可用')
    }

    // ✅ 增加调试日志
    console.log('========== 接单权限检查 ==========')
    console.log('1. 接单用户 ID:', owner_id)
    console.log('2. 车辆 ID:', vehicle_id)
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
        .eq('vehicle_id', vehicle_id)
        .eq('status', 'active')
        .maybeSingle()

      console.log('7. 租赁关系 ID:', activeRental?.id)
      console.log('8. 租赁关系 renter_id:', activeRental?.renter_id)
      console.log('9. 租赁关系 owner_id:', activeRental?.owner_id)
      console.log('10. 租赁关系 status:', activeRental?.status)
      console.log('11. 租赁到期时间:', activeRental?.rent_end_date)

      if (activeRental) {
        // 如果租赁状态为 active，检查当前用户是车主还是租户
        if (owner_id === activeRental.renter_id) {
          // 当前用户是租户，可以使用租赁车辆接单
          console.log('✓ 权限检查通过：租户使用租赁车辆接单')
          console.log('===================================')
        } else if (owner_id === vehicle.owner_id) {
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
          .eq('id', vehicle_id)
      }
    } else {
      console.log('✓ 权限检查通过：自有车辆（未出租）')
      console.log('===================================')
    }

    const orderSource = demand.demand_source || 'merchant'

    // 创建订单
    const { data: order, error: insertError } = await client
      .from('orders')
      .insert({
        demand_id,
        vehicle_id,
        merchant_id: orderSource === 'merchant' ? demand.merchant_id : null,
        enterprise_id: orderSource === 'enterprise' ? demand.enterprise_id : null,
        enterprise_demand_id: orderSource === 'enterprise' ? demand.enterprise_demand_id : null,
        order_source: orderSource,
        owner_id,
        status: 'accepted',
        accept_time: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      throw new BadRequestException(`创建订单失败: ${insertError.message}`)
    }

    // 更新需求状态为已接单
    await client
      .from('demands')
      .update({ status: 'accepted' })
      .eq('id', demand_id)

    // 给需求方发送通知
    try {
      let requesterId = demand.merchant_id
      if (orderSource === 'enterprise' && demand.enterprise_id) {
        const { data: enterprise } = await client
          .from('enterprises')
          .select('admin_id')
          .eq('id', demand.enterprise_id)
          .single()
        requesterId = enterprise?.admin_id || demand.enterprise_id
      }
      await this.notificationsService.create({
        userId: requesterId,
        type: 'order_accepted',
        title: '您的需求已被接单',
        content: `您发布的"${demand.cargo_name}"需求已被接单，请关注订单状态`,
        relatedOrderId: order.id,
        relatedDemandId: demand.id
      })
    } catch (notificationError) {
      console.error('[OrdersService] 创建通知失败:', notificationError)
      // 通知创建失败不影响接单流程
    }

    return {
      code: 200,
      message: '接单成功',
      data: order
    }
  }

  async findByUserId(ownerId?: string, merchantId?: string, status?: string) {
    const client = getSupabaseClient()

    let query = client.from('orders').select('*')

    if (ownerId) {
      query = query.eq('owner_id', ownerId)
    }

    if (merchantId) {
      query = query.eq('merchant_id', merchantId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: orders, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('[OrdersService] 查询订单失败:', error)
      throw new BadRequestException(`查询失败: ${error.message}`)
    }

    return {
      code: 200,
      message: '查询成功',
      data: orders || []
    }
  }

  async findById(id: string) {
    const client = getSupabaseClient()
    const { data: order, error } = await client
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !order) {
      throw new NotFoundException('订单不存在')
    }

    return {
      code: 200,
      message: '查询成功',
      data: order
    }
  }

  async startTransport(id: string) {
    const client = getSupabaseClient()

    // 检查订单是否存在
    const { data: existingOrder, error: checkError } = await client
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (checkError || !existingOrder) {
      throw new NotFoundException('订单不存在')
    }

    // 检查订单状态
    if (existingOrder.status !== 'accepted') {
      throw new BadRequestException('只有已接单的订单可以开始运输')
    }

    // 检查需求方是否已确认运费
    if (!existingOrder.merchant_confirmed) {
      throw new BadRequestException('需求方尚未确认运费，无法开始运输')
    }

    // 更新订单状态为运输中
    const { data: order, error: updateError } = await client
      .from('orders')
      .update({
        status: 'in_transit',
        pickup_time: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      throw new BadRequestException(`开始运输失败: ${updateError.message}`)
    }

    // 更新需求状态为运输中
    await client
      .from('demands')
      .update({ status: 'in_transit' })
      .eq('id', existingOrder.demand_id)

    return {
      code: 200,
      message: '已开始运输',
      data: order
    }
  }

  async cancelOrder(id: string, reason: string, merchantId: string) {
    const client = getSupabaseClient()

    // 检查订单是否存在
    const { data: existingOrder, error: checkError } = await client
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (checkError || !existingOrder) {
      throw new NotFoundException('订单不存在')
    }

    // 检查订单状态 - 只有已接单的订单可以取消
    if (existingOrder.status !== 'accepted') {
      throw new BadRequestException('只有已接单的订单可以取消')
    }

    // 检查运费确认状态 - 已确认运费的订单不能直接取消，需要申请取消
    if (existingOrder.merchant_confirmed) {
      throw new BadRequestException('运费已确认，不能直接取消，请联系车主协商取消')
    }

    // 检查是否是需求方的订单
    if (existingOrder.merchant_id !== merchantId) {
      throw new BadRequestException('无权取消此订单')
    }

    // 更新订单状态为已取消
    const { data: order, error: updateError } = await client
      .from('orders')
      .update({
        status: 'cancelled',
        cancel_reason: reason,
        cancel_time: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      throw new BadRequestException(`取消订单失败: ${updateError.message}`)
    }

    // 更新需求状态为待接单（不是已取消，让其他车主可以继续接单）
    await client
      .from('demands')
      .update({ status: 'pending', owner_id: null })
      .eq('id', existingOrder.demand_id)

    // 恢复车辆状态为空闲
    if (existingOrder.vehicle_id) {
      await client
        .from('vehicles')
        .update({ trip_status: 'idle' })
        .eq('id', existingOrder.vehicle_id)
    }

    // 给车主发送通知
    if (existingOrder.owner_id) {
      try {
        await this.notificationsService.create({
          userId: existingOrder.owner_id,
          type: 'order_cancelled',
          title: '订单已被取消',
          content: `您接的订单"${existingOrder.remarks || '订单'}"已被需求方取消，取消原因：${reason}`,
          relatedOrderId: existingOrder.id,
          relatedDemandId: existingOrder.demand_id
        })
      } catch (notificationError) {
        console.error('[OrdersService] 创建通知失败:', notificationError)
        // 通知创建失败不影响取消订单流程
      }
    }

    return {
      code: 200,
      message: '订单已取消，需求已恢复待接单状态',
      data: order
    }
  }

  /**
   * 运力方取消订单（已接单状态，需求方未确认运费）
   */
  async cancelOrderByOwner(id: string, reason: string, ownerId: string) {
    const client = getSupabaseClient()

    console.log('[OrdersService] 运力方取消订单:', id, 'reason:', reason, 'ownerId:', ownerId)

    // 检查订单是否存在
    const { data: existingOrder, error: checkError } = await client
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (checkError || !existingOrder) {
      throw new NotFoundException('订单不存在')
    }

    // 检查订单状态 - 只有已接单的订单可以取消
    if (existingOrder.status !== 'accepted') {
      throw new BadRequestException('只有已接单的订单可以取消')
    }

    // 检查运费确认状态 - 已确认运费的订单不能直接取消，需要申请取消
    if (existingOrder.merchant_confirmed) {
      throw new BadRequestException('运费已确认，不能直接取消，请联系需求方协商取消')
    }

    // 检查是否是运力方的订单
    if (existingOrder.owner_id !== ownerId) {
      throw new BadRequestException('无权取消此订单')
    }

    // 更新订单状态为已取消
    const { data: order, error: updateError } = await client
      .from('orders')
      .update({
        status: 'cancelled',
        cancel_reason: reason,
        cancel_time: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      throw new BadRequestException(`取消订单失败: ${updateError.message}`)
    }

    // 更新需求状态为待接单（让其他车主可以继续接单）
    await client
      .from('demands')
      .update({ status: 'pending', owner_id: null })
      .eq('id', existingOrder.demand_id)

    // 恢复车辆状态为空闲
    if (existingOrder.vehicle_id) {
      await client
        .from('vehicles')
        .update({ trip_status: 'idle' })
        .eq('id', existingOrder.vehicle_id)
    }

    // 给需求方发送通知
    if (existingOrder.merchant_id) {
      try {
        await this.notificationsService.create({
          userId: existingOrder.merchant_id,
          type: 'order_cancelled',
          title: '订单已被车主取消',
          content: `您的订单"${existingOrder.remarks || '订单'}"已被车主取消，取消原因：${reason}`,
          relatedOrderId: existingOrder.id,
          relatedDemandId: existingOrder.demand_id
        })
      } catch (notificationError) {
        console.error('[OrdersService] 创建通知失败:', notificationError)
        // 通知创建失败不影响取消订单流程
      }
    }

    console.log('[OrdersService] 运力方取消订单成功:', id)

    return {
      code: 200,
      message: '订单已取消，需求已恢复待接单状态',
      data: order
    }
  }

  async complete(id: string, pickupPhotoKey?: string, deliveryPhotoKey?: string) {
    const client = getSupabaseClient()

    // 检查订单是否存在
    const { data: existingOrder, error: checkError } = await client
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (checkError || !existingOrder) {
      throw new NotFoundException('订单不存在')
    }

    // 检查订单状态
    if (existingOrder.status !== 'in_transit') {
      throw new BadRequestException('只有运输中的订单可以完成')
    }

    // 获取平台佣金比例
    const { data: settings } = await client
      .from('platform_settings')
      .select('commission_rate')
      .eq('id', 'default')
      .single()

    const commissionRate = settings?.commission_rate || 5.00
    const farePrice = existingOrder.fare_price || 0
    const commissionAmount = (farePrice * commissionRate) / 100

    // 更新订单状态为运输完成（待付款）
    const { data: order, error: updateError } = await client
      .from('orders')
      .update({
        status: 'transport_completed',
        payment_status: 'unpaid',
        commission_payment_status: 'unpaid',
        commission_amount: commissionAmount,
        transport_completed_time: new Date().toISOString(),
        complete_time: new Date().toISOString(),
        pickup_photo_key: pickupPhotoKey || existingOrder.pickup_photo_key,
        delivery_photo_key: deliveryPhotoKey || existingOrder.delivery_photo_key
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      throw new BadRequestException(`完成运输失败: ${updateError.message}`)
    }

    // 更新需求状态为运输完成
    await client
      .from('demands')
      .update({ status: 'transport_completed' })
      .eq('id', existingOrder.demand_id)

    // 注意：此时不恢复车辆状态，等待佣金支付完成后才恢复

    return {
      code: 200,
      message: '运输已完成，等待需求方付款',
      data: order
    }
  }

  // 需求方标记已付款
  async markPayment(orderId: string) {
    const client = getSupabaseClient()

    // 检查订单是否存在
    const { data: order, error: checkError } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (checkError || !order) {
      throw new NotFoundException('订单不存在')
    }

    // 检查订单状态
    if (order.status !== 'transport_completed') {
      throw new BadRequestException('订单状态不正确')
    }

    if (order.payment_status === 'paid') {
      throw new BadRequestException('已标记为已付款')
    }

    // 更新付款状态
    const { data: updatedOrder, error: updateError } = await client
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_time: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      throw new BadRequestException(`标记付款失败: ${updateError.message}`)
    }

    return {
      code: 200,
      message: '已标记为已付款，等待运力方确认',
      data: updatedOrder
    }
  }

  // 运力方确认收款
  async confirmPayment(orderId: string) {
    const client = getSupabaseClient()

    // 检查订单是否存在
    const { data: order, error: checkError } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (checkError || !order) {
      throw new NotFoundException('订单不存在')
    }

    // 检查订单状态
    if (order.status !== 'transport_completed') {
      throw new BadRequestException('订单状态不正确')
    }

    if (order.payment_status !== 'paid') {
      throw new BadRequestException('需求方尚未付款')
    }

    // 更新订单状态
    const { data: updatedOrder, error: updateError } = await client
      .from('orders')
      .update({
        status: 'payment_confirmed',
        payment_confirm_time: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      throw new BadRequestException(`确认收款失败: ${updateError.message}`)
    }

    // 更新需求状态
    await client
      .from('demands')
      .update({ status: 'payment_confirmed' })
      .eq('id', order.demand_id)

    // 给需求方发送通知
    if (order.merchant_id) {
      try {
        await this.notificationsService.create({
          userId: order.merchant_id,
          type: 'payment_received',
          title: '车主已确认收款',
          content: `车主已确认收到运费¥${order.fare_price?.toFixed(2) || '0.00'}，订单运输已完成`,
          relatedOrderId: order.id,
          relatedDemandId: order.demand_id
        })
      } catch (notificationError) {
        console.error('[OrdersService] 创建通知失败:', notificationError)
        // 通知创建失败不影响确认收款流程
      }
    }

    return {
      code: 200,
      message: '收款已确认，请向平台支付撮合佣金',
      data: updatedOrder
    }
  }

  // 获取付款信息（需求方查看）
  async getPaymentInfo(orderId: string) {
    console.log('[OrdersService] 获取付款信息，订单ID:', orderId)
    const client = getSupabaseClient()

    // 先查询订单基本信息
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    console.log('[OrdersService] 订单基础查询结果:', { order, orderError })

    if (orderError || !order) {
      console.error('[OrdersService] 订单不存在:', orderError)
      throw new NotFoundException('订单不存在')
    }

    // 查询需求信息
    const { data: demand, error: demandError } = await client
      .from('demands')
      .select('merchant_id, pickup_address, delivery_address, cargo_name')
      .eq('id', order.demand_id)
      .maybeSingle()

    if (demandError) {
      console.error('[OrdersService] 需求信息查询失败:', demandError)
    }

    // 查询车主信息
    const { data: owner, error: ownerError } = await client
      .from('users')
      .select('id, name, phone, wechat_payment_qr')
      .eq('id', order.owner_id)
      .maybeSingle()

    if (ownerError) {
      console.error('[OrdersService] 车主信息查询失败:', ownerError)
    }

    console.log('[OrdersService] 关联数据:', { demand, owner })

    // 如果车主有收款码，生成签名URL
    let paymentQrUrl: string | null = null
    if (owner?.wechat_payment_qr) {
      try {
        const storage = createFileStorage()
        paymentQrUrl = await storage.generatePresignedUrl({
          key: owner.wechat_payment_qr,
          expireTime: 86400
        })
        console.log('[OrdersService] 收款码URL生成成功:', paymentQrUrl)
      } catch (err) {
        console.error('[OrdersService] 生成收款码URL失败:', err)
      }
    }

    const result = {
      orderId: order.id,
      farePrice: order.fare_price,
      commissionAmount: order.commission_amount,
      ownerName: owner?.name,
      ownerPhone: owner?.phone,
      paymentQr: paymentQrUrl,
      paymentStatus: order.payment_status,
      status: order.status,
      pickupAddress: demand?.pickup_address,
      deliveryAddress: demand?.delivery_address,
      cargoName: demand?.cargo_name
    }

    console.log('[OrdersService] 返回结果:', result)

    return {
      code: 200,
      message: '查询成功',
      data: result
    }
  }

  // 运力方标记已付佣金
  async markCommissionPayment(orderId: string, paymentProof?: string) {
    const client = getSupabaseClient()

    // 检查订单是否存在
    const { data: order, error: checkError } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (checkError || !order) {
      throw new NotFoundException('订单不存在')
    }

    // 检查订单状态
    if (order.status !== 'payment_confirmed') {
      throw new BadRequestException('请先确认收款')
    }

    if (order.commission_payment_status === 'paid') {
      throw new BadRequestException('已标记为已支付佣金')
    }

    // 更新佣金付款状态
    const { data: updatedOrder, error: updateError } = await client
      .from('orders')
      .update({
        commission_payment_status: 'paid',
        commission_payment_time: new Date().toISOString(),
        status: 'commission_pending'
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      throw new BadRequestException(`标记支付佣金失败: ${updateError.message}`)
    }

    return {
      code: 200,
      message: '已提交佣金支付，等待平台审核',
      data: updatedOrder
    }
  }

  // 获取佣金支付信息（运力方查看）
  async getCommissionInfo(orderId: string) {
    const client = getSupabaseClient()

    const { data: order, error } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (error || !order) {
      throw new NotFoundException('订单不存在')
    }

    // 获取平台收款码
    let platformPaymentQrUrl: string | null = null
    const { data: settings } = await client
      .from('platform_settings')
      .select('commission_payment_qr')
      .eq('id', 'default')
      .single()

    if (settings?.commission_payment_qr) {
      try {
        const storage = createFileStorage()
        platformPaymentQrUrl = await storage.generatePresignedUrl({
          key: settings.commission_payment_qr,
          expireTime: 86400
        })
      } catch (err) {
        console.error('[OrdersService] 生成平台收款码URL失败:', err)
      }
    }

    return {
      code: 200,
      message: '查询成功',
      data: {
        orderId: order.id,
        farePrice: order.fare_price,
        commissionAmount: order.commission_amount,
        platformPaymentQr: platformPaymentQrUrl,
        commissionPaymentStatus: order.commission_payment_status,
        status: order.status
      }
    }
  }

  // 管理员确认佣金支付
  async confirmCommission(orderId: string) {
    const client = getSupabaseClient()

    // 检查订单是否存在
    const { data: order, error: checkError } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (checkError || !order) {
      throw new NotFoundException('订单不存在')
    }

    // 检查订单状态
    if (order.status !== 'commission_pending') {
      throw new BadRequestException('订单状态不正确')
    }

    if (order.commission_payment_status !== 'paid') {
      throw new BadRequestException('运力方尚未支付佣金')
    }

    // 更新订单状态为已完成
    const { data: updatedOrder, error: updateError } = await client
      .from('orders')
      .update({
        status: 'completed',
        commission_confirm_time: new Date().toISOString(),
        actual_complete_time: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      throw new BadRequestException(`确认佣金失败: ${updateError.message}`)
    }

    // 更新需求状态为已完成
    await client
      .from('demands')
      .update({ status: 'completed' })
      .eq('id', order.demand_id)

    // 恢复车辆状态为空闲（此时订单才真正完成）
    if (order.vehicle_id) {
      await client
        .from('vehicles')
        .update({ trip_status: 'idle' })
        .eq('id', order.vehicle_id)
    }

    // 给运力方和需求方各增加 2 分信用积分
    try {
      // 给运力方增加积分
      if (order.owner_id) {
        const { data: owner } = await client
          .from('users')
          .select('credit_score')
          .eq('id', order.owner_id)
          .single()

        const ownerCurrentScore = owner?.credit_score || 100
        const ownerNewScore = ownerCurrentScore + 2

        await client
          .from('users')
          .update({ credit_score: ownerNewScore })
          .eq('id', order.owner_id)
      }

      // 给需求方增加积分
      if (order.merchant_id) {
        const { data: merchant } = await client
          .from('users')
          .select('credit_score')
          .eq('id', order.merchant_id)
          .single()

        const merchantCurrentScore = merchant?.credit_score || 100
        const merchantNewScore = merchantCurrentScore + 2

        await client
          .from('users')
          .update({ credit_score: merchantNewScore })
          .eq('id', order.merchant_id)
      }
    } catch (creditError) {
      console.error('[OrdersService] 更新信用积分失败:', creditError)
      // 积分更新失败不影响确认佣金流程
    }

    // 给车主发送通知
    if (order.owner_id) {
      try {
        await this.notificationsService.create({
          userId: order.owner_id,
          type: 'commission_confirmed',
          title: '佣金已审核通过',
          content: `您支付的佣金¥${order.commission_amount?.toFixed(2) || '0.00'}已审核通过，订单已完成，车辆已恢复空闲状态。信用积分 +2`,
          relatedOrderId: order.id,
          relatedDemandId: order.demand_id
        })
      } catch (notificationError) {
        console.error('[OrdersService] 创建通知失败:', notificationError)
        // 通知创建失败不影响确认佣金流程
      }
    }

    // 给需求方发送通知
    if (order.merchant_id) {
      try {
        await this.notificationsService.create({
          userId: order.merchant_id,
          type: 'order_completed',
          title: '订单已完成',
          content: `您的订单已完成，感谢使用本平台。信用积分 +2`,
          relatedOrderId: order.id,
          relatedDemandId: order.demand_id
        })
      } catch (notificationError) {
        console.error('[OrdersService] 创建通知失败:', notificationError)
        // 通知创建失败不影响确认佣金流程
      }
    }

    return {
      code: 200,
      message: '佣金已确认，订单完成',
      data: updatedOrder
    }
  }

  async confirmFare(orderId: string) {
    const client = getSupabaseClient()

    // 检查订单是否存在
    const { data: order, error: checkError } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (checkError || !order) {
      throw new NotFoundException('订单不存在')
    }

    // 检查订单状态
    if (order.status !== 'accepted') {
      throw new BadRequestException('只有已接单的订单可以确认运费')
    }

    // 检查是否已确认
    if (order.merchant_confirmed) {
      throw new BadRequestException('订单已确认运费')
    }

    // 更新订单确认状态
    const { data: updatedOrder, error: updateError } = await client
      .from('orders')
      .update({
        merchant_confirmed: true,
        confirm_time: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      throw new BadRequestException(`确认运费失败: ${updateError.message}`)
    }

    // 给车主发送通知
    if (order.owner_id) {
      try {
        await this.notificationsService.create({
          userId: order.owner_id,
          type: 'fare_confirmed',
          title: '运费已确认',
          content: `需求方已确认运费¥${order.fare_price?.toFixed(2) || '0.00'}，请开始运输`,
          relatedOrderId: order.id,
          relatedDemandId: order.demand_id
        })
      } catch (notificationError) {
        console.error('[OrdersService] 创建通知失败:', notificationError)
        // 通知创建失败不影响确认运费流程
      }
    }

    return {
      code: 200,
      message: '运费已确认',
      data: updatedOrder
    }
  }

  // 获取运力方收益统计
  async getOwnerRevenueStats(ownerId: string) {
    console.log('[OrdersService] 获取运力方收益统计，ownerId:', ownerId)
    const client = getSupabaseClient()

    // 查询已完成的订单
    const { data: completedOrders, error: ordersError } = await client
      .from('orders')
      .select(`
        id,
        fare_price,
        commission_amount,
        payment_status,
        commission_payment_status,
        actual_complete_time,
        demands (
          cargo_name,
          pickup_address,
          delivery_address
        )
      `)
      .eq('owner_id', ownerId)
      .eq('status', 'completed')
      .order('actual_complete_time', { ascending: false, nullsFirst: false })

    if (ordersError) {
      console.error('[OrdersService] 查询订单失败:', ordersError)
      throw new BadRequestException(`查询订单失败: ${ordersError.message}`)
    }

    console.log('[OrdersService] 查询到的订单数:', completedOrders?.length || 0)

    // 计算统计数据
    const totalFare = (completedOrders || []).reduce((sum: number, order: any) => {
      return sum + (order.payment_status === 'paid' ? order.fare_price : 0)
    }, 0)

    const totalCommission = (completedOrders || []).reduce((sum: number, order: any) => {
      return sum + (order.commission_payment_status === 'paid' ? order.commission_amount : 0)
    }, 0)

    const netRevenue = totalFare - totalCommission

    // 构建收益明细列表
    const revenueList = (completedOrders || []).map((order: any) => {
      const hasReceivedFare = order.payment_status === 'paid'
      const hasPaidCommission = order.commission_payment_status === 'paid'

      return {
        id: order.id,
        cargoName: (order.demands as any)?.cargo_name || '',
        farePrice: order.fare_price,
        commissionAmount: order.commission_amount,
        receivedFare: hasReceivedFare ? order.fare_price : 0,
        paidCommission: hasPaidCommission ? order.commission_amount : 0,
        netIncome: hasReceivedFare ? (order.fare_price - (hasPaidCommission ? order.commission_amount : 0)) : 0,
        completedTime: order.actual_complete_time,
        paymentStatus: order.payment_status,
        commissionPaymentStatus: order.commission_payment_status
      }
    })

    const result = {
      summary: {
        totalFare,
        totalCommission,
        netRevenue,
        totalOrders: completedOrders?.length || 0,
        paidOrders: (completedOrders || []).filter((o: any) => o.payment_status === 'paid').length,
        pendingPaymentOrders: (completedOrders || []).filter((o: any) => o.payment_status === 'unpaid').length
      },
      revenueList
    }

    console.log('[OrdersService] 收益统计结果:', result)

    return {
      code: 200,
      message: '查询成功',
      data: result
    }
  }

  // 获取平台佣金汇总统计
  async getCommissionSummary() {
    console.log('[OrdersService] 获取平台佣金汇总统计')
    const client = getSupabaseClient()

    // 查询已完成和待审核佣金的订单
    const { data: orders, error: ordersError } = await client
      .from('orders')
      .select(`
        id,
        status,
        fare_price,
        commission_amount,
        payment_status,
        commission_payment_status,
        commission_payment_time,
        actual_complete_time,
        owner_id,
        demands (
          cargo_name,
          pickup_address,
          delivery_address
        )
      `)
      .in('status', ['completed', 'commission_pending'])
      .order('actual_complete_time', { ascending: false, nullsFirst: false })

    if (ordersError) {
      console.error('[OrdersService] 查询订单失败:', ordersError)
      throw new BadRequestException(`查询订单失败: ${ordersError.message}`)
    }

    // 获取车主和车辆信息
    const ownerIds = orders?.map((o: any) => o.owner_id).filter(Boolean) || []
    const { data: users, error: usersError } = ownerIds.length > 0
      ? await client.from('users').select('id, name').in('id', ownerIds)
      : { data: [], error: null }

    const userMap = new Map<string, string>()
    if (users) {
      users.forEach((u: any) => {
        userMap.set(u.id, u.name)
      })
    }

    // 计算汇总数据
    const summary = {
      totalCommission: 0,
      confirmedCommission: 0,
      pendingCommission: 0,
      totalOrders: orders?.length || 0
    }

    // 构建佣金订单列表
    const commissionOrders = (orders || []).map((order: any) => {
      // 累加佣金
      // 已确认佣金：佣金已支付且平台已确认（订单状态为 completed）
      if (order.commission_payment_status === 'paid' && order.status === 'completed') {
        const amount = Number(order.commission_amount) || 0
        summary.confirmedCommission += amount
        summary.totalCommission += amount
      }
      // 待审核佣金：佣金已支付但平台未确认（订单状态为 commission_pending）
      else if (order.commission_payment_status === 'paid' && order.status === 'commission_pending') {
        const amount = Number(order.commission_amount) || 0
        summary.pendingCommission += amount
        summary.totalCommission += amount
      }

      return {
        id: order.id,
        cargoName: (order.demands as any)?.cargo_name || '',
        farePrice: order.fare_price,
        commissionAmount: order.commission_amount,
        commissionStatus: order.commission_payment_status,
        fareStatus: order.payment_status,
        completedTime: order.actual_complete_time,
        paymentTime: order.commission_payment_time,
        ownerName: userMap.get(order.owner_id) || '未知',
        status: order.status
      }
    })

    console.log('[OrdersService] 佣金汇总统计:', summary)

    return {
      code: 200,
      message: '查询成功',
      data: {
        summary,
        commissionOrders
      }
    }
  }

  // 获取待审核佣金订单
  async getPendingCommissionOrders() {
    console.log('[OrdersService] 获取待审核佣金订单')
    const client = getSupabaseClient()

    const { data: orders, error: ordersError } = await client
      .from('orders')
      .select(`
        id,
        fare_price,
        commission_amount,
        commission_payment_status,
        commission_payment_time,
        owner_id,
        demands (
          cargo_name,
          pickup_address,
          delivery_address
        )
      `)
      .eq('status', 'commission_pending')
      .order('commission_payment_time', { ascending: false, nullsFirst: true })

    if (ordersError) {
      console.error('[OrdersService] 查询订单失败:', ordersError)
      throw new BadRequestException(`查询失败: ${ordersError.message}`)
    }

    // 获取车主信息
    const ownerIds = orders?.map((o: any) => o.owner_id).filter(Boolean) || []
    const { data: users, error: usersError } = ownerIds.length > 0
      ? await client.from('users').select('id, name').in('id', ownerIds)
      : { data: [], error: null }

    const userMap = new Map<string, string>()
    if (users) {
      users.forEach((u: any) => {
        userMap.set(u.id, u.name)
      })
    }

    // 映射数据为前端需要的格式
    const pendingOrders = (orders || []).map((order: any) => {
      return {
        id: order.id,
        cargoName: (order.demands as any)?.cargo_name || '未知货物',
        farePrice: order.fare_price,
        commissionAmount: order.commission_amount,
        commissionStatus: order.commission_payment_status,
        paymentTime: order.commission_payment_time,
        ownerName: userMap.get(order.owner_id) || '未知车主'
      }
    })

    return {
      code: 200,
      message: '查询成功',
      data: pendingOrders
    }
  }
}
