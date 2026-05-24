import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../../storage/database/supabase-client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DemandService {
  /**
   * 创建配送需求
   */
  async createDemand(data: {
    enterpriseId: string;
    pickupPointType: string;
    pickupPointInfo: any;
    deliveryPoints: any[];
    cargoInfo: any;
    timeWindow: any;
    vehicleSource: string;
  }) {
    const supabase = getSupabaseClient();
    const demandId = `demand-${uuidv4().split('-')[0]}`; // 生成简短的ID

    // 创建企业需求
    const { data: demand, error } = await supabase
      .from('enterprise_demands')
      .insert({
        id: demandId,
        enterprise_id: data.enterpriseId,
        pickup_point_type: data.pickupPointType,
        pickup_point_info: data.pickupPointInfo,
        delivery_points: data.deliveryPoints,
        cargo_info: data.cargoInfo,
        time_window: data.timeWindow,
        vehicle_source: data.vehicleSource,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // 如果是外部运力，同时发布到demands表供接单大厅使用
    if (data.vehicleSource === 'external') {
      const publicDemandId = `pub-${uuidv4().split('-')[0]}`;

      // 获取第一个配送点作为送货地址，或者组合多个配送点
      const firstDeliveryPoint = data.deliveryPoints[0] || {};
      const deliveryAddress = firstDeliveryPoint.address || '未指定';

      // 计算总重量和体积
      const cargoInfo = data.cargoInfo;
      const totalWeight = cargoInfo.quantity || 0;
      const totalVolume = totalWeight * 0.001; // 假设每箱0.001立方米

      // 获取企业信息，获取管理员ID作为merchant_id
      const { data: enterprise } = await supabase
        .from('enterprises')
        .select('admin_id')
        .eq('id', data.enterpriseId)
        .single();

      const merchantId = enterprise?.admin_id || data.enterpriseId;

      // 构建取货时间（使用今天的时间，加上时间窗的开始时间）
      const today = new Date();
      const [startHour, startMinute] = data.timeWindow.start.split(':');
      const pickupTime = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        parseInt(startHour),
        parseInt(startMinute)
      );

      // 检查是否有重复的需求（相同的企业和创建时间窗口）
      const { data: existingDemands } = await supabase
        .from('demands')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('remarks', '企业外部需求')
        .gte('created_at', demand.created_at)
        .lt('created_at', new Date(new Date(demand.created_at).getTime() + 10000)); // 10秒内创建的

      // 如果不存在，则创建新的公共需求记录
      if (!existingDemands || existingDemands.length === 0) {
        const { error: pubError } = await supabase
          .from('demands')
          .insert({
            id: publicDemandId,
            merchant_id: merchantId, // 使用企业管理员ID作为merchant_id
            cargo_name: cargoInfo.type || '货物',
            cargo_type: 'normal',
            weight: totalWeight.toString(),
            volume: totalVolume.toString(),
            pickup_time: pickupTime.toISOString(),
            pickup_address: data.pickupPointInfo?.address || '配送中心',
            pickup_lat: data.pickupPointInfo?.latitude,
            pickup_lng: data.pickupPointInfo?.longitude,
            delivery_address: deliveryAddress,
            delivery_lat: firstDeliveryPoint.latitude,
            delivery_lng: firstDeliveryPoint.longitude,
            time_window: data.timeWindow, // 存储时间窗信息
            status: 'pending',
            remarks: '企业外部需求',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (pubError) {
          console.error('发布到接单大厅失败:', pubError);
        } else {
          console.log('成功发布到接单大厅，需求ID:', publicDemandId);
        }
      } else {
        console.log('需求已存在于接单大厅，跳过创建');
      }
    }

    return demand;
  }

  /**
   * 获取配送需求列表
   */
  async getDemands(params: {
    enterpriseId: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { enterpriseId, status, page = 1, pageSize = 20 } = params;
    const from = (page - 1) * pageSize;

    const supabase = getSupabaseClient();
    let query = supabase
      .from('enterprise_demands')
      .select('*', { count: 'exact' })
      .eq('enterprise_id', enterpriseId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query
      .range(from, from + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      list: data || [],
      total: count || 0,
      page,
      pageSize,
    };
  }

  /**
   * 获取配送需求详情
   */
  async getDemandById(id: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('enterprise_demands')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * 更新配送需求
   */
  async updateDemand(id: string, data: Partial<{
    vehicleAllocation: any;
    optimizedRoutes: any;
    status: string;
  }>) {
    const supabase = getSupabaseClient();
    const { data: demand, error } = await supabase
      .from('enterprise_demands')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return demand;
  }

  /**
   * 获取待调度订单
   */
  async getPendingDemands(enterpriseId: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('enterprise_demands')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * 获取企业需求统计
   */
  async getEnterpriseDemandStats(enterpriseId: string) {
    const supabase = getSupabaseClient();

    const { data: demands, error } = await supabase
      .from('enterprise_demands')
      .select('status')
      .eq('enterprise_id', enterpriseId);

    if (error) throw error;

    const stats = {
      pending: demands?.filter(d => d.status === 'pending').length || 0,
      in_transit: demands?.filter(d => d.status === 'in_transit').length || 0,
      completed: demands?.filter(d => d.status === 'completed').length || 0,
      cancelled: demands?.filter(d => d.status === 'cancelled').length || 0,
      total: demands?.length || 0,
    };

    return stats;
  }

  /**
   * 分配车辆到配送需求
   */
  async allocateVehicleToDemand(demandId: string, vehicleAllocation: any) {
    const supabase = getSupabaseClient();

    const { data: demand, error: updateError } = await supabase
      .from('enterprise_demands')
      .update({
        vehicle_allocation: vehicleAllocation,
        status: 'in_transit',
        updated_at: new Date().toISOString(),
      })
      .eq('id', demandId)
      .select()
      .single();

    if (updateError) throw updateError;
    return demand;
  }

  /**
   * 获取待调度外部订单
   */
  async getPendingExternalDemands() {
    const supabase = getSupabaseClient();

    const { data: demands, error } = await supabase
      .from('demands')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return demands || [];
  }

  /**
   * 企业接外部订单
   */
  async acceptExternalDemand(demandId: string, enterpriseId: string, vehicleIds: string[]) {
    const supabase = getSupabaseClient();

    if (!vehicleIds || vehicleIds.length === 0) {
      throw new Error('请选择车辆');
    }

    // 获取外部订单
    const { data: externalDemand, error: fetchError } = await supabase
      .from('demands')
      .select('*')
      .eq('id', demandId)
      .single();

    if (fetchError || !externalDemand) {
      throw new Error('外部需求不存在');
    }

    if (externalDemand.status !== 'pending') {
      throw new Error('只有待接单的外部需求可以接单');
    }

    const { data: enterprise } = await supabase
      .from('enterprises')
      .select('admin_id')
      .eq('id', enterpriseId)
      .single();

    const businessMode = externalDemand.cargo_info?.businessMode || 'enterprise_terminal';
    const pointType = businessMode === 'community_group_buy' ? 'community_leader' : 'terminal';
    const existingDeliveryPoints = Array.isArray(externalDemand.delivery_points)
      ? externalDemand.delivery_points
      : [];
    const deliveryPoints = existingDeliveryPoints.length > 0
      ? existingDeliveryPoints.map((point: any, index: number) => ({
          stationId: point.stationId || point.id || `external-${demandId}-${index + 1}`,
          name: point.name || point.stationName || point.address || externalDemand.delivery_address || '收货点',
          address: point.address || externalDemand.delivery_address || '',
          contact: point.contact,
          phone: point.phone,
          latitude: point.latitude ?? point.lat ?? externalDemand.delivery_lat,
          longitude: point.longitude ?? point.lng ?? externalDemand.delivery_lng,
          pointType: point.pointType || pointType,
          businessMode: point.businessMode || businessMode,
          status: point.status || 'pending',
        }))
      : [{
          stationId: `external-${demandId}`,
          name: externalDemand.delivery_address || '收货点',
          address: externalDemand.delivery_address || '',
          latitude: externalDemand.delivery_lat,
          longitude: externalDemand.delivery_lng,
          pointType,
          businessMode,
          status: 'pending',
        }];

    const cargoInfo = {
      ...(externalDemand.cargo_info || {}),
      type: externalDemand.cargo_info?.type || externalDemand.cargo_name || '货物',
      cargoType: externalDemand.cargo_info?.cargoType || externalDemand.cargo_type,
      weight: externalDemand.cargo_info?.weight ?? externalDemand.weight,
      volume: externalDemand.cargo_info?.volume ?? externalDemand.volume,
      businessMode,
      businessModeLabel: businessMode === 'community_group_buy' ? '社区团购' : '终端配送',
    };

    const timeWindow = externalDemand.time_window || {
      start: externalDemand.pickup_time_start || externalDemand.pickup_time,
      end: externalDemand.pickup_time_end || externalDemand.pickup_time,
    };

    const pickupPointInfo = externalDemand.pickup_point || {
      name: '起点',
      address: externalDemand.pickup_address || '',
      latitude: externalDemand.pickup_lat,
      longitude: externalDemand.pickup_lng,
    };

    // 创建企业需求
    const { data: enterpriseDemand, error: insertError } = await supabase
      .from('enterprise_demands')
      .insert({
        enterprise_id: enterpriseId,
        pickup_point_type: 'warehouse',
        pickup_point_info: pickupPointInfo,
        delivery_points: deliveryPoints,
        cargo_info: cargoInfo,
        time_window: timeWindow,
        vehicle_source: 'internal',
        status: 'in_transit',
        vehicle_allocation: {
          vehicle_ids: vehicleIds,
          allocated_at: new Date().toISOString(),
        },
        external_demand_id: demandId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 更新外部需求状态
    await supabase
      .from('demands')
      .update({
        status: 'accepted',
        owner_id: enterprise?.admin_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', demandId);

    await supabase
      .from('vehicles')
      .update({
        trip_status: 'in_transit',
        updated_at: new Date().toISOString(),
      })
      .in('id', vehicleIds);

    return enterpriseDemand;
  }

  /**
   * 更新配送点状态或移除配送点
   */
  async updateDeliveryPoints(demandId: string, body: {
    action: 'update_status' | 'remove';
    stationId?: string;
    status?: string;
  }) {
    const supabase = getSupabaseClient();

    // 获取当前需求
    const { data: demand, error: fetchError } = await supabase
      .from('enterprise_demands')
      .select('*')
      .eq('id', demandId)
      .single();

    if (fetchError || !demand) {
      throw new Error('配送需求不存在');
    }

    // 检查需求状态，只有待调度才能修改配送点
    if (demand.status !== 'pending' && body.action === 'remove') {
      throw new Error('只有待调度的配送需求才能移除配送点');
    }

    let deliveryPoints = demand.delivery_points || [];

    if (body.action === 'remove') {
      // 移除配送点
      if (!body.stationId) {
        throw new Error('stationId 不能为空');
      }

      const originalCount = deliveryPoints.length;
      deliveryPoints = deliveryPoints.filter((p: any) => p.stationId !== body.stationId);

      if (deliveryPoints.length === originalCount) {
        throw new Error('未找到指定的配送点');
      }

      if (deliveryPoints.length === 0) {
        throw new Error('不能移除所有配送点');
      }
    } else if (body.action === 'update_status') {
      // 更新配送点状态
      if (!body.stationId || !body.status) {
        throw new Error('stationId 和 status 不能为空');
      }

      const pointExists = deliveryPoints.some((p: any) => p.stationId === body.stationId);
      if (!pointExists) {
        throw new Error('未找到指定的配送点');
      }

      deliveryPoints = deliveryPoints.map((p: any) => {
        if (p.stationId === body.stationId) {
          return { ...p, status: body.status };
        }
        return p;
      });

      // 检查是否所有配送点都已完成，如果是则更新整体状态
      const allCompleted = deliveryPoints.every((p: any) => p.status === 'completed');
      if (allCompleted && demand.status !== 'completed') {
        const { error: updateError } = await supabase
          .from('enterprise_demands')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', demandId);

        if (updateError) throw updateError;
      }
    }

    // 更新配送点列表
    const { data: updatedDemand, error: updateError } = await supabase
      .from('enterprise_demands')
      .update({
        delivery_points: deliveryPoints,
        updated_at: new Date().toISOString(),
      })
      .eq('id', demandId)
      .select()
      .single();

    if (updateError) throw updateError;

    return updatedDemand;
  }

  /**
   * 取消配送需求
   */
  async cancelDemand(demandId: string) {
    const supabase = getSupabaseClient();

    // 获取需求信息
    const { data: demand, error: fetchError } = await supabase
      .from('enterprise_demands')
      .select('*')
      .eq('id', demandId)
      .single();

    if (fetchError) throw fetchError;

    // 检查需求状态，只能取消pending状态的需求
    if (demand.status !== 'pending') {
      throw new Error('只能取消待调度状态的需求');
    }

    // 更新需求状态为已取消
    const { error: updateError } = await supabase
      .from('enterprise_demands')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', demandId);

    if (updateError) throw updateError;

    // 如果是外部运力需求，同时取消demands表中的记录
    if (demand.vehicle_source === 'external') {
      // 查找对应的外部需求记录（通过企业ID和创建时间匹配）
      const { data: externalDemands } = await supabase
        .from('demands')
        .select('*')
        .eq('merchant_id', demand.enterprise_id)
        .eq('remarks', '企业外部需求')
        .gte('created_at', demand.created_at)
        .lt('created_at', new Date(new Date(demand.created_at).getTime() + 10000)) // 10秒内创建的
        .eq('status', 'pending');

      if (externalDemands && externalDemands.length > 0) {
        // 取消找到的外部需求
        const { error: cancelExternalError } = await supabase
          .from('demands')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .in('id', externalDemands.map((d: any) => d.id));

        if (cancelExternalError) {
          console.error('取消外部需求失败:', cancelExternalError);
        }
      }
    }

    return { success: true };
  }
}
