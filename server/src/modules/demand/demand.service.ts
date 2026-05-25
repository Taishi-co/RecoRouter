import { Injectable, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../../storage/database/supabase-client';
import { v4 as uuidv4 } from 'uuid';

type BusinessMode = 'enterprise_terminal' | 'community_group_buy';
type VehicleSource = 'internal' | 'external' | 'mixed';

const BUSINESS_MODES: BusinessMode[] = ['enterprise_terminal', 'community_group_buy'];
const VEHICLE_SOURCES: VehicleSource[] = ['internal', 'external', 'mixed'];

@Injectable()
export class DemandService {
  private readonly logger = new Logger(DemandService.name);

  private async getEnterpriseRequesterId(supabase: any, enterpriseId: string) {
    const { data: enterprise } = await supabase
      .from('enterprises')
      .select('admin_id')
      .eq('id', enterpriseId)
      .single();

    return enterprise?.admin_id || enterpriseId;
  }

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
    const vehicleSource = this.normalizeVehicleSource(data.vehicleSource);
    const businessMode = this.normalizeBusinessMode(data.cargoInfo?.businessMode);
    const deliveryPoints = this.normalizeDeliveryPoints(data.deliveryPoints, businessMode);
    const cargoInfo = this.normalizeCargoInfo(data.cargoInfo, businessMode);
    const timeWindow = this.normalizeTimeWindow(data.timeWindow);

    if (!data.enterpriseId) {
      throw new Error('enterpriseId 不能为空');
    }

    if (deliveryPoints.length === 0) {
      throw new Error('至少需要一个配送点');
    }

    // 创建企业需求
    const { data: demand, error } = await supabase
      .from('enterprise_demands')
      .insert({
        id: demandId,
        enterprise_id: data.enterpriseId,
        pickup_point_type: data.pickupPointType,
        pickup_point_info: data.pickupPointInfo,
        delivery_points: deliveryPoints,
        cargo_info: cargoInfo,
        time_window: timeWindow,
        vehicle_source: vehicleSource,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    let linkedExternalDemandId: string | null = null;

    // 如果是外部运力，同时发布到demands表供接单大厅使用
    if (vehicleSource === 'external') {
      const publicDemandId = `pub-${uuidv4().split('-')[0]}`;

      // 获取第一个配送点作为送货地址，或者组合多个配送点
      const firstDeliveryPoint = deliveryPoints[0] || {};
      const deliveryAddress = firstDeliveryPoint.address || '未指定';

      // 计算总重量和体积
      const totalWeight = cargoInfo.quantity || 0;
      const totalVolume = totalWeight * 0.001; // 假设每箱0.001立方米

      // 公共 demands 表当前用 merchant_id 保存需求发布用户 ID，企业外部需求使用企业管理员作为发布用户。
      const enterpriseRequesterId = await this.getEnterpriseRequesterId(supabase, data.enterpriseId);

      // 构建取货时间（使用今天的时间，加上时间窗的开始时间）
      const today = new Date();
      const [startHour, startMinute] = timeWindow.start.split(':');
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
        .select('id')
        .eq('merchant_id', enterpriseRequesterId)
        .eq('remarks', '企业外部需求')
        .gte('created_at', demand.created_at)
        .lt('created_at', new Date(new Date(demand.created_at).getTime() + 10000)); // 10秒内创建的

      // 如果不存在，则创建新的公共需求记录
      if (!existingDemands || existingDemands.length === 0) {
        const { data: publicDemand, error: pubError } = await supabase
          .from('demands')
          .insert({
            id: publicDemandId,
            merchant_id: enterpriseRequesterId,
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
            pickup_point: data.pickupPointInfo,
            delivery_points: deliveryPoints,
            cargo_info: cargoInfo,
            time_window: timeWindow, // 存储时间窗信息
            status: 'pending',
            remarks: '企业外部需求',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (pubError) {
          this.logger.error(`发布到接单大厅失败: ${pubError.message}`);
        } else {
          linkedExternalDemandId = publicDemand?.id || publicDemandId;
        }
      } else {
        linkedExternalDemandId = existingDemands[0].id;
      }

      if (linkedExternalDemandId) {
        const { data: linkedDemand, error: linkError } = await supabase
          .from('enterprise_demands')
          .update({
            external_demand_id: linkedExternalDemandId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', demand.id)
          .select()
          .single();

        if (linkError) {
          this.logger.error(`关联接单大厅需求失败: ${linkError.message}`);
        } else {
          return linkedDemand;
        }
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
    if (data.status && ['completed', 'cancelled'].includes(data.status)) {
      throw new Error('不能通过通用接口修改为终态，请使用配送点完成或取消接口');
    }

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
    const vehicleIds = this.normalizeIdList(vehicleAllocation?.vehicle_ids);

    if (vehicleIds.length === 0) {
      throw new Error('请选择车辆');
    }

    const { data: existingDemand, error: fetchError } = await supabase
      .from('enterprise_demands')
      .select('*')
      .eq('id', demandId)
      .single();

    if (fetchError || !existingDemand) {
      throw new Error('配送需求不存在');
    }

    if (existingDemand.status !== 'pending') {
      throw new Error('只有待调度状态的需求可以分配车辆');
    }

    const vehicleSource = this.normalizeVehicleSource(existingDemand.vehicle_source);
    if (vehicleSource === 'external') {
      throw new Error('外部运力需求无需分配自有车辆');
    }

    await this.assertEnterpriseVehiclesAvailable(
      existingDemand.enterprise_id,
      vehicleIds,
      vehicleSource === 'mixed' ? ['internal', 'external'] : ['internal'],
    );

    const normalizedAllocation = {
      ...vehicleAllocation,
      vehicle_ids: vehicleIds,
      allocated_at: vehicleAllocation?.allocated_at || new Date().toISOString(),
    };

    const { data: demand, error: updateError } = await supabase
      .from('enterprise_demands')
      .update({
        vehicle_allocation: normalizedAllocation,
        status: 'in_transit',
        updated_at: new Date().toISOString(),
      })
      .eq('id', demandId)
      .select()
      .single();

    if (updateError) throw updateError;

    const { error: vehicleUpdateError } = await supabase
      .from('vehicles')
      .update({
        trip_status: 'in_transit',
        updated_at: new Date().toISOString(),
      })
      .in('id', vehicleIds);

    if (vehicleUpdateError) throw vehicleUpdateError;

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

    const uniqueVehicleIds = this.normalizeIdList(vehicleIds);
    if (uniqueVehicleIds.length === 0) {
      throw new Error('请选择车辆');
    }

    await this.assertEnterpriseVehiclesAvailable(enterpriseId, uniqueVehicleIds, ['external']);

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
          vehicle_ids: uniqueVehicleIds,
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
      .in('id', uniqueVehicleIds);

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
      if (demand.status !== 'in_transit') {
        throw new Error('只有进行中的配送需求才能更新配送点状态');
      }

      // 更新配送点状态
      if (!body.stationId || !body.status) {
        throw new Error('stationId 和 status 不能为空');
      }

      if (!['pending', 'in_transit', 'completed'].includes(body.status)) {
        throw new Error('配送点状态不合法');
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
        await this.releaseAllocatedVehicles(demand.vehicle_allocation);
      }
    } else {
      throw new Error('操作失败');
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

    // 检查需求状态，只能取消 pending / in_transit 状态的需求
    if (!['pending', 'in_transit'].includes(demand.status)) {
      throw new Error('只能取消待调度或进行中状态的需求');
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

    await this.releaseAllocatedVehicles(demand.vehicle_allocation);

    // 如果是外部运力需求，同时取消demands表中的记录
    if (demand.vehicle_source === 'external') {
      let externalDemandIds: string[] = demand.external_demand_id ? [demand.external_demand_id] : [];

      if (externalDemandIds.length === 0) {
        const { data: enterprise } = await supabase
          .from('enterprises')
          .select('admin_id')
          .eq('id', demand.enterprise_id)
          .single();

        const merchantIds = Array.from(
          new Set([enterprise?.admin_id, demand.enterprise_id].filter(Boolean))
        );

        // 兼容旧数据：早期没有 external_demand_id，只能通过商户与创建时间窗口回溯。
        const { data: externalDemands } = await supabase
          .from('demands')
          .select('id')
          .in('merchant_id', merchantIds)
          .eq('remarks', '企业外部需求')
          .gte('created_at', demand.created_at)
          .lt('created_at', new Date(new Date(demand.created_at).getTime() + 10000)) // 10秒内创建的
          .eq('status', 'pending');

        externalDemandIds = (externalDemands || []).map((item: any) => item.id);
      }

      if (externalDemandIds.length > 0) {
        // 取消找到的外部需求
        const { error: cancelExternalError } = await supabase
          .from('demands')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('status', 'pending')
          .in('id', externalDemandIds);

        if (cancelExternalError) {
          this.logger.error(`取消外部需求失败: ${cancelExternalError.message}`);
        }
      }
    }

    return { success: true };
  }

  private normalizeVehicleSource(source?: string): VehicleSource {
    if (source === 'own') return 'internal';
    if (VEHICLE_SOURCES.includes(source as VehicleSource)) return source as VehicleSource;
    throw new Error('vehicleSource 不合法');
  }

  private normalizeBusinessMode(mode?: string): BusinessMode {
    if (!mode) return 'enterprise_terminal';
    if (BUSINESS_MODES.includes(mode as BusinessMode)) return mode as BusinessMode;
    throw new Error('businessMode 不合法');
  }

  private normalizeTimeWindow(timeWindow: any) {
    if (!timeWindow?.start || !timeWindow?.end) {
      throw new Error('timeWindow.start 和 timeWindow.end 不能为空');
    }
    return timeWindow;
  }

  private normalizeCargoInfo(cargoInfo: any, businessMode: BusinessMode) {
    if (!cargoInfo?.type) {
      throw new Error('cargoInfo.type 不能为空');
    }

    return {
      ...cargoInfo,
      businessMode,
      businessModeLabel: businessMode === 'community_group_buy' ? '社区团购' : '终端配送',
    };
  }

  private normalizeDeliveryPoints(deliveryPoints: any[], businessMode: BusinessMode) {
    if (!Array.isArray(deliveryPoints)) {
      throw new Error('deliveryPoints 必须是数组');
    }

    const pointType = businessMode === 'community_group_buy' ? 'community_leader' : 'terminal';
    return deliveryPoints
      .filter(point => point && (point.stationId || point.id || point.address || point.name))
      .map((point, index) => ({
        ...point,
        stationId: point.stationId || point.id || `point-${index + 1}`,
        pointType: point.pointType || pointType,
        businessMode: point.businessMode || businessMode,
        status: point.status || 'pending',
      }));
  }

  private normalizeIdList(ids: unknown): string[] {
    if (!Array.isArray(ids)) return [];
    return Array.from(
      new Set(
        ids
          .map(id => typeof id === 'string' ? id.trim() : '')
          .filter(Boolean)
      )
    );
  }

  private getAllocatedVehicleIds(vehicleAllocation: any): string[] {
    return this.normalizeIdList(vehicleAllocation?.vehicle_ids);
  }

  private async assertEnterpriseVehiclesAvailable(
    enterpriseId: string,
    vehicleIds: string[],
    usageModes: VehicleSource[],
  ) {
    const supabase = getSupabaseClient();
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('id')
      .eq('enterprise_id', enterpriseId)
      .eq('status', 'active')
      .eq('trip_status', 'idle')
      .in('usage_mode', usageModes)
      .in('id', vehicleIds);

    if (error) throw error;

    if ((vehicles || []).length !== vehicleIds.length) {
      throw new Error('所选车辆不可用或不属于该企业');
    }
  }

  private async releaseAllocatedVehicles(vehicleAllocation: any) {
    const vehicleIds = this.getAllocatedVehicleIds(vehicleAllocation);
    if (vehicleIds.length === 0) return;

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('vehicles')
      .update({
        trip_status: 'idle',
        updated_at: new Date().toISOString(),
      })
      .in('id', vehicleIds)
      .eq('trip_status', 'in_transit');

    if (error) throw error;
  }
}
