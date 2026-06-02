import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appSource = readFileSync(resolve('server/src/app.rs'), 'utf8')
const mallSource = readFileSync(resolve('server/src/modules/mall.rs'), 'utf8')
const ordersSource = readFileSync(resolve('server/src/modules/orders.rs'), 'utf8')
const vehiclesSource = readFileSync(resolve('server/src/modules/vehicles.rs'), 'utf8')
const testSource = readFileSync(resolve('server/tests/mall_endpoints.rs'), 'utf8')
const orderTestSource = readFileSync(resolve('server/tests/order_endpoints.rs'), 'utf8')
const vehicleTestSource = readFileSync(resolve('server/tests/vehicle_endpoints.rs'), 'utf8')

const adminRouterIndex = mallSource.indexOf('pub fn admin_router')
if (adminRouterIndex === -1) {
  throw new Error('mall.rs must expose a dedicated admin_router for /api/admin/mall routes')
}

const publicRouterSource = mallSource.slice(0, adminRouterIndex)
const adminRouterSource = mallSource.slice(adminRouterIndex)

if (/\/api\/admin\/mall\//.test(publicRouterSource)) {
  throw new Error('/api/admin/mall routes must not be mounted in the public mall router')
}

if (!/\/api\/admin\/mall\/products/.test(adminRouterSource) || !/\/api\/admin\/mall\/orders/.test(adminRouterSource)) {
  throw new Error('mall admin_router must include admin product and order routes')
}

if (!/pub fn admin_router/.test(ordersSource) || !/\/api\/orders\/commission-pending/.test(ordersSource) || !/\/api\/orders\/:id\/commission-confirm/.test(ordersSource)) {
  throw new Error('orders.rs must expose protected commission admin routes')
}

if (!/pub fn admin_router/.test(vehiclesSource) || !/\/api\/vehicles\/:id\/review/.test(vehiclesSource)) {
  throw new Error('vehicles.rs must expose a protected vehicle review route')
}

if (
  !/mall::admin_router::<S>\(\)\.route_layer\(\s*middleware::from_fn_with_state/.test(appSource)
  || !/orders::admin_router::<S>\(\)\.route_layer\(\s*middleware::from_fn_with_state/.test(appSource)
  || !/vehicles::admin_router::<S>\(\)\.route_layer\(\s*middleware::from_fn_with_state/.test(appSource)
  || !/auth::admin_guard::<S>/.test(appSource)
) {
  throw new Error('app router must protect mall, order commission, and vehicle admin routers with auth::admin_guard')
}

if (!/StatusCode::UNAUTHORIZED/.test(testSource) || !/StatusCode::FORBIDDEN/.test(testSource)) {
  throw new Error('mall endpoint tests must cover missing and non-admin bearer access')
}

if (!/get_json_with_auth/.test(testSource) || !/post_json_with_auth/.test(testSource)) {
  throw new Error('mall endpoint tests must exercise admin routes with bearer auth')
}

if (!/commission-summary/.test(orderTestSource) || !/get_json_with_auth/.test(orderTestSource) || !/put_json_with_auth/.test(orderTestSource)) {
  throw new Error('order endpoint tests must exercise commission admin routes with bearer auth')
}

if (!/\/api\/vehicles\/\{vehicle_id\}\/review/.test(vehicleTestSource) || !/post_json_with_auth/.test(vehicleTestSource)) {
  throw new Error('vehicle endpoint tests must exercise review route with bearer auth')
}
