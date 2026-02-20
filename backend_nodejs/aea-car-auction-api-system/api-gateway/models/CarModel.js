const db = require('../config/database');
const ProviderFactory = require('../providers/ProviderFactory');

class CarModel {
    constructor() {
        this.tables = ['main', 'korea', 'china', 'bike'];
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
            if (cars.length > 0) {
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
            // 1. ВЕТКА ЛОКАЛЬНОГО ПОИСКА:
            // Если задан фильтр по цене (price_from/price_to), мы НЕ МОЖЕМ искать через API AJES,
            // так как там нет наших цен. Ищем только у нас в базе.
            if (filters.price_from || filters.price_to) {
                // console.log(`[Search] Searching locally due to price filter`);
                return await this._getLocalCarsWithFilters(filters, table);
            }

            // 2. ВЕТКА API ПОИСКА (Стандартная):
            const providerInstance = ProviderFactory.getProvider(provider);

            // А. Получаем "сырые" данные от провайдера
            let rawCars = await providerInstance.getCars(filters, table, clientIP);

            if (!rawCars || rawCars.length === 0) return [];

            // Б. СЛИЯНИЕ ЦЕН (Вот то, что вы просили):
            // Проверяем эти машины в нашей базе. Если для них уже посчитан CALC_RUB,
            // мы подменяем его в rawCars.
            rawCars = await this._mergeWithLocalPrices(rawCars, table);

            // В. Нормализация (чистка данных, форматирование)
            // Теперь сюда попадут машины, у которых уже может быть заполнен CALC_RUB из шага Б
            const cars = rawCars.map(car => this._normalizeCarData(car));

            // Г. Сохраняем в фоне (обновляем данные, не трогая цены)
            this.saveCarsToDatabase(cars, table).catch(err =>
                console.error(`[Background] Error saving cars to ${table}:`, err.message)
            );

            return rawCars.map(car => this._normalizeCarData(car));
        } catch (error) {
            console.error('Error in getCarsByFilter:', error.message);
            return [];
        }
    }

    async getTotalCount(filters = {}, table = 'main', provider = 'ajes', clientIP) {
        try {
            const providerInstance = ProviderFactory.getProvider(provider);
            return await providerInstance.getTotalCount(filters, table, clientIP);
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
            // Сначала пробуем локально (если нужно строго актуальное, этот шаг можно пропустить)
            // Но обычно детали меняются редко, а цена пересчитывается.
            // Для надежности сейчас берем с API, так как "синхронизации нет".


            const providerInstance = ProviderFactory.getProvider(provider);
            const rawCar = await providerInstance.getCarById(carId, table, clientIP);

            if (rawCar) {

                // Сохраняем актуальное состояние
                await this.saveCarToDatabase(rawCar, table).catch(err => console.error(err));

                return this._normalizeCarData(rawCar);
            }

            // Если в API нет, можно попробовать поискать в локальной БД как fallback
            return await this._getLocalCarById(carId, table);

        } catch (error) {
            console.error('Error getting car by ID:', error.message);
            // Fallback to local DB
            return this._normalizeCarData(this._getLocalCarById(carId, table));
        }
    }


