const db = require('../config/database');
const axios = require('axios');

class CarModel {
    constructor() {
        this.tables = ['main', 'korea', 'china', 'bike'];
        // Маппинг колонок для разных таблиц
        this.tableColumns = {
            main: {
                vendor_id: 'MARKA_ID',
                vendor_name: 'MARKA_NAME',
                model_id: 'MODEL_ID',
                model_name: 'MODEL_NAME',
                fuel_type: 'TIME',
                transmission: 'KPP',
                drive: 'PRIV',
                mileage: 'MILEAGE'
            },
            korea: {
                vendor_id: 'MARKA_ID',
                vendor_name: 'MARKA_NAME',
                model_id: 'MODEL_ID',
                model_name: 'MODEL_NAME',
                fuel_type: 'TIME',
                transmission: 'KPP',
                drive: 'PRIV',
                mileage: 'MILEAGE'
            },
            china: {
                vendor_id: 'MARKA_ID',
                vendor_name: 'MARKA_NAME',
                model_id: 'MODEL_ID',
                model_name: 'MODEL_NAME',
                fuel_type: 'TIME',
                transmission: 'KPP',
                drive: 'PRIV',
                mileage: 'MILEAGE'
            },
            bike: {
                vendor_id: 'MARKA_ID',
                vendor_name: 'MARKA_NAME',
                model_id: 'MODEL_ID',
                model_name: 'MODEL_NAME',
                fuel_type: null, // В bike нет колонки TIME
                transmission: null, // В bike нет колонки KPP
                drive: null, // В bike нет колонки PRIV
                mileage: 'MILEAGE'
            }
        };

        // Маппинг для преобразования д��нных
        this.fieldMappers = {
            // Маппин�� трансмиссий (HTML entities -> читаемые коды)
            transmission: (value) => {
                const transmissionMap = {
                    '&#65412;&#65400;S': 'AT',
                    '&#65407;&#65417;&#65408;': 'MT',
                    '&#65412;&#65400;&#65404;&#65389;': 'CVT',
                    '&#65401;&#65438;&#65437;&#65404;': 'AT',
                    '&#12381;&#12398;&#20182;': 'OTHER',
                    'AT': 'AT', 'MT': 'MT', 'CVT': 'CVT',
                    'SAT': 'AT', 'FAT': 'AT', 'DAT': 'AT',
                    'FMT': 'MT', 'HL': 'HYBRID', 'SQ': 'SEQUENTIAL'
                };
                return transmissionMap[value] || value;
            },

            // Маппинг приводов
            drive: (value) => {
                const driveMap = {
                    'FF': 'FWD', 'FWD': 'FWD',
                    'FR': 'RWD', 'RWD': 'RWD',
                    'RR': 'RWD',
                    '4WD': 'AWD', 'AWD': 'AWD', 'FULLTIME4WD': 'AWD',
                    'PARTTIME4WD': 'PARTTIME_AWD'
                };
                return driveMap[value] || value;
            },

            // Маппинг топлива (уже есть в fuel_types)
            fuel: (value) => value // Просто возвращаем код, т.о. есть маппинг в fuel_types
        };

        // Группы трансмиссий для удобства
        this.transmissionGroups = {
            automatic: ['AT', 'SAT', 'FAT', 'DAT', 'A', 'F', 'FM', 'IAT'],
            manual: ['MT', 'FMT', 'M'],
            cvt: ['CVT', 'C', 'CA', 'CAT', 'C3', 'C5', 'C6'],
            hybrid: ['HL', 'HL5', 'HL6', 'HL8', 'HL9', 'H'],
            sequential: ['SQ', 'SEQ'],
            other: ['OTHER', '-', '...', '..S']
        };

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
        // Маппинг трансмиссий на основные категории
        this.transmissionMapping = {
            // AUTOMATIC
            'AT': 'automatic',
            'A': 'automatic',
            'FAT': 'automatic',
            'SAT': 'automatic',
            '4AT': 'automatic',
            '5AT': 'automatic',
            '6AT': 'automatic',
            '7AT': 'automatic',
            '8AT': 'automatic',
            'DAT': 'automatic',
            'IAT': 'automatic',
            '&#65401;&#65438;&#65437;&#65404;': 'automatic', // японское AT
            '&#65412;&#65400;&#65404;&#65389;': 'automatic', // японское AT

            // MANUAL
            'MT': 'manual',
            'M': 'manual',
            'FMT': 'manual',
            '5MT': 'manual',
            '6MT': 'manual',
            '7MT': 'manual',
            'DMT': 'manual',
            '&#65407;&#65417;&#65408;': 'manual', // японское MT

            // CVT
            'CVT': 'cvt',
            'C': 'cvt',
            'C3': 'cvt',
            'C5': 'cvt',
            'C6': 'cvt',
            'CA': 'cvt',
            'CAT': 'cvt',

            // HYBRID/SPECIAL
            'HL': 'hybrid',
            'HL5': 'hybrid',
            'HL6': 'hybrid',
            'HL8': 'hybrid',
            'HL9': 'hybrid',
            'H': 'hybrid',

            // DUAL-CLUTCH/DSG
            'DCT': 'automatic',
            'DSG': 'automatic',
            'PDK': 'automatic',

            // SEQUENTIAL
            'SQ': 'sequential',
            'SEQ': 'sequential',

            // UNKNOWN/OTHER (маппим на automatic как наиболее вероятный)
            '-': 'automatic',
            '...': 'automatic',
            '..S': 'automatic',
            '&#12381;&#12398;&#20182;': 'automatic', // "Другое"
            'F': 'automatic',
            'FM': 'automatic'
        };

        // --- CACHING ---
        // Кэш динамических фильтров: ключ = table|vendor|model|only_calculated
        this.dynamicFiltersCache = {}; // { key: { data, updatedAt }}
        this.dynamicCacheTTL = 24 * 60 * 60 * 1000; // 24 часа

        // Кэш внешних списков брендов/моделей (30 минут)
        this.externalCache = {}; // { key: { data, updatedAt }}
        this.externalCacheTTL = 30 * 60 * 1000; // 30 минут

        // Внешние эндпоинты manuf/model по таблицам
        this.externalEndpoints = {
            main: { manuf: '/manuf', model: '/model' }, // для Японии/main
            korea: { manuf: '/manuf_kr', model: '/model_kr' },
            china: { manuf: '/manuf_che', model: '/model_che' },
            bike: { manuf: '/manuf_bike', model: '/model_bike' }
        };

        // Хост внешнего сервиса
        this.externalHost = 'http://87.242.72.57';

        // Запускаем фоновое обновление раз в час
        this._startBackgroundRefresh();
    }

    async bulkUpdatePrices(table, records) {
        let updatedCount = 0;
        const errors = [];

        for (const record of records) {
            try {
                // Для таблицы bike используем другой набор полей
                if (table === 'bike') {
                    const sql = `
                    UPDATE ${table} 
                    SET START = ?, 
                        FINISH = ?,
                        UPDATED_AT = NOW()
                    WHERE ID = ? AND deleted = 0
                `;
                    const params = [
                        record.START || 0,
                        record.FINISH || 0,
                        record.ID
                    ];
                    const result = await db.query(sql, params);
                    if (result.affectedRows > 0) {
                        updatedCount++;
                    }
                } else {
                    // Для остальных таблиц (main, korea, china)
                    const sql = `
                    UPDATE ${table} 
                    SET START = ?, 
                        FINISH = ?, 
                        AVG_PRICE = ?,
                        UPDATED_AT = NOW()
                    WHERE ID = ? AND deleted = 0
                `;
                    const params = [
                        record.START || 0,
                        record.FINISH || 0,
                        record.AVG_PRICE || 0,
                        record.ID
                    ];
                    const result = await db.query(sql, params);
                    if (result.affectedRows > 0) {
                        updatedCount++;
                    }
                }
            } catch (error) {
                errors.push({ id: record.ID, error: error.message });
            }
        }

        return { updated: updatedCount, errors };
    }

