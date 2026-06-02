use std::{env, net::SocketAddr, path::Path};

use recorouter_api::{app, config::Config, db, storage, storage::Storage};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let args = env::args().collect::<Vec<_>>();
    let config = Config::from_env()?;

    if args.get(1).is_some_and(|arg| arg == "sync-mall-assets") {
        let asset_dir = args
            .get(2)
            .map(String::as_str)
            .unwrap_or("/assets/mall-products");
        let storage = storage::from_config(&config);
        sync_mall_assets(&storage, asset_dir).await?;
        return Ok(());
    }

    let db = db::connect(&config).await?;
    db::run_migrations(&db).await?;
    let storage = storage::from_config(&config);
    let router = app::router(config.clone(), db, storage);
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server_port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    axum::serve(listener, router).await?;

    Ok(())
}

async fn sync_mall_assets<S>(
    storage: &S,
    asset_dir: &str,
) -> Result<(), Box<dyn std::error::Error>>
where
    S: Storage,
{
    let mut entries = tokio::fs::read_dir(asset_dir).await?;
    let mut synced = 0usize;

    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let Some(content_type) = image_content_type(&path) else {
            continue;
        };

        let bytes = tokio::fs::read(&path).await?;
        let key = format!("mall-products/{file_name}");
        let stored_key = storage.put_key(bytes, &key, Some(content_type)).await?;
        println!("Synced mall asset {stored_key}");
        synced += 1;
    }

    println!("Synced {synced} mall product assets");

    Ok(())
}

fn image_content_type(path: &Path) -> Option<&'static str> {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("jpg" | "jpeg") => Some("image/jpeg"),
        Some("png") => Some("image/png"),
        Some("webp") => Some("image/webp"),
        _ => None,
    }
}
