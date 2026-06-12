use axum::{middleware, Router};
use sqlx::PgPool;
use tower_http::services::ServeDir;

use crate::{
    config::{ApiService, Config},
    modules::{
        account_settings, address_books, admin, auth, cancellations, demand_schedules,
        demand_templates, demands, enterprise, enterprise_demands, enterprise_vehicles, fare,
        favorite_routes, health, home, mall, notifications, orders, owner_wallet, payments,
        platform, rental_reminders, station, trips, user_roles, vehicle_rentals, vehicles,
    },
    storage::Storage,
};

#[derive(Clone)]
pub struct AppState<S>
where
    S: Storage,
{
    pub config: Config,
    pub db: PgPool,
    pub storage: S,
    pub captcha_store: auth::CaptchaStore,
}

pub fn router<S>(config: Config, db: PgPool, storage: S) -> Router
where
    S: Storage + Send + Sync + 'static,
{
    legacy_router(config, db, storage)
}

pub fn legacy_router<S>(config: Config, db: PgPool, storage: S) -> Router
where
    S: Storage + Send + Sync + 'static,
{
    router_for_service(ApiService::Legacy, config, db, storage)
}

pub fn vehicle_router<S>(config: Config, db: PgPool, storage: S) -> Router
where
    S: Storage + Send + Sync + 'static,
{
    router_for_service(ApiService::Vehicle, config, db, storage)
}

pub fn mall_router<S>(config: Config, db: PgPool, storage: S) -> Router
where
    S: Storage + Send + Sync + 'static,
{
    router_for_service(ApiService::Mall, config, db, storage)
}

pub fn platform_router<S>(config: Config, db: PgPool, storage: S) -> Router
where
    S: Storage + Send + Sync + 'static,
{
    router_for_service(ApiService::Platform, config, db, storage)
}

pub fn router_for_service<S>(service: ApiService, config: Config, db: PgPool, storage: S) -> Router
where
    S: Storage + Send + Sync + 'static,
{
    let upload_dir = config.local_upload_dir.clone();
    let state = AppState {
        config,
        db,
        storage,
        captcha_store: auth::CaptchaStore::default(),
    };

    let router: Router<AppState<S>> = Router::new()
        .nest_service("/api/uploads", ServeDir::new(upload_dir))
        .merge(health::router::<AppState<S>>());

    let router = match service {
        ApiService::Legacy => legacy_routes(router, &state),
        ApiService::Vehicle => vehicle_routes(router, &state),
        ApiService::Mall => mall_routes(router, &state),
        ApiService::Platform => platform_routes(router, &state),
    };

    router.with_state(state)
}

fn legacy_routes<S>(router: Router<AppState<S>>, state: &AppState<S>) -> Router<AppState<S>>
where
    S: Storage + Send + Sync + 'static,
{
    platform_routes(mall_routes(vehicle_routes(router, state), state), state)
}

fn vehicle_routes<S>(router: Router<AppState<S>>, state: &AppState<S>) -> Router<AppState<S>>
where
    S: Storage + Send + Sync + 'static,
{
    router
        .merge(home::router::<S>())
        .merge(auth::router::<S>())
        .merge(account_settings::router::<S>())
        .merge(user_roles::router::<S>())
        .merge(fare::router::<S>())
        .merge(notifications::router::<S>())
        .merge(orders::router::<S>())
        .merge(
            orders::admin_router::<S>().route_layer(middleware::from_fn_with_state(
                state.clone(),
                auth::admin_guard::<S>,
            )),
        )
        .merge(owner_wallet::router::<S>())
        .merge(
            owner_wallet::admin_router::<S>().route_layer(middleware::from_fn_with_state(
                state.clone(),
                auth::admin_guard::<S>,
            )),
        )
        .merge(cancellations::router::<S>())
        .merge(
            admin::router::<S>().route_layer(middleware::from_fn_with_state(
                state.clone(),
                auth::admin_guard::<S>,
            )),
        )
        .merge(enterprise::router::<S>())
        .merge(station::router::<S>())
        .merge(enterprise_vehicles::router::<S>())
        .merge(enterprise_demands::router::<S>())
        .merge(vehicle_rentals::router::<S>())
        .merge(rental_reminders::router::<S>())
        .merge(vehicles::router::<S>())
        .merge(
            vehicles::admin_router::<S>().route_layer(middleware::from_fn_with_state(
                state.clone(),
                auth::admin_guard::<S>,
            )),
        )
        .merge(address_books::router::<S>())
        .merge(favorite_routes::router::<S>())
        .merge(demands::router::<S>())
        .merge(demand_templates::router::<S>())
        .merge(demand_schedules::router::<S>())
        .merge(trips::router::<S>())
        .merge(
            trips::admin_router::<S>().route_layer(middleware::from_fn_with_state(
                state.clone(),
                auth::admin_guard::<S>,
            )),
        )
}

fn mall_routes<S>(router: Router<AppState<S>>, state: &AppState<S>) -> Router<AppState<S>>
where
    S: Storage + Send + Sync + 'static,
{
    router
        .merge(mall::router::<S>())
        .merge(payments::router::<S>())
        // trips 路由已在 vehicle_routes 中添加，避免重复注册
        .merge(
            mall::admin_router::<S>().route_layer(middleware::from_fn_with_state(
                state.clone(),
                auth::admin_guard::<S>,
            )),
        )
}

fn platform_routes<S>(router: Router<AppState<S>>, _state: &AppState<S>) -> Router<AppState<S>>
where
    S: Storage + Send + Sync + 'static,
{
    router.merge(platform::router::<S>())
}