    // --- CACHE HELPERS ---
    _makeDynamicCacheKey(currentFilters = {}, table = 'main') {
        const v = (currentFilters.vendor || '').toString().toUpperCase();
        const m = (currentFilters.model || '').toString();
        const o = (currentFilters.only_calculated || '').toString();
        return `${table}|${v}|${m}|${o}`;
    }

    _isFresh(entry, ttl) {
        if (!entry || !entry.updatedAt) return false;
        return (Date.now() - entry.updatedAt) < ttl;
    }

    async _startBackgroundRefresh() {
        // hourly refresh
        setInterval(async () => {
            try {
                const keys = Object.keys(this.dynamicFiltersCache);
                for (const key of keys) {
                    // обновляем в фоне, не блокируя
                    this._refreshDynamicCacheKey(key).catch(err => {
                        console.error('Background refresh error for', key, err.message);
                    });
                }
            } catch (err) {
                console.error('Background refresh scheduler error:', err.message);
            }
        }, 60 * 60 * 1000); // 1 час
    }

    async _refreshDynamicCacheKey(cacheKey) {
        // cacheKey format: table|V|M|O
        try {
            const [table] = cacheKey.split('|');
            const parts = cacheKey.split('|');
            const currentFilters = { vendor: parts[1] || '', model: parts[2] || '', only_calculated: parts[3] || '' };
            const fresh = await this._computeDynamicFilters(currentFilters, table);
            this.dynamicFiltersCache[cacheKey] = { data: fresh, updatedAt: Date.now() };
            // console.log(`Background refreshed dynamic filters for ${cacheKey}`);
        } catch (error) {
            console.error('Error refreshing cache key', cacheKey, error.message);
        }
    }

    // --- EXTERNAL FETCH ---
    async _fetchExternalManuf(table) {
        const endpoint = this.externalEndpoints[table];
        if (!endpoint || !endpoint.manuf) return null;
        const key = `manuf_${table}`;

        const cached = this.externalCache[key];
        if (this._isFresh(cached, this.externalCacheTTL)) {
            return cached.data;
        }

        try {
            const url = `${this.externalHost}${endpoint.manuf}`;
            const resp = await axios.get(url, { timeout: 5000 });
            const raw = ('' + (resp.data || '')).trim();
            // формат: 1:TOYOTA;2:NISSAN;
            const pairs = raw.split(';').map(s => s.trim()).filter(Boolean);
            const result = pairs.map(p => {
                const parts = p.split(':');
                if (parts.length >= 2) {
                    const id = parts[0];
                    const name = parts.slice(1).join(':').trim();
                    return { id: id, name: name };
                }
                return null;
            }).filter(Boolean);

            this.externalCache[key] = { data: result, updatedAt: Date.now() };
            return result;
        } catch (error) {
            console.error('External manuf fetch error for', table, error.message);
            // не ломаем работу — возвращаем null чтобы использовать локальную базу
            return null;
        }
    }

    async _fetchExternalModels(table) {
        const endpoint = this.externalEndpoints[table];
        if (!endpoint || !endpoint.model) return null;
        const key = `model_${table}`;

        const cached = this.externalCache[key];
        if (this._isFresh(cached, this.externalCacheTTL)) {
            return cached.data;
        }

        try {
            const url = `${this.externalHost}${endpoint.model}`;
            const resp = await axios.get(url, { timeout: 5000 });
            const raw = ('' + (resp.data || '')).trim();
            // формат: MARKA_ID:MODEL_ID:MODEL_NAME (COUNT CARS);...;
            const parts = raw.split(';').map(s => s.trim()).filter(Boolean);
            const result = [];
            for (const part of parts) {
                // Найдем первые два ':'
                const idx1 = part.indexOf(':');
                if (idx1 === -1) continue;
                const idx2 = part.indexOf(':', idx1 + 1);
                if (idx2 === -1) continue;
                const markaId = part.slice(0, idx1);
                const modelId = part.slice(idx1 + 1, idx2);
                const rest = part.slice(idx2 + 1).trim();
                // model name может содержать ':' но мы уже взяли первые два
                // Уберем возможный (COUNT) в конце
                const name = rest.replace(/\(\d+\)$/g, '').trim();
                result.push({ marka_id: markaId, model_id: modelId, name });
            }

            this.externalCache[key] = { data: result, updatedAt: Date.now() };
            return result;
        } catch (error) {
            console.error('External model fetch error for', table, error.message);
            return null;
        }
    }

