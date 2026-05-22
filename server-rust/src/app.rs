use axum::Router;
use sqlx::PgPool;

use crate::{config::Config, storage::Storage};

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

    Router::new().with_state(state)
}
