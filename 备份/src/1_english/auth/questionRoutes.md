```json
{
  "q_1705312800000_nc001": {
    // 1. 核心计数（必选）
    "extraction_count": 12,        // 总抽取次数
    "correct_count": 10,            // 总正确次数
    "wrong_count": 2,               // 总错误次数
    
    // 2. 时间记录（必选）
    "first_seen": "2024-01-10T09:20:00Z",     // 首次见到
    "last_extracted": "2024-01-20T15:30:00Z", // 上次抽取
    "last_result": true,                       // 上次结果
    
    // 3. 智能指标（动态计算后存储）
    "mastery_level": 0.83,           // 掌握程度 0-1
    
    // 4. 历史记录（可选，用于分析趋势）
    "history": [
      {"date": "2024-01-15T10:30:00Z", "result": true, "time": 5.2},
      {"date": "2024-01-16T14:20:00Z", "result": true, "time": 4.8},
      {"date": "2024-01-18T09:15:00Z", "result": false, "time": 12.3},
      {"date": "2024-01-20T15:30:00Z", "result": true, "time": 6.1}
    ],
    
    // 5. 进阶指标（可选，用于更智能的分析）
    "streak": {                       // 连续记录
      "current_correct": 1,           // 当前连续正确
      "current_wrong": 0,             // 当前连续错误
      "max_correct": 3,               // 最大连续正确
      "max_wrong": 1                  // 最大连续错误
    },
    "time_stats": {                    // 用时统计
      "avg_time": 7.1,                 // 平均用时（秒）
      "fastest": 4.8,                  // 最快用时
      "slowest": 12.3                  // 最慢用时
    }
  }
}
```