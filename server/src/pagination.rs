#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Pagination {
    pub limit: i64,
    pub offset: i64,
}

impl Pagination {
    pub fn from_query(page: Option<i64>, page_size: Option<i64>) -> Self {
        let page = page.unwrap_or(1).max(1);
        let limit = page_size.unwrap_or(20).clamp(1, 100);

        Self {
            limit,
            offset: page.saturating_sub(1).saturating_mul(limit),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Pagination;

    #[test]
    fn defaults_to_first_page_with_twenty_items() {
        let pagination = Pagination::from_query(None, None);

        assert_eq!(pagination.limit, 20);
        assert_eq!(pagination.offset, 0);
    }

    #[test]
    fn clamps_page_size_to_supported_range() {
        let tiny = Pagination::from_query(Some(1), Some(-20));
        let huge = Pagination::from_query(Some(1), Some(500));

        assert_eq!(tiny.limit, 1);
        assert_eq!(huge.limit, 100);
    }

    #[test]
    fn saturates_offset_for_extreme_page_values() {
        let pagination = Pagination::from_query(Some(i64::MAX), Some(100));

        assert_eq!(pagination.limit, 100);
        assert_eq!(pagination.offset, i64::MAX);
    }
}