    // --- ORIGINAL METHODS (unchanged unless necessary) ---
    async createTables() {
        const tablesSql = {
            main: `
                CREATE TABLE IF NOT EXISTS main (
                                                    ID VARCHAR(50) PRIMARY KEY,
                    LOT VARCHAR(50),
                    AUCTION_TYPE VARCHAR(10),
                    AUCTION_DATE DATETIME,
                    AUCTION VARCHAR(255),
                    MARKA_ID VARCHAR(10),
                    MODEL_ID VARCHAR(10),
                    MARKA_NAME VARCHAR(255),
                    MODEL_NAME VARCHAR(255),
                    YEAR VARCHAR(4),
                    TOWN VARCHAR(50),
                    ENG_V VARCHAR(10),
                    PW VARCHAR(255),
                    KUZOV VARCHAR(255),
                    GRADE VARCHAR(255),
                    COLOR VARCHAR(30),
                    KPP VARCHAR(255),
                    KPP_TYPE VARCHAR(255),
                    PRIV VARCHAR(255),
                    MILEAGE VARCHAR(20),
                    EQUIP TEXT,
                    RATE VARCHAR(10),
                    START VARCHAR(10),
                    FINISH VARCHAR(10),
                    STATUS VARCHAR(20),
                    TIME VARCHAR(10),
                    SANCTION VARCHAR(10),
                    AVG_PRICE VARCHAR(20),
                    AVG_STRING TEXT,
                    IMAGES TEXT,
                    PRICE_CALC DECIMAL(15,2) NULL,
                    CALC_RUB DECIMAL(15,2) NULL,
                    CALC_UPDATED_AT TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted TINYINT(1) DEFAULT 0,
                    INDEX idx_auction_date (AUCTION_DATE),
                    INDEX idx_marka_model (MARKA_NAME, MODEL_NAME),
                    INDEX idx_price_calc (PRICE_CALC),
                    INDEX idx_calc_rub (CALC_RUB),
                    INDEX idx_calc_updated (CALC_UPDATED_AT)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `,
            korea: `
                CREATE TABLE IF NOT EXISTS korea (
                    ID VARCHAR(50) PRIMARY KEY,
                    LOT VARCHAR(50),
                    AUCTION_DATE DATETIME,
                    AUCTION VARCHAR(255),
                    MARKA_ID VARCHAR(10),
                    MODEL_ID VARCHAR(10),
                    MARKA_NAME VARCHAR(255),
                    MODEL_NAME VARCHAR(255),
                    YEAR VARCHAR(4),
                    MONTH VARCHAR(20),
                    ENG_V VARCHAR(10),
                    KUZOV VARCHAR(255),
                    GRADE VARCHAR(255),
                    COLOR VARCHAR(30),
                    KPP VARCHAR(255),
                    KPP_TYPE VARCHAR(255),
                    PRIV VARCHAR(255),
                    MILEAGE VARCHAR(20),
                    EQUIP TEXT,
                    RATE VARCHAR(10),
                    START VARCHAR(10),
                    FINISH VARCHAR(10),
                    STATUS VARCHAR(20),
                    TIME VARCHAR(10),
                    AVG_PRICE VARCHAR(20),
                    AVG_STRING TEXT,
                    IMAGES TEXT,
                    PRICE_CALC DECIMAL(15,2) NULL,
                    CALC_RUB DECIMAL(15,2) NULL,
                    CALC_UPDATED_AT TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted TINYINT(1) DEFAULT 0,
                    INDEX idx_auction_date (AUCTION_DATE),
                    INDEX idx_marka_model (MARKA_NAME, MODEL_NAME),
                    INDEX idx_price_calc (PRICE_CALC),
                    INDEX idx_calc_rub (CALC_RUB),
                    INDEX idx_calc_updated (CALC_UPDATED_AT)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `,
            china: `
                CREATE TABLE IF NOT EXISTS china (
                    ID VARCHAR(50) PRIMARY KEY,
                    LOT VARCHAR(50),
                    AUCTION_DATE DATETIME,
                    AUCTION VARCHAR(255),
                    MARKA_ID VARCHAR(10),
                    MODEL_ID VARCHAR(10),
                    MARKA_NAME VARCHAR(255),
                    MODEL_NAME VARCHAR(255),
                    YEAR VARCHAR(4),
                    ENG_V VARCHAR(10),
                    PW VARCHAR(255),
                    KUZOV VARCHAR(255),
                    GRADE VARCHAR(255),
                    COLOR VARCHAR(30),
                    KPP VARCHAR(255),
                    KPP_TYPE VARCHAR(255),
                    PRIV VARCHAR(255),
                    MILEAGE VARCHAR(20),
                    EQUIP TEXT,
                    RATE VARCHAR(10),
                    START VARCHAR(10),
                    FINISH VARCHAR(10),
                    STATUS VARCHAR(20),
                    TIME VARCHAR(10),
                    AVG_PRICE VARCHAR(20),
                    AVG_STRING TEXT,
                    IMAGES TEXT,
                    PRICE_CALC DECIMAL(15,2) NULL,
                    CALC_RUB DECIMAL(15,2) NULL,
                    CALC_UPDATED_AT TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted TINYINT(1) DEFAULT 0,
                    INDEX idx_auction_date (AUCTION_DATE),
                    INDEX idx_marka_model (MARKA_NAME, MODEL_NAME),
                    INDEX idx_price_calc (PRICE_CALC),
                    INDEX idx_calc_rub (CALC_RUB),
                    INDEX idx_calc_updated (CALC_UPDATED_AT)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `,
            bike: `
                CREATE TABLE IF NOT EXISTS bike (
                    ID VARCHAR(50) PRIMARY KEY,
                    AUCTION_DATE DATETIME,
                    LOT_NUM VARCHAR(50),
                    AUCTION VARCHAR(255),
                    AUCTION_ID VARCHAR(10),
                    MARKA_ID VARCHAR(10),
                    MODEL_ID VARCHAR(10),
                    MARKA_NAME VARCHAR(255),
                    MODEL_NAME VARCHAR(255),
                    YEAR VARCHAR(4),
                    GRADE VARCHAR(255),
                    MILEAGE VARCHAR(20),
                    MIL_NOTE VARCHAR(50),
                    ENG_V VARCHAR(10),
                    COLOR VARCHAR(30),
                    RATE_ENG VARCHAR(10),
                    RATE_FRONT VARCHAR(10),
                    RATE_EXT VARCHAR(10),
                    RATE_REAR VARCHAR(10),
                    RATE_EL VARCHAR(10),
                    RATE_FRAME VARCHAR(10),
                    RATE VARCHAR(10),
                    START VARCHAR(10),
                    FINISH VARCHAR(10),
                    STATUS VARCHAR(20),
                    INSPECTION VARCHAR(255),
                    SERIAL VARCHAR(100),
                    IMAGES TEXT,
                    PRICE_CALC DECIMAL(15,2) NULL,
                    CALC_RUB DECIMAL(15,2) NULL,
                    CALC_UPDATED_AT TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted TINYINT(1) DEFAULT 0,
                    INDEX idx_auction_date (AUCTION_DATE),
                    INDEX idx_marka_model (MARKA_NAME, MODEL_NAME),
                    INDEX idx_price_calc (PRICE_CALC),
                    INDEX idx_calc_rub (CALC_RUB),
                    INDEX idx_calc_updated (CALC_UPDATED_AT)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `
        };

        for (const [tableName, sql] of Object.entries(tablesSql)) {
            try {
                await db.query(sql);
                console.log(`✅ Table ${tableName} created/verified`);
            } catch (error) {
                console.error(`❌ Error creating table ${tableName}:`, error.message);
            }
        }

        // Добавляем колонки для хранения данных расчета
        await this.addCalculationColumns();
    }

    // Метод для маппинга данных автомобиля
    mapCarData(carData) {
        if (!carData) return null;

        const mapped = { ...carData };

        // Маппинг основных полей
        if (carData.KPP) {
            mapped.transmission_code = carData.KPP;
            mapped.transmission = this.fieldMappers.transmission(carData.KPP);
            mapped.transmission_group = this.getTransmissionGroup(mapped.transmission);
        }

        if (carData.PRIV) {
            mapped.drive_code = carData.PRIV;
            mapped.drive = this.fieldMappers.drive(carData.PRIV);
        }

        if (carData.TIME) {
            mapped.fuel_code = carData.TIME;
            mapped.fuel_type = carData.TIME;
            // Находим ��олное описание топлива
            const fuelInfo = this.fuelTypes.find(f => f.code === carData.TIME);
            if (fuelInfo) {
                mapped.fuel_name = fuelInfo.name;
                mapped.fuel_tks_type = fuelInfo.tks_type;
            }
        }

        // Числовые преобразования
        if (carData.MILEAGE) {
            mapped.mileage_numeric = parseInt(carData.MILEAGE.replace(/,/g, '')) || 0;
        }

        if (carData.YEAR) {
            mapped.year_numeric = parseInt(carData.YEAR) || 0;
        }

        if (carData.ENG_V) {
            mapped.engine_volume_numeric = parseInt(carData.ENG_V) || 0;
        }

        return mapped;
    }

    // Метод для определения группы трансмиссии
    getTransmissionGroup(transmissionCode) {
        for (const [group, codes] of Object.entries(this.transmissionGroups)) {
            if (codes.includes(transmissionCode)) {
                return group;
            }
        }
        return 'other';
    }

    // Метод для получения имени колонки с проверкой существования
    getColumnName(table, columnType) {
        const columns = this.tableColumns[table];
        if (!columns || !columns[columnType]) {
            return null; // Колонка не существует в этой таблице
        }
        return columns[columnType];
    }

    async addCalculationColumns() {
        const alterQueries = {
            main: `
            ALTER TABLE main 
            ADD COLUMN original_price DECIMAL(15,2) NULL AFTER CALC_UPDATED_AT,
            ADD COLUMN original_currency VARCHAR(10) NULL AFTER original_price,
            ADD COLUMN converted_price DECIMAL(15,2) NULL AFTER original_currency,
            ADD COLUMN tks_total DECIMAL(15,2) NULL AFTER converted_price,
            ADD COLUMN markup DECIMAL(15,2) NULL AFTER tks_total,
            ADD COLUMN response_time INT NULL AFTER markup
        `,
            korea: `
            ALTER TABLE korea 
            ADD COLUMN original_price DECIMAL(15,2) NULL AFTER CALC_UPDATED_AT,
            ADD COLUMN original_currency VARCHAR(10) NULL AFTER original_price,
            ADD COLUMN converted_price DECIMAL(15,2) NULL AFTER original_currency,
            ADD COLUMN tks_total DECIMAL(15,2) NULL AFTER converted_price,
            ADD COLUMN markup DECIMAL(15,2) NULL AFTER tks_total,
            ADD COLUMN response_time INT NULL AFTER markup
        `,
            china: `
            ALTER TABLE china 
            ADD COLUMN original_price DECIMAL(15,2) NULL AFTER CALC_UPDATED_AT,
            ADD COLUMN original_currency VARCHAR(10) NULL AFTER original_price,
            ADD COLUMN converted_price DECIMAL(15,2) NULL AFTER original_currency,
            ADD COLUMN tks_total DECIMAL(15,2) NULL AFTER converted_price,
            ADD COLUMN markup DECIMAL(15,2) NULL AFTER tks_total,
            ADD COLUMN response_time INT NULL AFTER markup
        `,
            bike: `
            ALTER TABLE bike 
            ADD COLUMN original_price DECIMAL(15,2) NULL AFTER CALC_UPDATED_AT,
            ADD COLUMN original_currency VARCHAR(10) NULL AFTER original_price,
            ADD COLUMN converted_price DECIMAL(15,2) NULL AFTER original_currency,
            ADD COLUMN tks_total DECIMAL(15,2) NULL AFTER converted_price,
            ADD COLUMN markup DECIMAL(15,2) NULL AFTER tks_total,
            ADD COLUMN response_time INT NULL AFTER markup
        `
        };

        for (const [tableName, sql] of Object.entries(alterQueries)) {
            try {
                await db.query(sql);
                console.log(`✅ Added calculation columns to ${tableName}`);
            } catch (error) {
                if (error.code === 'ER_DUP_FIELDNAME') {
                    console.log(`ℹ️ Columns already exist in ${tableName}`);
                } else {
                    console.error(`❌ Error adding columns to ${tableName}:`, error.message);
                }
            }
        }
    }

