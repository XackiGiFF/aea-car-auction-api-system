const BaseProvider = require('../BaseProvider');
const db = require('../../config/database');

class Che168Provider extends BaseProvider {
    constructor() {
        super();
        this.name = 'che-168';

        // Маппинг полей для разных таблиц
        this.tableFields = {
            'che_available': {
                id: 'ID',
                vendor: 'MARKA_NAME',
                model: 'MODEL_NAME',
                year: 'YEAR',
                engine: 'ENG_V',
                price: 'CALC_RUB',
                mileage: 'MILEAGE',
                transmission: 'KPP',
                auction_date: null,
                created_at: 'created_at'
            },
            'bike': {
                id: 'ID',
                vendor: 'MARKA_NAME',
                model: 'MODEL_NAME',
                year: 'YEAR',
                engine: 'ENG_V',
                price: 'CALC_RUB',
                mileage: 'MILEAGE',
                transmission: null,
                auction_date: 'AUCTION_DATE',
                created_at: 'created_at'
            },
            'main': {
                id: 'ID',
                vendor: 'MARKA_NAME',
                model: 'MODEL_NAME',
                year: 'YEAR',
                engine: 'ENG_V',
                price: 'CALC_RUB',
                mileage: 'MILEAGE',
                transmission: 'KPP',
                auction_date: 'AUCTION_DATE',
                created_at: 'created_at'
            }
        };
    }

    // Получить маппинг полей для таблицы
    _getFields(table) {
        return this.tableFields[table] || this.tableFields['che_available'];
    }

    /**
     * Универсальная функция для извлечения rows из результата db.query
     * @param {*} result Результат db.query()
     * @returns {Array} Массив строк
     */
    _extractRows(result) {
        if (!result) return [];

        // Случай 1: Уже массив строк (прямой результат)
        if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
            return result;
        }

        // Случай 2: [rows, fields] от mysql2/promise
        if (Array.isArray(result) && result.length >= 2) {
            return result[0] || [];
        }

        // Случай 3: Объект, который выглядит как массив (ключи 0,1,2...)
        if (result && typeof result === 'object' && !Array.isArray(result)) {
            // Проверяем, есть ли числовые ключи (как у массива)
            const hasNumericKeys = Object.keys(result).some(key => !isNaN(parseInt(key)));
            if (hasNumericKeys) {
                // Преобразуем объект с числовыми ключами в массив
                return Object.values(result);
            }

            // Проверяем свойство rows
            if (result.rows && Array.isArray(result.rows)) {
                return result.rows;
            }

            // Проверяем другие возможные свойства
            for (const key in result) {
                if (Array.isArray(result[key])) {
                    return result[key];
                }
            }

            // Если это одиночный объект, оборачиваем в массив
            return [result];
        }

