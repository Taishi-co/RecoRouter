use axum::Router;
use sqlx::PgPool;
use tower_http::services::ServeDir;

use crate::{
    config::Config,
    modules::{
        account_settings, address_books, admin, auth, cancellations, demand_schedules,
        demand_templates, demands, enterprise, enterprise_demands, enterprise_vehicles, fare,
        favorite_routes, health, home, notifications, orders, owner_wallet, payments, platform,
        rental_reminders, station, user_roles, vehicle_rentals, vehicles,
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
    let upload_dir = config.local_upload_dir.clone();
    let state = AppState {
        config,
        db,
        storage,
        captcha_store: auth::CaptchaStore::default(),
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
        .merge(payments::router::<S>())
        .merge(owner_wallet::router::<S>())
        .merge(cancellations::router::<S>())
        .merge(admin::router::<S>())
        .merge(enterprise::router::<S>())
        .merge(station::router::<S>())
        .merge(enterprise_vehicles::router::<S>())
        .merge(enterprise_demands::router::<S>())
        .merge(vehicle_rentals::router::<S>())
        .merge(rental_reminders::router::<S>())
        .merge(vehicles::router::<S>())
        .merge(address_books::router::<S>())
        .merge(favorite_routes::router::<S>())
        .merge(demands::router::<S>())
        .merge(demand_templates::router::<S>())
        .merge(demand_schedules::router::<S>())
        .with_state(state)
}
