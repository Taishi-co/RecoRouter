import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { EnterpriseVehiclesService } from './enterprise-vehicles.service';

@Controller('enterprise-vehicles')
export class EnterpriseVehiclesController {
  constructor(private readonly enterpriseVehiclesService: EnterpriseVehiclesService) {}

  /**
   * 获取企业车辆列表
   */
  @Get()
  async getVehicles(
    @Query('enterprise_id') enterpriseId: string,
    @Query('usage_mode') usageMode?: string,
  ) {
    if (!enterpriseId) {
      return {
        code: 400,
        message: '缺少企业ID',
        data: null,
      };
    }

    try {
      return {
        code: 200,
        message: 'success',
        data: await this.enterpriseVehiclesService.getEnterpriseVehicles(enterpriseId, usageMode),
      };
    } catch (error) {
      return {
        code: 500,
        message: error.message || '查询失败',
        data: null,
      };
    }
  }

  /**
   * 获取企业车辆统计
   */
  @Get('stats')
  async getStats(@Query('enterprise_id') enterpriseId: string) {
    if (!enterpriseId) {
      return {
        code: 400,
        message: '缺少企业ID',
        data: null,
      };
    }

    return {
      code: 200,
      message: 'success',
      data: await this.enterpriseVehiclesService.getEnterpriseVehicleStats(enterpriseId),
    };
  }

  /**
   * 创建企业车辆
   */
  @Post()
  async createVehicle(@Body() body: {
    enterprise_id: string;
    vehicle_id?: string;
    vehicle_code: string;
    vehicle_type: string;
    load_capacity: number;
    volume: number;
    length?: number;
    width?: number;
    height?: number;
    has_cold_chain: boolean;
    usage_mode?: string;
  }) {
    try {
      const vehicle = await this.enterpriseVehiclesService.createEnterpriseVehicle(
        body.enterprise_id,
        {
          vehicle_code: body.vehicle_code,
          vehicle_type: body.vehicle_type,
          license_plate: body.vehicle_code,
          load_capacity: body.load_capacity,
          volume: body.volume,
          length: body.length,
          width: body.width,
          height: body.height,
          has_cold_chain: body.has_cold_chain,
          usage_mode: body.usage_mode || 'internal',
        },
        body.vehicle_id,
      );

      return {
        code: 200,
        message: 'success',
        data: vehicle,
      };
    } catch (error) {
      return {
        code: 500,
        message: error.message || '创建车辆失败',
        data: null,
      };
    }
  }

  /**
   * 更新车辆使用模式
   */
  @Put(':id/usage-mode')
  async updateUsageMode(
    @Param('id') id: string,
    @Body('usage_mode') usageMode: string,
  ) {
    try {
      return {
        code: 200,
        message: 'success',
        data: await this.enterpriseVehiclesService.updateVehicleUsageMode(id, usageMode),
      };
    } catch (error) {
      return {
        code: 500,
        message: error.message || '更新失败',
        data: null,
      };
    }
  }

  /**
   * 更新车辆今日统计
   */
  @Put(':id/today-stats')
  async updateTodayStats(
    @Param('id') id: string,
    @Body() body: {
      internal_orders?: number;
      external_orders?: number;
      distance?: number;
    },
  ) {
    return {
      code: 200,
      message: 'success',
      data: await this.enterpriseVehiclesService.updateVehicleTodayStats(id, body),
    };
  }

  /**
   * 获取车辆详情
   */
  @Get(':id')
  async getVehicleDetail(@Param('id') id: string) {
    const vehicle = await this.enterpriseVehiclesService.getVehicleById(id);
    if (!vehicle) {
      return {
        code: 404,
        message: '车辆不存在',
        data: null,
      };
    }
    return {
      code: 200,
      message: 'success',
      data: vehicle,
    };
  }

  /**
   * 更新车辆状态
   */
  @Put(':id/status')
  async updateVehicleStatus(
    @Param('id') id: string,
    @Body('trip_status') tripStatus: string,
  ) {
    try {
      const vehicle = await this.enterpriseVehiclesService.updateVehicleStatus(id, tripStatus);
      if (!vehicle) {
        return {
          code: 404,
          message: '车辆不存在',
          data: null,
        };
      }
      return {
        code: 200,
        message: 'success',
        data: vehicle,
      };
    } catch (error) {
      return {
        code: 500,
        message: error.message || '更新失败',
        data: null,
      };
    }
  }

  /**
   * 删除车辆
   */
  @Delete(':id')
  async deleteVehicle(@Param('id') id: string) {
    try {
      await this.enterpriseVehiclesService.deleteVehicle(id);
      return {
        code: 200,
        message: '删除成功',
        data: null,
      };
    } catch (error) {
      return {
        code: 500,
        message: error.message || '删除失败',
        data: null,
      };
    }
  }
}
