import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

type VehicleUsageMode = 'internal' | 'external';
type VehicleTripStatus = 'idle' | 'in_transit' | 'maintenance';

const VEHICLE_USAGE_MODES: VehicleUsageMode[] = ['internal', 'external'];
const VEHICLE_TRIP_STATUSES: VehicleTripStatus[] = ['idle', 'in_transit', 'maintenance'];

@Injectable()
export class EnterpriseVehiclesService {
  /**
   * 获取企业车辆列表
   */
  async getEnterpriseVehicles(enterpriseId: string, usageMode?: string) {
    const client = getSupabaseClient();
    const normalizedUsageMode = usageMode ? this.normalizeUsageMode(usageMode) : undefined;

    let query = client
      .from('vehicles')
      .select('*')
      .eq('enterprise_id', enterpriseId);

    // 如果指定了usage_mode，则过滤
    if (normalizedUsageMode) {
      query = query.eq('usage_mode', normalizedUsageMode);
    }

    const { data: vehicles, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`查询失败: ${error.message}`);
    }

    return vehicles || [];
  }

  /**
   * 创建企业车辆
   */
  async createEnterpriseVehicle(
    enterpriseId: string,
    vehicleData: {
      vehicle_code: string;
      vehicle_type: string;
      license_plate: string;
      load_capacity: number;
      volume: number;
      length?: number;
      width?: number;
      height?: number;
      has_cold_chain: boolean;
      usage_mode: string;
    },
    vehicleId?: string,
  ) {
    const client = getSupabaseClient();
    const usageMode = this.normalizeUsageMode(vehicleData.usage_mode);

    // 验证企业是否存在并获取管理员ID
    const { data: enterprise, error: enterpriseError } = await client
      .from('enterprises')
      .select('id, admin_id')
      .eq('id', enterpriseId)
      .maybeSingle();

    if (enterpriseError || !enterprise) {
      throw new NotFoundException('企业不存在');
    }

    // 验证企业管理员是否存在
    if (!enterprise.admin_id) {
      throw new BadRequestException('企业管理员未设置');
    }

    // 创建车辆
    const { data: vehicle, error: insertError } = await client
      .from('vehicles')
      .insert({
        id: vehicleId,
        owner_id: enterprise.admin_id, // 使用企业管理员作为车辆所有者
        enterprise_id: enterpriseId,
        vehicle_code: vehicleData.vehicle_code,
        vehicle_type: vehicleData.vehicle_type,
        license_plate: vehicleData.vehicle_code, // 使用编码作为车牌
        load_capacity: vehicleData.load_capacity,
        volume: vehicleData.volume,
        length: vehicleData.length || null,
        width: vehicleData.width || null,
        height: vehicleData.height || null,
        has_cold_chain: vehicleData.has_cold_chain,
        current_location: '唐山配送中心', // 默认位置
        usage_mode: usageMode,
        trip_status: 'idle',
        status: 'active', // 企业车辆直接激活，无需审核
        battery_life: 100,
        base_price: 20,
        base_distance: 3,
        price_per_km: 2,
        today_internal_orders: 0,
        today_external_orders: 0,
        today_distance: 0,
      })
      .select()
      .single();

    if (insertError) {
      throw new BadRequestException(`创建车辆失败: ${insertError.message}`);
    }

    return vehicle;
  }

  /**
   * 更新车辆使用模式
   */
  async updateVehicleUsageMode(vehicleId: string, usageMode: string) {
    const client = getSupabaseClient();
    const normalizedUsageMode = this.normalizeUsageMode(usageMode);

    const { data: vehicle, error } = await client
      .from('vehicles')
      .update({ usage_mode: normalizedUsageMode })
      .eq('id', vehicleId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`更新失败: ${error.message}`);
    }

    return vehicle;
  }

  /**
   * 获取企业车辆统计
   */
  async getEnterpriseVehicleStats(enterpriseId: string) {
    const client = getSupabaseClient();

    const { data: vehicles, error } = await client
      .from('vehicles')
      .select('usage_mode, trip_status')
      .eq('enterprise_id', enterpriseId);

    if (error) {
      throw new BadRequestException(`查询失败: ${error.message}`);
    }

    const stats = {
      total: vehicles?.length || 0,
      in_transit: vehicles?.filter(v => v.trip_status === 'in_transit').length || 0,
      idle: vehicles?.filter(v => v.trip_status === 'idle').length || 0,
      internal: vehicles?.filter(v => v.usage_mode === 'internal').length || 0,
      external: vehicles?.filter(v => v.usage_mode === 'external').length || 0,
    };

    return stats;
  }

  /**
   * 更新车辆今日统计
   */
  async updateVehicleTodayStats(
    vehicleId: string,
    stats: {
      internal_orders?: number;
      external_orders?: number;
      distance?: number;
    }
  ) {
    const client = getSupabaseClient();

    const { error } = await client
      .from('vehicles')
      .update({
        today_internal_orders: stats.internal_orders,
        today_external_orders: stats.external_orders,
        today_distance: stats.distance,
      })
      .eq('id', vehicleId);

    if (error) {
      throw new BadRequestException(`更新失败: ${error.message}`);
    }

    return { success: true };
  }

  /**
   * 根据ID获取车辆
   */
  async getVehicleById(vehicleId: string) {
    const client = getSupabaseClient();

    const { data: vehicle, error } = await client
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(`查询失败: ${error.message}`);
    }

    return vehicle;
  }

  /**
   * 更新车辆状态
   */
  async updateVehicleStatus(
    vehicleId: string,
    tripStatus: string,
  ) {
    const client = getSupabaseClient();
    const normalizedTripStatus = this.normalizeTripStatus(tripStatus);

    const { data: vehicle, error } = await client
      .from('vehicles')
      .update({ trip_status: normalizedTripStatus })
      .eq('id', vehicleId)
      .select()
      .maybeSingle();

    if (error) {
      throw new BadRequestException(`更新失败: ${error.message}`);
    }

    return vehicle;
  }

  /**
   * 删除车辆
   */
  async deleteVehicle(vehicleId: string) {
    const client = getSupabaseClient();

    const { error } = await client
      .from('vehicles')
      .delete()
      .eq('id', vehicleId);

    if (error) {
      throw new BadRequestException(`删除失败: ${error.message}`);
    }

    return true;
  }

  private normalizeUsageMode(usageMode?: string): VehicleUsageMode {
    if (VEHICLE_USAGE_MODES.includes(usageMode as VehicleUsageMode)) {
      return usageMode as VehicleUsageMode;
    }
    throw new BadRequestException('usage_mode 不合法');
  }

  private normalizeTripStatus(tripStatus?: string): VehicleTripStatus {
    if (VEHICLE_TRIP_STATUSES.includes(tripStatus as VehicleTripStatus)) {
      return tripStatus as VehicleTripStatus;
    }
    throw new BadRequestException('trip_status 不合法');
  }
}
