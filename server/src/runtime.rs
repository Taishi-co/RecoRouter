use std::net::SocketAddr;

use crate::{
    app,
    config::{ApiService, Config},
    db, storage,
};

pub async fn serve(service: ApiService) -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let config = Config::from_env_for_service(service)?;
    let db = db::connect(&config).await?;
    if crate::config::should_run_migrations(service)? {
        db::run_migrations(&db).await?;
    } else {
        tracing::info!(
            service = service.as_str(),
            "skipping embedded migrations for split service"
        );
    }
    let storage = storage::from_config(&config);
    let router = app::router_for_service(service, config.clone(), db, storage);
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server_port));
    tracing::info!(
        service = service.as_str(),
        port = config.server_port,
        "starting recorouter api service"
    );
    let listener = tokio::net::TcpListener::bind(addr).await?;

    axum::serve(listener, router).await?;

    Ok(())
}
