use std::path::{Component, Path, PathBuf};

use async_trait::async_trait;
use tokio::fs;
use uuid::Uuid;

use crate::{error::ApiError, storage::Storage};

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
        let key = sanitize_key(key)?;
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
        let key = append_uuid_suffix(&sanitize_key(file_name)?);
        let path = self.key_path(&key)?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await.map_err(storage_error)?;
        }

        fs::write(&path, bytes).await.map_err(storage_error)?;

        Ok(key)
    }

    async fn public_url(&self, key: &str) -> Result<String, ApiError> {
        let key = sanitize_key(key)?;
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

fn append_uuid_suffix(key: &str) -> String {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let path = Path::new(key);
    let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
        return format!("{key}-{suffix}");
    };
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(file_name);
    let suffixed = match path.extension().and_then(|value| value.to_str()) {
        Some(extension) if !extension.is_empty() => format!("{stem}-{suffix}.{extension}"),
        _ => format!("{stem}-{suffix}"),
    };

    match path.parent().and_then(|parent| parent.to_str()) {
        Some(parent) if !parent.is_empty() => format!("{parent}/{suffixed}"),
        _ => suffixed,
    }
}

fn sanitize_key(key: &str) -> Result<String, ApiError> {
    let mut segments = Vec::new();

    for component in Path::new(key).components() {
        match component {
            Component::Normal(segment) => {
                let segment = segment
                    .to_str()
                    .ok_or_else(|| ApiError::Storage("invalid storage key".to_string()))?;
                let sanitized = sanitize_segment(segment);
                if !sanitized.is_empty() {
                    segments.push(sanitized);
                }
            }
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(ApiError::Storage("invalid storage key".to_string()));
            }
        }
    }

    if segments.is_empty() {
        return Err(ApiError::Storage("invalid storage key".to_string()));
    }

    Ok(segments.join("/"))
}

fn sanitize_segment(segment: &str) -> String {
    segment
        .chars()
        .filter_map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_') {
                Some(ch)
            } else if ch.is_whitespace() {
                Some('_')
            } else {
                None
            }
        })
        .collect()
}

fn storage_error(err: std::io::Error) -> ApiError {
    ApiError::Storage(err.to_string())
}
