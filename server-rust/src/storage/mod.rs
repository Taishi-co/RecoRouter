use async_trait::async_trait;

use crate::{config::Config, error::ApiError};

mod local;

pub use local::LocalStorage;

#[async_trait]
pub trait Storage: Clone + Send + Sync + 'static {
    async fn put(
        &self,
        bytes: Vec<u8>,
        file_name: &str,
        content_type: Option<&str>,
    ) -> Result<String, ApiError>;

    async fn public_url(&self, key: &str) -> Result<String, ApiError>;

    async fn exists(&self, key: &str) -> Result<bool, ApiError>;

    async fn delete(&self, key: &str) -> Result<bool, ApiError>;
}

pub fn from_config(config: &Config) -> LocalStorage {
    LocalStorage::new(
        config.local_upload_dir.clone(),
        config.public_base_url.clone(),
    )
}
