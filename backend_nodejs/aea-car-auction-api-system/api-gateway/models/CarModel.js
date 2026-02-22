const db = require('../config/database');
const ProviderFactory = require('../providers/ProviderFactory');

class CarModel {
    constructor() {
        this.tables = ['main', 'korea', 'china', 'bike', 'che_available'];
        this.tableColumnsCache = new Map();
    }

    /**
     * Получить автомобили по фильтру.
     * 1. Запрашивает провайдера (AJES).
     * 2. Нормализует данные (цена, типы).
     * 3. Асинхронно сохраняет в локальную БД (кэш).
     */
    async getCarsByFilterOld(filters = {}, table = 'main', provider = 'ajes', clientIP) {
        try {
            const providerInstance = ProviderFactory.getProvider(provider);

            // 1. Получаем данные
            const rawCars = await providerInstance.getCars(filters, table, clientIP);

            // 2. Нормализуем данные (расчет цены и т.д.)
            const cars = rawCars.map(car => this._normalizeCarData(car));

            // 3. Сохраняем в БД в фоне (Fire-and-forget)
            // Не ждем await, чтобы отдать ответ пользователю быстрее
            if (cars.length > 0 && this._shouldSyncWithDatabase(provider, table)) {
                this.saveCarsToDatabase(cars, table).catch(err =>
                    console.error(`[Background] Error saving cars to ${table}:`, err.message)
                );
            }

            return rawCars.map(car => this._normalizeCarData(car));
        } catch (error) {
            console.error('Error in getCarsByFilter:', error.message);
            return [];
        }
    }

    async getCarsByFilter(filters = {}, table = 'main', provider = 'ajes', clientIP) {
        try {
            const safeTable = this._normalizeTable(table);
            // 1. ВЕТКА ЛОКАЛЬНОГО ПОИСКА:
            // Если задан фильтр по цене (price_from/price_to), мы НЕ МОЖЕМ искать через API AJES,
            // так как там нет наших цен. Ищем только у нас в базе.
            if (this._hasPriceFilter(filters)) {
                // console.log(`[Search] Searching locally due to price filter`);
                return await this._getLocalCarsWithFilters(filters, safeTable);
            }

            // 2. ВЕТКА API ПОИСКА (Стандартная):
            const providerInstance = ProviderFactory.getProvider(provider);

            // А. Получаем "сырые" данные от провайдера
            let rawCars = await providerInstance.getCars(filters, safeTable, clientIP);

            if (!rawCars || rawCars.length === 0) return [];

            // Б. СЛИЯНИЕ ЦЕН (Вот то, что вы просили):
            // Проверяем эти машины в нашей базе. Если для них уже посчитан CALC_RUB,
            // мы подменяем его в rawCars.
            rawCars = await this._mergeWithLocalPrices(rawCars, safeTable);

            // В. Нормализация (чистка данных, форматирование)
            // Теперь сюда попадут машины, у которых уже может быть заполнен CALC_RUB из шага Б
            const cars = rawCars.map(car => this._normalizeCarData(car));

            // Г. Сохраняем в фоне (обновляем данные, не трогая цены)
            if (this._shouldSyncWithDatabase(provider, safeTable)) {
                const syncPromise = this.saveCarsToDatabase(cars, safeTable).catch(err =>
                    console.error(`[Background] Error saving cars to ${safeTable}:`, err.message)
                );

                // Для Китая держим синхронную запись, чтобы fallback по ID сразу видел те же поля,
                // что и только что отданный список (важно при нестабильном AJES).
                if (provider === 'ajes' && safeTable === 'china') {
                    await syncPromise;
                }
            }

            return rawCars.map(car => this._normalizeCarData(car));
        } catch (error) {
            console.error('Error in getCarsByFilter:', error.message);
            return [];
        }
    }

    async getTotalCount(filters = {}, table = 'main', provider = 'ajes', clientIP) {
        try {
            const safeTable = this._normalizeTable(table);
            // Для ценового фильтра считаем total по тем же локальным условиям,
            // что и список cars, иначе ломается пагинация.
            if (this._hasPriceFilter(filters)) {
                return await this._getLocalCarsCountWithFilters(filters, safeTable);
            }

            const providerInstance = ProviderFactory.getProvider(provider);
            return await providerInstance.getTotalCount(filters, safeTable, clientIP);
        } catch (error) {
            return 0;
        }
    }