        // По умолчанию возвращаем пустой массив
        return [];
    }

    async getCars(filters = {}, table = 'che_available') {
        try {
            const fields = this._getFields(table);

            // Базовый запрос
            let sql = `SELECT * FROM ${table} WHERE deleted = 0`;
            const params = [];

            // Добавляем фильтры с параметризацией
            if (filters.vendor && fields.vendor) {
                sql += ` AND ${fields.vendor} = ?`;
                params.push(filters.vendor);
            }

            if (filters.model && fields.model) {
                sql += ` AND ${fields.model} = ?`;
                params.push(filters.model);
            }

            if (filters.year_from && fields.year) {
                sql += ` AND ${fields.year} >= ?`;
                params.push(parseInt(filters.year_from));
            }

            if (filters.year_to && fields.year) {
                sql += ` AND ${fields.year} <= ?`;
                params.push(parseInt(filters.year_to));
            }

            if (filters.engine_from && fields.engine) {
                sql += ` AND ${fields.engine} >= ?`;
                params.push(parseFloat(filters.engine_from));
            }

            if (filters.engine_to && fields.engine) {
                sql += ` AND ${fields.engine} <= ?`;
                params.push(parseFloat(filters.engine_to));
            }

            if (filters.price_from && fields.price) {
                sql += ` AND ${fields.price} >= ?`;
                params.push(parseFloat(filters.price_from));
            }

            if (filters.price_to && fields.price) {
                sql += ` AND ${fields.price} <= ?`;
                params.push(parseFloat(filters.price_to));
            }

            // Сортировка
            if (fields.auction_date) {
                sql += ` ORDER BY ${fields.auction_date} DESC`;
            } else if (fields.created_at) {
                sql += ` ORDER BY ${fields.created_at} DESC`;
            } else {
                sql += ` ORDER BY ${fields.id} DESC`;
            }

            // Лимит и оффсет
            const limit = parseInt(filters.limit) || 20;
            const offset = parseInt(filters.offset) || 0;
            sql += ` LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            console.log(`[CHE-168] SQL: ${sql}`, params);
            const result = await db.query(sql, params);

            // Используем универсальную функцию для извлечения rows
            return this._extractRows(result);
        } catch (error) {
            console.error(`Error getting cars from ${table}:`, error.message);
            return [];
        }
    }

    async getCarById(carId, table = 'che_available') {
        try {
            const result = await db.query(
                `SELECT * FROM ${table} WHERE ID = ? AND deleted = 0`,
                [carId]
            );

            const rows = this._extractRows(result);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error getting car by ID:', error.message);
            return null;
        }
    }

    async getCarPrice(carId, table = 'che_available') {
        try {
            const fields = this._getFields(table);
            const result = await db.query(
                `SELECT ${fields.price}, CALC_UPDATED_AT FROM ${table} WHERE ID = ? AND deleted = 0`,
                [carId]
            );

            const rows = this._extractRows(result);
            if (rows.length > 0) {
                return {
                    calc_rub: rows[0][fields.price],
                    last_updated: rows[0].CALC_UPDATED_AT
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting car price:', error.message);
            return null;
        }
    }

    async getDynamicFilters(currentFilters = {}, table = 'che_available') {
        try {
            const fields = this._getFields(table);

            console.log(`[CHE-168] Getting filters for table: ${table}`);

            // Вендоры
            const vendorsResult = await db.query(
                `SELECT DISTINCT ${fields.vendor} FROM ${table}
                 WHERE deleted = 0 AND ${fields.vendor} IS NOT NULL
                 ORDER BY ${fields.vendor}`
            );

            const vendors = this._extractRows(vendorsResult);
            console.log(`[CHE-168] Extracted ${vendors.length} vendors`);

            // Модели
            let models = [];
            if (currentFilters.vendor && fields.vendor && fields.model) {
                const modelRowsResult = await db.query(
                    `SELECT DISTINCT ${fields.model} FROM ${table}
                     WHERE ${fields.vendor} = ? AND deleted = 0 
                     AND ${fields.model} IS NOT NULL
                     ORDER BY ${fields.model}`,
                    [currentFilters.vendor]
                );

                const modelRows = this._extractRows(modelRowsResult);
                models = modelRows.map(row => row[fields.model]);
                console.log(`[CHE-168] Extracted ${models.length} models for vendor: ${currentFilters.vendor}`);
            }

            // Годы
            const yearsResult = await db.query(
                `SELECT DISTINCT ${fields.year} FROM ${table}
                 WHERE deleted = 0 AND ${fields.year} IS NOT NULL 
                 ORDER BY ${fields.year} DESC`
            );

            const years = this._extractRows(yearsResult);
            console.log(`[CHE-168] Extracted ${years.length} years`);

            const yearRange = years.map(row => row[fields.year])
                .filter(y => y && y > 1900);

            console.log(`[CHE-168] Year range: ${yearRange.length} years`);

            return {
                vendors: vendors.map(row => row[fields.vendor]).filter(Boolean),
                models: models.filter(Boolean),
                years: yearRange,
                fuel_types: {},
                transmissions: {},
                drives: {}
            };
        } catch (error) {
            console.error(`Error getting filters from ${table}:`, error.message);
            return {
                vendors: [],
                models: [],
                years: [],
                fuel_types: {},
                transmissions: {},
                drives: {}
            };
        }
    }

    async getTotalCount(filters = {}, table = 'che_available') {
        try {
            const fields = this._getFields(table);

            let sql = `SELECT COUNT(*) as count FROM ${table} WHERE deleted = 0`;
            const params = [];

            if (filters.vendor && fields.vendor) {
                sql += ` AND ${fields.vendor} = ?`;
                params.push(filters.vendor);
            }

            if (filters.model && fields.model) {
                sql += ` AND ${fields.model} = ?`;
                params.push(filters.model);
            }

            if (filters.year_from && fields.year) {
                sql += ` AND ${fields.year} >= ?`;
                params.push(parseInt(filters.year_from));
            }

            if (filters.year_to && fields.year) {
                sql += ` AND ${fields.year} <= ?`;
                params.push(parseInt(filters.year_to));
            }

            const result = await db.query(sql, params);
            const rows = this._extractRows(result);

            return rows.length > 0 ? parseInt(rows[0].count) || 0 : 0;
        } catch (error) {
            console.error(`Error getting total count from ${table}:`, error.message);
            return 0;
        }
    }

    async getVendors(table = 'che_available') {
        try {
            const fields = this._getFields(table);
            const result = await db.query(
                `SELECT DISTINCT ${fields.vendor} as MARKA_NAME FROM ${table}
                 WHERE deleted = 0 AND ${fields.vendor} IS NOT NULL
                 ORDER BY ${fields.vendor}`
            );

            const rows = this._extractRows(result);
            return rows.map(row => ({
                MARKA_ID: '',
                MARKA_NAME: row.MARKA_NAME
            }));
        } catch (error) {
            console.error('Error getting vendors:', error.message);
            return [];
        }
    }

    async getModelsByVendor(vendorName, table = 'che_available') {
        try {
            const fields = this._getFields(table);
            const result = await db.query(
                `SELECT DISTINCT ${fields.model} as MODEL_NAME FROM ${table}
                 WHERE ${fields.vendor} = ? AND deleted = 0 
                 AND ${fields.model} IS NOT NULL
                 ORDER BY ${fields.model}`,
                [vendorName]
            );

            const rows = this._extractRows(result);
            return rows.map(row => ({
                MODEL_ID: '',
                MODEL_NAME: row.MODEL_NAME
            }));
        } catch (error) {
            console.error('Error getting models by vendor:', error.message);
            return [];
        }
    }

    // Дополнительные методы для совместимости
    async getAvailableFuelTypes(table = 'che_available') {
        return [];
    }

    async getAvailableTransmissions(table = 'che_available') {
        return {};
    }

    async getAvailableDrives(table = 'che_available') {
        return {};
    }
}

module.exports = Che168Provider;