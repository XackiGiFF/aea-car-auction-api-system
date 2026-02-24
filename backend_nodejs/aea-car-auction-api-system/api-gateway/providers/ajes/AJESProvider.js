const axios = require('axios');
const BaseProvider = require('../BaseProvider');
const AJESMapper = require('./AJESMapper');

class AJESProvider extends BaseProvider {
    constructor() {
        super();
        this.name = 'ajes';
        this.mapper = AJESMapper;

        // Настройки API
        this.apiBase = process.env.API_BASE_URL;
        this.apiCode = process.env.API_CODE;

        // Маппинг колонок
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
                fuel_type: null,
                transmission: null,
                drive: null,
                mileage: 'MILEAGE'
            }
        };

        // === СЛОВАРЬ ПОИСКА (Фронтенд -> Коды БД AJES) ===
        this.searchMappings = {
            fuel: {
                'diesel': ['D'],
                'petrol': ['G', 'P'],
                'gas': ['L', 'C'],
                'hybrid': ['&', 'H', 'HE'], // & - дизель гибрид, P - плагин
                'electric': ['E'],
                'other': ['O', '&']
            },
            transmission: {
                // Группа AUTOMATIC (включает роботы и "прочее", как было в вашей старой логике)
                'automatic': [
                    // Стандартные и новые из дампа
                    'AT', 'A', 'Auto', 'OA',
                    // Floor (Напольные)
                    'FAT', 'FA', '4FAT', '5FAT', '7FAT', '3FAT',
                    // Dash / Instrument (На торпеде)
                    'DAT', 'DA', 'IAT', 'IA', '6DAT', '5DAT', '4DAT',
                    // Tiptronic / Semi / Paddle
                    'SAT', 'SEMIAT', 'PAT', '6X2', '8X2',
                    // Роботы (DCT/DSG были в automatic в старом конфиге)
                    'DCT', 'DSG', 'PDK', '6D',
                    // Явные указания скоростей автоматов
                    '4AT', '5AT', '6AT', '7AT', '8AT', '9AT', '3AT',
                    // Неопределенные и "Другое" (маппим на автомат по старой логике)
                    '-', '...', '..S', '7..', 'F', 'FM', '??', 'X',
                    //'その他', '기타', // Иероглифы "Прочее"
                    '&#12381;&#12398;&#20182;', '&#65401;&#65438;&#65437;&#65404;', '&#65412;&#65400;&#65404;&#65389;' // HTML-сущности
                ],

                // Группа MANUAL
                'manual': [
                    // Стандартные
                    'MT', 'M', 'FMT', 'IMT', 'DMT',
                    // С указанием скоростей
                    '5MT', '6MT', '7MT', '4MT',
                    // Коды "F + цифра" (Floor Manual) из дампа
                    'F5', 'F6', 'F4', 'F7', 'F9', '5F', '6F',
                    // Коды "I + цифра" (Instrument Manual) из дампа
                    'I5', 'I6', 'I7',
                    // HTML-сущности
                    '&#65407;&#65417;&#65408;'
                ],

                // Группа CVT (Включает C, CA, CAT, C3-C6 согласно вашей старой логике)
                'cvt': [
                    'CVT', 'FCVT', 'DCVT', 'CCVT', 'AC',
                    'CVT7', 'CVT8', 'VC',
                    // Спорные коды, которые просили отнести к вариаторам
                    'C',
                    'CA', 'CAT', // Column Auto -> CVT (по вашей логике)
                    'C3', 'C4', 'C5', 'C6' // Column Manual/Auto -> CVT (по вашей логике)
                ],

                // Группа HYBRID (Коды HL)
                'hybrid': [
                    'HL', 'HL5', 'HL6', 'HL8', 'HL9', 'H'
                ],

                // Группа SEQUENTIAL
                'sequential': [
                    'SQ', 'SEQ'
                ]
            },
            drive: {
                'awd': [
                    '4WD',
                    'AWD',
                    'FULLTIME4WD',
                    'PARTTIME4WD',
                    'FF,FULLTIME4WD',
                    'FR,PARTTIME4WD',
                    'FULLTIME4WD,PARTTIME',
                    'FR,FULLTIME4WD,PARTT',
                    'FR,FULLTIME4WD',
                    'FULLTIME4WD,RR',
                    'FULLTIME4WD,MIDSHIP'],
                'fwd': [
                    'FF',
                    'FWD',
                    'FF,FULLTIME4WD'],
                'rwd': [
                    'FR',
                    'RWD',
                    'RR',
                    'FR,PARTTIME4WD',
                    'MIDSHIP',
                    'FR,FULLTIME4WD',
                    'FULLTIME4WD,RR',
                    'FULLTIME4WD,MIDSHIP']
            }
        };

        // Внешние эндпоинты
        this.externalEndpoints = {
            main: { manuf: '/manuf', model: '/model' },
            korea: { manuf: '/manuf_kr', model: '/model_kr' },
            china: { manuf: '/manuf_che', model: '/model_che' },
            bike: { manuf: '/manuf_bike', model: '/model_bike' }
        };
        this.externalHost = 'http://87.242.72.57';
        this.externalCache = {};
        this.externalCacheTTL = 30 * 60 * 1000;
        this.dynamicFiltersCacheTTL = (() => {
            const parsed = Number.parseInt(process.env.AJES_DYNAMIC_FILTERS_CACHE_TTL_MS || '60000', 10);
            return Number.isInteger(parsed) && parsed >= 0 ? parsed : 60000;
        })();
        this.debugSql = process.env.AJES_DEBUG_SQL === 'true';
        this.defaultLimit = 20;
        this.maxLimit = (() => {
            const parsed = Number.parseInt(process.env.API_PAGINATION_LIMIT_MAX || '200', 10);
            return Number.isInteger(parsed) && parsed > 0 ? parsed : 200;
        })();
        this.maxOffset = (() => {
            const parsed = Number.parseInt(process.env.API_PAGINATION_OFFSET_MAX || '1000000', 10);
            return Number.isInteger(parsed) && parsed >= 0 ? parsed : 1000000;
        })();
    }

    // ==================== ОСНОВНЫЕ МЕТОДЫ ====================

    async makeRequest(sql, clientIP) {
        try {
            const params = new URLSearchParams({
                json: '',
                ip: clientIP,
                code: this.apiCode,
                sql: sql
            });

            const url = `${this.apiBase}?${params}`;
            console.log(`[AJES] URL: ${this._maskSensitiveUrl(url)}`);

            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'Accept': 'application/json, text/javascript, */*',
                    'User-Agent': 'CarAuctionAPI/1.0'
                }
            });

            console.log(`[AJES] Response status: ${response.status}`);

            // Обработка ответа AJES
            if (response.data && typeof response.data === 'object') {
                if (response.data.error) {
                    console.error(`[AJES] Error: ${response.data.error}`);
                    return [];
                }

                if (Array.isArray(response.data)) {
                    return response.data;
                }

                // Преобразуем объект в массив
                const keys = Object.keys(response.data);
                const hasArrayLikeKeys = keys.some(key => !isNaN(parseInt(key)));

                if (hasArrayLikeKeys) {
                    return Object.values(response.data);
                } else {
                    return [response.data];
                }
            }

            return [];
        } catch (error) {
            console.error('Error in AJES request:', error.message);
            return [];
        }
    }

    _maskSensitiveUrl(rawUrl) {
        try {
            const parsed = new URL(rawUrl);
            if (parsed.searchParams.has('code')) {
                parsed.searchParams.set('code', '***');
            }
            if (parsed.searchParams.has('sql')) {
                parsed.searchParams.set('sql', '***');
            }
            return parsed.toString();
        } catch (_) {
            return String(rawUrl || '')
                .replace(/([?&]code=)[^&]*/i, '$1***')
                .replace(/([?&]sql=)[^&]*/i, '$1***');
        }
    }

    _escapeSqlLiteral(value) {
        return String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/\u0000/g, '')
            .replace(/'/g, "''");
    }

    _logSql(label, sql) {
        if (!this.debugSql) return;
        const compact = String(sql || '').replace(/\s+/g, ' ').trim();
        const preview = compact.length > 220 ? `${compact.slice(0, 220)}...` : compact;
        console.log(`[AJES] ${label}: ${preview}`);
    }

    _getSafeTable(table = 'main') {
        const normalized = String(table || 'main').trim().toLowerCase();
        return this.tableColumns[normalized] ? normalized : 'main';
    }

    _normalizePagination(limitRaw, offsetRaw) {
        let limit = Number.parseInt(limitRaw, 10);
        if (!Number.isInteger(limit)) {
            limit = this.defaultLimit;
        }
        limit = Math.min(Math.max(limit, 1), this.maxLimit);

        let offset = Number.parseInt(offsetRaw, 10);
        if (!Number.isInteger(offset)) {
            offset = 0;
        }
        offset = Math.min(Math.max(offset, 0), this.maxOffset);

        return { limit, offset };
    }

    // ==================== ФИЛЬТРЫ И ГРУППИРОВКИ ====================

    groupFilterToSQL(field, group, table = 'main') {
        const safeTable = this._getSafeTable(table);
        const columnMap = {
            'transmission': this.tableColumns[safeTable]?.transmission || 'KPP',
            'drive': this.tableColumns[safeTable]?.drive || 'PRIV',
            'fuel': this.tableColumns[safeTable]?.fuel_type || 'TIME'
        };

        const column = columnMap[field];
        if (!column) return '';

        const searchCodes = this.mapper.getSearchCodesForGroup(field, group);
        if (searchCodes.length === 0) return '';

        // Для пустых значений
        if (searchCodes.includes('')) {
            const nonEmptyCodes = searchCodes.filter(code => code !== '');
            if (nonEmptyCodes.length > 0) {
                return ` AND (${column} IN ('${nonEmptyCodes.join("','")}') OR ${column} IS NULL OR ${column} = '')`;
            } else {
                return ` AND (${column} IS NULL OR ${column} = '')`;
            }
        }

        return ` AND ${column} IN ('${searchCodes.join("','")}')`;
    }

    /**
     * Преобразует фильтры в SQL WHERE clause.
     * ИСПРАВЛЕНО: Убрано дублирование условий.
     */
    filterToSQL(filters, table = 'main') {
        const safeTable = this._getSafeTable(table);
        let sql = '';
        const cols = this.tableColumns[safeTable] || this.tableColumns.main;

        // --- 1. Основные параметры (Марка, Модель, Год, Объем) ---

        // Vendor (Марка)
        if (filters.vendor) {
            const col = cols.vendor_name || 'MARKA_NAME';
            sql += ` AND ${col} = '${this._escapeSqlLiteral(filters.vendor)}'`;
        }

        // Model (Модель)
        if (filters.model) {
            const col = cols.model_name || 'MODEL_NAME';
            sql += ` AND ${col} = '${this._escapeSqlLiteral(filters.model)}'`;
        }

        // Years
        if (filters.year_from) {
            const yearFrom = parseInt(filters.year_from, 10);
            if (Number.isFinite(yearFrom)) {
                sql += ` AND YEAR >= ${yearFrom}`;
            }
        }
        if (filters.year_to) {
            const yearTo = parseInt(filters.year_to, 10);
            if (Number.isFinite(yearTo)) {
                sql += ` AND YEAR <= ${yearTo}`;
            }
        }

        // Engine Volume
        if (filters.engine_from) {
            const engineFrom = parseFloat(filters.engine_from);
            if (Number.isFinite(engineFrom)) {
                sql += ` AND ENG_V >= ${engineFrom}`;
            }
        }
        if (filters.engine_to) {
            const engineTo = parseFloat(filters.engine_to);
            if (Number.isFinite(engineTo)) {
                sql += ` AND ENG_V <= ${engineTo}`;
            }
        }

        // Engine Volume
        if (filters.mileage_from) {
            const mileageFrom = parseFloat(filters.mileage_from);
            if (Number.isFinite(mileageFrom)) {
                sql += ` AND MILEAGE >= ${mileageFrom}`;
            }
        }
        if (filters.mileage_to) {
            const mileageTo = parseFloat(filters.mileage_to);
            if (Number.isFinite(mileageTo)) {
                sql += ` AND MILEAGE <= ${mileageTo}`;
            }
        }

        // --- 2. Сложные поля с маппингом (КПП, Топливо, Привод) ---
        // Логика:
        // 1. Берем значение из filters.field (если есть) или filters.field_group.
        // 2. Проверяем словарь searchMappings.
        // 3. Если есть в словаре -> IN (...). Если нет -> прямое сравнение.

        // --- TRANSMISSION ---
        if (cols.transmission) {
            // Приоритет: обычный фильтр > групповой фильтр
            const transVal = filters.transmission || filters.transmission_group;
            if (transVal) {
                const mapped = this.searchMappings.transmission[transVal.toLowerCase()];
                if (mapped) {
                    sql += ` AND ${cols.transmission} IN ('${mapped.join("','")}')`;
                } else {
                    sql += ` AND ${cols.transmission} = '${this._escapeSqlLiteral(transVal)}'`;
                }
            }
        }

        // --- FUEL ---
        if (cols.fuel_type) {
            const fuelVal = filters.fuel_type || filters.fuel_group || filters.fuel;
            if (fuelVal) {
                const mapped = this.searchMappings.fuel[fuelVal.toLowerCase()];
                if (mapped) {
                    sql += ` AND ${cols.fuel_type} IN ('${mapped.join("','")}')`;
                } else {
                    sql += ` AND ${cols.fuel_type} = '${this._escapeSqlLiteral(fuelVal)}'`;
                }
            }
        }

        // --- DRIVE ---
        if (cols.drive) {
            const driveVal = filters.drive || filters.drive_group;
            if (driveVal) {
                const mapped = this.searchMappings.drive[driveVal.toLowerCase()];
                if (mapped) {
                    sql += ` AND ${cols.drive} IN ('${mapped.join("','")}')`;
                } else {
                    sql += ` AND ${cols.drive} = '${this._escapeSqlLiteral(driveVal)}'`;
                }
            }
        }

        return sql;
    }

    buildSQL(filters, table) {
        const safeTable = this._getSafeTable(table);
        let sql = `SELECT `;

        // Важно: перечисляем поля без AS, так как API может не поддерживать алиасы
        if (safeTable === 'bike') {
            sql += `id, MARKA_NAME, MODEL_NAME, YEAR, ENG_V, MILEAGE, START, FINISH, IMAGES, RATE, AUCTION, AUCTION_DATE, LOT_NUM, STATUS`;
        } else {
            sql += `id, MARKA_NAME, MODEL_NAME, YEAR, ENG_V, PW, TIME, MILEAGE, KPP, PRIV, START, FINISH, AVG_PRICE, IMAGES, RATE, AUCTION, AUCTION_DATE, LOT, STATUS`;
        }

        sql += ` FROM ${safeTable} WHERE 1=1`;

        // Добавляем WHERE условия
        sql += this.filterToSQL(filters, safeTable);

        sql += ' ORDER BY id DESC';

        const { limit, offset } = this._normalizePagination(filters.limit, filters.offset);
        sql += ` LIMIT ${offset}, ${limit}`;

        return sql;
    }

    // ==================== РЕАЛИЗАЦИЯ МЕТОДОВ ====================

    async getCars(filters = {}, table = 'main', clientIP) {
        const safeTable = this._getSafeTable(table);
        const sql = this.buildSQL(filters, safeTable);
        this._logSql('SQL', sql);

        const data = await this.makeRequest(sql, clientIP);
        if (!data || !Array.isArray(data)) return [];

        console.log(`[AJES] Total cars received: ${data.length}`);

        // Применяем маппинг
        return data.map(car => this.mapper.mapCarData(car));
    }

    async getCarById(carId, table = 'main', clientIP) {
        const safeTable = this._getSafeTable(table);
        const escapedId = this._escapeSqlLiteral(carId);
        const selectColumns = safeTable === 'bike'
            ? 'id, MARKA_NAME, MODEL_NAME, YEAR, ENG_V, MILEAGE, START, FINISH, IMAGES, RATE, AUCTION, AUCTION_DATE, LOT_NUM, STATUS'
            : 'id, MARKA_NAME, MODEL_NAME, YEAR, ENG_V, PW, TIME, MILEAGE, KPP, PRIV, START, FINISH, AVG_PRICE, IMAGES, RATE, AUCTION, AUCTION_DATE, LOT, STATUS';

        // Сначала запрашиваем точное совпадение ID с учетом регистра.
        const strictSql = `SELECT ${selectColumns} FROM ${safeTable} WHERE BINARY id = '${escapedId}' ORDER BY id DESC LIMIT 1`;
        this._logSql('SQL for getCarById (strict)', strictSql);

        let data = await this.makeRequest(strictSql, clientIP);
        if (!data || data.length === 0) {
            // Фолбэк на обычное сравнение, если BINARY не поддержан или запись не найдена.
            const fallbackSql = `SELECT ${selectColumns} FROM ${safeTable} WHERE id = '${escapedId}' ORDER BY id DESC LIMIT 1`;
            this._logSql('SQL for getCarById (fallback)', fallbackSql);
            data = await this.makeRequest(fallbackSql, clientIP);
        }

        if (data && data.length > 0) {
            return this.mapper.mapCarData(data[0]);
        }

        return null;
    }

    async getCarPrice(carId, table = 'main') {
        // Для AJES цена рассчитывается на лету
        return {
            calc_rub: null,
            last_updated: new Date().toISOString()
        };
    }

    async getDynamicFilters(currentFilters = {}, table = 'main', clientIP) {
        try {
            const safeTable = this._getSafeTable(table);
            const vendorFilter = currentFilters.vendor ? String(currentFilters.vendor).trim() : '';
            const vendorCacheKey = vendorFilter.toUpperCase();
            const cacheKey = vendorFilter
                ? `dynamic_filters_${safeTable}_vendor_${vendorCacheKey}`
                : `dynamic_filters_${safeTable}_all`;
            const cached = this.externalCache[cacheKey];
            if (this._isFresh(cached, this.dynamicFiltersCacheTTL)) {
                return cached.data;
            }

            // Набор запросов не зависит друг от друга, поэтому выполняем параллельно.
            const vendorsPromise = this._fetchExternalManuf(safeTable, clientIP);
            const modelsPromise = vendorFilter
                ? this.getModelsByVendor(vendorFilter, safeTable, clientIP)
                : Promise.resolve([]);
            const fuelPromise = this.getAvailableFuelTypes(safeTable, clientIP);
            const transmissionsPromise = this.getAvailableTransmissions(safeTable, clientIP);
            const drivesPromise = this.getAvailableDrives(safeTable, clientIP);

            const [vendors, models, fuelRaw, transmissions, drives] = await Promise.all([
                vendorsPromise,
                modelsPromise,
                fuelPromise,
                transmissionsPromise,
                drivesPromise
            ]);

            const vendorNames = vendors ? vendors.map(v => v.name).filter(Boolean) : [];

            const fuel_types = Object.entries(fuelRaw).map(([code, data]) => ({
                code: code,
                name: data.name,
                count: data.count
            }));

            // Генерация диапазона годов
            const years = this._generateYearRange();

            const result = {
                vendors: vendorNames,
                models,
                years,
                fuel_types,
                transmissions,
                drives
            };

            const hasFuelData = fuel_types.some((item) => Number(item?.count) > 0);
            const hasTransmissionData = Object.values(transmissions || {}).some((item) => Number(item?.count) > 0);
            const hasDriveData = Object.values(drives || {}).some((item) => Number(item?.count) > 0);
            const canCache = vendorNames.length > 0 && (
                safeTable === 'bike' || hasFuelData || hasTransmissionData || hasDriveData
            );

            // Не кешируем очевидно "битые" ответы (например, при блокировке IP у провайдера).
            if (canCache) {
                this.externalCache[cacheKey] = { data: result, updatedAt: Date.now() };
            }

            return result;
        } catch (error) {
            console.error('Error getting filters from AJES:', error.message);
            return {
                vendors: [],
                models: [],
                years: [],
                fuel_types: this.mapper.getEmptyFuelGroups(),
                transmissions: this.mapper.getEmptyTransmissionGroups(),
                drives: this.mapper.getEmptyDriveGroups()
            };
        }
    }

    async getTotalCount(filters = {}, table = 'main', clientIP) {
        const safeTable = this._getSafeTable(table);
        let sql = `SELECT COUNT(id) FROM ${safeTable} WHERE 1=1`;
        sql += this.filterToSQL(filters, safeTable);

        this._logSql('Count SQL', sql);
        const data = await this.makeRequest(sql, clientIP);

        if (data && data.length > 0 && data[0].TAG0) {
            return parseInt(data[0].TAG0);
        }
        return 0;
    }

    async getVendors(table = 'main', clientIP) {
        try {
            const safeTable = this._getSafeTable(table);
            const sql = `SELECT MARKA_ID, MARKA_NAME FROM ${safeTable} GROUP BY MARKA_NAME ORDER BY MARKA_NAME ASC`;

            const data = await this.makeRequest(sql, clientIP);
            if (Array.isArray(data) && data.length > 0) {
                return data.map(item => ({
                    MARKA_ID: item.MARKA_ID || item.marka_id || item.id || '',
                    MARKA_NAME: item.MARKA_NAME || item.marka_name || item.name || ''
                }));
            }
            return [];
        } catch (error) {
            console.error('Error getting vendors:', error.message);
            return [];
        }
    }

    async getModelsByVendor(vendorName, table, clientIP) {
        try {
            const safeTable = this._getSafeTable(table);
            const normalizedVendorName = String(vendorName || '').trim();
            if (!normalizedVendorName) return [];

            const cacheKey = `models_${safeTable}_${normalizedVendorName.toUpperCase()}`;
            const cached = this.externalCache[cacheKey];
            if (this._isFresh(cached, this.externalCacheTTL)) {
                return cached.data;
            }

            const escapedVendorName = this._escapeSqlLiteral(normalizedVendorName);
            const sql = `SELECT DISTINCT MODEL_NAME FROM ${safeTable}
                         WHERE MARKA_NAME = '${escapedVendorName}'
                           AND MODEL_NAME IS NOT NULL
                         ORDER BY MODEL_NAME`;

            const data = await this.makeRequest(sql, clientIP);

            if (Array.isArray(data)) {
                // Преобразуем массив объектов в массив строк
                const models = data.map(row => {
                    // 1. Пробуем получить по точному ключу (чаще всего MODEL_NAME)
                    // 2. Пробуем в нижнем регистре
                    // 3. Если ключи неизвестны, берем первое значение объекта (Object.values)
                    return row.MODEL_NAME || row.model_name || Object.values(row)[0];
                }).filter(val => val && typeof val === 'string' && val.trim() !== '');

                if (models.length > 0) {
                    this.externalCache[cacheKey] = { data: models, updatedAt: Date.now() };
                }
                return models;
            }
            return [];
        } catch (error) {
            console.error('Error getting models:', error.message);
            return [];
        }
    }

    async getAvailableFuelTypes(table = 'main', clientIP) {
        const safeTable = this._getSafeTable(table);
        const fuelColumn = this.tableColumns[safeTable]?.fuel_type;
        if (!fuelColumn) return this.mapper.getEmptyFuelGroups();

        // SQL: SELECT TIME, COUNT(*) FROM ... GROUP BY TIME
        const sql = `SELECT ${fuelColumn}, COUNT(*) FROM ${safeTable} 
                     WHERE ${fuelColumn} IS NOT NULL AND ${fuelColumn} != '' 
                     GROUP BY ${fuelColumn}`;

        const data = await this.makeRequest(sql, clientIP);
        return this.mapper.processFuelData(data, fuelColumn);
    }

    async getAvailableTransmissions(table = 'main', clientIP) {
        try {
            const safeTable = this._getSafeTable(table);
            const transmissionColumn = this.tableColumns[safeTable]?.transmission;
            if (!transmissionColumn) return this.mapper.getEmptyTransmissionGroups();

            const sql = `SELECT ${transmissionColumn}, COUNT(*) FROM ${safeTable}
                         WHERE ${transmissionColumn} IS NOT NULL
                         GROUP BY ${transmissionColumn}`;

            const data = await this.makeRequest(sql, clientIP);
            if (Array.isArray(data) && data.length > 0) {
                return this.mapper.processTransmissionData(data, transmissionColumn);
            }

            return this.mapper.getEmptyTransmissionGroups();
        } catch (error) {
            console.error('Error getting transmissions:', error.message);
            return this.mapper.getEmptyTransmissionGroups();
        }
    }

    async getAvailableDrives(table = 'main', clientIP) {
        try {
            const safeTable = this._getSafeTable(table);
            const driveColumn = this.tableColumns[safeTable]?.drive;
            if (!driveColumn) return this.mapper.getEmptyDriveGroups();

            const sql = `SELECT ${driveColumn}, COUNT(*) FROM ${safeTable}
                         WHERE ${driveColumn} IS NOT NULL
                         GROUP BY ${driveColumn}`;

            const data = await this.makeRequest(sql, clientIP);
            if (Array.isArray(data) && data.length > 0) {
                return this.mapper.processDriveData(data, driveColumn);
            }

            return this.mapper.getEmptyDriveGroups();
        } catch (error) {
            console.error('Error getting drives:', error.message);
            return this.mapper.getEmptyDriveGroups();
        }
    }

    async _fetchExternalManuf(table, clientIP) {
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
            return null;
        }
    }

    _isFresh(entry, ttl) {
        if (!entry || !entry.updatedAt) return false;
        return (Date.now() - entry.updatedAt) < ttl;
    }

    _generateYearRange() {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let year = currentYear; year >= 1990; year--) {
            years.push(year);
        }
        return years;
    }
}

module.exports = AJESProvider;
