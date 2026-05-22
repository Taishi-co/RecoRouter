use std::path::PathBuf;

#[async_trait::async_trait]
pub trait Storage: Clone {
    fn root(&self) -> &PathBuf;
}

#[derive(Clone)]
pub struct LocalStorage {
    root: PathBuf,
}

impl LocalStorage {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }
}

#[async_trait::async_trait]
impl Storage for LocalStorage {
    fn root(&self) -> &PathBuf {
        &self.root
    }
}
