// router/json_user_m.js - 用户学习数据管理器
const fs = require('fs');
const path = require('path');

class UserLearningManager {
    constructor() {
        // 用户数据根目录
        this.usersBasePath = path.join(__dirname, '..', 'users');
        this.ensureBaseDirectory();
    }

    /**
     * 确保基础目录存在
     */
    ensureBaseDirectory() {
        if (!fs.existsSync(this.usersBasePath)) {
            fs.mkdirSync(this.usersBasePath, { recursive: true });
            console.log(`创建用户数据目录: ${this.usersBasePath}`);
        }
    }

    /**
     * 获取用户文件路径
     * @param {number|string} userId - 用户ID
     * @param {string} bookType - 书本类型: textbook, reading, pepa
     * @param {string} mode - 模式: study, review
     * @returns {string} 文件路径
     */
    getUserFilePath(userId, bookType, mode = 'study') {
        const userDir = path.join(this.usersBasePath, userId.toString());
        const fileName = `word_${bookType}_${mode}.json`;
        return path.join(userDir, fileName);
    }

    /**
     * 获取用户配置文件路径
     * @param {number|string} userId - 用户ID
     * @returns {string} 配置文件路径
     */
    getUserConfigPath(userId) {
        const userDir = path.join(this.usersBasePath, userId.toString());
        return path.join(userDir, `${userId}.json`);
    }

    /**
     * 检查用户目录是否存在
     * @param {number|string} userId - 用户ID
     * @returns {boolean} 是否存在
     */
    userDirectoryExists(userId) {
        const userDir = path.join(this.usersBasePath, userId.toString());
        return fs.existsSync(userDir);
    }

