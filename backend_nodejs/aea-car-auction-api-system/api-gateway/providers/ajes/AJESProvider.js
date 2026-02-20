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
            console.log(`[AJES] URL: ${url}`);

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

    // ==================== ФИЛЬТРЫ И ГРУППИРОВКИ ====================

    groupFilterToSQL(field, group, table = 'main') {
        const columnMap = {
            'transmission': this.tableColumns[table]?.transmission || 'KPP',
            'drive': this.tableColumns[table]?.drive || 'PRIV',
            'fuel': this.tableColumns[table]?.fuel_type || 'TIME'
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
        let sql = '';
        const cols = this.tableColumns[table] || this.tableColumns.main;

        // --- 1. Основные параметры (Марка, Модель, Год, Объем) ---

        // Vendor (Марка)
        if (filters.vendor) {
            const col = cols.vendor_name || 'MARKA_NAME';
            sql += ` AND ${col} = '${filters.vendor.replace(/'/g, "''")}'`;
        }

        // Model (Модель)
        if (filters.model) {
            const col = cols.model_name || 'MODEL_NAME';
            sql += ` AND ${col} = '${filters.model.replace(/'/g, "''")}'`;
        }

        // Years
        if (filters.year_from) {
            sql += ` AND YEAR >= ${parseInt(filters.year_from)}`;
        }
        if (filters.year_to) {
            sql += ` AND YEAR <= ${parseInt(filters.year_to)}`;
        }

        // Engine Volume
        if (filters.engine_from) {
            sql += ` AND ENG_V >= ${parseFloat(filters.engine_from)}`;
        }
        if (filters.engine_to) {
            sql += ` AND ENG_V <= ${parseFloat(filters.engine_to)}`;
        }

        // Engine Volume
        if (filters.mileage_from) {
            sql += ` AND MILEAGE >= ${parseFloat(filters.mileage_from)}`;
        }
        if (filters.mileage_to) {
            sql += ` AND MILEAGE <= ${parseFloat(filters.mileage_to)}`;
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
                    sql += ` AND ${cols.transmission} = '${transVal.replace(/'/g, "''")}'`;
                }
            }
        }

        // --- FUEL ---
        if (cols.fuel_type) {
            const fuelVal = filters.fuel_type || filters.fuel_group;
            if (fuelVal) {
                const mapped = this.searchMappings.fuel[fuelVal.toLowerCase()];
                if (mapped) {
                    sql += ` AND ${cols.fuel_type} IN ('${mapped.join("','")}')`;
                } else {
                    sql += ` AND ${cols.fuel_type} = '${fuelVal.replace(/'/g, "''")}'`;
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
                    sql += ` AND ${cols.drive} = '${driveVal.replace(/'/g, "''")}'`;
                }
            }
        }

        return sql;
    }

    buildSQL(filters, table) {
        let sql = `SELECT `;

        // Важно: перечисляем поля без AS, так как API может не поддерживать алиасы
        if (table === 'bike') {
            sql += `id, MARKA_NAME, MODEL_NAME, YEAR, ENG_V, MILEAGE, START, FINISH, IMAGES, RATE, AUCTION, AUCTION_DATE, LOT_NUM, STATUS`;
        } else {
            sql += `id, MARKA_NAME, MODEL_NAME, YEAR, ENG_V, PW, TIME, MILEAGE, KPP, PRIV, START, FINISH, AVG_PRICE, IMAGES, RATE, AUCTION, AUCTION_DATE, LOT, STATUS`;
        }

        sql += ` FROM ${table} WHERE 1=1`;

        // Добавляем WHERE условия
        sql += this.filterToSQL(filters, table);

        sql += ' ORDER BY id DESC';

        const limit = filters.limit || 20;
        const offset = filters.offset || 0;
        sql += ` LIMIT ${offset}, ${limit}`;

        return sql;
    }

    // ==================== РЕАЛИЗАЦИЯ МЕТОДОВ ====================

    async getCars(filters = {}, table = 'main', clientIP) {
        const sql = this.buildSQL(filters, table);
        console.log(`[AJES] SQL: ${sql}`);

        const data = await this.makeRequest(sql, clientIP);
        if (!data || !Array.isArray(data)) return [];

        console.log(`[AJES] Total cars received: ${data.length}`);

        // Применяем маппинг
        return data.map(car => this.mapper.mapCarData(car));
    }

    async getCarById(carId, table = 'main', clientIP) {
        const sql = `SELECT * FROM ${table} WHERE id = '${carId}' LIMIT 1`;
        console.log(`[AJES] SQL for getCarById: ${sql}`);

        const data = await this.makeRequest(sql, clientIP);
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
            // Получаем вендоры
            const vendors = await this._fetchExternalManuf(table, clientIP);
            const vendorNames = vendors ? vendors.map(v => v.name).filter(Boolean) : [];

            // Получаем модели
            let models = [];
            if (currentFilters.vendor) {
                models = await this.getModelsByVendor(currentFilters.vendor, table, clientIP);
            }

            // Получаем фильтры с группировкой
            const fuelRaw = await this.getAvailableFuelTypes(table, clientIP);

            const fuel_types = Object.entries(fuelRaw).map(([code, data]) => ({
                code: code,
                name: data.name,
                count: data.count
            }));

            const transmissions = await this.getAvailableTransmissions(table, clientIP);
            const drives = await this.getAvailableDrives(table, clientIP);

            // Генерация диапазона годов
            const years = this._generateYearRange();

            return {
                vendors: vendorNames,
                models,
                years,
                fuel_types,
                transmissions,
                drives
            };
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
        let sql = `SELECT COUNT(id) FROM ${table} WHERE 1=1`;
        sql += this.filterToSQL(filters, table);

        console.log(`[AJES] Count SQL: ${sql}`);
        const data = await this.makeRequest(sql, clientIP);

        if (data && data.length > 0 && data[0].TAG0) {
            return parseInt(data[0].TAG0);
        }
        return 0;
    }

    async getVendors(table = 'main', clientIP) {
        try {
            const sql = `SELECT MARKA_ID, MARKA_NAME FROM ${table} GROUP BY MARKA_NAME ORDER BY MARKA_NAME ASC`;

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
            const sql = `SELECT DISTINCT MODEL_NAME FROM ${table}
                         WHERE MARKA_NAME = '${vendorName}'
                           AND MODEL_NAME IS NOT NULL
                         ORDER BY MODEL_NAME`;

            const data = await this.makeRequest(sql, clientIP);

            if (Array.isArray(data)) {
                // Преобразуем массив объектов в массив строк
                return data.map(row => {
                    // 1. Пробуем получить по точному ключу (чаще всего MODEL_NAME)
                    // 2. Пробуем в нижнем регистре
                    // 3. Если ключи неизвестны, берем первое значение объекта (Object.values)
                    return row.MODEL_NAME || row.model_name || Object.values(row)[0];
                }).filter(val => val && typeof val === 'string' && val.trim() !== '');
            }
            return [];
        } catch (error) {
            console.error('Error getting models:', error.message);
            return [];
        }
    }

    async getAvailableFuelTypes(table = 'main', clientIP) {
        const fuelColumn = this.tableColumns[table]?.fuel_type;
        if (!fuelColumn) return this.mapper.getEmptyFuelGroups();

        // SQL: SELECT TIME, COUNT(*) FROM ... GROUP BY TIME
        const sql = `SELECT ${fuelColumn}, COUNT(*) FROM ${table} 
                     WHERE ${fuelColumn} IS NOT NULL AND ${fuelColumn} != '' 
                     GROUP BY ${fuelColumn}`;

        const data = await this.makeRequest(sql, clientIP);
        return this.mapper.processFuelData(data, fuelColumn);
    }

    async getAvailableTransmissions(table = 'main', clientIP) {
        try {
            const transmissionColumn = this.tableColumns[table]?.transmission;
            if (!transmissionColumn) return this.mapper.getEmptyTransmissionGroups();

            const sql = `SELECT ${transmissionColumn}, COUNT(*) FROM ${table}
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
            const driveColumn = this.tableColumns[table]?.drive;
            if (!driveColumn) return this.mapper.getEmptyDriveGroups();

            const sql = `SELECT ${driveColumn}, COUNT(*) FROM ${table}
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