    // Обновим методы для возврата маппированных данных
    async getCarById(carId, table = 'main') {
        const sql = `SELECT * FROM ${table} WHERE ID = ? AND deleted = 0`;
        const rows = await db.query(sql, [carId]);
        const car = rows[0] || null;
        return car ? this.mapCarData(car) : null;
    }

    // Обновим методы для возврата маппированных данных
    async getCarPriceById(carId, table = 'main') {
        const sql = `SELECT CALC_RUB FROM ${table} WHERE ID = ?`;
        const rows = await db.query(sql, [carId]);
        const car = rows[0] || null;
        return car.CALC_RUB;
    }

    // Новый публичный метод: getDynamicFilters с кэшированием и фоновым обновлением
    async getDynamicFilters(currentFilters = {}, table = 'main') {
        try {
            // Нормализуем вход
            if (currentFilters.vendor) currentFilters.vendor = currentFilters.vendor.toString().toUpperCase();

            const cacheKey = this._makeDynamicCacheKey(currentFilters, table);
            const cached = this.dynamicFiltersCache[cacheKey];

            // Если кэш свежий (меньше 24 часо��), возвращаем его немедленно
            if (this._isFresh(cached, this.dynamicCacheTTL)) {
                return cached.data;
            }

            // Если кэш есть, но устарел — попробуем вернуть старый кэш и обновить в фоне
            if (cached) {
                // Триггерим фоновое обновление, но не ждём
                this._refreshDynamicCacheKey(cacheKey).catch(err => console.error('Background refresh failed:', err.message));
                return cached.data;
            }

            // Иначе вычисляем свежие фильтры и сохраняем в кэше
            const filters = await this._computeDynamicFilters(currentFilters, table);
            this.dynamicFiltersCache[cacheKey] = { data: filters, updatedAt: Date.now() };
            return filters;
        } catch (error) {
            console.error('Error getting dynamic filters (cached):', error.message);
            return this.getFallbackFilters(table);
        }
    }

    // Внутренняя функция вычисления фильтров (оригинальная логика с минимальными правками)
    async _computeDynamicFilters(currentFilters = {}, table = 'main') {
        try {
            let whereConditions = [
                'deleted = 0'
            ];
            const params = [];

            // Базовое условие - не удаленные записи (уже добавлено выше)

            // Получаем маппинг колонок для текущей таблицы
            const columns = this.tableColumns[table];

            // Базовые условия фильтрации (только для существующих колонок)
            const filterMap = {};
            if (columns.vendor_name) filterMap.vendor = `${columns.vendor_name} =`;
            if (columns.model_name) filterMap.model = `${columns.model_name} =`;
            if (columns.mileage) {
                filterMap.mileage_from = `CAST(REPLACE(${columns.mileage}, ",", "") AS UNSIGNED) >=`;
                filterMap.mileage_to = `CAST(REPLACE(${columns.mileage}, ",", "") AS UNSIGNED) <=`;
            }

            if(table !== 'bike') {
                whereConditions.push('(FINISH != 0 OR AVG_PRICE != 0)');
            } else {
                whereConditions.push('(START != 0 OR FINISH != 0)');
            }

            // Only calculated filter (есть во всех таблицах)
            if (currentFilters.only_calculated === 'true') {
                whereConditions.push('CALC_RUB IS NOT NULL');
            }

            // Применяем текущие фильтры (только для существующих колонок)
            for (const [key, value] of Object.entries(currentFilters)) {
                if (filterMap[key] && value !== undefined && value !== '' &&
                    key !== 'only_calculated' && key !== 'transmission_group') {
                    whereConditions.push(`${filterMap[key]} ?`);
                    params.push(value);
                }
            }

            const whereClause = whereConditions.length > 0 ?
                `WHERE ${whereConditions.join(' AND ')}` : '';

            // Получаем список брендов максимально быстро напрямую из БД
            const vendorRows = await this.getVendors(table); // [{vendor_id, vendor_name}]
            let allVendors = (vendorRows || []).map(v => v.vendor_name).filter(Boolean);

            // Fallback: если пусто, используем прежнюю логику (внешний сервис/локальная выборка)
            if (!allVendors || allVendors.length === 0) {
                // РАНЕЕ: пробуем внешнюю систему, затем локальную БД
                let extManuf = await this._fetchExternalManuf(table);
                if (!extManuf || extManuf.length === 0) {
                    let fromDb = await this.getAvailableVendors('WHERE deleted = 0', [], table);
                    // getAvailableVendors может вернуть строки или объекты — приводим к именам
                    if (Array.isArray(fromDb) && fromDb.length > 0 && typeof fromDb[0] === 'object') {
                        allVendors = fromDb.map(v => v.vendor_name || v.name || v.vendor_id).filter(Boolean);
                    } else {
                        allVendors = (fromDb || []).filter(Boolean);
                    }
                } else {
                    // external manuf -> array of {id,name} -> конвертируем в массив имён
                    allVendors = extManuf.map(v => v.name).filter(Boolean);
                }
            }

            // Сортируем вендоры по алфавиту, выбранный — первым
            let vendors = this.sortWithSelectedFirst(allVendors, currentFilters.vendor);

            // Получаем модели только если выбран вендор
            let models = [];
            if (currentFilters.vendor && columns.vendor_name && columns.model_name) {
                // Быстрый путь: найдём vendor_id по имени и возьмём модели по ID (индексированное поле)
                const matchedVendor = (vendorRows || []).find(v => (v.vendor_name || '').toUpperCase() === currentFilters.vendor.toUpperCase());
                if (matchedVendor && matchedVendor.vendor_id) {
                    const modelRows = await this.getModelsByVendor(matchedVendor.vendor_id, table);
                    models = (modelRows || []).map(m => m.model_name).filter(Boolean);
                } else {
                    // РАНЕЕ: статический список моделей по названию бренда
                    models = await this.getModelsForVendorStatic(currentFilters.vendor, table);
                }
                // Выбранная модель — первой
                models = this.sortWithSelectedFirst(models, currentFilters.model);
            }

            // Получаем остальные фильтры
            const [fuelTypes, transmissions, drives] = await Promise.all([
                columns.fuel_type ? this.getAvailableFuelTypes(whereClause, params, table) : Promise.resolve([]),
                columns.transmission ? this.getAvailableTransmissions(whereClause, params, table) : Promise.resolve([]),
                columns.drive ? this.getAvailableDrives(whereClause, params, table) : Promise.resolve([])
            ]);

            const { code, ...filtersWithoutCode } = currentFilters;

            return {
                vendors,
                models,
                fuel_types: fuelTypes, // Показываем все типы топлива
                transmissions: columns.transmission ?
                    this.groupTransmissions(transmissions) : {}, // Показываем все трансмиссии
                drives: columns.drive ?
                    this.groupDrives(drives) : {}, // Показываем все приводы
                current_filters: filtersWithoutCode,
                table_support: {
                    has_fuel_filter: !!columns.fuel_type,
                    has_transmission_filter: !!columns.transmission,
                    has_drive_filter: !!columns.drive
                }
            };
        } catch (error) {
            console.error('Error getting dynamic filters:', error.message);
            return this.getFallbackFilters(table);
        }
    }

