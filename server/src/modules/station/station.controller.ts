import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { StationService } from './station.service';

@Controller('station')
export class StationController {
  constructor(private readonly stationService: StationService) {}

  /**
   * 创建配送点
   */
  @Post()
  async createStation(@Body() body: {
    enterpriseId: string;
    name: string;
    address: string;
    location?: { lat: number; lng: number };
    phone?: string;
    customer_type?: 'owned' | 'external';
    point_type?: string;
    status?: string;
  }) {
    try {
      return {
        code: 200,
        message: 'success',
        data: await this.stationService.createStation(body),
      };
    } catch (error) {
      return {
        code: 500,
        message: error.message || '创建失败',
        data: null,
      };
    }
  }

  /**
   * 获取配送点列表
   */
  @Get()
  async getStations(@Query() query: {
    enterpriseId: string;
    page?: string;
    pageSize?: string;
    keyword?: string;
    point_type?: string;
  }) {
    const { enterpriseId, page, pageSize, keyword, point_type } = query;
    try {
      return {
        code: 200,
        message: 'success',
        data: await this.stationService.getStations({
          enterpriseId,
          page: page ? parseInt(page) : 1,
          pageSize: pageSize ? parseInt(pageSize) : 20,
          keyword,
          point_type,
        }),
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
   * 获取配送点详情
   */
  @Get(':id')
  async getStation(@Param('id') id: string) {
    try {
      const station = await this.stationService.getStationById(id);
      return {
        code: 200,
        message: 'success',
        data: station,
      };
    } catch (error) {
      const code = error.status === 404 ? 404 : 500;
      return {
        code,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * 更新配送点信息
   */
  @Put(':id')
  async updateStation(
    @Param('id') id: string,
    @Body() body: Partial<{
      name: string;
      address: string;
      location: { lat: number; lng: number };
      phone: string;
      point_type: string;
      status: string;
    }>,
  ) {
    try {
      return {
        code: 200,
        message: 'success',
        data: await this.stationService.updateStation(id, body),
      };
    } catch (error) {
      const code = error.status === 404 ? 404 : 500;
      return {
        code,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * 删除配送点
   */
  @Delete(':id')
  async deleteStation(@Param('id') id: string) {
    try {
      return {
        code: 200,
        message: 'success',
        data: await this.stationService.deleteStation(id),
      };
    } catch (error) {
      return {
        code: 404,
        message: error.message,
        data: null,
      };
    }
  }
}
