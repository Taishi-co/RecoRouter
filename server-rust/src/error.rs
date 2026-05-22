pub type ApiResult<T> = Result<T, ApiError>;

#[derive(Debug, thiserror::Error)]
#[error("{message}")]
pub struct ApiError {
    message: String,
}

impl ApiError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}