    // Новая вспомогательная функция для сортировки с выбранным элементом первым
    sortWithSelectedFirst(items, selectedValue) {
        if (!items || items.length === 0) return [];

        // Фильтруем и преобразуем все элементы в строки
        const stringItems = items
            .filter(item => item != null) // убираем null и undefined
            .map(item => String(item))    // преобразуем все в строки
            .filter(item => item.trim() !== ''); // убираем пустые строки

        // Убираем дубликаты
        const uniqueItems = [...new Set(stringItems)];

        if (!selectedValue) {
            // Если ничего не выбрано, просто сортируем по алфавиту
            return uniqueItems.sort((a, b) => a.localeCompare(b));
        }

        // Преобразуем selectedValue в строку для сравнения
        const selectedValueStr = String(selectedValue);

        // Находим выбранный элемент
        const selectedItem = uniqueItems.find(item => item === selectedValueStr);

        if (!selectedItem) {
            // Если выбранного элемента нет в списке, просто сортируем
            return uniqueItems.sort((a, b) => a.localeCompare(b));
        }

        // Фильтруем остальны�� элементы и сортируем их
        const otherItems = uniqueItems
            .filter(item => item !== selectedValueStr)
            .sort((a, b) => a.localeCompare(b));

        // Возвращаем: выбранный + отсортированные остальные
        return [selectedItem, ...otherItems];
    }

    // Обновим методы для работы с конкретными колонками
    async getAvailableVendors(whereClause, params, table) {
        const columns = this.tableColumns[table];
        if (!columns.vendor_name) return [];

        const sql = `
        SELECT DISTINCT ${columns.vendor_name} as name 
        FROM ${table} 
        ${whereClause}
        AND ${columns.vendor_name} IS NOT NULL 
        AND ${columns.vendor_name} != ''
        ORDER BY ${columns.vendor_name}
    `;

        try {
            const rows = await db.query(sql, params);
            return rows.map(row => row.name);
        } catch (error) {
            console.error('Error getting vendors:', error.message);
            return [];
        }
    }

    // Новый метод: получить модели статично (зависят только от марки) — сначала пробуем внешний сервис
    async getModelsForVendorStatic(vendorName, table = 'main') {
        if (!vendorName) return [];

        // Попытаемся получить внешние данные
        try {
            const manuf = await this._fetchExternalManuf(table); // [{id,name}]
            const models = await this._fetchExternalModels(table); // [{marka_id,model_id,name}]

            if (manuf && manuf.length > 0 && models && models.length > 0) {
                // Найдём ID марки по имени (case-insensitive)
                const vendorObj = manuf.find(m => m.name && m.name.toString().toUpperCase() === vendorName.toString().toUpperCase());
                if (vendorObj) {
                    const markaId = vendorObj.id;
                    const filtered = models.filter(m => m.marka_id === markaId).map(m => m.name).filter(Boolean);
                    if (filtered.length > 0) return filtered;
                    // если нет моделей — продолжим к локальной БД
                }
            }
        } catch (err) {
            console.error('Error using external models for vendor:', err.message);
        }

        // Fallback: локальная БД — только по марке, без учёта других текущих фильтров
        try {
            const sql = `
            SELECT DISTINCT MODEL_ID as id, MODEL_NAME as name 
            FROM ${table} 
            WHERE deleted = 0
            AND MARKA_NAME = ?
            AND MODEL_ID IS NOT NULL AND MODEL_NAME IS NOT NULL
            ORDER BY MODEL_NAME
        `;
            const rows = await db.query(sql, [vendorName]);
            return rows.map(r => r.name);
        } catch (error) {
            console.error('Error getting static models from DB:', error.message);
            return [];
        }
    }

    // Метод для получения доступных моделей для выбранного вендора (старый — оставляем для совместимости)
    async getAvailableModels(vendorName, whereClause, params, table) {
        const vendorColumn = this.getColumnName(table, 'vendor_name');
        const modelColumn = this.getColumnName(table, 'model_name');
        const modelIdColumn = this.getColumnName(table, 'model_id');

        if (!vendorColumn || !modelColumn || !modelIdColumn) return [];

        const sql = `
            SELECT DISTINCT ${modelIdColumn} as id, ${modelColumn} as name 
            FROM ${table} 
            ${whereClause}
            AND ${vendorColumn} = ?
            AND ${modelIdColumn} IS NOT NULL AND ${modelColumn} IS NOT NULL
            ORDER BY ${modelColumn}
        `;
        return await db.query(sql, [...params, vendorName]);
    }

    // Метод для получения доступных типов топлива
    async getAvailableFuelTypes(whereClause, params, table) {
        const fuelColumn = this.getColumnName(table, 'fuel_type');
        if (!fuelColumn) return [];

        // Убираем обязательное условие CALC_RUB для получения всех типов топлива
        const sql = `
            SELECT DISTINCT ${fuelColumn} as code, COUNT(*) as count
            FROM ${table}
                ${whereClause}
                AND ${fuelColumn} IS NOT NULL
            GROUP BY ${fuelColumn}
            ORDER BY count DESC
        `;

        const results = await db.query(sql, params);

        // Создаем полный список всех возможных типов топлива
        const availableFuelTypes = this.fuelTypes.map(fuelType => {
            const found = results.find(r => r.code === fuelType.code);
            return {
                ...fuelType,
                count: found ? found.count : 0
            };
        });

        // Добавляем неизвестные типы топлива из результатов
        results.forEach(row => {
            if (!this.fuelTypes.find(ft => ft.code === row.code)) {
                availableFuelTypes.push({
                    code: row.code,
                    name: `Неизвестно (${row.code})`,
                    tks_type: 'petrol',
                    count: row.count
                });
            }
        });

        return availableFuelTypes;
    }

    // Метод для получения доступных трансмиссий
    async getAvailableTransmissions(whereClause, params, table) {
        const transmissionColumn = this.getColumnName(table, 'transmission');
        if (!transmissionColumn) return [];

        const sql = `
            SELECT DISTINCT ${transmissionColumn} as code, COUNT(*) as count
            FROM ${table} 
            ${whereClause}
            AND ${transmissionColumn} IS NOT NULL AND ${transmissionColumn} != ''
            GROUP BY ${transmissionColumn}
            ORDER BY count DESC
        `;
        return await db.query(sql, params);
    }

    // Метод для получения доступных приводов
    async getAvailableDrives(whereClause, params, table) {
        const driveColumn = this.getColumnName(table, 'drive');
        if (!driveColumn) return [];

        const sql = `
            SELECT DISTINCT ${driveColumn} as code, COUNT(*) as count
            FROM ${table} 
            ${whereClause}
            AND ${driveColumn} IS NOT NULL AND ${driveColumn} != ''
            GROUP BY ${driveColumn}
            ORDER BY count DESC
        `;
        return await db.query(sql, params);
    }

    // Группировка трансмиссий
    groupTransmissions(transmissions) {
        const groups = {
            automatic: { name: 'Автоматическая', count: 0 },
            manual: { name: 'Механическая', count: 0 },
            cvt: { name: 'Вариатор (CVT)', count: 0 },
            hybrid: { name: 'Гибридная', count: 0 },
            sequential: { name: 'Секвентальная', count: 0 },
            other: { name: 'Другое', count: 0 }
        };

        transmissions.forEach(trans => {
            const category = this.getTransmissionCategory(trans.code);
            if (groups[category]) {
                groups[category].count += trans.count || 0;
            }
        });

        return groups;
    }

    // Группировка приводов (аналогично можно сделать)
    groupDrives(drives) {
        const groups = {
            fwd: { name: 'Передний привод', count: 0 },
            rwd: { name: 'Задний привод', count: 0 },
            awd: { name: 'Полный привод', count: 0 },
            other: { name: 'Другое', count: 0 }
        };

        drives.forEach(drive => {
            const group = this.getDriveGroup(drive.code);
            if (groups[group]) {
                groups[group].count += drive.count || 0;
            }
        });

        return groups;
    }

