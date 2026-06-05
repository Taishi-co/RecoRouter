use recorouter_api::{
    config::{self, ApiService, Config},
    db,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let service = config::service_from_env_key("MIGRATION_SERVICE", ApiService::Legacy)?;
    let config = Config::from_env_for_service(service)?;
    let db = db::connect(&config).await?;
    tracing::info!(
        service = service.as_str(),
        "running recorouter database migrations"
    );
    db::run_migrations(&db).await?;
    tracing::info!(
        service = service.as_str(),
        "recorouter database migrations completed"
    );

    Ok(())
}