    /**
     * Получить авто по ID.
     * 1. Сначала ищем в локальной БД (она быстрее).
     * 2. Если нет или устарело - идем к провайдеру.
     * 3. Если взяли у провайдера - обновляем локальную БД.
     */
    async getCarById(carId, table = 'main', provider = 'ajes', clientIP) {
        try {
            const safeTable = this._normalizeTable(table);
            // Сначала пробуем локально (если нужно строго актуальное, этот шаг можно пропустить)
            // Но обычно детали меняются редко, а цена пересчитывается.
            // Для надежности сейчас берем с API, так как "синхронизации нет".


            const providerInstance = ProviderFactory.getProvider(provider);
            const rawCar = await providerInstance.getCarById(carId, safeTable, clientIP);

            if (rawCar) {

                // Сохраняем актуальное состояние
                if (this._shouldSyncWithDatabase(provider, safeTable)) {
                    await this.saveCarToDatabase(rawCar, safeTable).catch(err => console.error(err));
                }

                return this._normalizeCarData(rawCar);
            }

            // Если в API нет, можно попробовать поискать в локальной БД как fallback
            const localCar = await this._getLocalCarById(carId, safeTable);
            if (!localCar) {
                return null;
            }

            const mappedLocalCar = this._mapLocalFallbackCar(localCar, provider);
            return this._normalizeCarData(mappedLocalCar);

        } catch (error) {
            console.error('Error getting car by ID:', error.message);
            // Fallback to local DB
            const localCar = await this._getLocalCarById(carId, this._normalizeTable(table));
            if (!localCar) {
                return null;
            }

            const mappedLocalCar = this._mapLocalFallbackCar(localCar, provider);
            return this._normalizeCarData(mappedLocalCar);
        }
    }


    async getCarPriceById(carId, table = 'main', provider = 'ajes') {
        // Так как AJES не дает отдельный эндпоинт цены, мы возвращаем
        // расчетную цену из локальной базы или null
        let connection;
        try {
            const safeTable = this._normalizeTable(table);
            connection = await db.getConnection();
            const [rows] = await connection.execute(
                `SELECT CALC_RUB, CALC_UPDATED_AT FROM ${safeTable} WHERE BINARY ID = ?`,
                [carId]
            );

            if (rows.length > 0) {
                return {
                    calc_rub: rows[0].CALC_RUB,
                    last_updated: rows[0].CALC_UPDATED_AT
                };
            }
            return null;
        } catch (error) {
            return null;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async getDynamicFilters(currentFilters = {}, table = 'main', provider = 'ajes', clientIP) {
        try {
            const safeTable = this._normalizeTable(table);
            const providerInstance = ProviderFactory.getProvider(provider);
            return await providerInstance.getDynamicFilters(currentFilters, safeTable, clientIP);
        } catch (error) {
            console.error('Error in getDynamicFilters:', error.message);
            return { vendors: [], models: [], years: [], fuel_types: {}, transmissions: {}, drives: {} };
        }
    }

    // ==================== INTERNAL HELPERS ====================

    /**
     * Нормализация данных авто.
     * Главная задача: Вычислить CALC_RUB, если его нет.
     * Логика цены: FINISH > START > AVG_PRICE.
     * Также очистка чисел от запятых.
     */
    _normalizeCarDataOld(car) {
        if (!car) return null;

        const parsePrice = (val) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            return parseInt(val.toString().replace(/,/g, '').replace(/\s/g, '')) || 0;
        };

        const finish = parsePrice(car.FINISH);
        const start = parsePrice(car.START);
        const avg = parsePrice(car.AVG_PRICE);
        let bestPrice = parsePrice(car.CALC_RUB);

        // Если цена в рублях уже есть (например, из базы или пришла), оставляем
        // Если нет - берем лучшую доступную цену в валюте как заглушку
        // (В реале тут должна быть формула конвертации валют, но просили "хотя бы цену")
        let stockPrice = '';

        if (!bestPrice) {
            bestPrice = '';
            if (finish > 0) stockPrice = finish;
            else if (start > 0) stockPrice = start;
            else if (avg > 0) stockPrice = avg;
        }

        return {
            ...car,
            // Перезаписываем очищенными числами для БД
            FINISH: finish,
            START: start,
            AVG_PRICE: avg,
            // Если CALC_RUB не был установлен, ставим raw цену (или 0),
            // чтобы клиент видел хоть что-то.
            CALC_RUB: bestPrice,
            STOCK_PRICE: stockPrice,
            // Сохраняем исходные поля для дебага если нужно
            raw_finish: car.FINISH
        };
    }

    _normalizeCarData(car) {
        if (!car) return null;

        const parsePrice = (val) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            return parseInt(val.toString().replace(/,/g, '').replace(/\s/g, '')) || 0;
        };

        const finish = parsePrice(car.FINISH);
        const start = parsePrice(car.START);
        const avg = parsePrice(car.AVG_PRICE);

        // CALC_RUB может прийти из базы (через _mergeWithLocalPrices).
        // Если он там есть — используем его. Если нет — будет 0.
        let calcRub = parsePrice(car.CALC_RUB);

        // Рассчитываем STOCK_PRICE (Стоковая цена в валюте лота)
        // Это виртуальное поле, в базе его нет.
        let stockPrice = '';
        if (finish > 0) stockPrice = finish;
        else if (start > 0) stockPrice = start;
        else if (avg > 0) stockPrice = avg;

        return {
            ...car,
            // Нормализуем ID
            ID: String(car.ID || car.id).trim(),

            // Числовые поля
            FINISH: finish,
            START: start,
            AVG_PRICE: avg,

            // Расчетная цена в рублях (из базы или пусто)
            CALC_RUB: calcRub > 0 ? calcRub : '',

            // Виртуальная цена лота
            STOCK_PRICE: stockPrice,

            raw_finish: car.FINISH
        };
    }