    getDriveGroup(driveCode) {
        if (!driveCode) return 'other';

        const normalizedDrive = driveCode.toUpperCase();

        if (normalizedDrive.includes('FWD') || normalizedDrive.includes('FF')) return 'fwd';
        if (normalizedDrive.includes('RWD') || normalizedDrive.includes('FR') || normalizedDrive.includes('RR')) return 'rwd';
        if (normalizedDrive.includes('AWD') || normalizedDrive.includes('4WD') || normalizedDrive.includes('4X4')) return 'awd';

        return 'other';
    }

    // Убираем фильтрацию - показываем все группы и ��лементы
    // filterNonEmptyGroups и filterNonEmptyItems больше не используются
    // Все фильтры показываются независимо от count

// Также обновим getFallbackFilters для соответствия
    getFallbackFilters(table) {
        const columns = this.tableColumns[table];

        return {
            vendors: [],
            models: [],
            fuel_types: columns.fuel_type ? this.fuelTypes.map(ft => ({ ...ft, count: 0 })) : [],
            transmissions: {
                automatic: { name: 'Автоматическая', count: 0 },
                manual: { name: 'Механическая', count: 0 },
                cvt: { name: 'Вариатор (CVT)', count: 0 },
                hybrid: { name: 'Гибридная', count: 0 },
                sequential: { name: 'Секвентальная', count: 0 },
                other: { name: 'Другое', count: 0 }
            },
            drives: {
                fwd: { name: 'Передний привод', count: 0 },
                rwd: { name: 'Задний привод', count: 0 },
                awd: { name: 'Полный привод', count: 0 },
                other: { name: 'Другое', count: 0 }
            },
            current_filters: {},
            table_support: {
                has_fuel_filter: !!columns.fuel_type,
                has_transmission_filter: !!columns.transmission,
                has_drive_filter: !!columns.drive
            }
        };
    }

    getFuelCodesByTksType(tksType) {
        const fuelMap = {
            'petrol': ['G', 'L', 'C', ''],
            'diesel': ['D'],
            'petrol_electric': ['H', 'P'],
            'diesel_electric': ['&'],
            'electric': ['E']
        };
        return fuelMap[tksType] || [];
    }

    getTransmissionsByGroup(group) {
        const groupMap = {
            'automatic': ['AT', 'SAT', 'FAT', 'DAT', 'A', 'F', 'FM', 'IAT'],
            'manual': ['MT', 'FMT', 'M'],
            'cvt': ['CVT', 'C', 'CA', 'CAT', 'C3', 'C5', 'C6'],
            'hybrid': ['HL', 'HL5', 'HL6', 'HL8', 'HL9', 'H'],
            'sequential': ['SQ', 'SEQ'],
            'other': ['OTHER', '-', '...', '..S']
        };
        return groupMap[group] || [];
    }

    getDriveCodesByGroup(driveGroup) {
        const driveMap = {
            'fwd': ['FWD', 'FF', '2WD'],
            'rwd': ['RWD', 'FR', 'RR'],
            'awd': ['AWD', '4WD', '4X4', 'FULLTIME4WD'],
            'other': [] // Для 'other' возвращаем пустой массив или обрабатываем отдельно
        };

        return driveMap[driveGroup] || [];
    }

    async getCarsByFilter(filters = {}, table = 'main', limit = 100, offset = 0) {
        let whereConditions = [
            'deleted = 0'
        ];
        let params = [];

        // Получаем маппинг колонок для текущей таблицы
        const columns = this.tableColumns[table];

        // Динамическое построение условий WHERE
        const filterMap = {};

        // Базовые фильтры (есть во всех таблицах)
        filterMap.year_from = 'YEAR >=';
        filterMap.year_to = 'YEAR <=';
        filterMap.price_from = 'CALC_RUB >=';
        filterMap.price_to = 'CALC_RUB <=';
        filterMap.engine_from = 'ENG_V >=';
        filterMap.engine_to = 'ENG_V <=';

        // Таблично-специфичные фильтры (только если колонки существуют)
        if (columns.vendor_name) filterMap.vendor = `${columns.vendor_name} =`;
        if (columns.model_name) filterMap.model = `${columns.model_name} =`;
        if (columns.mileage) {
            filterMap.mileage_from = `CAST(REPLACE(${columns.mileage}, ",", "") AS UNSIGNED) >=`;
            filterMap.mileage_to = `CAST(REPLACE(${columns.mileage}, ",", "") AS UNSIGNED) <=`;
        }
        if (columns.fuel_type) filterMap.fuel_type = `${columns.fuel_type} =`;
        if (columns.transmission) filterMap.transmission = `${columns.transmission} =`;
        if (columns.drive) filterMap.drive = `${columns.drive} =`;

        // Фильтр only_calculated
        if (filters.only_calculated === 'true') {
            whereConditions.push('CALC_RUB IS NOT NULL');
        }

        if(table !== 'bike') {
            whereConditions.push('(FINISH != 0 OR AVG_PRICE != 0)');
        } else {
            whereConditions.push('(START != 0 OR FINISH != 0)');
        }

        // Обрабатываем специальные случаи фильтрации
        for (const [key, value] of Object.entries(filters)) {
            if (value === undefined || value === '') continue;

            if (this.isSpecialFilter(key)) {
                this.processSpecialFilter(key, value, whereConditions, params, columns);
            } else if (filterMap[key]) {
                whereConditions.push(`${filterMap[key]} ?`);
                params.push(value);
            }
        }

        const whereClause = whereConditions.length > 0 ?
            `WHERE ${whereConditions.join(' AND ')}` : '';

    //     const sql = `
    //     SELECT * FROM ${table}
    //     ${whereClause}
    //     ORDER BY created_at DESC
    //     LIMIT ? OFFSET ?
    // `;

        // Определяем приоритет сортировки по типу топлива
        let orderByClause = 'created_at DESC';
        if (columns.fuel_type) {
            orderByClause = `
            CASE 
                WHEN ${columns.fuel_type} IN ('G', 'L', 'C') THEN 1
                WHEN ${columns.fuel_type} = 'D' THEN 2
                WHEN ${columns.fuel_type} IN ('H', 'P') THEN 3
                WHEN ${columns.fuel_type} = '&' THEN 4
                WHEN ${columns.fuel_type} = 'E' THEN 5
                WHEN ${columns.fuel_type} = '' THEN 6
                ELSE 7
            END,
            ${orderByClause}
        `;
        }

        const sql = `
        SELECT * FROM ${table}
        ${whereClause}
        ORDER BY ${orderByClause}
        LIMIT ? OFFSET ?
    `;

        // Убедимся в числовых значениях лимита и оффсета
        const lim = Number.isFinite(Number(limit)) ? parseInt(limit) : 0;
        const off = Number.isFinite(Number(offset)) ? parseInt(offset) : 0;

        params.push(lim, off);

        // Добавим детальные логи для дебага (временное, можно закомментировать позже)
        console.log('getCarsByFilter: table=', table, 'filters=', filters);
        console.log('getCarsByFilter: WHERE clause=', whereClause);
        console.log('getCarsByFilter: SQL=', sql);
        console.log('getCarsByFilter: params=', params);

        try {
            const rows = await db.query(sql, params);
            console.log('getCarsByFilter: rows returned=', rows.length);
            return rows.map(car => this.mapCarData(car));
        } catch (error) {
            console.error('Error in getCarsByFilter:', error.message);
            console.error('SQL:', sql);
            console.error('Params:', params);
            return [];
        }
    }

    // Метод для получения вендоров и моделей
    async getVendorsAndModels(table = 'main') {
        try {
            // Получаем уникальные вендоры
            const vendorsSql = `
                SELECT DISTINCT MARKA_ID, MARKA_NAME 
                FROM ${table} 
                WHERE deleted = 0 AND MARKA_ID IS NOT NULL AND MARKA_NAME IS NOT NULL
                ORDER BY MARKA_NAME
            `;

            const vendors = await db.query(vendorsSql);

            // Для каждого вендора получаем модели
            const result = [];

            for (const vendor of vendors) {
                const modelsSql = `
                    SELECT DISTINCT MODEL_ID, MODEL_NAME 
                    FROM ${table} 
                    WHERE deleted = 0 
                    AND MARKA_ID = ? 
                    AND MODEL_ID IS NOT NULL 
                    AND MODEL_NAME IS NOT NULL
                    ORDER BY MODEL_NAME
                `;

                const models = await db.query(modelsSql, [vendor.MARKA_ID]);

                result.push({
                    vendor_id: vendor.MARKA_ID,
                    vendor_name: vendor.MARKA_NAME,
                    models: models.map(model => ({
                        model_id: model.MODEL_ID,
                        model_name: model.MODEL_NAME
                    }))
                });
            }

            return result;
        } catch (error) {
            console.error('Error getting vendors and models:', error.message);
            return [];
        }
    }

