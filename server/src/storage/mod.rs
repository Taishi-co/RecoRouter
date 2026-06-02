use async_trait::async_trait;

use crate::{config::Config, error::ApiError};

mod cos;
mod local;

pub use cos::TencentCosStorage;
pub use local::LocalStorage;

#[async_trait]
pub trait Storage: Clone + Send + Sync + 'static {
    async fn put(
        &self,
        bytes: Vec<u8>,
        file_name: &str,
        content_type: Option<&str>,
    ) -> Result<String, ApiError>;

    async fn put_key(
        &self,
        bytes: Vec<u8>,
        key: &str,
        content_type: Option<&str>,
    ) -> Result<String, ApiError>;

    async fn public_url(&self, key: &str) -> Result<String, ApiError>;

    async fn public_url_with_expiry(
        &self,
        key: &str,
        expire_time_seconds: i64,
    ) -> Result<String, ApiError>;

    async fn exists(&self, key: &str) -> Result<bool, ApiError>;

    async fn delete(&self, key: &str) -> Result<bool, ApiError>;
}

#[derive(Clone)]
pub enum StorageBackend {
    Local(LocalStorage),
    TencentCos(TencentCosStorage),
}

#[async_trait]
impl Storage for StorageBackend {
    async fn put(
        &self,
        bytes: Vec<u8>,
        file_name: &str,
        content_type: Option<&str>,
    ) -> Result<String, ApiError> {
        match self {
            Self::Local(storage) => storage.put(bytes, file_name, content_type).await,
            Self::TencentCos(storage) => storage.put(bytes, file_name, content_type).await,
        }
    }

    async fn put_key(
        &self,
        bytes: Vec<u8>,
        key: &str,
        content_type: Option<&str>,
    ) -> Result<String, ApiError> {
        match self {
            Self::Local(storage) => storage.put_key(bytes, key, content_type).await,
            Self::TencentCos(storage) => storage.put_key(bytes, key, content_type).await,
        }
    }

    async fn public_url(&self, key: &str) -> Result<String, ApiError> {
        match self {
            Self::Local(storage) => storage.public_url(key).await,
            Self::TencentCos(storage) => storage.public_url(key).await,
        }
    }

    async fn public_url_with_expiry(
        &self,
        key: &str,
        expire_time_seconds: i64,
    ) -> Result<String, ApiError> {
        match self {
            Self::Local(storage) => {
                storage
                    .public_url_with_expiry(key, expire_time_seconds)
                    .await
            }
            Self::TencentCos(storage) => {
                storage
                    .public_url_with_expiry(key, expire_time_seconds)
                    .await
            }
        }
    }

    async fn exists(&self, key: &str) -> Result<bool, ApiError> {
        match self {
            Self::Local(storage) => storage.exists(key).await,
            Self::TencentCos(storage) => storage.exists(key).await,
        }
    }

    async fn delete(&self, key: &str) -> Result<bool, ApiError> {
        match self {
            Self::Local(storage) => storage.delete(key).await,
            Self::TencentCos(storage) => storage.delete(key).await,
        }
    }
}

pub fn from_config(config: &Config) -> StorageBackend {
    if config.has_tencent_cos() {
        return StorageBackend::TencentCos(TencentCosStorage::new(
            config
                .cos_secret_id
                .clone()
                .expect("checked by has_tencent_cos"),
            config
                .cos_secret_key
                .clone()
                .expect("checked by has_tencent_cos"),
            config
                .cos_bucket
                .clone()
                .expect("checked by has_tencent_cos"),
            config
                .cos_region
                .clone()
                .expect("checked by has_tencent_cos"),
        ));
    }

    StorageBackend::Local(LocalStorage::new(
        config.local_upload_dir.clone(),
        config.public_base_url.clone(),
    ))
}

pub(crate) fn build_storage_key(file_name: &str) -> Result<String, ApiError> {
    let raw_key = sanitized_key(file_name)?;
    let (dir, file_name) = raw_key
        .rsplit_once('/')
        .map_or((None, raw_key.as_str()), |(dir, file_name)| {
            (Some(dir), file_name)
        });
    let (stem, ext) = split_extension(file_name);
    let suffix = uuid::Uuid::new_v4().simple().to_string();
    let file_name = format!("{}_{}{}", stem, &suffix[..8], ext);

    Ok(match dir {
        Some(dir) => format!("{dir}/{file_name}"),
        None => file_name,
    })
}

pub(crate) fn sanitized_key(key: &str) -> Result<String, ApiError> {
    let normalized = key.replace('\\', "/");
    let segments = normalized
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(sanitize_segment)
        .collect::<Vec<_>>();

    if segments.is_empty() {
        return Ok("file".to_string());
    }

    Ok(segments.join("/"))
}

pub(crate) fn encode_key_path(key: &str) -> Result<String, ApiError> {
    let key = sanitized_key(key)?;
    Ok(key
        .split('/')
        .map(encode_url_component)
        .collect::<Vec<_>>()
        .join("/"))
}

pub(crate) fn encode_url_component(value: &str) -> String {
    const ENCODE_SET: &percent_encoding::AsciiSet = &percent_encoding::CONTROLS
        .add(b' ')
        .add(b'"')
        .add(b'#')
        .add(b'$')
        .add(b'%')
        .add(b'&')
        .add(b'+')
        .add(b',')
        .add(b'/')
        .add(b':')
        .add(b';')
        .add(b'<')
        .add(b'=')
        .add(b'>')
        .add(b'?')
        .add(b'@')
        .add(b'[')
        .add(b'\\')
        .add(b']')
        .add(b'^')
        .add(b'`')
        .add(b'{')
        .add(b'|')
        .add(b'}');

    percent_encoding::utf8_percent_encode(value, ENCODE_SET).to_string()
}

fn sanitize_segment(segment: &str) -> String {
    let mut result = String::new();
    let mut last_was_underscore = false;

    for ch in segment.trim().chars() {
        let mapped = if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_') {
            ch
        } else {
            '_'
        };

        if mapped == '_' {
            if !last_was_underscore {
                result.push(mapped);
            }
            last_was_underscore = true;
        } else {
            result.push(mapped);
            last_was_underscore = false;
        }
    }

    let trimmed = result.trim_matches(|ch| matches!(ch, '.' | '_' | '-'));
    if trimmed.is_empty() {
        "file".to_string()
    } else {
        trimmed.to_string()
    }
}

fn split_extension(file_name: &str) -> (&str, &str) {
    match file_name.rfind('.') {
        Some(index) if index > 0 => (&file_name[..index], &file_name[index..]),
        _ => (file_name, ""),
    }
}