    async _getLocalCarById(carId, table) {
        try {
            const safeTable = this._normalizeTable(table);
            const rows = await db.query(`SELECT * FROM ${safeTable} WHERE BINARY ID = ? LIMIT 1`, [carId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (e) { return null; }
    }

    _mapLocalFallbackCar(car, provider = 'ajes') {
        if (!car) {
            return null;
        }

        try {
            const providerInstance = ProviderFactory.getProvider(provider);
            if (providerInstance?.mapper?.mapCarData) {
                return providerInstance.mapper.mapCarData(car);
            }
        } catch (error) {
            console.warn(`[DB Fallback] Failed to map local car data for provider ${provider}:`, error.message);
        }

        return car;
    }

    async getVendors(table = 'main', provider = 'ajes', clientIP) {
        try {
            const safeTable = this._normalizeTable(table);
            const providerInstance = ProviderFactory.getProvider(provider);
            return await providerInstance.getVendors(safeTable, clientIP);
        } catch (error) {
            console.error('Error getting vendors:', error.message);
            return [];
        }
    }

    async getModelsByVendor(vendorName, table = 'main', provider = 'ajes', clientIP) {
        try {
            const safeTable = this._normalizeTable(table);
            const providerInstance = ProviderFactory.getProvider(provider);
            return await providerInstance.getModelsByVendor(vendorName, safeTable, clientIP);
        } catch (error) {
            console.error('Error getting models by vendor:', error.message);
            return [];
        }
    }

    // ==================== МЕТОДЫ ДЛЯ БАЗЫ ДАННЫХ ====================

    async saveCarsToDatabaseOld(cars, table = 'main') {
        if (!cars || cars.length === 0) return;
        const safeTable = this._normalizeTable(table);

        // Используем bulkOperation для массовой вставки
        try {
            // Подготавливаем массив для вставки.
            // Нам нужны только поля, которые есть в схеме БД.
            // Но bulkOperation в db.js довольно умен.
            // Главное убедиться, что ID есть.

            const validCars = cars.filter(c => c && c.ID);

            // Запускаем через Database helper
            // Это сделает INSERT ON DUPLICATE KEY UPDATE
            await db.bulkOperation(safeTable, validCars);

            console.log(`[DB] Saved/Updated ${validCars.length} cars in ${safeTable}`);
        } catch (error) {
            console.error(`Error saving cars to ${safeTable}:`, error.message);
        }
    }

    async saveCarsToDatabase(cars, table = 'main') {
        if (!cars || cars.length === 0) return;
        const safeTable = this._normalizeTable(table);

        // Список полей, которые есть в вашей таблице и которые мы обновляем данными с API
        const preferredColumns = [
            'ID', 'AUCTION_DATE', 'MARKA_NAME', 'MODEL_NAME', 'YEAR',
            'MILEAGE', 'ENG_V', 'PW', 'KPP', 'PRIV', 'TIME', 'START', 'FINISH',
            'AVG_PRICE', 'IMAGES', 'RATE', 'LOT', 'STATUS', 'AUCTION'
            // ВАЖНО: STOCK_PRICE и CALC_RUB здесь быть НЕ ДОЛЖНО,
            // чтобы мы не пытались писать их в базу или затирать существующие.
        ];

        let connection;
        try {
            const validCars = cars.filter(c => c && c.ID);
            if (validCars.length === 0) return;

            const availableColumns = await this._getTableColumns(safeTable);
            const columns = preferredColumns.filter(col => availableColumns.has(col));

            if (!columns.includes('ID')) {
                console.warn(`[DB] Table ${safeTable} does not contain ID column, skipping sync`);
                return;
            }

            connection = await db.getConnection();

            const placeholders = `(${columns.map(() => '?').join(', ')})`;
            const allPlaceholders = validCars.map(() => placeholders).join(', ');

            let values = [];
            validCars.forEach(car => {
                columns.forEach(col => {
                    values.push(this._getColumnValue(car, col));
                });
            });

            const nonUpdatableFields = new Set(['STATUS', 'AUCTION_DATE']);

            // Обновляем только безопасные поля (исключаем "шумные" STATUS/AUCTION_DATE).
            const updateClause = columns
                .filter(col => col !== 'ID' && !nonUpdatableFields.has(col))
                .map(col => {
                    if (col === 'TIME') {
                        // Не допускаем деградацию топлива в БД (например H -> P).
                        return `TIME = CASE 
                            WHEN TIME IN ('H','HE','&','E','D','L','C') AND VALUES(TIME) IN ('P','G','B') THEN TIME
                            ELSE VALUES(TIME)
                        END`;
                    }
                    return `${col} = VALUES(${col})`;
                })
                .join(', ');

            const sql = `
                INSERT INTO ${safeTable} (${columns.join(', ')}) 
                VALUES ${allPlaceholders} 
                ON DUPLICATE KEY UPDATE ${updateClause}
            `;

            await connection.execute(sql, values);

        } catch (error) {
            console.error(`Error saving cars to ${safeTable}:`, error.message);
            this.tableColumnsCache.delete(safeTable);
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async saveCarToDatabase(carData, table = 'main') {
        let connection;
        try {
            const safeTable = this._normalizeTable(table);
            const normalizedId = String(carData?.ID || carData?.id || '').trim();
            if (!carData || !normalizedId) {
                console.log('❌ No car ID provided for saving');
                return 'error';
            }
            const savePayload = { ...carData, ID: normalizedId };
            delete savePayload.transmission_name;
            delete savePayload.transmission_group;
            delete savePayload.drive_group;
            delete savePayload.fuel_name;
            delete savePayload.fuel_groups;
            delete savePayload.raw_finish;
            delete savePayload.STOCK_PRICE;
            delete savePayload.CALC_RUB;
            delete savePayload.tks_type;

            const preferredColumns = [
                'ID', 'AUCTION_DATE', 'MARKA_NAME', 'MODEL_NAME', 'YEAR',
                'MILEAGE', 'ENG_V', 'PW', 'KPP', 'PRIV', 'TIME', 'START', 'FINISH',
                'AVG_PRICE', 'PRICE_CALC', 'CALC_RUB', 'CALC_UPDATED_AT', 'IMAGES'
            ];
            const availableColumns = await this._getTableColumns(safeTable);
            const columns = preferredColumns.filter(col => availableColumns.has(col));
            if (!columns.includes('ID')) {
                console.warn(`[DB] Table ${safeTable} does not contain ID column, skipping single save`);
                return 'error';
            }

            connection = await db.getConnection();

            try {
                // Проверяем существование
                const existingSelectColumns = availableColumns.has('TIME') ? 'ID, TIME' : 'ID';
                const [existing] = await connection.execute(
                    `SELECT ${existingSelectColumns} FROM ${safeTable} WHERE ID = ?`,
                    [savePayload.ID]
                );

                if (existing.length > 0) {
                    if (availableColumns.has('TIME')) {
                        const existingFuelCode = this._normalizeFuelCode(existing[0].TIME);
                        const incomingFuelCode = this._normalizeFuelCode(savePayload.TIME);
                        const resolvedFuelCode = this._resolveFuelCodeConflict(existingFuelCode, incomingFuelCode);
                        if (resolvedFuelCode && resolvedFuelCode !== incomingFuelCode) {
                            savePayload.TIME = resolvedFuelCode;
                            console.log(`[DB] Preserved fuel code for ${savePayload.ID}: ${incomingFuelCode} -> ${resolvedFuelCode}`);
                        }
                    }

                    // Обновляем только безопасные поля (исключаем "шумные" STATUS/AUCTION_DATE).
                    const nonUpdatableFields = new Set(['STATUS', 'AUCTION_DATE']);
                    const columnsToUpdate = columns.filter(col => col !== 'ID' && !nonUpdatableFields.has(col));
                    const updateFields = columnsToUpdate.map(col => `${col} = ?`).join(', ');
                    const values = columnsToUpdate
                        .map(col => this._getColumnValue(savePayload, col));
                    values.push(savePayload.ID);

                    const trailingUpdates = [];
                    if (availableColumns.has('CALC_UPDATED_AT')) {
                        trailingUpdates.push('CALC_UPDATED_AT = NOW()');
                    }
                    if (availableColumns.has('updated_at')) {
                        trailingUpdates.push('updated_at = CURRENT_TIMESTAMP');
                    }
                    const setClause = [updateFields, ...trailingUpdates].filter(Boolean).join(', ');
                    if (!setClause) {
                        return 'updated';
                    }

                    await connection.execute(
                        `UPDATE ${safeTable} SET ${setClause} WHERE ID = ?`,
                        values
                    );
                    console.log(`✓ Car ${savePayload.ID} updated in ${safeTable}`);
                    return 'updated';
                } else {
                    // Вставляем
                    const placeholders = columns.map(() => '?').join(', ');
                    const values = columns.map(col => this._getColumnValue(savePayload, col));

                    await connection.execute(
                        `INSERT INTO ${safeTable} (${columns.join(', ')}) VALUES (${placeholders})`,
                        values
                    );
                    console.log(`✓ Car ${savePayload.ID} inserted into ${safeTable}`);
                    return 'inserted';
                }
            } finally {
                if (connection) {
                    connection.release();
                }
            }
        } catch (error) {
            console.error(`Error saving car ${carData?.ID} to database:`, error.message);
            this.tableColumnsCache.delete(this._normalizeTable(table));
            return 'error';
        }
    }

    async createTables() {
        console.log('ℹ️ Tables creation not needed for API-only mode');
        return true;
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    getAvailableProviders() {
        return ProviderFactory.getAvailableProviders();
    }

    getTables() {
        return this.tables;
    }

    _normalizeTable(table = 'main') {
        const normalized = String(table || 'main').trim().toLowerCase();
        return this.tables.includes(normalized) ? normalized : 'main';
    }

    _shouldSyncWithDatabase(provider, table) {
        return !(provider === 'che-168' && table === 'che_available');
    }

    _hasPriceFilter(filters = {}) {
        const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';
        return hasValue(filters.price_from) || hasValue(filters.price_to);
    }

    _parseOptionalNumber(value, parser = parseFloat) {
        if (value === undefined || value === null || value === '') {
            return null;
        }

        const parsed = parser(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    _resolveGroupedValues(value, groups = null) {
        if (value === undefined || value === null || value === '') {
            return [];
        }

        const raw = String(value).trim();
        if (!raw) return [];

        if (groups) {
            const byLower = groups[raw.toLowerCase()];
            if (Array.isArray(byLower) && byLower.length > 0) {
                return byLower;
            }
        }

        return [raw.toUpperCase()];
    }

    _pushInCondition(conditions, params, column, values) {
        if (!Array.isArray(values) || values.length === 0) return;
        const placeholders = values.map(() => '?').join(',');
        conditions.push(`${column} IN (${placeholders})`);
        params.push(...values);
    }

    _buildLocalSearchWhere(filters = {}) {
        const conditions = ['1=1', '(deleted = 0 OR deleted IS NULL)'];
        const params = [];

        const priceFrom = this._parseOptionalNumber(filters.price_from, parseFloat);
        if (priceFrom !== null) {
            conditions.push('CALC_RUB >= ?');
            params.push(priceFrom);
        }

        const priceTo = this._parseOptionalNumber(filters.price_to, parseFloat);
        if (priceTo !== null) {
            conditions.push('CALC_RUB <= ?');
            params.push(priceTo);
        }

        if (filters.vendor !== undefined && filters.vendor !== null && String(filters.vendor).trim() !== '') {
            conditions.push('MARKA_NAME = ?');
            params.push(String(filters.vendor).trim().toUpperCase());
        }

        if (filters.model !== undefined && filters.model !== null && String(filters.model).trim() !== '') {
            conditions.push('MODEL_NAME = ?');
            params.push(String(filters.model).trim().toUpperCase());
        }

        const yearFrom = this._parseOptionalNumber(filters.year_from, parseInt);
        if (yearFrom !== null) {
            conditions.push('YEAR >= ?');
            params.push(yearFrom);
        }

        const yearTo = this._parseOptionalNumber(filters.year_to, parseInt);
        if (yearTo !== null) {
            conditions.push('YEAR <= ?');
            params.push(yearTo);
        }

        const engineFrom = this._parseOptionalNumber(filters.engine_from, parseFloat);
        if (engineFrom !== null) {
            conditions.push('ENG_V >= ?');
            params.push(engineFrom);
        }

        const engineTo = this._parseOptionalNumber(filters.engine_to, parseFloat);
        if (engineTo !== null) {
            conditions.push('ENG_V <= ?');
            params.push(engineTo);
        }

        const mileageExpr = "CAST(REPLACE(REPLACE(MILEAGE, ',', ''), ' ', '') AS UNSIGNED)";
        const mileageFrom = this._parseOptionalNumber(filters.mileage_from, parseInt);
        if (mileageFrom !== null) {
            conditions.push(`${mileageExpr} >= ?`);
            params.push(mileageFrom);
        }

        const mileageTo = this._parseOptionalNumber(filters.mileage_to, parseInt);
        if (mileageTo !== null) {
            conditions.push(`${mileageExpr} <= ?`);
            params.push(mileageTo);
        }

        const fuelGroups = {
            petrol: ['G', 'P', 'L', 'C'],
            diesel: ['D'],
            hybrid: ['H', 'HE', '&'],
            electric: ['E'],
            other: ['O', '']
        };
        const fuelValue = filters.fuel_type || filters.fuel_group || filters.fuel;
        const fuelCodes = this._resolveGroupedValues(fuelValue, fuelGroups);
        this._pushInCondition(conditions, params, 'TIME', fuelCodes);

        const transmissionGroups = {
            automatic: ['AT', 'A', 'AUTO', 'DCT', 'DSG', 'PDK', 'SAT', 'IAT', 'FAT'],
            manual: ['MT', 'M', 'FMT', 'IMT', 'DMT'],
            cvt: ['CVT', 'ECVT', 'FCVT', 'DCVT', 'CCVT', 'AC'],
            hybrid: ['HL', 'H'],
            sequential: ['SQ', 'SEQ'],
            other: ['OTHER', '-', '...']
        };
        const transmissionValue = filters.transmission || filters.transmission_group;
        const transmissionCodes = this._resolveGroupedValues(transmissionValue, transmissionGroups);
        this._pushInCondition(conditions, params, 'KPP', transmissionCodes);

        const driveGroups = {
            fwd: ['FF', 'FWD', '2WD'],
            rwd: ['FR', 'RWD', 'RR'],
            awd: ['4WD', 'AWD', '4X4', 'FULLTIME4WD', 'PARTTIME4WD'],
            other: ['OTHER']
        };
        const driveValue = filters.drive || filters.drive_group;
        const driveCodes = this._resolveGroupedValues(driveValue, driveGroups);
        this._pushInCondition(conditions, params, 'PRIV', driveCodes);

        return { conditions, params };
    }

    _getColumnValue(car, column) {
        if (column === 'ID') {
            return String(car.ID || car.id || '').trim() || null;
        }
        return car[column] !== undefined ? car[column] : null;
    }

    _normalizeFuelCode(value) {
        if (value === undefined || value === null) {
            return '';
        }
        return String(value).trim().toUpperCase();
    }

    _resolveFuelCodeConflict(existingCode, incomingCode) {
        if (!incomingCode) return existingCode || '';
        if (!existingCode || existingCode === incomingCode) return incomingCode;

        const protectedCodes = new Set(['H', 'HE', '&', 'E', 'D', 'L', 'C']);
        const petrolCodes = new Set(['P', 'G', 'B']);

        if (protectedCodes.has(existingCode) && petrolCodes.has(incomingCode)) {
            return existingCode;
        }

        return incomingCode;
    }

    async _getTableColumns(table) {
        const safeTable = this._normalizeTable(table);
        if (this.tableColumnsCache.has(safeTable)) {
            return this.tableColumnsCache.get(safeTable);
        }

        let connection;
        try {
            connection = await db.getConnection();
            const [rows] = await connection.execute(`SHOW COLUMNS FROM ${safeTable}`);
            const columns = new Set(rows.map(row => row.Field));
            this.tableColumnsCache.set(safeTable, columns);
            return columns;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    /**
     * Проверяет массив машин с API на наличие сохраненных цен в локальной БД.
     * Если цена есть - подставляет её в объект.
     */
    async _mergeWithLocalPrices(cars, table) {
        if (!cars || cars.length === 0) return [];
        const safeTable = this._normalizeTable(table);

        // Получаем список ID, очищаем от пробелов
        const ids = cars.map(c => String(c.ID || c.id).trim()).filter(Boolean);

        if (ids.length === 0) return cars;

        let connection;
        try {
            connection = await db.getConnection();

            // Создаем строку плейсхолдеров (?,?,?)
            const placeholders = ids.map(() => '?').join(',');

            // ИСПРАВЛЕНО: Убрали STOCK_PRICE из запроса, так как его нет в базе
            const [rows] = await connection.execute(
                `SELECT ID, CALC_RUB FROM ${safeTable} WHERE ID IN (${placeholders})`,
                ids
            );

            // Создаем Map:  "7Sc6Vvt0UGttPA" -> { CALC_RUB: 123 }
            const priceMap = new Map();
            rows.forEach(row => {
                if (row.ID) {
                    priceMap.set(String(row.ID).trim(), row);
                }
            });

            // Проходим по машинам и внедряем цену
            return cars.map(car => {
                const carId = String(car.ID || car.id).trim();
                const localData = priceMap.get(carId);

                if (localData && localData.CALC_RUB) {
                    return {
                        ...car,
                        CALC_RUB: localData.CALC_RUB
                        // STOCK_PRICE здесь не трогаем, он рассчитается в _normalizeCarData
                    };
                }
                return car;
            });

        } catch (error) {
            console.error('Error merging local prices:', error.message);
            return cars;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    /**
     * Поиск чисто по локальной базе (когда есть фильтр цены)
     */
    async _getLocalCarsWithFilters(filters, table) {
        let connection;
        try {
            const safeTable = this._normalizeTable(table);
            const { conditions, params } = this._buildLocalSearchWhere(filters);

            // Пагинация
            const limit = parseInt(filters.limit) || 20;
            const offset = parseInt(filters.offset) || 0;

            const whereClause = conditions.join(' AND ');
            const sql = `SELECT * FROM ${safeTable} WHERE ${whereClause} ORDER BY ID DESC LIMIT ${limit} OFFSET ${offset}`;

            connection = await db.getConnection();
            const [rows] = await connection.execute(sql, params);

            // Важно: данные из базы тоже прогоняем через нормализатор
            return rows.map(car => this._normalizeCarData(car));

        } catch (error) {
            console.error('Error searching local DB:', error.message);
            return [];
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async _getLocalCarsCountWithFilters(filters, table) {
        let connection;
        try {
            const safeTable = this._normalizeTable(table);
            const { conditions, params } = this._buildLocalSearchWhere(filters);
            const whereClause = conditions.join(' AND ');
            const sql = `SELECT COUNT(*) AS total FROM ${safeTable} WHERE ${whereClause}`;

            connection = await db.getConnection();
            const [rows] = await connection.execute(sql, params);
            return rows && rows[0] ? Number(rows[0].total) || 0 : 0;
        } catch (error) {
            console.error('Error counting local DB cars:', error.message);
            return 0;
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
}

module.exports = new CarModel();