    async getCarPriceById(carId, table = 'main', provider = 'ajes') {
        // Так как AJES не дает отдельный эндпоинт цены, мы возвращаем
        // расчетную цену из локальной базы или null
        try {
            const connection = await db.getConnection();
            const [rows] = await connection.execute(
                `SELECT CALC_RUB, CALC_UPDATED_AT FROM ${table} WHERE ID = ?`,
                [carId]
            );
            connection.release();

            if (rows.length > 0) {
                return {
                    calc_rub: rows[0].CALC_RUB,
                    last_updated: rows[0].CALC_UPDATED_AT
                };
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async getDynamicFilters(currentFilters = {}, table = 'main', provider = 'ajes', clientIP) {
        try {
            const providerInstance = ProviderFactory.getProvider(provider);
            return await providerInstance.getDynamicFilters(currentFilters, table, clientIP);
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
            const [rows] = await db.query(`SELECT * FROM ${table} WHERE ID = ?`, [carId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (e) { return null; }
    }

    async getVendors(table = 'main', provider = 'ajes', clientIP) {
        try {
            const providerInstance = ProviderFactory.getProvider(provider);
            return await providerInstance.getVendors(table, clientIP);
        } catch (error) {
            console.error('Error getting vendors:', error.message);
            return [];
        }
    }

    async getModelsByVendor(vendorName, table = 'main', provider = 'ajes', clientIP) {
        try {
            const providerInstance = ProviderFactory.getProvider(provider);
            return await providerInstance.getModelsByVendor(vendorName, table, clientIP);
        } catch (error) {
            console.error('Error getting models by vendor:', error.message);
            return [];
        }
    }

    // ==================== МЕТОДЫ ДЛЯ БАЗЫ ДАННЫХ ====================

    async saveCarsToDatabaseOld(cars, table = 'main') {
        if (!cars || cars.length === 0) return;

        // Используем bulkOperation для массовой вставки
        try {
            // Подготавливаем массив для вставки.
            // Нам нужны только поля, которые есть в схеме БД.
            // Но bulkOperation в db.js довольно умен.
            // Главное убедиться, что ID есть.

            const validCars = cars.filter(c => c && c.ID);

            // Запускаем через Database helper
            // Это сделает INSERT ON DUPLICATE KEY UPDATE
            await db.bulkOperation(table, validCars);

            console.log(`[DB] Saved/Updated ${validCars.length} cars in ${table}`);
        } catch (error) {
            console.error(`Error saving cars to ${table}:`, error.message);
        }
    }

    async saveCarsToDatabase(cars, table = 'main') {
        if (!cars || cars.length === 0) return;

        // Список полей, которые есть в вашей таблице и которые мы обновляем данными с API
        const columns = [
            'ID', 'AUCTION_DATE', 'MARKA_NAME', 'MODEL_NAME', 'YEAR',
            'MILEAGE', 'ENG_V', 'PW', 'KPP', 'PRIV', 'TIME', 'START', 'FINISH',
            'AVG_PRICE', 'IMAGES', 'RATE', 'LOT', 'STATUS', 'AUCTION'
            // ВАЖНО: STOCK_PRICE и CALC_RUB здесь быть НЕ ДОЛЖНО,
            // чтобы мы не пытались писать их в базу или затирать существующие.
        ];

        try {
            const validCars = cars.filter(c => c && c.ID);
            if (validCars.length === 0) return;

            const connection = await db.getConnection();

            const placeholders = `(${columns.map(() => '?').join(', ')})`;
            const allPlaceholders = validCars.map(() => placeholders).join(', ');

            let values = [];
            validCars.forEach(car => {
                columns.forEach(col => {
                    values.push(car[col] !== undefined ? car[col] : null);
                });
            });

            // Обновляем всё, кроме цены (CALC_RUB)
            const updateClause = columns
                .filter(col => col !== 'ID')
                .map(col => `${col} = VALUES(${col})`)
                .join(', ');

            const sql = `
                INSERT INTO ${table} (${columns.join(', ')}) 
                VALUES ${allPlaceholders} 
                ON DUPLICATE KEY UPDATE ${updateClause}
            `;

            await connection.execute(sql, values);
            connection.release();

        } catch (error) {
            console.error(`Error saving cars to ${table}:`, error.message);
        }
    }

    async saveCarToDatabase(carData, table = 'main') {
        try {
            if (!carData || !carData.ID) {
                console.log('❌ No car ID provided for saving');
                return 'error';
            }
            delete carData.transmission_name;
            delete carData.transmission_group;
            delete carData.drive_group;
            delete carData.fuel_name;
            delete carData.fuel_groups;
            delete carData.raw_finish;
            delete carData.STOCK_PRICE;
            delete carData.CALC_RUB;
            delete carData.tks_type;

            const connection = await db.getConnection();

            try {
                // Проверяем существование
                const [existing] = await connection.execute(
                    `SELECT ID FROM ${table} WHERE ID = ?`,
                    [carData.ID]
                );

                const columns = [
                    'ID', 'AUCTION_DATE', 'MARKA_NAME', 'MODEL_NAME', 'YEAR',
                    'MILEAGE', 'ENG_V', 'PW', 'KPP', 'PRIV', 'TIME', 'START', 'FINISH',
                    'AVG_PRICE', 'PRICE_CALC', 'CALC_RUB', 'CALC_UPDATED_AT', 'IMAGES'
                ];

                if (existing.length > 0) {
                    // Обновляем
                    const updateFields = columns.filter(col => col !== 'ID').map(col => `${col} = ?`).join(', ');
                    const values = columns.filter(col => col !== 'ID').map(col => carData[col] || null);
                    values.push(carData.ID);

                    await connection.execute(
                        `UPDATE ${table} SET ${updateFields}, CALC_UPDATED_AT = NOW() WHERE ID = ?`,
                        values
                    );
                    console.log(`✓ Car ${carData.ID} updated in ${table}`);
                    return 'updated';
                } else {
                    // Вставляем
                    const placeholders = columns.map(() => '?').join(', ');
                    const values = columns.map(col => carData[col] || null);

                    await connection.execute(
                        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
                        values
                    );
                    console.log(`✓ Car ${carData.ID} inserted into ${table}`);
                    return 'inserted';
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error(`Error saving car ${carData?.ID} to database:`, error.message);
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

    /**
     * Проверяет массив машин с API на наличие сохраненных цен в локальной БД.
     * Если цена есть - подставляет её в объект.
     */
    async _mergeWithLocalPrices(cars, table) {
        if (!cars || cars.length === 0) return [];

        // Получаем список ID, очищаем от пробелов
        const ids = cars.map(c => String(c.ID || c.id).trim()).filter(Boolean);

        if (ids.length === 0) return cars;

        try {
            const connection = await db.getConnection();

            // Создаем строку плейсхолдеров (?,?,?)
            const placeholders = ids.map(() => '?').join(',');

            // ИСПРАВЛЕНО: Убрали STOCK_PRICE из запроса, так как его нет в базе
            const [rows] = await connection.execute(
                `SELECT ID, CALC_RUB FROM ${table} WHERE ID IN (${placeholders})`,
                ids
            );
            connection.release();

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
        }
    }

    /**
     * Поиск чисто по локальной базе (когда есть фильтр цены)
     */
    async _getLocalCarsWithFilters(filters, table) {
        try {
            const conditions = ['1=1'];
            const params = [];

            // === Генерация SQL условий ===

            // Цена
            if (filters.price_from) {
                conditions.push('CALC_RUB >= ?');
                params.push(parseInt(filters.price_from));
            }
            if (filters.price_to) {
                conditions.push('CALC_RUB <= ?');
                params.push(parseInt(filters.price_to));
            }

            // Марка
            if (filters.vendor) {
                conditions.push('MARKA_NAME = ?');
                params.push(filters.vendor);
            }

            // Модель
            if (filters.model) {
                conditions.push('MODEL_NAME = ?');
                params.push(filters.model);
            }

            // Год
            if (filters.year_from) {
                conditions.push('YEAR >= ?');
                params.push(parseInt(filters.year_from));
            }
            if (filters.year_to) {
                conditions.push('YEAR <= ?');
                params.push(parseInt(filters.year_to));
            }

            // Объем
            if (filters.engine_from) {
                conditions.push('ENG_V >= ?');
                params.push(parseFloat(filters.engine_from));
            }
            if (filters.engine_to) {
                conditions.push('ENG_V <= ?');
                params.push(parseFloat(filters.engine_to));
            }

            // Пагинация
            const limit = parseInt(filters.limit) || 20;
            const offset = parseInt(filters.offset) || 0;

            const whereClause = conditions.join(' AND ');
            const sql = `SELECT * FROM ${table} WHERE ${whereClause} ORDER BY ID DESC LIMIT ${limit} OFFSET ${offset}`;

            const connection = await db.getConnection();
            const [rows] = await connection.execute(sql, params);
            connection.release();

            // Важно: данные из базы тоже прогоняем через нормализатор
            return rows.map(car => this._normalizeCarData(car));

        } catch (error) {
            console.error('Error searching local DB:', error.message);
            return [];
        }
    }
}

module.exports = new CarModel();