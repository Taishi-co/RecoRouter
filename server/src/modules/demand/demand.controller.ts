import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { DemandService } from './demand.service';

@Controller('demand')
export class DemandController {
  constructor(private readonly demandService: DemandService) {}

  /**
   * 创建企业需求（发布配送）
   */
  @Post()
  async createDemand(@Body() body: {
    enterpriseId: string;
    pickupPointType: string;
    pickupPointInfo: any;
    deliveryPoints: any[];
    cargoInfo: any;
    timeWindow: any;
    vehicleSource: string;
    remark?: string;
  }) {
    return {
      code: 200,
      message: 'success',
      data: await this.demandService.createDemand(body),
    };
  }

  /**
   * 获取配送需求列表
   */
  @Get()
  async getDemands(@Query() query: {
    enterpriseId: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }) {
    const { enterpriseId, status, page, pageSize } = query;
    return {
      code: 200,
      message: 'success',
      data: await this.demandService.getDemands({
        enterpriseId,
        status,
        page: page ? parseInt(page) : 1,
        pageSize: pageSize ? parseInt(pageSize) : 20,
      }),
    };
  }

  /**
   * 获取配送需求详情
   */
  @Get(':id')
  async getDemand(@Param('id') id: string) {
    const demand = await this.demandService.getDemandById(id);
    if (!demand) {
      return {
        code: 404,
        message: '配送需求不存在',
        data: null,
      };
    }
    return {
      code: 200,
      message: 'success',
      data: demand,
    };
  }

  /**
   * 更新配送需求
   */
  @Put(':id')
  async updateDemand(
    @Param('id') id: string,
    @Body() body: Partial<{
      vehicleAllocation: any;
      optimizedRoutes: any;
      status: string;
    }>,
  ) {
    try {
      return {
        code: 200,
        message: 'success',
        data: await this.demandService.updateDemand(id, body),
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
   * 获取待调度订单
   */
  @Get('pending/:enterpriseId')
  async getPendingDemands(@Param('enterpriseId') enterpriseId: string) {
    return {
      code: 200,
      message: 'success',
      data: await this.demandService.getPendingDemands(enterpriseId),
    };
  }

  /**
   * 获取企业需求统计
   */
  @Get('stats/enterprise')
  async getStats(@Query('enterprise_id') enterpriseId: string) {
    return {
      code: 200,
      message: 'success',
      data: await this.demandService.getEnterpriseDemandStats(enterpriseId),
    };
  }

  /**
   * 分配车辆到配送需求
   */
  @Put(':id/allocate')
  async allocateVehicle(@Param('id') id: string, @Body() body: any) {
    return {
      code: 200,
      message: 'success',
      data: await this.demandService.allocateVehicleToDemand(id, body.vehicle_allocation),
    };
  }

  /**
   * 获取待调度外部订单
   */
  @Get('external/pending')
  async getPendingExternalDemands() {
    return {
      code: 200,
      message: 'success',
      data: await this.demandService.getPendingExternalDemands(),
    };
  }

  /**
   * 企业接外部订单
   */
  @Post('external/:id/accept')
  async acceptExternalDemand(
    @Param('id') id: string,
    @Body() body: {
      enterprise_id: string;
      vehicle_ids: string[];
    }
  ) {
    return {
      code: 200,
      message: 'success',
      data: await this.demandService.acceptExternalDemand(
        id,
        body.enterprise_id,
        body.vehicle_ids
      ),
    };
  }

  /**
   * 更新配送点状态或移除配送点
   */
  @Put(':id/delivery-points')
  async updateDeliveryPoints(
    @Param('id') id: string,
    @Body() body: {
      action: 'update_status' | 'remove';
      stationId?: string;
      status?: string;
    }
  ) {
    try {
      const result = await this.demandService.updateDeliveryPoints(id, body);
      return {
        code: 200,
        message: 'success',
        data: result,
      };
    } catch (error) {
      return {
        code: 500,
        message: error.message || '操作失败',
        data: null,
      };
    }
  }

  /**
   * 取消配送需求
   */
  @Put(':id/cancel')
  async cancelDemand(@Param('id') id: string) {
    try {
      const result = await this.demandService.cancelDemand(id);
      return {
        code: 200,
        message: 'success',
        data: result,
      };
    } catch (error) {
      return {
        code: 500,
        message: error.message || '取消失败',
        data: null,
      };
    }
  }
}