    // Метод для получения только вендоров
    async getVendors(table = 'main') {
        try {
            const sql = `
                SELECT DISTINCT MARKA_ID as vendor_id, MARKA_NAME as vendor_name 
                FROM ${table} 
                WHERE deleted = 0 AND MARKA_ID IS NOT NULL AND MARKA_NAME IS NOT NULL
                ORDER BY MARKA_NAME
            `;

            return await db.query(sql);
        } catch (error) {
            console.error('Error getting vendors:', error.message);
            return [];
        }
    }

    // Метод для получения моделей конкретного вендора
    async getModelsByVendor(vendorId, table = 'main') {
        try {
            const sql = `
                SELECT DISTINCT MODEL_ID as model_id, MODEL_NAME as model_name 
                FROM ${table} 
                WHERE deleted = 0 
                AND MARKA_ID = ? 
                AND MODEL_ID IS NOT NULL 
                AND MODEL_NAME IS NOT NULL
                ORDER BY MODEL_NAME
            `;

            return await db.query(sql, [vendorId]);
        } catch (error) {
            console.error('Error getting models by vendor:', error.message);
            return [];
        }
    }

    // Обновим getAvailableFilters
    async getAvailableFilters(table = 'main') {
        try {
            return {
                fuel_types: this.fuelTypes.map(fuel => ({
                    code: fuel.code,
                    name: fuel.name,
                    type: fuel.tks_type,
                    count: 0
                })),
                transmissions: {
                    automatic: { name: 'Автоматическая', count: 0 },
                    manual: { name: 'Механическая', count: 0 },
                    cvt: { name: 'Вариатор (CVT)', count: 0 },
                    hybrid: { name: 'Гибридная', count: 0 },
                    sequential: { name: 'Секвентальная', count: 0 },
                    other: { name: 'Другое', count: 0 }
                },
                drives: {
                    fwd: { name: 'Передний привод', count: 0 },
                    rwd: { name: 'Задний привод', count: 0 },
                    awd: { name: 'Полный привод', count: 0 },
                    other: { name: 'Другое', count: 0 }
                }
            };
        } catch (error) {
            console.error('Error getting available filters:', error.message);
            return {
                fuel_types: this.fuelTypes.map(fuel => ({
                    code: fuel.code,
                    name: fuel.name,
                    type: fuel.tks_type,
                    count: 0
                })),
                transmissions: {
                    automatic: { name: 'Автоматическая', count: 0 },
                    manual: { name: 'Механическая', count: 0 },
                    cvt: { name: 'Вариатор (CVT)', count: 0 },
                    hybrid: { name: 'Гибридная', count: 0 },
                    sequential: { name: 'Секвентальная', count: 0 },
                    other: { name: 'Другое', count: 0 }
                },
                drives: {
                    fwd: { name: 'Передний привод', count: 0 },
                    rwd: { name: 'Задний привод', count: 0 },
                    awd: { name: 'Полный привод', count: 0 },
                    other: { name: 'Другое', count: 0 }
                }
            };
        }
    }

    async updateCarPrice(carId, priceCalc, calcRub, table = 'main', additionalData = {}) {
        const sql = `
            UPDATE ${table}
            SET PRICE_CALC = ?,
                CALC_RUB = ?,
                CALC_UPDATED_AT = NOW(),
                ${Object.keys(additionalData).map(key => `${key} = ?`).join(', ')}
            WHERE ID = ?
        `;

        const params = [priceCalc, calcRub, ...Object.values(additionalData), carId];
        await db.query(sql, params);
    }

    async insertOrUpdateCar(carData, table) {
        try {
            // Убираем поля которые могут вызвать конфликты
            const { created_at, updated_at, deleted, PRICE_CALC, CALC_RUB, CALC_UPDATED_AT, ...cleanData } = carData;

            const fields = Object.keys(cleanData).join(', ');
            const values = Object.values(cleanData);
            const placeholders = Object.keys(cleanData).map(() => '?').join(', ');

            // Обновляем только основные поля, но сохраняем расчетные
            const updateSet = Object.keys(cleanData)
                .filter(key => !['ID'].includes(key))
                .map(key => `${key} = VALUES(${key})`)
                .join(', ');

            const sql = `
                INSERT INTO ${table} (${fields}, deleted, deleted_at)
                VALUES (${placeholders}, 0, NULL)
                    ON DUPLICATE KEY UPDATE
                                         ${updateSet},
                                         updated_at = CURRENT_TIMESTAMP,
                                         deleted = 0,
                                         deleted_at = NULL
            `;

            await db.query(sql, values);
        } catch (error) {
            console.error(`❌ Error inserting/updating car in ${table}:`, error.message);
            throw error;
        }
    }

    async bulkInsertOrUpdate(table, records) {
        if (!records || records.length === 0) {
            return { processed: 0, errors: 0 };
        }

        let processed = 0;
        let errors = 0;

        // Используем bulk operation из database
        try {
            const result = await db.bulkOperation(table, records, 50); // 50 записей за раз
            return result;
        } catch (error) {
            console.error(`❌ Bulk operation failed for ${table}:`, error.message);

            // Fallback: обрабатываем записи по одной
            console.log(`🔄 Falling back to individual record processing...`);

            for (const record of records) {
                try {
                    await this.insertOrUpdateCar(record, table);
                    processed++;
                } catch (recordError) {
                    errors++;
                    console.error(`❌ Error processing record ${record.ID}:`, recordError.message);
                }
            }

            return { processed, errors };
        }
    }

    // Получить все локальные ID (включая deleted=0 только)
    async getLocalIds(table = 'main') {
        try {
            const sql = `SELECT ID FROM ${table} WHERE deleted = 0`;
            const rows = await db.query(sql);
            return rows.map(r => r.ID);
        } catch (error) {
            console.error('Error getting local IDs:', error.message);
            return [];
        }
    }

    // Вставлять только новые записи, не трогая существующие
    async bulkInsertIfNotExists(table, records, batchSize = 100) {
        if (!records || records.length === 0) return { processed: 0 };

        let processed = 0;

        // Разбиваем на батчи
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);

            // Собираем набор всех полей в батче
            const allKeys = Array.from(new Set(batch.flatMap(r => Object.keys(r))));

            // Убираем служебные поля, которы�� не должны быть вставлены, если их нет в данных
            // Но оставим ID и все прочие поля. Добавим столбцы deleted и deleted_at
            const fields = [...allKeys, 'deleted', 'deleted_at'];

            const placeholders = batch.map(() => `(${fields.map(() => '?').join(',')})`).join(',');
            const sql = `INSERT IGNORE INTO ${table} (${fields.join(',')}) VALUES ${placeholders}`;

            // Подготавливаем значения: для каждого record берем значение по allKeys, либо NULL
            const values = [];
            for (const rec of batch) {
                for (const key of allKeys) {
                    values.push(rec.hasOwnProperty(key) ? rec[key] : null);
                }
                values.push(0, null); // deleted = 0, deleted_at = NULL
            }

