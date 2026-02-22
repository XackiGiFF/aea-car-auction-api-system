const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

class Che168Parser {
    constructor() {
        this.apiBase = 'https://cacheapigo.che168.com/shop/v1/searchv2.ashx';
        this.pageBase = 'https://www.che168.com/dealer';
        this.dealerId = 625793;
        this.dealerType = 9;
        this.userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 YaBrowser/25.10.0.0 Safari/537.36';

        this.batchSize = 50;
        this.maxPages = 0;
        this.maxParallelRequests = 1;
        this.isRunning = false;
        this.downloadMedia = String(process.env.CHE_MEDIA_DOWNLOAD_ENABLED || 'false').toLowerCase() === 'true';
        this.mediaRoot = process.env.CHE_MEDIA_ROOT || '/app/media';
        this.mediaBaseUrl = (process.env.CHE_MEDIA_BASE_URL || '').replace(/\/+$/, '');
        this.mediaServiceUrl = (process.env.MEDIA_SERVICE_URL || '').replace(/\/+$/, '');
        this.mediaServiceToken = process.env.MEDIA_SERVICE_TOKEN || '';
        this.mediaServiceTimeoutMs = Number(process.env.MEDIA_SERVICE_TIMEOUT_MS || 25000);
        this.purgeDeletedEnabled = String(process.env.PURGE_DELETED_ENABLED || 'true').toLowerCase() === 'true';
        this.purgeDeletedAfterHours = Number(process.env.PURGE_DELETED_AFTER_HOURS || 48);
        this.purgeDeletedBatchSize = Number(process.env.PURGE_DELETED_BATCH_SIZE || 5000);
        this.puppeteerMaxAttempts = Math.max(1, Number(process.env.CHE_PUPPETEER_MAX_ATTEMPTS || 3));
        this.puppeteerRetryDelayMs = Math.max(1000, Number(process.env.CHE_PUPPETEER_RETRY_DELAY_MS || 5000));
        this.puppeteerRetryMaxDelayMs = Math.max(
            this.puppeteerRetryDelayMs,
            Number(process.env.CHE_PUPPETEER_RETRY_MAX_DELAY_MS || 30000)
        );
        this.puppeteerNavTimeoutMs = Math.max(30000, Number(process.env.CHE_PUPPETEER_NAV_TIMEOUT_MS || 60000));
        this.deepseekApiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
        this.deepseekApiKey = process.env.DEEPSEEK_API_KEY || '';
        const deepseekEnabledEnv = String(process.env.DEEPSEEK_ENABLED || '').trim().toLowerCase();
        this.deepseekEnabled = deepseekEnabledEnv ? deepseekEnabledEnv === 'true' : Boolean(this.deepseekApiKey);
        this.deepseekModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
        this.deepseekTimeoutMs = Math.max(3000, Number(process.env.DEEPSEEK_TIMEOUT_MS || 12000));
        this.deepseekMaxRetries = Math.max(1, Number(process.env.DEEPSEEK_MAX_RETRIES || 2));
        this.deepseekRetryDelayMs = Math.max(500, Number(process.env.DEEPSEEK_RETRY_DELAY_MS || 1500));
        this.deepseekTranslationCache = new Map();
        this.translationCacheFile = process.env.CHE_TRANSLATION_CACHE_FILE
            || path.join(__dirname, '..', 'data', 'che-translations.cache.json');
        this.translationFileCache = { brand: {}, model: {} };
        this.translationCacheLoaded = false;
        this.translationCacheLoadingPromise = null;
        this.translationCacheWritePromise = Promise.resolve();
        this.deepseekSystemPrompt = [
            'You are an automotive name translator.',
            'Translate exactly one car brand or model name into English.',
            'Output ONLY the translated name.',
            'No explanations, no extra words, no punctuation, no quotes.',
            'Use uppercase Latin letters.',
            'Preserve standard automotive formatting when known (e.g., XR-V, CX-5, X-TRAIL, QASHQAI).',
            'If input is already English, return normalized uppercase.',
            'If exact English equivalent is unknown, return pinyin transliteration in uppercase.'
        ].join(' ');

        // Словарь для перевода китайских марок на английские
        this.brandTranslations = {
            '丰田': 'TOYOTA',
            '本田': 'HONDA',
            '马自达': 'MAZDA',
            '奥迪': 'AUDI',
            '大众': 'VOLKSWAGEN',
            '宝马': 'BMW',
            '奔驰': 'MERCEDES',
            '斯柯达': 'SKODA',
            '日产': 'NISSAN',
            '现代': 'HYUNDAI',
            '起亚': 'KIA',
            '吉利汽车': 'GEELY',
            '哈弗': 'HAVAL',
            '奇瑞': 'CHERY',
            '斯巴鲁': 'SUBARU',
            '长安': 'CHANGAN',
            '比亚迪': 'BYD',
            '特斯拉': 'TESLA',
            '福特': 'FORD',
            '雪佛兰': 'CHEVROLET',
            '别克': 'BUICK',
            '雷克萨斯': 'LEXUS',
            '长安启源': 'CHANGAN QIYUAN',
            '领克': 'LYNK&CO'
        };

        // Fallback по slug из breadcrumbs (например /anshan/richan/xiaoke/)
        this.brandSlugTranslations = {
            'fengtian': 'TOYOTA',
            'bentian': 'HONDA',
            'mazida': 'MAZDA',
            'aodi': 'AUDI',
            'dazhong': 'VOLKSWAGEN',
            'baoma': 'BMW',
            'benchi': 'MERCEDES',
            'riben': 'NISSAN',
            'richan': 'NISSAN',
            'sikeda': 'SKODA',
            'hafu': 'HAVAL',
            'xiandai': 'HYUNDAI',
            'beijingxiandai': 'HYUNDAI',
            'qiya': 'KIA',
            'jili': 'GEELY',
            'jiliqiche': 'GEELY',
            'changan': 'CHANGAN',
            'changanqiyuan': 'CHANGAN QIYUAN',
            'qirui': 'CHERY',
            'sibalu': 'SUBARU',
            'fute': 'FORD',
            'xuefulan': 'CHEVROLET',
            'bieke': 'BUICK',
            'leikesasi': 'LEXUS',
            'tesila': 'TESLA',
            'biyadi': 'BYD'
        };

        // Словарь для перевода моделей
        this.modelTranslations = {
            'CX-30': 'CX-30',
            'CX-5': 'CX-5',
            'XR-V': 'XR-V',
            'A3': 'A3',
            '奥迪A3': 'A3',
            '奥迪Q2L': 'Q2L',
            '奥迪Q3': 'Q3',
            '宝马X1': 'X1',
            '宝马1系': '1 SERIES',
            '宝马3系': '3 SERIES',
            '本田XR-V': 'XR-V',
            'T-ROC探歌': 'T-ROC',
            '高尔夫': 'GOLF',
            '探影': 'TACQUA',
            '雷凌': 'LEVIN',
            '卡罗拉': 'COROLLA',
            'YARiS L 致炫': 'YARIS L',
            '雅阁': 'ACCORD',
            '思域': 'CIVIC',
            'CR-V': 'CR-V',
            '途观': 'TIGUAN',
            '途岳': 'THARU',
            '帕萨特': 'PASSAT',
            '朗逸': 'LAVIDA',
            '速腾': 'SAGITAR',
            '探歌': 'T-ROC',
            '昂克赛拉': 'AXELA',
            '马自达3 昂克赛拉': 'AXELA',
            '马自达CX-5': 'CX-5',
            '马自达CX-30': 'CX-30',
            '探岳': 'TAYRON',
            '森林人': 'FORESTER',
            '明锐': 'OCTAVIA',
            '柯米克': 'KAMIQ',
            '柯珞克': 'KAROQ',
            '雷克萨斯NX': 'NX',
            '哈弗M6': 'M6',
            '哈弗H6': 'H6',
            '缤智': 'VEZEL',
            '凌渡': 'LAMANDO',
            '缤越': 'COOLRAY',
            '奕跑': 'STONIC',
            '伊兰特': 'ELANTRA',
            '北京现代ix25': 'IX25',
            '起亚K3': 'K3',
            'KX3傲跑': 'KX3',
            '飞度': 'FIT',
            '逍客': 'QASHQAI',
            '奇骏': 'X-TRAIL',
            '轩逸': 'SYLPHY',
            '天籁': 'TEANA',
            '迈腾': 'MAGOTAN',
            '宝来': 'BORA',
            '雅力士': 'YARIS',
            '奔驰A级': 'A-CLASS',
            '瑞虎3x': 'TIGGO 3X',
            '长安CS35PLUS': 'CS35 PLUS',
            '长安启源A06': 'A06'
        };

        // Fallback для model slug из breadcrumbs
        this.modelSlugTranslations = {
            'aodia3': 'A3',
            'aodiq2l': 'Q2L',
            'aodiq3': 'Q3',
            'baoma1xi': '1 SERIES',
            'baoma3xi': '3 SERIES',
            'baomax1': 'X1',
            'bentianxrv': 'XR-V',
            'troctange': 'T-ROC',
            'leikesasinx': 'NX',
            'mazida3angkesaila': 'AXELA',
            'mazidacx5': 'CX-5',
            'mazidacx30': 'CX-30',
            'hafum6': 'M6',
            'hafuh6': 'H6',
            'xiaoke': 'QASHQAI',
            'qijun': 'X-TRAIL',
            'xuanyi': 'SYLPHY',
            'tianlai': 'TEANA',
            'leiling': 'LEVIN',
            'kaluola': 'COROLLA',
            'langyi': 'LAVIDA',
            'gaoerfu': 'GOLF',
            'tuyue': 'THARU',
            'yilante': 'ELANTRA',
            'ix25': 'IX25',
            'beijingxiandaiix25': 'IX25',
            'sagitar': 'SAGITAR',
            'lingdu': 'LAMANDO',
            'mingrui': 'OCTAVIA',
            'binzhi': 'VEZEL',
            'binyue': 'COOLRAY',
            'yipao': 'STONIC',
            'maiteng': 'MAGOTAN',
            'bora': 'BORA',
            'tuguan': 'TIGUAN',
            'tanyue': 'TAYRON',
            'tanying': 'TACQUA',
            'kemike': 'KAMIQ',
            'keluoke': 'KAROQ',
            'ruihu3x': 'TIGGO 3X',
            'changancs35plus': 'CS35 PLUS',
            'changanqiyuana06': 'A06',
            'qiyak3': 'K3',
            'kx3aopao': 'KX3',
            'feidu': 'FIT',
            'siyu': 'CIVIC',
            'yarislzhixuan': 'YARIS L',
            'yarisl': 'YARIS L',
            'civic': 'CIVIC',
            'accord': 'ACCORD',
            'camry': 'CAMRY',
            'cr-v': 'CR-V',
            'xrv': 'XR-V',
            'x1': 'X1',
            'q2l': 'Q2L',
            'q3': 'Q3',
            'cx5': 'CX-5',
            'cx30': 'CX-30',
            'cx-5': 'CX-5',
            'cx-30': 'CX-30',
            'vezel': 'VEZEL'
        };

        // Нормативный словарь: brand slug -> BRAND + вложенные model slugs.
        this.brandAndModels = this.buildBrandAndModelsConfig();
        this.brandSlugTranslations = {
            ...this.brandSlugTranslations,
            ...this.buildBrandMapFromBrandAndModels(this.brandAndModels)
        };
        this.modelSlugTranslations = {
            ...this.modelSlugTranslations,
            ...this.buildModelMapFromBrandAndModels(this.brandAndModels)
        };

        // Маппинг цветов
        this.colorTranslations = {
            '白色': 'white',
            '黑色': 'black',
            '银色': 'silver',
            '灰色': 'gray',
            '蓝色': 'blue',
            '红色': 'red',
            '棕色': 'brown',
            '金色': 'gold',
            '绿色': 'green',
            '黄色': 'yellow'
        };

        // Маппинг типов топлива [2]
        this.fuelTypes = [
            { code: 'H', name: 'Гибрид (H)', tks_type: 'petrol_electric' },
            { code: 'G', name: 'Бензин (G)', tks_type: 'petrol' },
            { code: 'D', name: 'Дизель (D)', tks_type: 'diesel' },
            { code: 'E', name: 'Электро (E)', tks_type: 'electric' },
            { code: 'L', name: 'Газ (L)', tks_type: 'petrol' },
            { code: 'P', name: 'Подзаряжаемый гибрид (P)', tks_type: 'petrol_electric' },
            { code: '&', name: 'Гибрид дизель-электрический (&)', tks_type: 'diesel_electric' },
            { code: 'C', name: 'Газ метан (C)', tks_type: 'petrol' },
            { code: '', name: 'Не указано', tks_type: 'petrol' }
        ];

        // Маппинг трансмиссий [2]
        this.transmissionMapping = {
            'AT': 'automatic',
            'MT': 'manual',
            'CVT': 'cvt',
            '自动': 'AT',
            '手动': 'MT',
            'CVT科技版': 'CVT',
            'DCT': 'automatic',
            'DSG': 'automatic',
            'PDK': 'automatic'
        };

        // Маппинг приводов [2]
        this.driveMapping = {
            'FF': 'FWD',
            'FWD': 'FWD',
            'FR': 'RWD',
            'RWD': 'RWD',
            'RR': 'RWD',
            '4WD': 'AWD',
            'AWD': 'AWD',
            'FULLTIME4WD': 'AWD',
            'PARTTIME4WD': 'PARTTIME_AWD',
            '前驱': 'FWD',
            '后驱': 'RWD',
            '四驱': 'AWD'
        };

        this.defaultImageBlacklist = [
            'default-che168.png',
            '/2scimg/m/'
        ];
    }

