use std::net::SocketAddr;

use recorouter_api::{app, config::Config, db, storage};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let config = Config::from_env()?;
    let db = db::connect(&config).await?;
    db::run_migrations(&db).await?;
    let storage = storage::from_config(&config);
    let router = app::router(config.clone(), db, storage);
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server_port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    axum::serve(listener, router).await?;

    Ok(())
}
