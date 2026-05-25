import { Injectable, NotFoundException } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'

@Injectable()
export class AdminService {
  async getUsers(filters: { role?: string; status?: string }) {
    const client = getSupabaseClient()

    let query = client
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters.role) {
      query = query.eq('role', filters.role)
    }

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    const { data: users, error } = await query

    if (error) {
      throw new NotFoundException('查询用户列表失败')
    }

    // 移除密码字段
    const usersWithoutPassword = users.map(user => {
      const { password, ...userWithoutPassword } = user as any
      return userWithoutPassword
    })

    return {
      code: 200,
      message: '查询成功',
      data: usersWithoutPassword || []
    }
  }

  async updateUserStatus(userId: string, status: 'active' | 'disabled') {
    const client = getSupabaseClient()

    // 检查用户是否存在
    const { data: existingUser, error: checkError } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (checkError || !existingUser) {
      throw new NotFoundException('用户不存在')
    }

    // 更新用户状态
    const { data: user, error: updateError } = await client
      .from('users')
      .update({ status })
      .eq('id', userId)
      .select()
      .single()

    if (updateError) {
      throw new NotFoundException('更新用户状态失败')
    }

    // 移除密码字段
    const { password, ...userWithoutPassword } = user as any

    return {
      code: 200,
      message: '更新成功',
      data: userWithoutPassword
    }
  }

  async getOrders(filters: { status?: string }) {
    const client = getSupabaseClient()

    // 先查询订单列表
    let query = client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    const { data: orders, error: ordersError } = await query

    if (ordersError) {
      console.error('[AdminService] Query orders error:', ordersError)
      throw new NotFoundException(`查询订单列表失败: ${ordersError.message}`)
    }

    if (!orders || orders.length === 0) {
      return {
        code: 200,
        message: '查询成功',
        data: []
      }
    }

    // 获取所有相关的需求ID、车辆ID、车主ID、需求方ID
    const demandIds = orders.map(o => o.demand_id).filter(Boolean)
    const vehicleIds = orders.map(o => o.vehicle_id).filter(Boolean)
    const ownerIds = orders.map(o => o.owner_id).filter(Boolean)
    const merchantIds = orders.map(o => o.merchant_id).filter(Boolean)

    // 批量查询需求
    const { data: demands } = await client
      .from('demands')
      .select('id, cargo_name, cargo_type, weight, volume, pickup_address, delivery_address, pickup_time')
      .in('id', demandIds)

    // 批量查询车辆
    const { data: vehicles } = await client
      .from('vehicles')
      .select('id, vehicle_type, license_plate')
      .in('id', vehicleIds)

    // 批量查询车主和需求方
    const { data: users } = await client
      .from('users')
      .select('id, username, phone')
      .in('id', [...ownerIds, ...merchantIds])

    // 创建查找映射
    const demandMap = new Map(demands?.map(d => [d.id, d]) || [])
    const vehicleMap = new Map(vehicles?.map(v => [v.id, v]) || [])
    const userMap = new Map(users?.map(u => [u.id, u]) || [])

    // 组装数据
    const enrichedOrders = orders.map(order => ({
      ...order,
      demand: demandMap.get(order.demand_id) || null,
      vehicle: order.vehicle_id ? vehicleMap.get(order.vehicle_id) : null,
      owner: order.owner_id ? userMap.get(order.owner_id) : null,
      merchant: order.merchant_id ? userMap.get(order.merchant_id) : null
    }))

    return {
      code: 200,
      message: '查询成功',
      data: enrichedOrders
    }
  }

  async getStatistics() {
    const client = getSupabaseClient()

    // 查询用户总数（按角色分类）
    const { data: usersByRole, error: usersError } = await client
      .from('users')
      .select('role, status')
      .not('role', 'eq', 'admin')

    // 查询订单总数（按状态分类）
    const { data: ordersByStatus, error: ordersError } = await client
      .from('orders')
      .select('status')

    // 查询车辆总数
    const { data: vehiclesData, error: vehiclesError } = await client
      .from('vehicles')
      .select('status')

    // 查询需求总数
    const { data: demandsData, error: demandsError } = await client
      .from('demands')
      .select('status')

    if (usersError || ordersError || vehiclesError || demandsError) {
      throw new NotFoundException('查询统计数据失败')
    }

    // 统计数据
    const stats = {
      users: {
        total: usersByRole?.length || 0,
        owner: usersByRole?.filter(u => u.role === 'owner').length || 0,
        merchant: usersByRole?.filter(u => u.role === 'merchant').length || 0,
        enterprise: usersByRole?.filter(u => u.role === 'enterprise').length || 0,
        active: usersByRole?.filter(u => u.status === 'active').length || 0,
        disabled: usersByRole?.filter(u => u.status === 'disabled').length || 0
      },
      orders: {
        total: ordersByStatus?.length || 0,
        pending: ordersByStatus?.filter(o => o.status === 'pending').length || 0,
        accepted: ordersByStatus?.filter(o => o.status === 'accepted').length || 0,
        in_transit: ordersByStatus?.filter(o => o.status === 'in_transit').length || 0,
        completed: ordersByStatus?.filter(o => o.status === 'completed').length || 0,
        cancelled: ordersByStatus?.filter(o => o.status === 'cancelled').length || 0
      },
      vehicles: {
        total: vehiclesData?.length || 0,
        pending: vehiclesData?.filter(v => v.status === 'pending').length || 0,
        active: vehiclesData?.filter(v => v.status === 'active').length || 0,
        inactive: vehiclesData?.filter(v => v.status === 'inactive').length || 0
      },
      demands: {
        total: demandsData?.length || 0,
        pending: demandsData?.filter(d => d.status === 'pending').length || 0,
        accepted: demandsData?.filter(d => d.status === 'accepted').length || 0,
        in_transit: demandsData?.filter(d => d.status === 'in_transit').length || 0,
        completed: demandsData?.filter(d => d.status === 'completed').length || 0,
        cancelled: demandsData?.filter(d => d.status === 'cancelled').length || 0
      }
    }

    return {
      code: 200,
      message: '查询成功',
      data: stats
    }
  }
}