            try {
                const result = await db.query(sql, values);
                // В mysql2 результат для INSERT содержит affectedRows
                processed += result.affectedRows || 0;
            } catch (error) {
                console.error(`Error inserting batch into ${table}:`, error.message);
            }
        }

        return { processed };
    }

    // Пометить перечисленные ID как deleted = 1
    /*
    async markIdsDeleted(table = 'main', ids = []) {
        if (!ids || ids.length === 0) return { affected: 0 };

        const placeholders = ids.map(() => '?').join(',');
        const sql = `UPDATE ${table} SET deleted = 1, deleted_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE ID IN (${placeholders})`;
        try {
            const result = await db.query(sql, ids);
            return { affected: result.affectedRows || 0 };
        } catch (error) {
            console.error('Error marking IDs as deleted:', error.message);
            return { affected: 0 };
        }
    }
    */
    async markIdsDeleted(table = 'main', ids = []) {
        if (!ids || ids.length === 0) {
            console.log(`ℹ️ No IDs to mark as deleted in ${table}`);
            return { affected: 0 };
        }
        
        console.log(`🔄 Marking ${ids.length} records as deleted in ${table}...`);
        
        const batchSize = 1000;
        let totalAffected = 0;

        for (let i = 0; i < ids.length; i += batchSize) {
            const batchIds = ids.slice(i, i + batchSize);
            const placeholders = batchIds.map(() => '?').join(',');
            
            const sql = `UPDATE ${table} SET deleted = 1, updated_at = NOW() WHERE ID IN (${placeholders})`;
            
            try {
                // Просто логируем что происходит
                console.log(`📝 Executing SQL for batch ${Math.floor(i/batchSize) + 1} with ${batchIds.length} IDs`);
                
                const result = await db.query(sql, batchIds);
                console.log(`📊 Raw result:`, JSON.stringify(result).slice(0, 200));
                
                // Простая проверка результата
                let affected = 0;
                if (result && typeof result === 'object') {
                    if (result.affectedRows !== undefined) {
                        affected = result.affectedRows;
                    } else if (Array.isArray(result) && result[0] && result[0].affectedRows !== undefined) {
                        affected = result[0].affectedRows;
                    }
                }
                
                totalAffected += affected;
                console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: ${affected} records marked`);
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Error in batch ${Math.floor(i/batchSize) + 1}:`, error.message);
                // Продолжаем с другими батчами
            }
        }

        console.log(`🎯 Total marked as deleted in ${table}: ${totalAffected}`);
        return { affected: totalAffected };
    }

    // Оптимизировать таблицу и проанализировать индексы
    async optimizeTable(table = 'main') {
        try {
            console.log(`DB: Optimizing table ${table}...`);
            // OPTIMIZE и ANALYZE - безопасно обёрнуты в try/catch
            await db.query(`OPTIMIZE TABLE ${table}`);
            await db.query(`ANALYZE TABLE ${table}`);
            console.log(`DB: Optimization complete for ${table}`);
            return true;
        } catch (error) {
            console.error(`DB: Failed to optimize/analyze ${table}:`, error.message);
            return false;
        }
    }

    async getCarsForCalculation(table, limit = 0, hoursOld = 24, offset = 0) {
        let sql = `
            SELECT * FROM ${table}
            WHERE deleted = 0
              AND (CALC_UPDATED_AT IS NULL OR CALC_UPDATED_AT < DATE_SUB(NOW(), INTERVAL ? HOUR))
            ORDER BY CALC_UPDATED_AT ASC
        `;

        const params = [hoursOld];

        if (limit > 0) {
            sql += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
        } else if (offset > 0) {
            // If offset provided without limit, still apply offset with large limit to be safe
            sql += ' LIMIT 18446744073709551615 OFFSET ?';
            params.push(offset);
        }

        return await db.query(sql, params);
    }

    async getPriceRange(table, filters = {}) {
        let whereConditions = [
            'deleted = 0',
        ];
        let params = [];

        const columns = this.tableColumns[table];
        const filterMap = {
            vendor: 'MARKA_NAME =',
            model: 'MODEL_NAME =',
            year_from: 'YEAR >=',
            year_to: 'YEAR <=',
            price_from: 'CALC_RUB >=',
            price_to: 'CALC_RUB <=',
            engine_from: 'ENG_V >=',
            engine_to: 'ENG_V <=',
            // Новые фильтры
            mileage_from: 'CAST(REPLACE(MILEAGE, ",", "") AS UNSIGNED) >=',
            mileage_to: 'CAST(REPLACE(MILEAGE, ",", "") AS UNSIGNED) <=',
            transmission: 'KPP =',
            fuel_type: 'TIME =',
            drive: 'PRIV =' // Фильтр по приводу
        };

        for (const [key, value] of Object.entries(filters)) {
            if (value === undefined || value === '') continue;

            if (this.isSpecialFilter(key)) {
                this.processSpecialFilter(key, value, whereConditions, params, columns);
            } else if (filterMap[key]) {
                whereConditions.push(`${filterMap[key]} ?`);
                params.push(value);
            }
        }

        if (filters.only_calculated === 'true') {
            whereConditions.push('CALC_RUB IS NOT NULL');
        }

        if(table !== 'bike') {
            whereConditions.push('(FINISH != 0 OR AVG_PRICE != 0)');
        } else {
            whereConditions.push('(START != 0 OR FINISH != 0)');
        }

        const whereClause = whereConditions.length > 0 ?
            `WHERE ${whereConditions.join(' AND ')}` : '';

        const sql = `
            SELECT
                MIN(CALC_RUB) as min_price,
                MAX(CALC_RUB) as max_price,
                COUNT(*) as total_count
            FROM ${table}
                     ${whereClause}
        `;

        try {
            const rows = await db.query(sql, params);
            return rows[0] || { min_price: 0, max_price: 0, total_count: 0 };
        } catch (error) {
            console.error('Error in getPriceRange:', error.message);
            console.error('SQL:', sql);
            console.error('Params:', params);
            return { min_price: 0, max_price: 0, total_count: 0 };
        }
    }

    // Добавьте эти методы в класс:
    isSpecialFilter(key) {
        return ['transmission_group', 'drive'].includes(key);
    }

    processSpecialFilter(key, value, whereConditions, params, columns) {
        switch (key) {
            case 'fuel_type':
                if (columns.fuel_type) {
                    const fuelCodes = this.getFuelCodesByTksType(value);
                    if (fuelCodes.length > 0) {
                        whereConditions.push(`${columns.fuel_type} IN (${fuelCodes.map(() => '?').join(',')})`);
                        params.push(...fuelCodes);
                    }
                }
                break;

            case 'transmission_group':
                if (columns.transmission) {
                    const groupTransmissions = this.getTransmissionsByGroup(value);
                    if (groupTransmissions.length > 0) {
                        whereConditions.push(`${columns.transmission} IN (${groupTransmissions.map(() => '?').join(',')})`);
                        params.push(...groupTransmissions);
                    }
                }
                break;

            case 'drive':
                if (columns.drive) {
                    const driveCodes = this.getDriveCodesByGroup(value);
                    if (driveCodes.length > 0) {
                        whereConditions.push(`${columns.drive} IN (${driveCodes.map(() => '?').join(',')})`);
                        params.push(...driveCodes);
                    }
                }
                break;
        }
    }

    async getTotalCount(table) {
        const sql = `SELECT COUNT(*) as count FROM ${table} WHERE deleted = 0`;
        const rows = await db.query(sql);
        return rows[0]?.count || 0;
    }

    async markAllAsDeleted(table) {
        const sql = `UPDATE ${table} SET deleted = 1, deleted_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE deleted = 0`;
        await db.query(sql);
    }

    async cleanupDeleted(table, olderThanHours = 1) {
        try {
            const hours = Number.isFinite(Number(olderThanHours)) ? parseInt(olderThanHours) : 1;
            const sql = `DELETE FROM ${table} WHERE deleted = 1 AND deleted_at < DATE_SUB(NOW(), INTERVAL ${hours} HOUR)`;
            const result = await db.query(sql);
            return result.affectedRows || 0;
        } catch (error) {
            console.error(`Error cleaning up deleted records for ${table}:`, error.message);
            return 0;
        }
    }

    // Метод для получения основной категории трансмиссии
    getTransmissionCategory(transmissionCode) {
        const code = transmissionCode ? transmissionCode.trim().toUpperCase() : '';
        return this.transmissionMapping[code] || 'other';
    }
}

module.exports = new CarModel();
