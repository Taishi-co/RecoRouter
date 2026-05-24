import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../../storage/database/supabase-client';

type EnterpriseDemandStatus = 'pending' | 'in_transit' | 'completed' | 'cancelled';
type BusinessMode = 'enterprise_terminal' | 'community_group_buy';
type PointType = 'terminal' | 'community_leader';

interface EnterpriseDemandRecord {
  status?: EnterpriseDemandStatus;
  created_at?: string;
  updated_at?: string | null;
  delivery_points?: Array<{
    id?: string;
    stationId?: string;
    name?: string;
    businessMode?: BusinessMode;
    pointType?: PointType;
    status?: string;
  }> | null;
  cargo_info?: {
    businessMode?: BusinessMode;
  } | null;
}

interface EnterpriseVehicleRecord {
  status?: string;
  trip_status?: string | null;
  today_distance?: number | string | null;
}

@Injectable()
export class EnterpriseService {
  /**
   * 创建企业
   */
  async createEnterprise(data: {
    name: string;
    type: string;
    adminId: string;
  }) {
    const supabase = getSupabaseClient();
    const { data: enterprise, error } = await supabase
      .from('enterprises')
      .insert({
        name: data.name,
        type: data.type,
        admin_id: data.adminId,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return enterprise;
  }

  /**
   * 获取企业信息
   */
  async getEnterpriseById(id: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('enterprises')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * 根据管理员获取企业
   */
  async getEnterpriseByAdminId(adminId: string) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('enterprises')
      .select('*')
      .eq('admin_id', adminId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * 更新企业信息
   */
  async updateEnterprise(id: string, data: Partial<{
    name: string;
    type: string;
    adminId: string;
    status: string;
  }>) {
    const supabase = getSupabaseClient();
    const { data: enterprise, error } = await supabase
      .from('enterprises')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return enterprise;
  }

  /**
   * 获取企业统计信息
   */
  async getEnterpriseStats(enterpriseId: string) {
    const supabase = getSupabaseClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: demands, error: demandError } = await supabase
      .from('enterprise_demands')
      .select('status, created_at, updated_at, delivery_points, cargo_info')
      .eq('enterprise_id', enterpriseId);

    if (demandError) throw demandError;

    const demandRows = (demands || []) as EnterpriseDemandRecord[];
    const todayDemands = demandRows.filter(demand => this.isAtOrAfter(demand.created_at, today));
    const monthDemands = demandRows.filter(demand => this.isAtOrAfter(demand.created_at, monthStart));
    const pending = demandRows.filter(demand => demand.status === 'pending').length;
    const inTransit = demandRows.filter(demand => demand.status === 'in_transit').length;
    const completed = demandRows.filter(demand => demand.status === 'completed').length;
    const cancelled = demandRows.filter(demand => demand.status === 'cancelled').length;

    const { count: externalOpportunityCount, error: externalOpportunityError } = await supabase
      .from('demands')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (externalOpportunityError) throw externalOpportunityError;

    const { data: vehicles, error: vehicleError } = await supabase
      .from('vehicles')
      .select('status, trip_status, today_distance')
      .eq('enterprise_id', enterpriseId);

    if (vehicleError) throw vehicleError;

    const vehicleRows = (vehicles || []) as EnterpriseVehicleRecord[];
    const activeVehicles = vehicleRows.filter(vehicle => vehicle.trip_status === 'in_transit').length;
    const totalVehicles = vehicleRows.length;
    const availableVehicles = vehicleRows.filter(vehicle => (
      vehicle.status === 'active' && (!vehicle.trip_status || vehicle.trip_status === 'idle')
    )).length;
    const vehicleUsageRate = totalVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 100) : 0;
    const totalDistance = vehicleRows.reduce(
      (sum, vehicle) => sum + Number(vehicle.today_distance || 0),
      0,
    );
    const avgDeliveryTime = this.calculateAverageDeliveryTime(
      monthDemands.filter(demand => demand.status === 'completed'),
    );

    const { data: stations, error: stationError } = await supabase
      .from('dairy_stations')
      .select('id, name, point_type')
      .eq('enterprise_id', enterpriseId);

    if (stationError) throw stationError;

    const stationStats = (stations || []).map(station => {
      const pointType = this.normalizePointType(station.point_type);
      const stationOrders = todayDemands.filter(demand => (
        Array.isArray(demand.delivery_points) && demand.delivery_points.some(point => (
          point.stationId === station.id || point.id === station.id || point.name === station.name
        ))
      )).length;

      return {
        stationName: station.name,
        pointType,
        pointTypeLabel: this.pointTypeLabel(pointType),
        orderCount: stationOrders,
      };
    });
    const terminalPoints = stationStats.filter(station => station.pointType === 'terminal').length;
    const communityLeaderPoints = stationStats.filter(station => station.pointType === 'community_leader').length;
    const terminalOrders = demandRows.filter(demand => this.getDemandBusinessMode(demand) === 'enterprise_terminal').length;
    const communityGroupBuyOrders = demandRows.filter(demand => this.getDemandBusinessMode(demand) === 'community_group_buy').length;

    return {
      pending,
      in_transit: inTransit,
      completed,
      cancelled,
      total: demandRows.length,
      todayOrders: todayDemands.length,
      monthOrders: monthDemands.length,
      totalDistance,
      avgDeliveryTime,
      vehicleUsageRate,
      activeVehicles,
      availableVehicles,
      totalVehicles,
      externalOpportunities: externalOpportunityCount || 0,
      terminalPoints,
      communityLeaderPoints,
      terminalOrders,
      communityGroupBuyOrders,
      stationStats,
    };
  }

  private isAtOrAfter(value: string | undefined, start: Date) {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date >= start;
  }

  private calculateAverageDeliveryTime(completedDemands: EnterpriseDemandRecord[]) {
    const durations = completedDemands
      .map(demand => {
        if (!demand.created_at || !demand.updated_at) return null;
        const createdAt = new Date(demand.created_at).getTime();
        const updatedAt = new Date(demand.updated_at).getTime();
        if (Number.isNaN(createdAt) || Number.isNaN(updatedAt) || updatedAt < createdAt) {
          return null;
        }
        return Math.round((updatedAt - createdAt) / 60000);
      })
      .filter((duration): duration is number => duration !== null);

    if (durations.length === 0) return 0;
    return Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length);
  }

  private getDemandBusinessMode(demand: EnterpriseDemandRecord): BusinessMode {
    const mode = demand.cargo_info?.businessMode || demand.delivery_points?.[0]?.businessMode;
    return mode === 'community_group_buy' ? 'community_group_buy' : 'enterprise_terminal';
  }

  private normalizePointType(pointType: string | null | undefined): PointType {
    return pointType === 'community_leader' ? 'community_leader' : 'terminal';
  }

  private pointTypeLabel(pointType: PointType) {
    return pointType === 'community_leader' ? '社区团长' : '终端点';
  }
}
