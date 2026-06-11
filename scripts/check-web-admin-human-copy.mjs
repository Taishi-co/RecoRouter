import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const files = [
  'src/web-admin/main.tsx',
  'src/pages/admin/console/index.tsx',
  'src/pages/admin/console/admin-pages.ts',
];

const bannedCopy = [
  '商品创建、上下架、库存和图片',
  '商品创建会调用后台商城商品接口',
  '用户端可直接看到',
  '设计稿页面',
  'mUU7R',
  '接口边界',
  '接口占位',
  '真实接口接入提示',
  'Agent F',
  '接入接口',
  '正在连接后端管理接口',
  '后端接口连接正常',
  '部分接口暂不可用',
  '部分接口加载失败',
  '管理端实时接口',
  '当前加载状态',
  '销量统计接口',
  '接口问题',
  '真实申请表',
  '订单事件',
  '后续可扩展',
  'storage key',
  'COS key',
  '规则 JSON',
  '供 C 端',
  'C 端商城首页',
  '页面壳就绪',
  '平台能力壳',
  '复用治理后台壳',
  '只接 vehicle-api',
  '只接 mall-api',
  '主要接 platform-api',
  '后端校验规则',
  'key 前缀',
  '服务接口',
  '接口降级',
  '所有已加载接口可用',
  '报价字段',
  'COS管理',
  'SKU 规格',
  '用户 ID',
];

const failures = [];

for (const file of files) {
  const source = readFileSync(resolve(root, file), 'utf8');
  for (const copy of bannedCopy) {
    if (source.includes(copy)) {
      failures.push(`${file}: remove user-visible engineering copy "${copy}"`);
    }
  }
}

if (failures.length) {
  throw new Error(`Web admin human-copy check failed:\n- ${failures.join('\n- ')}`);
}

console.log('web admin human copy contract ok');
