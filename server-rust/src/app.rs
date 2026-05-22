use axum::Router;
use sqlx::PgPool;

use crate::{config::Config, modules::health, storage::Storage};

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
    let state = AppState {
        config,
        db,
        storage,
    };

    Router::new()
        .merge(health::router::<AppState<S>>())
        .with_state(state)
}
