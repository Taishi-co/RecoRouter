use axum::Router;
use sqlx::PgPool;
use tower_http::services::ServeDir;

use crate::{
    config::Config,
    modules::{account_settings, auth, health, home, platform, user_roles},
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
        .with_state(state)
}
