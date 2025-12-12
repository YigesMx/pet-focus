/// Fractional Indexing 实现
/// 使用浮点数方法：每次插入时计算前后位置的平均数
///
/// 规则：
/// - 两个位置之间：取平均值 (a + b) / 2
/// - 在开头（before=None）：after / 2
/// - 在末尾（after=None）：before + 10
/// - 当值小于阈值（1e-5）时触发重新分配

const BASE_INTERVAL: f64 = 10.0;
const MIN_THRESHOLD: f64 = 1e-5;

/// 生成在两个索引之间的新索引
pub fn generate_key_between(a: Option<f64>, b: Option<f64>) -> f64 {
    match (a, b) {
        (None, None) => {
            // 第一个元素
            BASE_INTERVAL
        }
        (None, Some(b_val)) => {
            // 在开头插入：after / 2
            b_val / 2.0
        }
        (Some(a_val), None) => {
            // 在末尾追加：before + 10
            a_val + BASE_INTERVAL
        }
        (Some(a_val), Some(b_val)) => {
            // 在两者之间：(a + b) / 2
            (a_val + b_val) / 2.0
        }
    }
}

/// 检查 order_index 是否需要重新分配
/// 当计算出的值小于阈值时返回 true
pub fn should_rebalance(order_index: f64) -> bool {
    order_index.abs() < MIN_THRESHOLD
}

/// 为一组任务生成均匀分布的索引
/// 按 BASE_INTERVAL (10) 为间隔重新生成
pub fn generate_balanced_keys(count: usize) -> Vec<f64> {
    let mut keys = Vec::with_capacity(count);

    for i in 1..=count {
        let val = (i as f64) * BASE_INTERVAL;
        keys.push(val);
    }

    keys
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_key_between_empty() {
        let key = generate_key_between(None, None);
        assert_eq!(key, 10.0);
    }

    #[test]
    fn test_generate_key_between_ordering() {
        // 第一个：10
        let key1 = generate_key_between(None, None);
        assert_eq!(key1, 10.0);

        // 在末尾：10 + 10 = 20
        let key2 = generate_key_between(Some(key1), None);
        assert_eq!(key2, 20.0);

        // 在 10 和 20 之间：(10 + 20) / 2 = 15
        let key3 = generate_key_between(Some(key1), Some(key2));
        assert_eq!(key3, 15.0);

        // 验证排序
        assert!(key1 < key2);
        assert!(key1 < key3);
        assert!(key3 < key2);
    }

    #[test]
    fn test_insert_at_beginning() {
        let key1 = 10.0;
        // 在开头：10 / 2 = 5
        let key0 = generate_key_between(None, Some(key1));
        assert_eq!(key0, 5.0);
        assert!(key0 < key1);
    }

    #[test]
    fn test_should_rebalance() {
        assert!(!should_rebalance(10.0));
        assert!(!should_rebalance(0.001));
        assert!(should_rebalance(0.000001)); // < 1e-5
        assert!(should_rebalance(0.0));
    }

    #[test]
    fn test_generate_balanced_keys() {
        let keys = generate_balanced_keys(5);
        assert_eq!(keys.len(), 5);

        // 应该是 10, 20, 30, 40, 50
        assert_eq!(keys[0], 10.0);
        assert_eq!(keys[1], 20.0);
        assert_eq!(keys[2], 30.0);
        assert_eq!(keys[3], 40.0);
        assert_eq!(keys[4], 50.0);

        // 验证顺序
        for i in 0..keys.len() - 1 {
            assert!(keys[i] < keys[i + 1]);
        }
    }
}
