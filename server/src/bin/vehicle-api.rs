use recorouter_api::{config::ApiService, runtime};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    runtime::serve(ApiService::Vehicle).await
}