    // Логирование в консоль [2]
    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[CHE168][${timestamp}] ${message}`;
        console.log(logMessage);
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    isRetryablePuppeteerError(errorMessage) {
        const message = String(errorMessage || '');
        return /ERR_CONNECTION_CLOSED|ERR_CONNECTION_RESET|ERR_TIMED_OUT|ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED|Navigation timeout|Target closed|Protocol error|Security verification blocked|Insufficient parsed details|Execution context was destroyed/i.test(message);
    }

    getRetryDelayMs(attemptNumber) {
        const exponent = Math.max(0, Number(attemptNumber || 1) - 1);
        const delay = this.puppeteerRetryDelayMs * Math.pow(2, exponent);
        return Math.min(delay, this.puppeteerRetryMaxDelayMs);
    }

    hasSufficientParsedDetails(details = {}) {
        const signals = [
            'price',
            'mileage',
            'year',
            'engineVolume',
            'horsepower',
            'transmission',
            'drive',
            'fuelType',
            'batteryKwh'
        ];
        return signals.some((field) => details[field] !== undefined && details[field] !== null && details[field] !== '');
    }

    buildBrandAndModelsConfig() {
        return {
            aodi: {
                brand: 'AUDI',
                aliases: ['audi'],
                models: {
                    aodia3: 'A3',
                    aodiq2l: 'Q2L',
                    aodiq3: 'Q3'
                }
            },
            bentian: {
                brand: 'HONDA',
                aliases: ['honda'],
                models: {
                    bentianxrv: 'XR-V',
                    binzhi: 'VEZEL',
                    siyu: 'CIVIC',
                    feidu: 'FIT'
                }
            },
            mazida: {
                brand: 'MAZDA',
                aliases: ['mazda'],
                models: {
                    mazida3angkesaila: 'AXELA',
                    mazidacx5: 'CX-5',
                    mazidacx30: 'CX-30'
                }
            },
            dazhong: {
                brand: 'VOLKSWAGEN',
                aliases: ['volkswagen', 'vw'],
                models: {
                    troctange: 'T-ROC',
                    gaoerfu: 'GOLF',
                    tanying: 'TACQUA',
                    tanyue: 'TAYRON',
                    tuyue: 'THARU',
                    tuguan: 'TIGUAN',
                    lingdu: 'LAMANDO',
                    sagitar: 'SAGITAR',
                    bora: 'BORA',
                    langyi: 'LAVIDA',
                    maiteng: 'MAGOTAN'
                }
            },
            baoma: {
                brand: 'BMW',
                aliases: ['bmw'],
                models: {
                    baomax1: 'X1',
                    baoma1xi: '1 SERIES',
                    baoma3xi: '3 SERIES'
                }
            },
            sikeda: {
                brand: 'SKODA',
                aliases: ['skoda'],
                models: {
                    mingrui: 'OCTAVIA',
                    kemike: 'KAMIQ',
                    keluoke: 'KAROQ'
                }
            },
            richan: {
                brand: 'NISSAN',
                aliases: ['riben', 'nissan'],
                models: {
                    xiaoke: 'QASHQAI',
                    qijun: 'X-TRAIL',
                    xuanyi: 'SYLPHY',
                    tianlai: 'TEANA'
                }
            },
            fengtian: {
                brand: 'TOYOTA',
                aliases: ['toyota'],
                models: {
                    kaluola: 'COROLLA',
                    leiling: 'LEVIN',
                    yarisl: 'YARIS L',
                    yarislzhixuan: 'YARIS L'
                }
            },
            leikesasi: {
                brand: 'LEXUS',
                aliases: ['lexus'],
                models: {
                    leikesasinx: 'NX'
                }
            },
            xiandai: {
                brand: 'HYUNDAI',
                aliases: ['hyundai', 'beijingxiandai'],
                models: {
                    yilante: 'ELANTRA',
                    ix25: 'IX25',
                    beijingxiandaiix25: 'IX25'
                }
            },
            qiya: {
                brand: 'KIA',
                aliases: ['kia'],
                models: {
                    qiyak3: 'K3',
                    kx3aopao: 'KX3',
                    yipao: 'STONIC'
                }
            },
            hafu: {
                brand: 'HAVAL',
                aliases: ['haval'],
                models: {
                    hafum6: 'M6',
                    hafuh6: 'H6'
                }
            },
            jiliqiche: {
                brand: 'GEELY',
                aliases: ['jili', 'geely'],
                models: {
                    binyue: 'COOLRAY'
                }
            },
            changan: {
                brand: 'CHANGAN',
                aliases: ['changan'],
                models: {
                    changancs35plus: 'CS35 PLUS'
                }
            },
            changanqiyuan: {
                brand: 'CHANGAN QIYUAN',
                aliases: ['qiyuan'],
                models: {
                    changanqiyuana06: 'A06'
                }
            },
            qirui: {
                brand: 'CHERY',
                aliases: ['chery'],
                models: {
                    ruihu3x: 'TIGGO 3X'
                }
            },
            sibalu: {
                brand: 'SUBARU',
                aliases: ['subaru'],
                models: {}
            },
            benchi: {
                brand: 'MERCEDES',
                aliases: ['benz', 'mercedes'],
                models: {}
            }
        };
    }

    buildBrandMapFromBrandAndModels(config = {}) {
        const map = {};
        for (const [brandSlug, brandConfig] of Object.entries(config || {})) {
            const brand = String(brandConfig?.brand || '').trim().toUpperCase();
            if (!brand) continue;

            map[String(brandSlug).toLowerCase()] = brand;
            const aliases = Array.isArray(brandConfig.aliases) ? brandConfig.aliases : [];
            for (const alias of aliases) {
                const normalizedAlias = String(alias || '').trim().toLowerCase();
                if (normalizedAlias) {
                    map[normalizedAlias] = brand;
                }
            }
        }
        return map;
    }

    buildModelMapFromBrandAndModels(config = {}) {
        const map = {};
        for (const brandConfig of Object.values(config || {})) {
            const models = brandConfig?.models || {};
            for (const [modelSlug, modelName] of Object.entries(models)) {
                const slug = String(modelSlug || '').trim().toLowerCase();
                const name = String(modelName || '').trim().toUpperCase();
                if (slug && name) {
                    map[slug] = name;
                }
            }
        }
        return map;
    }

    shouldUseDeepSeek() {
        return Boolean(this.deepseekEnabled && this.deepseekApiKey);
    }

    normalizeTranslationKind(kind) {
        return kind === 'brand' ? 'brand' : 'model';
    }

    normalizeTranslationCacheKey(value) {
        return String(value || '')
            .replace(/[\u00A0\s]+/g, ' ')
            .trim()
            .toUpperCase();
    }

    async ensureTranslationCacheLoaded() {
        if (this.translationCacheLoaded) {
            return;
        }
        if (this.translationCacheLoadingPromise) {
            await this.translationCacheLoadingPromise;
            return;
        }

        this.translationCacheLoadingPromise = (async () => {
            try {
                const raw = await fs.readFile(this.translationCacheFile, 'utf8');
                const parsed = JSON.parse(raw || '{}');
                this.translationFileCache = {
                    brand: parsed?.brand && typeof parsed.brand === 'object' ? parsed.brand : {},
                    model: parsed?.model && typeof parsed.model === 'object' ? parsed.model : {}
                };
                this.log('Loaded translation cache file', {
                    file: this.translationCacheFile,
                    brand_entries: Object.keys(this.translationFileCache.brand).length,
                    model_entries: Object.keys(this.translationFileCache.model).length
                });
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    this.log(`Failed to load translation cache file: ${error.message}`);
                }
            } finally {
                this.translationCacheLoaded = true;
                this.translationCacheLoadingPromise = null;
            }
        })();

        await this.translationCacheLoadingPromise;
    }

    getTranslationFromCache(kind, sourceText) {
        const normalizedKind = this.normalizeTranslationKind(kind);
        const key = this.normalizeTranslationCacheKey(sourceText);
        if (!key) return '';

        const runtimeKey = `${normalizedKind}::${key}`;
        if (this.deepseekTranslationCache.has(runtimeKey)) {
            return this.deepseekTranslationCache.get(runtimeKey);
        }

        const fromFile = this.translationFileCache?.[normalizedKind]?.[key] || '';
        if (fromFile) {
            this.deepseekTranslationCache.set(runtimeKey, fromFile);
            return fromFile;
        }

        return '';
    }

    async saveTranslationToCache(kind, sourceText, translatedText) {
        const normalizedKind = this.normalizeTranslationKind(kind);
        const key = this.normalizeTranslationCacheKey(sourceText);
        if (!key) return;

        const translated = this.normalizeDeepSeekOutput(translatedText, { kind: normalizedKind });
        if (!translated) return;

        const runtimeKey = `${normalizedKind}::${key}`;
        this.deepseekTranslationCache.set(runtimeKey, translated);

        if (this.translationFileCache[normalizedKind][key] === translated) {
            return;
        }

        this.translationFileCache[normalizedKind][key] = translated;
        await this.persistTranslationCacheToFile();
    }

    async persistTranslationCacheToFile() {
        const payload = JSON.stringify({
            version: 1,
            updated_at: new Date().toISOString(),
            brand: this.translationFileCache.brand || {},
            model: this.translationFileCache.model || {}
        }, null, 2);

        const filePath = this.translationCacheFile;
        const tmpPath = `${filePath}.tmp`;

        this.translationCacheWritePromise = this.translationCacheWritePromise.then(async () => {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(tmpPath, payload, 'utf8');
            await fs.rename(tmpPath, filePath);
        }).catch((error) => {
            this.log(`Failed to persist translation cache: ${error.message}`);
        });

        await this.translationCacheWritePromise;
    }

    normalizeDeepSeekOutput(value, options = {}) {
        const lines = String(value || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        if (lines.length === 0) return '';

        let text = lines[0];
        text = text
            .replace(/^translation\s*[:：-]\s*/i, '')
            .replace(/^brand\s*[:：-]\s*/i, '')
            .replace(/^model\s*[:：-]\s*/i, '')
            .replace(/^['"`]+|['"`]+$/g, '')
            .trim();

        if (!text) return '';

        const fragments = text.match(/[A-Za-z0-9][A-Za-z0-9&+\-/ ]{1,60}/g);
        if (fragments && fragments.length > 0) {
            text = fragments[fragments.length - 1].trim();
        }

        text = text.toUpperCase().replace(/\s+/g, ' ').trim();

        if (options.kind === 'model' && options.brandHint) {
            const brandHint = String(options.brandHint)
                .toUpperCase()
                .replace(/[^A-Z0-9&+\-/ ]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (brandHint && text.startsWith(`${brandHint} `)) {
                text = text.slice(brandHint.length).trim();
            }
        }

        if (!text || text.length > 40) return '';
        if (/[^A-Z0-9&+\-/ ]/.test(text)) return '';
        if (!/[A-Z]/.test(text)) return '';

        return text;
    }

    buildDeepSeekUserPrompt(sourceText, options = {}) {
        const kind = options.kind === 'brand' ? 'brand' : 'model';
        const lines = [`Input ${kind} name: ${String(sourceText || '').trim()}`];
        if (kind === 'model' && options.brandHint) {
            lines.push(`Brand hint: ${String(options.brandHint).trim()}`);
        }
        return lines.join('\n');
    }

    async translateNameWithDeepSeek(sourceText, options = {}) {
        const input = String(sourceText || '').trim();
        if (!input) return '';
        const kind = this.normalizeTranslationKind(options.kind);

        await this.ensureTranslationCacheLoaded();

        const fromCache = this.getTranslationFromCache(kind, input);
        if (fromCache) {
            return fromCache;
        }
        if (!this.shouldUseDeepSeek()) return '';

        const cacheKey = `${kind}::${this.normalizeTranslationCacheKey(input)}`;
        if (this.deepseekTranslationCache.has(cacheKey)) {
            return this.deepseekTranslationCache.get(cacheKey);
        }

        const payload = {
            model: this.deepseekModel,
            temperature: 0,
            messages: [
                { role: 'system', content: this.deepseekSystemPrompt },
                { role: 'user', content: this.buildDeepSeekUserPrompt(input, options) }
            ]
        };

        for (let attempt = 1; attempt <= this.deepseekMaxRetries; attempt++) {
            try {
                const response = await axios.post(this.deepseekApiUrl, payload, {
                    timeout: this.deepseekTimeoutMs,
                    headers: {
                        Authorization: `Bearer ${this.deepseekApiKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                const raw = response?.data?.choices?.[0]?.message?.content || '';
                const translated = this.normalizeDeepSeekOutput(raw, { ...options, kind });
                if (translated) {
                    await this.saveTranslationToCache(kind, input, translated);
                    return translated;
                }
            } catch (error) {
                this.log(`DeepSeek translation error (attempt ${attempt}/${this.deepseekMaxRetries})`, {
                    kind,
                    source: input,
                    error: error.message
                });
            }

            if (attempt < this.deepseekMaxRetries) {
                await this.sleep(this.deepseekRetryDelayMs);
            }
        }

        this.deepseekTranslationCache.set(cacheKey, '');
        return '';
    }

    // Генерация ID автомобиля [2]
    generateCarId(apiCar, brand, model, year, mileage, price) {
        if (apiCar && apiCar.carid) {
            const normalized = String(apiCar.carid).replace(/[^a-zA-Z0-9]/g, '');
            if (normalized.length > 0) {
                return normalized;
            }
        }
        const base = `${brand}_${model}_${year}_${mileage}_${price}`;
        const hash = crypto.createHash('md5').update(base).digest('hex');
        return `${hash.substring(0, 12)}`;
    }

    generateStableExternalId(apiCar) {
        const normalized = String(apiCar?.carid || '').replace(/[^a-zA-Z0-9]/g, '');
        return normalized || null;
    }

    containsNonAscii(value) {
        return /[^\x20-\x7E]/.test(value || '');
    }

    slugify(value) {
        return (value || '')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'unknown';
    }

    escapeRegex(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    normalizeChineseVehicleName(value) {
        return String(value || '')
            .replace(/^二手/u, '')
            .replace(/\s*(20\d{2}|19\d{2})款[\s\S]*$/u, '')
            .replace(/\s*(20\d{2}|19\d{2})[\s\S]*$/u, '')
            .replace(/[【】[\]()（）]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    formatModelSlugToken(token) {
        const cleaned = String(token || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (!cleaned) return '';

        const normalized = cleaned.replace(/-/g, '');
        const compactMap = {
            xrv: 'XR-V',
            crv: 'CR-V',
            cx5: 'CX-5',
            cx30: 'CX-30',
            q2l: 'Q2L',
            q3: 'Q3',
            x1: 'X1',
            xtrail: 'X-TRAIL',
            kx3: 'KX3',
            ix25: 'IX25'
        };

        if (compactMap[normalized]) {
            return compactMap[normalized];
        }

        if (/^[a-z]\d{1,3}[a-z0-9]*$/i.test(normalized)) {
            return normalized.toUpperCase();
        }

        if (/^\d+[a-z]+$/i.test(normalized)) {
            return normalized.toUpperCase();
        }

        if (/^[a-z0-9-]{2,30}$/i.test(cleaned)) {
            return cleaned.replace(/-/g, ' ').toUpperCase();
        }

        return '';
    }

    stripBrandPrefixFromModelSlug(slug) {
        const normalized = String(slug || '').trim().toLowerCase();
        if (!normalized) return '';

        const brandSlugs = Object.keys(this.brandSlugTranslations).sort((a, b) => b.length - a.length);
        for (const brandSlug of brandSlugs) {
            if (!normalized.startsWith(brandSlug) || normalized.length <= brandSlug.length) {
                continue;
            }
            const remainder = normalized.slice(brandSlug.length).replace(/^-+/, '');
            if (remainder && this.isLatinSlugSegment(remainder)) {
                return remainder;
            }
        }

        return '';
    }

    modelFromSlug(slug) {
        const normalized = String(slug || '').trim().toLowerCase();
        if (!normalized) return '';
        if (this.modelSlugTranslations[normalized]) {
            return this.modelSlugTranslations[normalized];
        }

        const stripped = this.stripBrandPrefixFromModelSlug(normalized);
        if (stripped) {
            if (this.modelSlugTranslations[stripped]) {
                return this.modelSlugTranslations[stripped];
            }
            const fromStrippedToken = this.formatModelSlugToken(stripped);
            if (fromStrippedToken) {
                return fromStrippedToken;
            }
        }

        const fromToken = this.formatModelSlugToken(normalized);
        if (fromToken) {
            return fromToken;
        }

        if (/^[a-z0-9-]{2,30}$/.test(normalized)) {
            return normalized.replace(/-/g, ' ').toUpperCase();
        }
        return '';
    }

    brandFromSlug(slug) {
        const normalized = String(slug || '').trim().toLowerCase();
        if (!normalized) return '';
        if (this.brandSlugTranslations[normalized]) {
            return this.brandSlugTranslations[normalized];
        }
        if (/^[a-z0-9-]{2,30}$/.test(normalized)) {
            return normalized.replace(/-/g, ' ').toUpperCase();
        }
        return '';
    }

    isLatinSlugSegment(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (!normalized) return false;
        if (!/^[a-z0-9-]{2,40}$/i.test(normalized)) return false;
        const reserved = new Set(['list', 'dealer', 'usedcar', 'ershouche']);
        return !reserved.has(normalized);
    }

    extractBreadcrumbData($) {
        const crumbs = [];
        $('.bread-crumbs.content a').each((_, element) => {
            const text = $(element).text().replace(/\s+/g, ' ').trim();
            const href = ($(element).attr('href') || '').trim();
            if (!text) return;
            crumbs.push({ text, href });
        });

        if (crumbs.length === 0) {
            return {};
        }

        let brandCn = '';
        let modelCn = '';
        let modelSpecCn = '';
        let brandSlug = '';
        let modelSlug = '';
        const ignoredUsedNames = new Set(['车之家', '二手车之家', '二手车']);

        // Обычно в крошках присутствуют "二手{бренд}" и "二手{модель}".
        for (const crumb of crumbs) {
            const path = crumb.href.replace(/^https?:\/\/[^/]+/i, '');
            const pathNoHash = path.split('#')[0].split('?')[0];
            const segments = pathNoHash.split('/').map(v => v.trim()).filter(Boolean);
            const brandPathSlug = segments.length >= 2 && this.isLatinSlugSegment(segments[1]) ? segments[1].toLowerCase() : '';
            const modelPathSlug = segments.length >= 3 && this.isLatinSlugSegment(segments[2]) ? segments[2].toLowerCase() : '';

            const m = crumb.text.match(/^二手(.+)$/u);
            if (m) {
                const name = this.normalizeChineseVehicleName(m[1]);
                if (name && !ignoredUsedNames.has(name)) {
                    if (!brandCn && brandPathSlug) {
                        brandCn = name;
                    } else if (!modelCn && modelPathSlug) {
                        modelCn = name;
                    }
                }
            }

            // типовой формат: /anshan/richan/xiaoke/s53438/
            if (!brandSlug && brandPathSlug) {
                brandSlug = brandPathSlug;
            }
            if (!modelSlug && modelPathSlug) {
                modelSlug = modelPathSlug;
            }
        }

        const lastCrumb = crumbs[crumbs.length - 1];
        if (lastCrumb && lastCrumb.text) {
            modelSpecCn = this.normalizeChineseVehicleName(lastCrumb.text);
        }

        return {
            brand_cn: brandCn || '',
            model_cn: modelCn || '',
            model_spec_cn: modelSpecCn || '',
            brand_slug: brandSlug || '',
            model_slug: modelSlug || ''
        };
    }

    normalizeBrand(apiCar, puppeteerDetails = {}) {
        const brandRaw = (apiCar.BrandName || '').trim();
        const breadcrumbBrand = (puppeteerDetails.brand_cn || '').trim();
        const candidates = [breadcrumbBrand, brandRaw].filter(Boolean);

        for (const candidate of candidates) {
            if (this.brandTranslations[candidate]) {
                return this.brandTranslations[candidate];
            }
            const fromCache = this.getTranslationFromCache('brand', candidate);
            if (fromCache) {
                return fromCache;
            }
            if (!this.containsNonAscii(candidate)) {
                return candidate.toUpperCase();
            }
        }

        const fromSlug = this.brandFromSlug(puppeteerDetails.brand_slug || '');
        if (fromSlug) {
            return fromSlug;
        }

        return apiCar.Brandid ? `BRAND_${apiCar.Brandid}` : 'UNKNOWN';
    }

    normalizeModel(apiCar, normalizedBrand, puppeteerDetails = {}) {
        const seriesName = (apiCar.SeriesName || '').trim();
        const carName = (apiCar.carname || '').trim();
        const specName = (apiCar.SpecName || '').trim();
        const breadcrumbModel = (puppeteerDetails.model_cn || '').trim();
        const breadcrumbSpec = (puppeteerDetails.model_spec_cn || '').trim();

        const candidates = [
            breadcrumbModel,
            breadcrumbSpec,
            seriesName,
            carName,
            specName
        ].filter(Boolean);

        for (const raw of candidates) {
            for (const [cn, en] of Object.entries(this.modelTranslations)) {
                if (raw.includes(cn)) {
                    return en.toUpperCase();
                }
            }
            const fromCache = this.getTranslationFromCache('model', raw);
            if (fromCache) {
                return fromCache;
            }
        }

        const fromSlug = this.modelFromSlug(puppeteerDetails.model_slug || '');
        if (fromSlug) {
            return fromSlug;
        }

        const raw = candidates[0] || '';
        if (!raw) {
            return apiCar.Seriesid ? `SERIES_${apiCar.Seriesid}` : 'MODEL_UNKNOWN';
        }

        let cleaned = this.normalizeChineseVehicleName(raw);

        if (normalizedBrand) {
            cleaned = cleaned.replace(new RegExp(`^${this.escapeRegex(normalizedBrand)}\\s*`, 'i'), '');
        }
        const brandRawCn = (apiCar.BrandName || '').trim();
        if (brandRawCn) {
            cleaned = cleaned.replace(new RegExp(`^${this.escapeRegex(brandRawCn)}\\s*`, 'u'), '');
        }

        const fromCleanedCache = this.getTranslationFromCache('model', cleaned);
        if (fromCleanedCache) {
            return fromCleanedCache;
        }

        const modelCodeMatch = cleaned.match(/[A-Za-z][A-Za-z0-9\-+]{0,20}/g);
        if (modelCodeMatch && modelCodeMatch.length > 0) {
            return modelCodeMatch[0].toUpperCase();
        }

        if (!this.containsNonAscii(cleaned)) {
            return cleaned.toUpperCase() || (apiCar.Seriesid ? `SERIES_${apiCar.Seriesid}` : 'MODEL_UNKNOWN');
        }

        return apiCar.Seriesid ? `SERIES_${apiCar.Seriesid}` : 'MODEL_UNKNOWN';
    }

    inferTransmission(apiCar, puppeteerDetails) {
        const text = `${apiCar.carname || ''} ${apiCar.SpecName || ''}`.toUpperCase();

        if (puppeteerDetails.transmission) {
            return puppeteerDetails.transmission;
        }
        if (text.includes('CVT')) return 'CVT';
        if (text.includes('MT') || /手动/u.test(apiCar.carname || '') || /手动/u.test(apiCar.SpecName || '')) return 'MT';
        if (text.includes('DCT') || text.includes('DSG') || text.includes('PDK')) return 'AT';
        if (text.includes('AT') || /自动/u.test(apiCar.carname || '') || /自动/u.test(apiCar.SpecName || '')) return 'AT';
        return 'AT';
    }

    inferFuelType(apiCar, puppeteerDetails) {
        const text = `${apiCar.carname || ''} ${apiCar.SpecName || ''}`.toUpperCase();
        const textCn = `${apiCar.carname || ''} ${apiCar.SpecName || ''}`;

        if (puppeteerDetails.fuelType) {
            return puppeteerDetails.fuelType;
        }
        if (/柴油/u.test(textCn) || /\bTDI\b/.test(text)) return 'D';
        if (/插电|增程/u.test(textCn) || /\bPHEV\b/.test(text)) return 'P';
        if (/混动|双擎|混合动力/u.test(textCn) || /\bHEV\b|\bHYBRID\b/.test(text)) return 'H';
        if (/纯电|电动/u.test(textCn) || /\bEV\b/.test(text)) return 'E';
        return 'G';
    }

    inferDrive(apiCar, puppeteerDetails) {
        const text = `${apiCar.carname || ''} ${apiCar.SpecName || ''}`.toUpperCase();
        const textCn = `${apiCar.carname || ''} ${apiCar.SpecName || ''}`;

        if (puppeteerDetails.drive) {
            return puppeteerDetails.drive;
        }
        if (/四驱/u.test(textCn) || /\b4WD\b|\bAWD\b|\bXDRIVE\b|\bQUATTRO\b/.test(text)) return '4WD';
        if (/后驱/u.test(textCn) || /\bRWD\b|\bFR\b/.test(text)) return 'FR';
        if (/前驱|两驱/u.test(textCn) || /\bFWD\b|\bFF\b/.test(text)) return 'FF';
        return 'FF';
    }

    extractEngineCc(apiCar, puppeteerDetails) {
        if (puppeteerDetails.engineVolume) {
            return String(puppeteerDetails.engineVolume);
        }
        if (puppeteerDetails.fuelType === 'E') {
            return '';
        }
        const text = `${apiCar.carname || ''} ${apiCar.SpecName || ''} ${apiCar.power || ''}`;
        const cc = this.extractEngineVolumeCcFromText(text);
        if (Number.isFinite(cc)) {
            return String(cc);
        }
        return '';
    }

    normalizeLabelText(value) {
        return String(value || '')
            .replace(/[\u00A0\s]+/g, '')
            .trim();
    }

    normalizeMetricValueText(value) {
        return String(value || '')
            .replace(/[，,]/g, '')
            .replace(/\u3000/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    normalizeHorsepowerValue(value) {
        const hp = Math.round(Number(value));
        if (!Number.isFinite(hp) || hp < 20 || hp > 2500) {
            return null;
        }
        return hp;
    }

    extractHorsepowerFromText(value) {
        const normalized = this.normalizeMetricValueText(value);
        if (!normalized) return null;

        const directHpPatterns = [
            /(\d{2,4}(?:\.\d+)?)\s*(?:马力|匹)(?=[^A-Za-z0-9]|$)/u,
            /(\d{2,4}(?:\.\d+)?)\s*P[Ss](?=[^A-Za-z0-9]|$)/u
        ];

        for (const pattern of directHpPatterns) {
            const match = normalized.match(pattern);
            if (!match) continue;
            const hp = this.normalizeHorsepowerValue(match[1]);
            if (Number.isFinite(hp)) return hp;
        }

        const kwMatch = normalized.match(/(\d{2,4}(?:\.\d+)?)\s*(?:kW(?!h)|KW(?!h)|千瓦)(?=[^A-Za-z0-9]|$)/u);
        if (kwMatch) {
            const kw = Number(kwMatch[1]);
            if (Number.isFinite(kw) && kw >= 15 && kw <= 1800) {
                const hp = this.normalizeHorsepowerValue(kw * 1.35962);
                if (Number.isFinite(hp)) return hp;
            }
        }

        return null;
    }

    extractEngineVolumeCcFromText(value) {
        const normalized = this.normalizeMetricValueText(value);
        if (!normalized) return null;

        const ccPatterns = [
            /(\d{3,5})\s*(?:mL|ML|ml|毫升|cc|CC|cm3|CM3)(?=[^A-Za-z0-9]|$)/u,
            /排量[^0-9]{0,8}(\d{3,5})(?!\d)/u
        ];

        for (const pattern of ccPatterns) {
            const match = normalized.match(pattern);
            if (!match) continue;
            const cc = Math.round(Number(match[1]));
            if (Number.isFinite(cc) && cc >= 600 && cc <= 8500) {
                return cc;
            }
        }

        const literPatterns = [
            /排量[^0-9]{0,8}(\d+(?:\.\d+)?)\s*(?:L|升|T)(?=[^A-Za-z0-9]|$)/iu,
            /挡位\s*\/\s*排量[^0-9]{0,16}(?:自动|手动|CVT|AT|MT)?\s*\/\s*(\d+(?:\.\d+)?)\s*(?:L|升|T)(?=[^A-Za-z0-9]|$)/iu,
            /发动机[^0-9]{0,8}(\d+(?:\.\d+)?)\s*(?:L|升|T)(?=[^A-Za-z0-9]|$)/iu,
            /(\d+(?:\.\d+)?)\s*(?:L|升|T)(?=[^A-Za-z0-9]|$)/iu
        ];

        for (const pattern of literPatterns) {
            const match = normalized.match(pattern);
            if (!match) continue;
            const liters = Number(match[1]);
            if (!Number.isFinite(liters) || liters < 0.6 || liters > 8.5) continue;
            return Math.round(liters * 1000);
        }

        return null;
    }

    extractMileageKmFromText(value) {
        const normalized = this.normalizeMetricValueText(value);
        if (!normalized) return null;

        const wanMatch = normalized.match(/(\d+(?:\.\d+)?)\s*万(?:公里|千米|km)?/iu);
        if (wanMatch) {
            const mileage = Number(wanMatch[1]) * 10000;
            return Number.isFinite(mileage) ? Math.round(mileage) : null;
        }

        const kmMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:公里|千米|km)(?=[^A-Za-z0-9]|$)/iu);
        if (kmMatch) {
            const mileage = Number(kmMatch[1]);
            return Number.isFinite(mileage) ? Math.round(mileage) : null;
        }

        const plainMatch = normalized.match(/^(\d+(?:\.\d+)?)$/u);
        if (plainMatch) {
            const numeric = Number(plainMatch[1]);
            if (!Number.isFinite(numeric) || numeric < 0) return null;
            if (numeric <= 20) return Math.round(numeric * 10000);
            return Math.round(numeric);
        }

        return null;
    }

    extractHorsepowerFromApi(apiCar) {
        const source = `${apiCar?.carname || ''} ${apiCar?.SpecName || ''} ${apiCar?.power || ''}`;
        return this.extractHorsepowerFromText(source);
    }

    extractMileageKmFromApi(apiCar) {
        const raw = apiCar?.mileage;
        if (raw === undefined || raw === null || raw === '') {
            return '';
        }

        const text = String(raw).trim();
        if (!text) return '';

        const byText = this.extractMileageKmFromText(text);
        if (Number.isFinite(byText)) {
            return byText;
        }

        const numeric = parseFloat(text.replace(/,/g, ''));
        if (!Number.isFinite(numeric) || numeric < 0) {
            return '';
        }

        if (text.includes('.')) {
            return Math.round(numeric * 10000);
        }

        if (numeric <= 20) {
            return Math.round(numeric * 10000);
        }

        return Math.round(numeric);
    }

    extractYearFromText(value) {
        const match = String(value || '').match(/(20\d{2}|19\d{2})年/u);
        if (!match) return null;
        const year = parseInt(match[1], 10);
        return Number.isFinite(year) ? year : null;
    }

    parseStructuredFields($) {
        const fields = [];

        $('ul.brand-unit-item.fn-clear li').each((_, liElement) => {
            const label = this.normalizeLabelText($(liElement).find('p').text());
            const value = $(liElement).find('h4').text().replace(/\s+/g, ' ').trim();
            if (label && value) {
                fields.push({ label, value });
            }
        });

        $('ul.basic-item-ul li').each((_, liElement) => {
            const labelRaw = $(liElement).find('span.item-name').first().text();
            const label = this.normalizeLabelText(labelRaw);
            if (!label) return;

            const valueNode = $(liElement).clone();
            valueNode.find('span.item-name').remove();
            const value = valueNode.text().replace(/\s+/g, ' ').trim();
            if (!value || value === '-') return;

            fields.push({ label, value });
        });

        return fields;
    }

    normalizeImageList(rawImages) {
        const list = (rawImages || '')
            .split('#')
            .map((u) => (u || '').trim())
            .filter(Boolean)
            .filter((u) => /^https?:\/\//i.test(u))
            .filter((u) => !this.defaultImageBlacklist.some((bad) => u.includes(bad)));

        return [...new Set(list)];
    }

    async localizeImages(imageUrls, brand, model, carId) {
        if (this.mediaServiceUrl && this.mediaServiceToken) {
            const result = [];
            for (let i = 0; i < imageUrls.length; i++) {
                const localized = await this.localizeImageByService({
                    imageUrl: imageUrls[i],
                    provider: 'che168',
                    brand,
                    model,
                    carId,
                    imageIndex: i + 1
                });
                if (localized) {
                    result.push(localized);
                }
            }

            if (result.length > 0) {
                return result;
            }

            if (!this.downloadMedia || !this.mediaBaseUrl) {
                this.log('Media service configured, but no images localized. Skipping donor URLs.');
                return [];
            }
        }

        if (!this.downloadMedia || !this.mediaBaseUrl) {
            return imageUrls;
        }

        const brandSlug = this.slugify(brand);
        const modelSlug = this.slugify(model);
        const baseDir = path.join(this.mediaRoot, 'che168', brandSlug, modelSlug, String(carId));
        await fs.mkdir(baseDir, { recursive: true });

        const result = [];
        for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            try {
                const response = await axios.get(url, {
                    timeout: 20000,
                    responseType: 'arraybuffer',
                    headers: {
                        'User-Agent': this.userAgent,
                        'Referer': 'https://www.che168.com/'
                    }
                });

                const contentType = (response.headers['content-type'] || '').toLowerCase();
                let ext = '.jpg';
                if (contentType.includes('webp') || url.includes('.webp')) ext = '.webp';
                else if (contentType.includes('png') || url.includes('.png')) ext = '.png';
                else if (contentType.includes('jpeg') || url.includes('.jpeg')) ext = '.jpeg';

                const fileName = `${String(i + 1).padStart(2, '0')}${ext}`;
                const filePath = path.join(baseDir, fileName);
                await fs.writeFile(filePath, response.data);
                result.push(`${this.mediaBaseUrl}/che168/${brandSlug}/${modelSlug}/${carId}/${fileName}`);
            } catch (error) {
                this.log(`Image localization failed for ${url}: ${error.message}`);
            }
        }

        return result.length > 0 ? result : imageUrls;
    }

    async localizeImageByService({ imageUrl, provider, brand, model, carId, imageIndex }) {
        try {
            const response = await axios.post(
                `${this.mediaServiceUrl}/internal/media/fetch`,
                {
                    source_url: imageUrl,
                    provider,
                    brand,
                    model,
                    car_id: String(carId),
                    image_index: imageIndex
                },
                {
                    timeout: this.mediaServiceTimeoutMs,
                    headers: {
                        'x-media-token': this.mediaServiceToken
                    }
                }
            );

            if (response.data?.ok && response.data?.url) {
                return response.data.url;
            }
            return null;
        } catch (error) {
            this.log(`Image service failed for ${imageUrl}: ${error.message}`);
            return null;
        }
    }

    async syncDeletedCars(currentExternalIds) {
        try {
            const CarModel = require('../models/CarModel');
            const localIds = await CarModel.getLocalIds('che_available');
            const currentSet = new Set((currentExternalIds || []).filter(Boolean));
            const staleIds = localIds.filter((id) => !currentSet.has(String(id)));

            if (staleIds.length === 0) {
                this.log('No stale che168 cars to mark as deleted');
                return;
            }

            this.log(`Marking stale che168 cars as deleted: ${staleIds.length}`);
            await CarModel.markIdsDeleted('che_available', staleIds);
        } catch (error) {
            this.log(`Failed to sync deleted cars: ${error.message}`);
        }
    }

    async purgeDeletedCarsAndMedia() {
        if (!this.purgeDeletedEnabled) {
            return;
        }

        try {
            const CarModel = require('../models/CarModel');
            const staleIds = await CarModel.getDeletedIdsForCleanup(
                'che_available',
                this.purgeDeletedAfterHours,
                this.purgeDeletedBatchSize
            );

            if (staleIds.length === 0) {
                this.log('No deleted che168 cars ready for purge');
                return;
            }

            this.log(`Purging deleted che168 cars: ${staleIds.length}`);
            await this.deleteMediaByCarIds(staleIds);

            const deletedRows = await CarModel.cleanupDeleted('che_available', this.purgeDeletedAfterHours);
            this.log(`Deleted old che168 rows from DB: ${deletedRows}`);
        } catch (error) {
            this.log(`Failed to purge deleted che168 cars: ${error.message}`);
        }
    }

    async deleteMediaByCarIds(carIds = []) {
        if (!Array.isArray(carIds) || carIds.length === 0) {
            return;
        }

        if (!this.mediaServiceUrl || !this.mediaServiceToken) {
            this.log('Media service is not configured, skipping media prune');
            return;
        }

        try {
            const response = await axios.post(
                `${this.mediaServiceUrl}/internal/media/delete-by-car-ids`,
                {
                    provider: 'che168',
                    car_ids: carIds
                },
                {
                    timeout: this.mediaServiceTimeoutMs,
                    headers: {
                        'x-media-token': this.mediaServiceToken
                    }
                }
            );

            this.log('Media prune completed', response.data || null);
        } catch (error) {
            this.log(`Media prune request failed: ${error.message}`);
        }
    }

    // Получение списка автомобилей с API [2]
    async fetchPage(pageIndex, pageSize = 6) {
        const params = {
            _appid: '2scapp.ios',
            dealerid: this.dealerId,
            dealertype: this.dealerType,
            pageindex: pageIndex,
            pagesize: pageSize,
            _callback: 'jsonp5'
        };

        try {
            this.log(`Fetching page ${pageIndex}...`);
            const response = await axios.get(this.apiBase, {
                params,
                timeout: 20000,
                headers: {
                    'User-Agent': this.userAgent
                }
            });

            // Обработка JSONP ответа [2]
            const jsonpData = response.data;
            const jsonStr = jsonpData.replace(/^jsonp5\(/, '').replace(/\)$/, '');
            const data = JSON.parse(jsonStr);

            this.log(`Page ${pageIndex} fetched: ${data.result?.carlist?.length || 0} cars`);
            return data;
        } catch (error) {
            this.log(`Error fetching page ${pageIndex}:`, error.message);
            throw error;
        }
    }

    // Парсинг детальной страницы через Puppeteer
    async parseCarDetailsWithPuppeteer(carId) {
        let browser = null;
        try {
            this.log(`Starting Puppeteer for car ${carId}`);

            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--window-size=1920,1080'
                ]
            });

            const page = await browser.newPage();

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            await page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': 'https://www.che168.com/',
                'Upgrade-Insecure-Requests': '1'
            });

            const url = `${this.pageBase}/${this.dealerId}/${carId}.html?offertype=110`;
            this.log(`Navigating to: ${url}`);

            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: this.puppeteerNavTimeoutMs
            });

            // Проверяем Security Verification
            const pageTitle = await page.title();
            if (pageTitle.includes('Security') || pageTitle.includes('Verification')) {
                this.log(`Security verification detected, trying to bypass...`);

                await page.waitForTimeout(5000);
                await page.reload({ waitUntil: 'networkidle2' });

                const newTitle = await page.title();
                if (newTitle.includes('Security') || newTitle.includes('Verification')) {
                    this.log(`Cannot bypass security for car ${carId}`);
                    return { error: 'Security verification blocked' };
                }
            }

            // Ждем появления контента
            try {
                await page.waitForSelector('body', { timeout: 10000 });
                await page.waitForFunction(() => {
                    const bodyText = document.body.textContent;
                    return bodyText && bodyText.length > 500;
                }, { timeout: 15000 });
            } catch (waitError) {
                this.log(`Content wait timeout for car ${carId}, continuing anyway`);
            }

            const html = await page.content();
            const details = this.parseDetailsFromHTML(html);

            if (details?.security_blocked) {
                return { error: 'Security verification blocked' };
            }
            if (!this.hasSufficientParsedDetails(details)) {
                return { error: 'Insufficient parsed details' };
            }

            // Извлекаем изображения из галереи
            details.images = await this.extractGalleryImages(page);

            return details;

        } catch (error) {
            this.log(`Puppeteer error for car ${carId}:`, error.message);
            return { error: error.message };
        } finally {
            if (browser) {
                await browser.close();
                this.log(`Browser closed for car ${carId}`);
            }
        }
    }

    // Извлечение изображений из галереи
    async extractGalleryImages(page) {
        try {
            const images = await page.evaluate(() => {
                const imageUrls = [];

                // Ищем галерею с id="pic_li" [1]
                const galleryImages = document.querySelectorAll('#pic_li img.LazyloadImg, #pic_li a img');
                galleryImages.forEach(img => {
                    // Берем URL из data-original (высокое качество)
                    const dataOriginal = img.getAttribute('data-original');
                    if (dataOriginal) {
                        const fullUrl = dataOriginal.startsWith('//') ? `https:${dataOriginal}` : dataOriginal;
                        if (!imageUrls.includes(fullUrl)) {
                            imageUrls.push(fullUrl);
                        }
                    }

                    // Также берем обычный src
                    if (img.src && img.src.startsWith('http') && !imageUrls.includes(img.src)) {
                        imageUrls.push(img.src);
                    }
                });

                return imageUrls.slice(0, 20);
            });

            this.log(`Extracted ${images.length} gallery images`);
            return images.join('#');
        } catch (error) {
            this.log(`Error extracting gallery images:`, error.message);
            return '';
        }
    }

    // Парсинг данных из HTML
    parseDetailsFromHTML(html) {
        const $ = cheerio.load(html);
        const details = {};
        const bodyText = $('body').text();
        const breadcrumbData = this.extractBreadcrumbData($);

        if (breadcrumbData && Object.keys(breadcrumbData).length > 0) {
            Object.assign(details, breadcrumbData);
            this.log('Parsed breadcrumb data', breadcrumbData);
        }

        this.log(`Parsing HTML, body length: ${bodyText.length} chars`);

        // Проверяем Security Verification
        if (bodyText.length < 1000 || bodyText.includes('Security Verification')) {
            this.log(`Warning: Page appears to be security verification page`);
            details.security_blocked = true;
        }

        // Извлекаем данные из заголовка [1]
        const titleText = $('title').text();
        if (titleText.includes('马自达3 昂克赛拉')) {
            details.brand = '马自达';
            details.model = '马自达3 昂克赛拉';
            details.brand_en = this.brandTranslations[details.brand] || details.brand;
            details.model_en = this.modelTranslations['昂克赛拉'] || details.model;
        }

        // Цена [1]
        let priceMatch = null;
        const priceSelectors = [
            'div:contains("报价")',
            '.price',
            '.car-price',
            '.offer-price',
            'span:contains("万")',
            'b:contains("万")'
        ];

        for (const selector of priceSelectors) {
            const element = $(selector).first();
            if (element.length) {
                const priceText = element.text();
                const match = priceText.match(/(\d+\.?\d*)万/);
                if (match) {
                    priceMatch = match;
                    this.log(`Found price with selector "${selector}": ${match[1]}万`);
                    break;
                }
            }
        }

        if (!priceMatch) {
            const matches = bodyText.match(/(\d+\.?\d*)万/g);
            if (matches && matches.length > 0) {
                for (const match of matches) {
                    const value = match.match(/(\d+\.?\d*)万/);
                    if (value && !bodyText.includes(`${value[1]}万公里`)) {
                        priceMatch = value;
                        this.log(`Found price in text: ${value[1]}万`);
                        break;
                    }
                }
            }
        }

        if (priceMatch) {
            details.price = parseFloat(priceMatch[1]) * 10000;
            this.log(`Final price: ${priceMatch[1]}万 = ${details.price} CNY`);
        }

        const structuredFields = this.parseStructuredFields($);
        for (const field of structuredFields) {
            const label = field.label;
            const value = field.value;

            if ((label.includes('表显里程') || label === '里程') && !details.mileage) {
                const mileage = this.extractMileageKmFromText(value);
                if (Number.isFinite(mileage)) {
                    details.mileage = mileage;
                    this.log(`Found mileage from ${label}: ${value} -> ${mileage} km`);
                }
            }

            if ((label.includes('上牌时间') || label.includes('登记时间')) && !details.year) {
                const year = this.extractYearFromText(value);
                if (year) {
                    details.year = year;
                    this.log(`Found year from ${label}: ${year}`);
                }
            }

            if ((label.includes('排量') || label.includes('挡位/排量') || label.includes('发动机')) && !details.engineVolume) {
                const cc = this.extractEngineVolumeCcFromText(`${label} ${value}`);
                if (Number.isFinite(cc)) {
                    details.engineVolume = cc;
                    this.log(`Found engine volume from ${label}: ${value} -> ${cc} cc`);
                }
            }

            if ((label.includes('发动机') || label.includes('电动机')) && !details.horsepower) {
                const hp = this.extractHorsepowerFromText(value);
                if (Number.isFinite(hp)) {
                    details.horsepower = hp;
                    this.log(`Found horsepower from ${label}: ${hp}`);
                }
            }

            if ((label.includes('变速箱') || label.includes('挡位')) && !details.transmission) {
                if (/CVT/i.test(value)) details.transmission = 'CVT';
                else if (/手动|MT/i.test(value)) details.transmission = 'MT';
                else if (/自动|AT|DCT|DSG|PDK/i.test(value)) details.transmission = 'AT';
            }

            if ((label.includes('驱动方式') || label === '驱动') && !details.drive) {
                if (/四驱|4WD|AWD/u.test(value)) details.drive = '4WD';
                else if (/后驱|RWD|FR/u.test(value)) details.drive = 'FR';
                else if (/前驱|两驱|FWD|FF/u.test(value)) details.drive = 'FF';
            }

            if ((label.includes('燃油标号') || label.includes('燃油类型') || label.includes('能源类型')) && !details.fuelType) {
                if (/插电|增程|PHEV/u.test(value)) details.fuelType = 'P';
                else if (/混动|双擎|混合动力|HEV|HYBRID/u.test(value)) details.fuelType = 'H';
                else if (/纯电|电动|EV/u.test(value)) details.fuelType = 'E';
                else if (/柴油/u.test(value)) details.fuelType = 'D';
                else if (/汽油|92号|95号|98号/u.test(value)) details.fuelType = 'G';
            }

            if ((label.includes('车身颜色') || label === '颜色') && !details.color) {
                const colorMatch = value.match(/(白色|黑色|银色|灰色|蓝色|红色|棕色|金色|绿色|黄色)/u);
                if (colorMatch) {
                    details.color = colorMatch[1];
                    details.color_en = this.colorTranslations[colorMatch[1]] || colorMatch[1];
                }
            }

            if (label.includes('标准容量') && !details.batteryKwh) {
                const batteryMatch = value.match(/(\d+(?:\.\d+)?)\s*kwh/i);
                if (batteryMatch) {
                    details.batteryKwh = parseFloat(batteryMatch[1]);
                    details.fuelType = details.fuelType || 'E';
                    this.log(`Found battery capacity from ${label}: ${details.batteryKwh} kWh`);
                }
            }
        }

        if (!details.horsepower) {
            const horsepowerContext =
                bodyText.match(/(?:发动机|电动机|最大马力|综合马力|马力|功率)[\s\S]{0,96}/u)?.[0] || '';
            const hp = this.extractHorsepowerFromText(horsepowerContext);
            if (Number.isFinite(hp)) {
                details.horsepower = hp;
                this.log(`Found horsepower: ${details.horsepower}`);
            }
        }

        if (!details.mileage) {
            const mileageContext =
                bodyText.match(/(?:表显里程|里程)[\s:：]*[0-9.,，]+(?:\.[0-9]+)?\s*(?:万)?\s*(?:公里|千米|km)?/iu)?.[0]
                || bodyText.match(/[0-9]+(?:\.[0-9]+)?\s*万公里/u)?.[0]
                || '';
            const mileage = this.extractMileageKmFromText(mileageContext);
            if (Number.isFinite(mileage)) {
                details.mileage = mileage;
                this.log(`Found mileage fallback: ${mileageContext} = ${details.mileage} km`);
            }
        }

        if (!details.year) {
            const yearMatch = bodyText.match(/上牌时间[\s:：]*(20\d{2}|19\d{2})年/u) || bodyText.match(/(20\d{2}|19\d{2})年/u);
            if (yearMatch) {
                details.year = parseInt(yearMatch[1], 10);
                this.log(`Found year: ${details.year}`);
            }
        }

        if (!details.color) {
            const colorMatch = bodyText.match(/(白色|黑色|银色|灰色|蓝色|红色|棕色|金色|绿色|黄色)/u);
            if (colorMatch) {
                details.color = colorMatch[1];
                details.color_en = this.colorTranslations[colorMatch[1]] || colorMatch[1];
                this.log(`Found color: ${details.color} (${details.color_en})`);
            }
        }

        if (!details.engineVolume) {
            const engineContext =
                bodyText.match(/(?:挡位\s*\/\s*排量|排量|发动机|电动机)[\s\S]{0,96}/u)?.[0] || '';
            const cc = this.extractEngineVolumeCcFromText(engineContext);
            if (Number.isFinite(cc)) {
                details.engineVolume = cc;
                this.log(`Found engine volume fallback: ${engineContext} -> ${details.engineVolume} cc`);
            }
        }

        if (!details.transmission) {
            if (bodyText.includes('CVT')) {
                details.transmission = 'CVT';
                this.log('Found transmission: CVT');
            } else if (bodyText.includes('自动')) {
                details.transmission = 'AT';
                this.log('Found transmission: AT');
            } else if (bodyText.includes('手动')) {
                details.transmission = 'MT';
                this.log('Found transmission: MT');
            }
        }

        if (!details.drive) {
            if (bodyText.includes('四驱') || bodyText.includes('4WD') || bodyText.includes('AWD')) {
                details.drive = '4WD';
            } else if (bodyText.includes('后驱') || bodyText.includes('RWD') || bodyText.includes('FR')) {
                details.drive = 'FR';
            } else if (bodyText.includes('前驱') || bodyText.includes('两驱') || bodyText.includes('FWD') || bodyText.includes('FF')) {
                details.drive = 'FF';
            }
        }

        if (!details.fuelType) {
            const energyBlock = bodyText.match(/(能源类型|燃料类型|动力类型).{0,24}/u)?.[0] || '';
            const fuelSourceText = `${energyBlock} ${bodyText.substring(0, 4000)}`;
            if (/插电式混合|增程/u.test(fuelSourceText)) {
                details.fuelType = 'P';
                this.log('Found fuel type: P (plug-in hybrid)');
            } else if (/油电混合|混合动力|双擎/u.test(fuelSourceText)) {
                details.fuelType = 'H';
                this.log('Found fuel type: H (hybrid)');
            } else if (/纯电|新能源|电动|标准容量/u.test(fuelSourceText)) {
                details.fuelType = 'E';
                this.log('Found fuel type: E (electric)');
            } else if (/柴油/u.test(fuelSourceText)) {
                details.fuelType = 'D';
                this.log('Found fuel type: D (diesel)');
            } else if (/汽油|92号|95号|98号/u.test(fuelSourceText)) {
                details.fuelType = 'G';
                this.log('Found fuel type: G (petrol)');
            }
        }

        if (!details.batteryKwh) {
            const batteryMatch = bodyText.match(/标准容量[\s:：]*([0-9]+(?:\.[0-9]+)?)\s*kwh/i);
            if (batteryMatch) {
                details.batteryKwh = parseFloat(batteryMatch[1]);
                details.fuelType = details.fuelType || 'E';
                this.log(`Found battery capacity fallback: ${details.batteryKwh} kWh`);
            }
        }

        return details;
    }

    // Преобразование данных автомобиля в формат для базы данных
    async prepareCarData(apiCar, puppeteerDetails) {
        try {
            await this.ensureTranslationCacheLoaded();
            const normalizedDetails = puppeteerDetails || {};

            // Применяем нормализацию бренда/модели без иероглифов.
            let brandEnglish = this.normalizeBrand(apiCar, normalizedDetails);
            const brandSource = String(normalizedDetails.brand_cn || apiCar.BrandName || '').trim();
            if (
                (/^BRAND_/i.test(brandEnglish) || /^UNKNOWN$/i.test(brandEnglish) || this.containsNonAscii(brandEnglish))
                && brandSource
            ) {
                const translatedBrand = await this.translateNameWithDeepSeek(brandSource, { kind: 'brand' });
                if (translatedBrand) {
                    brandEnglish = translatedBrand;
                }
            }

            let modelEnglish = this.normalizeModel(apiCar, brandEnglish, normalizedDetails);
            const modelSource = String(
                normalizedDetails.model_cn
                || normalizedDetails.model_spec_cn
                || apiCar.SeriesName
                || apiCar.carname
                || apiCar.SpecName
                || ''
            ).trim();
            if (
                (
                    /^SERIES_/i.test(modelEnglish)
                    || /^MODEL_UNKNOWN$/i.test(modelEnglish)
                    || this.containsNonAscii(modelEnglish)
                    || (String(modelEnglish || '').trim().length <= 1 && this.containsNonAscii(modelSource))
                )
                && modelSource
            ) {
                const translatedModel = await this.translateNameWithDeepSeek(modelSource, { kind: 'model' });
                if (translatedModel) {
                    modelEnglish = translatedModel;
                }
            }

            // Генерация ID [2]
            const carId = this.generateCarId(
                apiCar,
                brandEnglish,
                modelEnglish,
                apiCar.registrationdate,
                apiCar.mileage,
                apiCar.price
            );

            const fuelType = this.inferFuelType(apiCar, normalizedDetails);
            const transmission = this.inferTransmission(apiCar, normalizedDetails);
            const drive = this.inferDrive(apiCar, normalizedDetails);
            const engineCc = this.extractEngineCc(apiCar, normalizedDetails);
            const horsepower = Number.isFinite(Number(normalizedDetails.horsepower))
                ? Math.round(Number(normalizedDetails.horsepower))
                : this.extractHorsepowerFromApi(apiCar);
            const imageList = this.normalizeImageList(normalizedDetails.images || apiCar.image || '');
            const localizedImages = await this.localizeImages(imageList, brandEnglish, modelEnglish, carId);
            const basePrice = normalizedDetails.price ? normalizedDetails.price : (parseFloat(apiCar.price) * 10000);
            const mileageKm = Number.isFinite(Number(normalizedDetails.mileage))
                ? Math.round(Number(normalizedDetails.mileage))
                : this.extractMileageKmFromApi(apiCar);

            // Формируем данные в формате CarModel [2]
            const carData = {
                ID: carId,
                SOURCE: 'che168',
                MARKA_ID: '',
                MARKA_NAME: brandEnglish,
                MODEL_ID: '',
                MODEL_NAME: modelEnglish,
                YEAR: normalizedDetails.year || apiCar.registrationdate || '',
                TOWN: apiCar.cname || '',
                ENG_V: engineCc,
                PW: Number.isFinite(horsepower) ? String(horsepower) : '',
                KUZOV: '',
                GRADE: '',
                COLOR: normalizedDetails.color_en || normalizedDetails.color || '',
                KPP: transmission,
                KPP_TYPE: transmission,
                PRIV: drive,
                MILEAGE: mileageKm !== '' ? String(mileageKm) : '',
                EQUIP: '',
                RATE: '',
                START: basePrice.toString(),
                FINISH: basePrice.toString(),
                STATUS: 'available',
                TIME: fuelType,
                SANCTION: '',
                AVG_PRICE: basePrice.toString(),
                AVG_STRING: '',
                IMAGES: localizedImages.join('#'),
                PRICE_CALC: null,
                CALC_RUB: null,
                CALC_UPDATED_AT: null,
                original_price: basePrice,
                original_currency: 'CNY',
                converted_price: null,
                tks_total: null,
                markup: null,
                response_time: null,
                LOCATION: `${apiCar.pname || ''} ${apiCar.cname || ''}`.trim(),
                URL: `${this.pageBase}/${this.dealerId}/${apiCar.carid}.html?offertype=110`
            };

            return carData;

        } catch (error) {
            this.log(`Error preparing car data:`, error.message);
            return null;
        }
    }

    // Запуск теста (для отладки) [2]
    async runTest(limit = 5) {
        this.log(`🚀 Starting test with ${limit} cars...`);

        try {
            const firstPageData = await this.fetchPage(1, 6);

            if (!firstPageData.result || !firstPageData.result.carlist) {
                this.log(`No car list in response`);
                return;
            }

            const testCars = firstPageData.result.carlist.slice(0, limit);
            this.log(`Testing with ${testCars.length} cars`);

            for (let i = 0; i < testCars.length; i++) {
                const car = testCars[i];
                this.log(`\nTest car ${i + 1}: ${car.carname}`);

                const success = await this.processCar(car);

                if (success) {
                    this.log(`✅ Test car ${i + 1} processed successfully`);
                } else {
                    this.log(`❌ Test car ${i + 1} failed`);
                }

                if (i < testCars.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }

            this.log(`\n🎉 Test completed`);
        } catch (error) {
            this.log(`❌ Test failed:`, error.message);
        }
    }

    // Сохранение автомобиля в базу данных [2]
    async saveCarToDatabase(carData) {
        if (!carData) return false;

        try {
            const db = require('../config/database');

            // Формируем SQL запрос
            const fields = Object.keys(carData).join(', ');
            const values = Object.values(carData);
            const placeholders = Object.keys(carData).map(() => '?').join(', ');

            const sql = `
                INSERT INTO che_available (${fields}, created_at, updated_at, deleted)
                VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
                ON DUPLICATE KEY UPDATE
                    ${Object.keys(carData).map(key => `${key} = VALUES(${key})`).join(', ')},
                    updated_at = CURRENT_TIMESTAMP,
                    deleted = 0
            `;

            await db.query(sql, values);
            this.log(`Saved car ${carData.ID} to database`);
            return true;
        } catch (error) {
            this.log(`Error saving car ${carData?.ID} to database:`, error.message);
            return false;
        }
    }

    // Обработка одного автомобиля [2]
    async processCar(apiCar) {
        try {
            this.log(`Processing car: ${apiCar.carname} (ID: ${apiCar.carid})`);

            // Получаем детальную информацию через Puppeteer с ретраями при сетевых сбоях.
            let puppeteerDetails = null;
            for (let attempt = 1; attempt <= this.puppeteerMaxAttempts; attempt++) {
                if (attempt > 1) {
                    this.log(`Puppeteer retry ${attempt}/${this.puppeteerMaxAttempts} for car ${apiCar.carid}`);
                }

                puppeteerDetails = await this.parseCarDetailsWithPuppeteer(apiCar.carid);
                if (puppeteerDetails && !puppeteerDetails.error) {
                    break;
                }

                const errorMessage = puppeteerDetails?.error || 'unknown puppeteer error';
                const shouldRetry = this.isRetryablePuppeteerError(errorMessage);
                const hasAttemptsLeft = attempt < this.puppeteerMaxAttempts;

                if (!shouldRetry || !hasAttemptsLeft) {
                    this.log(`Skipping car ${apiCar.carid} due to Puppeteer error:`, errorMessage);
                    return false;
                }

                const retryDelayMs = this.getRetryDelayMs(attempt);
                this.log(`Transient Puppeteer error for car ${apiCar.carid}. Retry in ${retryDelayMs} ms`, errorMessage);
                await this.sleep(retryDelayMs);
            }

            // Подготавливаем данные для базы
            const carData = await this.prepareCarData(apiCar, puppeteerDetails);
            if (!carData) {
                this.log(`Failed to prepare data for car ${apiCar.carid}`);
                return false;
            }

            // Сохраняем в базу
            const saved = await this.saveCarToDatabase(carData);
            if (saved) {
                this.log(`Successfully processed car ${apiCar.carname}`);
                return true;
            } else {
                this.log(`Failed to save car ${apiCar.carname}`);
                return false;
            }
        } catch (error) {
            this.log(`Error processing car ${apiCar.carid}:`, error.message);
            return false;
        }
    }

    // Парсинг всех страниц [2]
    async parseAllPages(limitPages = null) {
        if (this.isRunning) {
            this.log(`Parser already running, skipping`);
            return;
        }

        this.isRunning = true;
        this.log(`🚀 Starting Che168 parser...`);

        try {
            // 1. Получаем первую страницу для определения общего количества
            const firstPageData = await this.fetchPage(1, 6);
            if (!firstPageData.result || !firstPageData.result.carlist) {
                this.log(`No car list in response`);
                return;
            }

            const totalPages = firstPageData.result.pagecount;
            const totalCars = firstPageData.result.rowcount;
            this.log(`Total pages: ${totalPages}, Total cars: ${totalCars}`);

            // Определяем сколько страниц обрабатывать
            const pagesToProcess = limitPages === null ? totalPages : Math.min(limitPages, totalPages);
            this.log(`Processing ${pagesToProcess} pages...`);

            const allCars = [];

            // 2. Получаем данные со всех страниц
            for (let pageIndex = 1; pageIndex <= pagesToProcess; pageIndex++) {
                this.log(`Fetching page ${pageIndex}/${pagesToProcess}...`);
                const pageData = await this.fetchPage(pageIndex, 6);

                if (pageData.result && pageData.result.carlist) {
                    allCars.push(...pageData.result.carlist);
                    this.log(`Added ${pageData.result.carlist.length} cars from page ${pageIndex}`);
                }

                // Пауза между запросами страниц
                if (pageIndex < pagesToProcess) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            this.log(`Total cars collected: ${allCars.length}`);

            const fullSyncMode = limitPages === null;

            // Убираем дубли в рамках одного цикла парсинга
            const uniqueCarsById = new Map();
            for (let i = 0; i < allCars.length; i++) {
                const car = allCars[i];
                const externalId = this.generateStableExternalId(car);
                const dedupeKey = externalId || `unknown_${i}`;
                if (!uniqueCarsById.has(dedupeKey)) {
                    uniqueCarsById.set(dedupeKey, car);
                }
            }

            const deduplicatedCars = Array.from(uniqueCarsById.values());
            const externalIds = Array.from(uniqueCarsById.keys());
            this.log(`Cars after deduplication: ${deduplicatedCars.length}`);

            if (fullSyncMode) {
                await this.syncDeletedCars(
                    externalIds.filter((id) => !id.startsWith('unknown_'))
                );
            } else {
                this.log('Partial parse mode detected (--limit), skipping deleted sync and purge');
            }

            // 3. Обрабатываем каждый автомобиль [2]
            let processed = 0;
            let errors = 0;

            for (let i = 0; i < deduplicatedCars.length; i++) {
                const car = deduplicatedCars[i];
                this.log(`Processing car ${i + 1}/${deduplicatedCars.length}: ${car.carname}`);

                const success = await this.processCar(car);
                if (success) {
                    processed++;
                } else {
                    errors++;
                }

                // Пауза между запросами автомобилей (5 секунд) [2]
                if (i < deduplicatedCars.length - 1) {
                    this.log(`Waiting 5 seconds before next car...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            this.log(`✅ Parsing completed: ${processed} processed, ${errors} errors`);
            if (fullSyncMode) {
                await this.purgeDeletedCarsAndMedia();
            }
        } catch (error) {
            this.log(`❌ Parsing failed:`, error.message);
        } finally {
            this.isRunning = false;
        }
    }
}
// Экспорт класса
module.exports = Che168Parser;
