use axum::Router;
use sqlx::PgPool;
use tower_http::services::ServeDir;

use crate::{
    config::Config,
    modules::{
        account_settings, address_books, admin, auth, cancellations, demand_schedules,
        demand_templates, demands, fare, favorite_routes, health, home, notifications, orders,
        platform, user_roles, vehicles,
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
}

pub fn router<S>(config: Config, db: PgPool, storage: S) -> Router
where
    S: Storage + Send + Sync + 'static,
{
    let upload_dir = config.local_upload_dir.clone();
    let state = AppState {
        config,
        db,
        storage,
    };

    Router::new()
        .nest_service("/api/uploads", ServeDir::new(upload_dir))
        .merge(health::router::<AppState<S>>())
        .merge(home::router::<S>())
        .merge(auth::router::<S>())
        .merge(account_settings::router::<S>())
        .merge(user_roles::router::<S>())
        .merge(platform::router::<S>())
        .merge(fare::router::<S>())
        .merge(notifications::router::<S>())
        .merge(orders::router::<S>())
        .merge(cancellations::router::<S>())
        .merge(admin::router::<S>())
        .merge(vehicles::router::<S>())
        .merge(address_books::router::<S>())
        .merge(favorite_routes::router::<S>())
        .merge(demands::router::<S>())
        .merge(demand_templates::router::<S>())
        .merge(demand_schedules::router::<S>())
        .with_state(state)
}
