use std::path::PathBuf;

use async_trait::async_trait;
use tokio::fs;

use crate::{
    error::ApiError,
    storage::{build_storage_key, encode_key_path, sanitized_key, Storage},
};

#[derive(Clone)]
pub struct LocalStorage {
    root: PathBuf,
    public_base_url: Option<String>,
}

impl LocalStorage {
    pub fn new(root: PathBuf, public_base_url: Option<String>) -> Self {
        Self {
            root,
            public_base_url: public_base_url.map(|url| url.trim_end_matches('/').to_string()),
        }
    }

    fn key_path(&self, key: &str) -> Result<PathBuf, ApiError> {
        let key = sanitized_key(key)?;
        Ok(self.root.join(key))
    }
}

#[async_trait]
impl Storage for LocalStorage {
    async fn put(
        &self,
        bytes: Vec<u8>,
        file_name: &str,
        _content_type: Option<&str>,
    ) -> Result<String, ApiError> {
        let key = build_storage_key(file_name)?;
        let path = self.key_path(&key)?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await.map_err(storage_error)?;
        }

        fs::write(&path, bytes).await.map_err(storage_error)?;

        Ok(key)
    }

    async fn public_url(&self, key: &str) -> Result<String, ApiError> {
        let key = encode_key_path(key)?;
        let path = format!("/api/uploads/{key}");

        Ok(match &self.public_base_url {
            Some(base_url) => format!("{base_url}{path}"),
            None => path,
        })
    }

    async fn exists(&self, key: &str) -> Result<bool, ApiError> {
        let path = self.key_path(key)?;

        match fs::metadata(path).await {
            Ok(metadata) => Ok(metadata.is_file()),
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(err) => Err(storage_error(err)),
        }
    }

    async fn delete(&self, key: &str) -> Result<bool, ApiError> {
        let path = self.key_path(key)?;

        match fs::remove_file(path).await {
            Ok(()) => Ok(true),
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(err) => Err(storage_error(err)),
        }
    }
}

fn storage_error(err: std::io::Error) -> ApiError {
    ApiError::Storage(err.to_string())
}
