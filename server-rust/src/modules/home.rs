use axum::{
    extract::{DefaultBodyLimit, Multipart, State},
    routing::post,
    Json, Router,
};
use chrono::Utc;
use rand::{distributions::Alphanumeric, Rng};
use serde::Serialize;

use crate::{
    app::AppState,
    error::{ApiError, ApiResult},
    response::{ok, ApiEnvelope},
    storage::Storage,
};

const MAX_FILE_SIZE: usize = 5 * 1024 * 1024;
const MAX_MULTIPART_SIZE: usize = MAX_FILE_SIZE + 1024 * 1024;
const ALLOWED_IMAGE_TYPES: [&str; 5] = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
];

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/home/upload", post(upload))
        .route_layer(DefaultBodyLimit::max(MAX_MULTIPART_SIZE))
}

#[derive(Debug, Serialize)]
struct UploadResponse {
    #[serde(rename = "fileKey")]
    file_key: String,
    url: String,
}

async fn upload<S>(
    State(state): State<AppState<S>>,
    mut multipart: Multipart,
) -> ApiResult<Json<ApiEnvelope<UploadResponse>>>
where
    S: Storage,
{
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|err| ApiError::BadRequest(err.to_string()))?
    {
        if field.name() != Some("file") {
            continue;
        }

        let content_type = field.content_type().map(str::to_string);
        if !content_type
            .as_deref()
            .is_some_and(|value| ALLOWED_IMAGE_TYPES.contains(&value))
        {
            return Err(ApiError::BadRequest(
                "不支持的文件类型，请上传图片文件".to_string(),
            ));
        }

        let extension = extension_for_content_type(content_type.as_deref())
            .ok_or_else(|| ApiError::BadRequest("不支持的文件类型，请上传图片文件".to_string()))?;
        let bytes = field
            .bytes()
            .await
            .map_err(|err| ApiError::BadRequest(err.to_string()))?;

        if bytes.is_empty() {
            return Err(ApiError::BadRequest("文件不能为空".to_string()));
        }

        if bytes.len() > MAX_FILE_SIZE {
            return Err(ApiError::BadRequest("文件大小不能超过5MB".to_string()));
        }

        let file_name = format!(
            "cargo-photos/{}-{}.{}",
            Utc::now().timestamp_millis(),
            random_id(),
            extension
        );
        let file_key = state
            .storage
            .put(bytes.to_vec(), &file_name, content_type.as_deref())
            .await?;
        let url = state.storage.public_url(&file_key).await?;

        return Ok(ok("上传成功", UploadResponse { file_key, url }));
    }

    Err(ApiError::BadRequest("文件不能为空".to_string()))
}

fn extension_for_content_type(content_type: Option<&str>) -> Option<&'static str> {
    match content_type {
        Some("image/jpeg") | Some("image/jpg") => Some("jpg"),
        Some("image/png") => Some("png"),
        Some("image/gif") => Some("gif"),
        Some("image/webp") => Some("webp"),
        _ => None,
    }
}

fn random_id() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(8)
        .map(char::from)
        .collect()
}