    /**
     * 创建用户目录
     * @param {number|string} userId - 用户ID
     * @returns {boolean} 是否成功
     */
    createUserDirectory(userId) {
        const userDir = path.join(this.usersBasePath, userId.toString());
        try {
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
                console.log(`创建用户目录: ${userDir}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`创建用户目录失败 (${userId}):`, error);
            return false;
        }
    }

    /**
     * 初始化用户数据文件
     * @param {number|string} userId - 用户ID
     * @param {string} username - 用户名
     * @returns {Object|null} 用户配置数据
     */
    initUserDataFiles(userId, username) {
        try {
            // 创建用户目录
            this.createUserDirectory(userId);
            
            const userDir = path.join(this.usersBasePath, userId.toString());
            
            // 1. 创建用户配置文件
            const userConfig = {
                user_id: parseInt(userId),
                username: username,
                current_status: {
                    active_book: 'reading',
                    active_mode: 'study',
                    current_word_index: 0,
                    last_updated: new Date().toISOString()
                },
                progress_stats: {
                    textbook: {
                        study_total: 0,
                        study_mastered: 0,
                        study_in_progress: 0,
                        review_total: 0,
                        review_mastered: 0,
                        review_due: 0,
                        last_study_date: null,
                        last_review_date: null
                    },
                    reading: {
                        study_total: 0,
                        study_mastered: 0,
                        study_in_progress: 0,
                        review_total: 0,
                        review_mastered: 0,
                        review_due: 0,
                        last_study_date: null,
                        last_review_date: null
                    },
                    pepa: {
                        study_total: 0,
                        study_mastered: 0,
                        study_in_progress: 0,
                        review_total: 0,
                        review_mastered: 0,
                        review_due: 0,
                        last_study_date: null,
                        last_review_date: null
                    }
                },
                settings: {
                    daily_target: 20,
                    notification_enabled: true,
                    auto_pronunciation: true,
                    difficulty_level: "medium",
                    theme: "light",
                    language: "zh-CN",
                    auto_play_audio: true,
                    show_hints: false,
                    timezone: "Asia/Shanghai",
                    font_size: "medium"
                },
                study_stats: {
                    current_streak: 0,
                    longest_streak: 0,
                    total_study_days: 0,
                    total_words_studied: 0,
                    total_words_mastered: 0,
                    total_study_time_minutes: 0,
                    average_daily_words: 0,
                    accuracy_rate: 0,
                    last_study_date: null
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                version: "2.0"
            };

            const configPath = this.getUserConfigPath(userId);
            fs.writeFileSync(configPath, JSON.stringify(userConfig, null, 2));
            console.log(`创建用户配置文件: ${configPath}`);

            // 2. 创建学习数据文件
            const bookTypes = ['textbook', 'reading', 'pepa'];
            const modes = ['study', 'review'];

            bookTypes.forEach(book => {
                modes.forEach(mode => {
                    const filePath = this.getUserFilePath(userId, book, mode);
                    let defaultContent;
                    
                    if (mode === 'study') {
                        // 学习本格式：数组
                        defaultContent = [];
                    } else {
                        // 复习本格式：对象
                        defaultContent = {};
                    }
                    
                    fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
                    console.log(`创建学习数据文件: ${filePath}`);
                });
            });

            console.log(`用户 ${username} (${userId}) 的数据文件初始化完成`);
            return userConfig;
        } catch (error) {
            console.error(`初始化用户数据文件失败 (${userId}):`, error);
            return null;
        }
    }

    /**
     * 获取学习数据
     * @param {number|string} userId - 用户ID
     * @param {string} bookType - 书本类型
     * @param {string} mode - 模式
     * @returns {Array|Object} 学习数据
     */
    getLearningData(userId, bookType, mode = 'study') {
        try {
            const filePath = this.getUserFilePath(userId, bookType, mode);
            
            // 检查文件是否存在
            if (!fs.existsSync(filePath)) {
                console.log(`学习数据文件不存在: ${filePath}，返回默认值`);
                // 确保目录存在
                this.createUserDirectory(userId);
                
                // 返回默认值
                if (mode === 'study') {
                    return [];
                } else {
                    return {};
                }
            }
            
            const data = fs.readFileSync(filePath, 'utf8');
            
            // 检查文件是否为空
            if (!data.trim()) {
                console.log(`学习数据文件为空: ${filePath}，返回默认值`);
                if (mode === 'study') {
                    return [];
                } else {
                    return {};
                }
            }
            
            const parsedData = JSON.parse(data);
            
            // 验证数据格式
            if (mode === 'study' && !Array.isArray(parsedData)) {
                console.warn(`学习本数据格式错误，重置为数组: ${filePath}`);
                return [];
            } else if (mode === 'review' && (Array.isArray(parsedData) || typeof parsedData !== 'object')) {
                console.warn(`复习本数据格式错误，重置为对象: ${filePath}`);
                return {};
            }
            
            return parsedData;
        } catch (error) {
            console.error(`读取学习数据失败 (${userId}, ${bookType}, ${mode}):`, error);
            
            // 返回安全的默认值
            if (mode === 'study') {
                return [];
            } else {
                return {};
            }
        }
    }

    /**
     * 保存学习数据
     * @param {number|string} userId - 用户ID
     * @param {string} bookType - 书本类型
     * @param {string} mode - 模式
     * @param {Array|Object} data - 要保存的数据
     * @returns {boolean} 是否成功
     */
    saveLearningData(userId, bookType, mode, data) {
        try {
            // 验证数据格式
            if (mode === 'study' && !Array.isArray(data)) {
                console.error(`学习本数据必须是数组: ${userId}, ${bookType}`);
                return false;
            } else if (mode === 'review' && (Array.isArray(data) || typeof data !== 'object')) {
                console.error(`复习本数据必须是对象: ${userId}, ${bookType}`);
                return false;
            }

            const filePath = this.getUserFilePath(userId, bookType, mode);
            
            // 确保目录存在
            this.createUserDirectory(userId);
            
            // 保存数据
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            
            console.log(`保存学习数据成功: ${filePath}`);
            return true;
        } catch (error) {
            console.error(`保存学习数据失败 (${userId}, ${bookType}, ${mode}):`, error);
            return false;
        }
    }

    /**
     * 获取用户配置
     * @param {number|string} userId - 用户ID
     * @returns {Object|null} 用户配置
     */
    getUserConfig(userId) {
        try {
            const configPath = this.getUserConfigPath(userId);
            
            // 检查配置文件是否存在
            if (!fs.existsSync(configPath)) {
                console.log(`用户配置文件不存在: ${configPath}`);
                
                // 尝试从 user_profiles.json 获取用户名
                try {
                    const profilesPath = path.join(__dirname, '..', 'user_profiles.json');
                    if (fs.existsSync(profilesPath)) {
                        const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
                        const userProfile = profiles.users[userId];
                        
                        if (userProfile && userProfile.basic_info) {
                            console.log(`自动初始化用户 ${userId} 的数据文件`);
                            return this.initUserDataFiles(userId, userProfile.basic_info.username);
                        }
                    }
                } catch (profileError) {
                    console.error(`读取用户档案失败:`, profileError);
                }
                
                return null;
            }
            
            const data = fs.readFileSync(configPath, 'utf8');
            
            // 检查文件是否为空
            if (!data.trim()) {
                console.warn(`用户配置文件为空: ${configPath}`);
                return null;
            }
            
            const config = JSON.parse(data);
            
            // 验证必要字段
            if (!config.user_id || !config.username) {
                console.warn(`用户配置文件格式错误: ${configPath}`);
                return null;
            }
            
            // 确保必要字段存在
            if (!config.current_status) config.current_status = {};
            if (!config.progress_stats) config.progress_stats = {};
            if (!config.settings) config.settings = {};
            if (!config.study_stats) config.study_stats = {};
            
            return config;
        } catch (error) {
            console.error(`读取用户配置失败 (${userId}):`, error);
            return null;
        }
    }

    /**
     * 更新用户配置
     * @param {number|string} userId - 用户ID
     * @param {Object} updates - 要更新的数据
     * @returns {boolean} 是否成功
     */
    updateUserConfig(userId, updates) {
        try {
            let config = this.getUserConfig(userId);
            
            if (!config) {
                console.error(`用户配置不存在，无法更新: ${userId}`);
                return false;
            }
            
            // 深度合并更新
            const deepMerge = (target, source) => {
                for (const key of Object.keys(source)) {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        if (!target[key]) target[key] = {};
                        deepMerge(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            };
            
            deepMerge(config, updates);
            
            // 更新元数据
            config.updated_at = new Date().toISOString();
            
            // 保存配置
            const configPath = this.getUserConfigPath(userId);
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            
            console.log(`更新用户配置成功: ${userId}`);
            return true;
        } catch (error) {
            console.error(`更新用户配置失败 (${userId}):`, error);
            return false;
        }
    }

    /**
     * 获取用户进度统计
     * @param {number|string} userId - 用户ID
     * @returns {Object|null} 进度统计
     */
    getUserProgress(userId) {
        const config = this.getUserConfig(userId);
        return config ? config.progress_stats : null;
    }

    /**
     * 更新学习进度
     * @param {number|string} userId - 用户ID
     * @param {string} bookType - 书本类型
     * @param {Object} updates - 更新数据
     * @returns {boolean} 是否成功
     */
    updateStudyProgress(userId, bookType, updates) {
        try {
            const config = this.getUserConfig(userId);
            if (!config) return false;
            
            if (!config.progress_stats[bookType]) {
                config.progress_stats[bookType] = {
                    study_total: 0,
                    study_mastered: 0,
                    study_in_progress: 0,
                    review_total: 0,
                    review_mastered: 0,
                    review_due: 0,
                    last_study_date: null,
                    last_review_date: null
                };
            }
            
            // 合并更新
            Object.assign(config.progress_stats[bookType], updates);
            
            // 更新总统计
            this.updateTotalStats(userId);
            
            // 保存配置
            config.updated_at = new Date().toISOString();
            const configPath = this.getUserConfigPath(userId);
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            
            return true;
        } catch (error) {
            console.error(`更新学习进度失败 (${userId}, ${bookType}):`, error);
            return false;
        }
    }

    /**
     * 更新总统计信息
     * @param {number|string} userId - 用户ID
     */
    updateTotalStats(userId) {
        try {
            const config = this.getUserConfig(userId);
            if (!config) return;
            
            const stats = config.progress_stats;
            let totalStudyWords = 0;
            let totalStudyMastered = 0;
            let totalReviewWords = 0;
            let totalReviewMastered = 0;
            let totalDueWords = 0;
            
            // 统计所有模块
            for (const bookType in stats) {
                const bookStats = stats[bookType];
                totalStudyWords += bookStats.study_total || 0;
                totalStudyMastered += bookStats.study_mastered || 0;
                totalReviewWords += bookStats.review_total || 0;
                totalReviewMastered += bookStats.review_mastered || 0;
                totalDueWords += bookStats.review_due || 0;
            }
            
            // 更新学习统计
            if (!config.study_stats) config.study_stats = {};
            config.study_stats.total_words_studied = totalStudyWords;
            config.study_stats.total_words_mastered = totalStudyMastered + totalReviewMastered;
            
            // 保存更新
            config.updated_at = new Date().toISOString();
            const configPath = this.getUserConfigPath(userId);
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            
        } catch (error) {
            console.error(`更新总统计失败 (${userId}):`, error);
        }
    }

    /**
     * 添加单词到学习本
     * @param {number|string} userId - 用户ID
     * @param {string} bookType - 书本类型
     * @param {Object} wordData - 单词数据
     * @returns {boolean} 是否成功添加（是否是新单词）
     */
    addWordToStudy(userId, bookType, wordData) {
        try {
            if (!wordData.word || !wordData.translation) {
                console.error(`添加单词失败: 单词或翻译为空`);
                return false;
            }
            
            const studyData = this.getLearningData(userId, bookType, 'study');
            
            // 检查是否已存在（不区分大小写）
            const wordExists = studyData.some(item => 
                item.word.toLowerCase() === wordData.word.toLowerCase()
            );
            
            if (wordExists) {
                console.log(`单词已存在: ${wordData.word}`);
                return false;
            }
            
            // 添加新单词
            const newWord = {
                word: wordData.word,
                translation: wordData.translation,
                status: {
                    listening: false,
                    reading: false,
                    translation: false,
                    pronunciation: false,
                    last_practiced: null
                },
                added_at: new Date().toISOString(),
                mastery_level: 0,
                practice_count: 0,
                tags: wordData.tags || [],
                notes: wordData.notes || '',
                source: wordData.source || 'manual'
            };
            
            studyData.push(newWord);
            
            // 保存数据
            this.saveLearningData(userId, bookType, 'study', studyData);
            
            // 更新进度统计
            const progress = this.getUserProgress(userId);
            if (progress && progress[bookType]) {
                this.updateStudyProgress(userId, bookType, {
                    study_total: progress[bookType].study_total + 1,
                    last_study_date: new Date().toISOString().split('T')[0]
                });
            }
            
            console.log(`添加单词成功: ${wordData.word} 到 ${bookType}`);
            return true;
        } catch (error) {
            console.error(`添加单词失败 (${userId}, ${bookType}):`, error);
            return false;
        }
    }

    /**
     * 检查单词是否已掌握
     * @param {Object} status - 单词状态
     * @returns {boolean} 是否已掌握
     */
    isWordMastered(status) {
        return status.listening && status.reading && 
               status.translation && status.pronunciation;
    }

    /**
     * 移动单词到复习本
     * @param {number|string} userId - 用户ID
     * @param {string} bookType - 书本类型
     * @param {Object} wordData - 单词数据
     * @returns {boolean} 是否成功
     */
    moveToReview(userId, bookType, wordData) {
        try {
            if (!wordData.word) {
                console.error(`移动单词失败: 单词数据无效`);
                return false;
            }
            
            const reviewData = this.getLearningData(userId, bookType, 'review');
            const wordKey = wordData.word.toLowerCase();
            
            // 如果已经存在，更新数据
            if (reviewData[wordKey]) {
                reviewData[wordKey].chinese = wordData.translation || reviewData[wordKey].chinese;
                reviewData[wordKey].time = new Date().toISOString();
                reviewData[wordKey].moved_from_study = true;
                reviewData[wordKey].last_updated = new Date().toISOString();
            } else {
                // 创建新记录
                reviewData[wordKey] = {
                    chinese: wordData.translation || '',
                    pass: false,
                    extraction_count: 0,
                    correct_count: 0,
                    wrong_count: 0,
                    time: new Date().toISOString(),
                    moved_from_study: true,
                    original_word: wordData.word,
                    added_at: new Date().toISOString(),
                    last_reviewed: null,
                    next_review_date: this.calculateNextReviewDate(0),
                    mastery_score: 0
                };
            }
            
            // 保存数据
            this.saveLearningData(userId, bookType, 'review', reviewData);
            
            // 更新进度统计
            const progress = this.getUserProgress(userId);
            if (progress && progress[bookType]) {
                this.updateStudyProgress(userId, bookType, {
                    study_mastered: (progress[bookType].study_mastered || 0) + 1,
                    review_total: (progress[bookType].review_total || 0) + 1,
                    review_due: (progress[bookType].review_due || 0) + 1,
                    last_review_date: new Date().toISOString().split('T')[0]
                });
            }
            
            console.log(`移动单词到复习本: ${wordData.word} 到 ${bookType}`);
            return true;
        } catch (error) {
            console.error(`移动单词失败 (${userId}, ${bookType}):`, error);
            return false;
        }
    }

    /**
     * 计算下次复习日期
     * @param {number} correctCount - 正确次数
     * @returns {string} 下次复习日期
     */
    calculateNextReviewDate(correctCount) {
        const intervals = [1, 3, 7, 14, 30]; // 间隔天数
        const days = correctCount < intervals.length ? intervals[correctCount] : 30;
        
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + days);
        
        return nextDate.toISOString().split('T')[0];
    }

    /**
     * 获取需要复习的单词
     * @param {number|string} userId - 用户ID
     * @param {string} bookType - 书本类型
     * @returns {Object} 需要复习的单词
     */
    getDueReviewWords(userId, bookType) {
        try {
            const reviewData = this.getLearningData(userId, bookType, 'review');
            const dueWords = {};
            const today = new Date().toISOString().split('T')[0];
            
            for (const [word, data] of Object.entries(reviewData)) {
                if (!data.pass) {
                    // 检查是否需要复习
                    const shouldReview = !data.next_review_date || 
                                        data.next_review_date <= today ||
                                        data.extraction_count === 0;
                    
                    if (shouldReview) {
                        dueWords[word] = data;
                    }
                }
            }
            
            // 更新待复习单词数量
            const dueCount = Object.keys(dueWords).length;
            this.updateStudyProgress(userId, bookType, { review_due: dueCount });
            
            return dueWords;
        } catch (error) {
            console.error(`获取复习单词失败 (${userId}, ${bookType}):`, error);
            return {};
        }
    }

    /**
     * 更新复习单词状态
     * @param {number|string} userId - 用户ID
     * @param {string} bookType - 书本类型
     * @param {string} word - 单词
     * @param {boolean} isCorrect - 是否回答正确
     * @returns {Object|null} 更新后的单词数据
     */
    updateReviewWord(userId, bookType, word, isCorrect) {
        try {
            const reviewData = this.getLearningData(userId, bookType, 'review');
            const wordKey = word.toLowerCase();
            
            if (!reviewData[wordKey]) {
                console.error(`复习单词不存在: ${word}`);
                return null;
            }
            
            const wordData = reviewData[wordKey];
            
            // 更新统计
            wordData.extraction_count = (wordData.extraction_count || 0) + 1;
            
            if (isCorrect) {
                wordData.correct_count = (wordData.correct_count || 0) + 1;
            } else {
                wordData.wrong_count = (wordData.wrong_count || 0) + 1;
            }
            
            // 计算掌握分数 (0-100)
            const totalAttempts = wordData.correct_count + wordData.wrong_count;
            wordData.mastery_score = totalAttempts > 0 ? 
                Math.round((wordData.correct_count / totalAttempts) * 100) : 0;
            
            // 检查是否通过（连续正确3次）
            if (wordData.correct_count >= 3) {
                wordData.pass = true;
            }
            
            // 更新时间和下次复习日期
            wordData.last_reviewed = new Date().toISOString();
            wordData.next_review_date = this.calculateNextReviewDate(wordData.correct_count);
            wordData.last_updated = new Date().toISOString();
            
            // 保存数据
            this.saveLearningData(userId, bookType, 'review', reviewData);
            
            // 更新进度统计
            if (wordData.pass) {
                const progress = this.getUserProgress(userId);
                if (progress && progress[bookType]) {
                    this.updateStudyProgress(userId, bookType, {
                        review_mastered: (progress[bookType].review_mastered || 0) + 1,
                        review_due: Math.max(0, (progress[bookType].review_due || 0) - 1)
                    });
                }
            }
            
            return wordData;
        } catch (error) {
            console.error(`更新复习单词失败 (${userId}, ${bookType}, ${word}):`, error);
            return null;
        }
    }

    /**
     * 批量操作
     * @param {number|string} userId - 用户ID
     * @param {Array} operations - 操作列表
     * @returns {Array} 操作结果
     */
    batchOperations(userId, operations) {
        const results = [];
        
        operations.forEach((op, index) => {
            try {
                const { type, bookType, mode, data, word, isCorrect } = op;
                let success = false;
                let result = null;
                
                switch(type) {
                    case 'add_word':
                        success = this.addWordToStudy(userId, bookType, data);
                        break;
                        
                    case 'move_to_review':
                        success = this.moveToReview(userId, bookType, data);
                        break;
                        
                    case 'update_review':
                        result = this.updateReviewWord(userId, bookType, word, isCorrect);
                        success = !!result;
                        break;
                        
                    case 'get_data':
                        result = this.getLearningData(userId, bookType, mode);
                        success = true;
                        break;
                        
                    case 'save_data':
                        success = this.saveLearningData(userId, bookType, mode, data);
                        break;
                        
                    case 'update_config':
                        success = this.updateUserConfig(userId, data);
                        break;
                }
                
                results.push({
                    index,
                    type,
                    success,
                    result,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                results.push({
                    index: index,
                    type: op.type,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        return results;
    }

    /**
     * 备份用户数据
     * @param {number|string} userId - 用户ID
     * @returns {boolean} 是否成功
     */
    backupUserData(userId) {
        try {
            const userDir = path.join(this.usersBasePath, userId.toString());
            const backupDir = path.join(this.usersBasePath, `${userId}_backup_${Date.now()}`);
            
            if (!fs.existsSync(userDir)) {
                console.error(`用户目录不存在，无法备份: ${userDir}`);
                return false;
            }
            
            // 复制整个目录
            this.copyDirectory(userDir, backupDir);
            
            console.log(`用户数据备份成功: ${userId} -> ${backupDir}`);
            return true;
        } catch (error) {
            console.error(`备份用户数据失败 (${userId}):`, error);
            return false;
        }
    }

    /**
     * 复制目录
     * @param {string} source - 源目录
     * @param {string} target - 目标目录
     */
    copyDirectory(source, target) {
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target, { recursive: true });
        }
        
        const files = fs.readdirSync(source);
        
        files.forEach(file => {
            const sourcePath = path.join(source, file);
            const targetPath = path.join(target, file);
            
            if (fs.statSync(sourcePath).isDirectory()) {
                this.copyDirectory(sourcePath, targetPath);
            } else {
                fs.copyFileSync(sourcePath, targetPath);
            }
        });
    }

    /**
     * 获取所有用户ID列表
     * @returns {Array} 用户ID列表
     */
    getAllUserIds() {
        try {
            if (!fs.existsSync(this.usersBasePath)) {
                return [];
            }
            
            const items = fs.readdirSync(this.usersBasePath);
            const userIds = items.filter(item => {
                const itemPath = path.join(this.usersBasePath, item);
                return fs.statSync(itemPath).isDirectory() && /^\d+$/.test(item);
            }).map(id => parseInt(id));
            
            return userIds.sort((a, b) => a - b);
        } catch (error) {
            console.error('获取用户ID列表失败:', error);
            return [];
        }
    }

    /**
     * 验证书本类型
     * @param {string} bookType - 书本类型
     * @returns {boolean} 是否有效
     */
    isValidBookType(bookType) {
        return ['textbook', 'reading', 'pepa'].includes(bookType);
    }

    /**
     * 验证模式
     * @param {string} mode - 模式
     * @returns {boolean} 是否有效
     */
    isValidMode(mode) {
        return ['study', 'review'].includes(mode);
    }

    /**
     * 获取系统统计信息
     * @returns {Object} 系统统计
     */
    getSystemStats() {
        try {
            const userIds = this.getAllUserIds();
            const stats = {
                total_users: userIds.length,
                active_users: 0,
                total_study_words: 0,
                total_review_words: 0,
                users: []
            };
            
            userIds.forEach(userId => {
                const config = this.getUserConfig(userId);
                if (config) {
                    let userStudyWords = 0;
                    let userReviewWords = 0;
                    
                    // 统计用户单词数
                    ['textbook', 'reading', 'pepa'].forEach(bookType => {
                        const studyData = this.getLearningData(userId, bookType, 'study');
                        const reviewData = this.getLearningData(userId, bookType, 'review');
                        
                        userStudyWords += Array.isArray(studyData) ? studyData.length : 0;
                        userReviewWords += typeof reviewData === 'object' ? Object.keys(reviewData).length : 0;
                    });
                    
                    stats.total_study_words += userStudyWords;
                    stats.total_review_words += userReviewWords;
                    
                    // 检查是否活跃用户（最近7天有活动）
                    const lastUpdated = new Date(config.updated_at);
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    
                    if (lastUpdated > sevenDaysAgo) {
                        stats.active_users++;
                    }
                    
                    stats.users.push({
                        user_id: userId,
                        username: config.username,
                        study_words: userStudyWords,
                        review_words: userReviewWords,
                        last_active: config.updated_at
                    });
                }
            });
            
            return stats;
        } catch (error) {
            console.error('获取系统统计失败:', error);
            return {
                total_users: 0,
                active_users: 0,
                total_study_words: 0,
                total_review_words: 0,
                users: []
            };
        }
    }
}

// 导出单例实例
module.exports = new UserLearningManager();