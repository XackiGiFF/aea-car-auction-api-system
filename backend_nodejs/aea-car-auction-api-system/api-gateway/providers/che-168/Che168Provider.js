const BaseProvider = require('../BaseProvider');
const db = require('../../config/database');

class Che168Provider extends BaseProvider {
    constructor() {
        super();
        this.name = 'che-168';

        // Маппинг полей для разных таблиц
        this.tableFields = {
            che_available: {
                id: 'ID',
                vendor: 'MARKA_NAME',
                model: 'MODEL_NAME',
                year: 'YEAR',
                engine: 'ENG_V',
                price: 'CALC_RUB',
                mileage: 'MILEAGE',
                transmission: 'KPP',
                drive: 'PRIV',
                fuel_type: 'TIME',
                auction_date: null,
                created_at: 'created_at'
            },
            bike: {
                id: 'ID',
                vendor: 'MARKA_NAME',
                model: 'MODEL_NAME',
                year: 'YEAR',
                engine: 'ENG_V',
                price: 'CALC_RUB',
                mileage: 'MILEAGE',
                transmission: null,
                drive: null,
                fuel_type: null,
                auction_date: 'AUCTION_DATE',
                created_at: 'created_at'
            },
            main: {
                id: 'ID',
                vendor: 'MARKA_NAME',
                model: 'MODEL_NAME',
                year: 'YEAR',
                engine: 'ENG_V',
                price: 'CALC_RUB',
                mileage: 'MILEAGE',
                transmission: 'KPP',
                drive: 'PRIV',
                fuel_type: 'TIME',
                auction_date: 'AUCTION_DATE',
                created_at: 'created_at'
            }
        };

        // Групповые фильтры: UI-значение -> реальные коды в БД
        this.fuelGroups = {
            petrol: ['G', 'P', 'L', 'C'],
            diesel: ['D'],
            hybrid: ['H', 'HE', '&'],
            electric: ['E'],
            other: ['O']
        };

        this.transmissionGroups = {
            automatic: ['AT', 'A', 'AUTO', 'DCT', 'DSG', 'PDK', 'SAT', 'IAT', 'FAT'],
            manual: ['MT', 'M', 'FMT', 'IMT', 'DMT'],
            cvt: ['CVT', 'ECVT', 'FCVT', 'DCVT', 'CCVT', 'AC'],
            hybrid: ['HL', 'H'],
            sequential: ['SQ', 'SEQ'],
            other: ['OTHER', '-', '...']
        };

        this.driveGroups = {
            fwd: ['FF', 'FWD', '2WD'],
            rwd: ['FR', 'RWD', 'RR'],
            awd: ['4WD', 'AWD', '4X4', 'FULLTIME4WD', 'PARTTIME4WD'],
            other: ['OTHER']
        };

        this.fuelNames = {
            G: 'Бензин',
            P: 'Бензин',
            D: 'Дизель',
            E: 'Электро',
            H: 'Гибрид',
            HE: 'Гибрид (Э)',
            L: 'Газ (LPG)',
            C: 'Газ (CNG)',
            O: 'Другое',
            '&': 'Гибрид (&)'
        };
    }

    _getSafeTable(table) {
        return this.tableFields[table] ? table : 'che_available';
    }

    // Получить маппинг полей для таблицы
    _getFields(table) {
        const safeTable = this._getSafeTable(table);
        return this.tableFields[safeTable];
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
            const hasNumericKeys = Object.keys(result).some(key => !isNaN(parseInt(key, 10)));
            if (hasNumericKeys) {
                return Object.values(result);
            }

            if (result.rows && Array.isArray(result.rows)) {
                return result.rows;
            }

            for (const key in result) {
                if (Array.isArray(result[key])) {
                    return result[key];
                }
            }

            return [result];
        }

        return [];
    }

    _normalizeFilterValue(value) {
        if (Array.isArray(value)) {
            return value.length > 0 ? String(value[0]).trim() : '';
        }
        return value == null ? '' : String(value).trim();
    }

    _toNumber(value, parser = parseFloat) {
        const normalized = this._normalizeFilterValue(value);
        if (normalized === '') return null;
        const num = parser(normalized);
        return Number.isNaN(num) ? null : num;
    }

    _resolveMappedValues(rawValue, groupMap = {}) {
        const normalized = this._normalizeFilterValue(rawValue);
        if (!normalized) return [];

        const key = normalized.toLowerCase();
        if (groupMap[key]) {
            return groupMap[key];
        }

        if (normalized.includes(',')) {
            return normalized.split(',').map(item => item.trim()).filter(Boolean);
        }

        return [normalized];
    }

    _pushInClause(clauses, params, column, values = []) {
        const nonEmptyValues = values
            .map(value => this._normalizeFilterValue(value))
            .filter(Boolean);

        if (!column || nonEmptyValues.length === 0) return;

        if (nonEmptyValues.length === 1) {
            clauses.push(`${column} = ?`);
            params.push(nonEmptyValues[0]);
            return;
        }

        const placeholders = nonEmptyValues.map(() => '?').join(', ');
        clauses.push(`${column} IN (${placeholders})`);
        params.push(...nonEmptyValues);
    }

    _mileageExpr(column) {
        return `CAST(REPLACE(REPLACE(${column}, ',', ''), ' ', '') AS UNSIGNED)`;
    }

    _buildWhereClause(filters = {}, table = 'che_available') {
        const safeTable = this._getSafeTable(table);
        const fields = this._getFields(safeTable);
        const clauses = ['deleted = 0'];
        const params = [];

        const vendor = this._normalizeFilterValue(filters.vendor);
        if (vendor && fields.vendor) {
            clauses.push(`${fields.vendor} = ?`);
            params.push(vendor);
        }

        const model = this._normalizeFilterValue(filters.model);
        if (model && fields.model) {
            clauses.push(`${fields.model} = ?`);
            params.push(model);
        }

        const yearFrom = this._toNumber(filters.year_from, parseInt);
        if (yearFrom != null && fields.year) {
            clauses.push(`${fields.year} >= ?`);
            params.push(yearFrom);
        }

        const yearTo = this._toNumber(filters.year_to, parseInt);
        if (yearTo != null && fields.year) {
            clauses.push(`${fields.year} <= ?`);
            params.push(yearTo);
        }

        const engineFrom = this._toNumber(filters.engine_from);
        if (engineFrom != null && fields.engine) {
            clauses.push(`${fields.engine} >= ?`);
            params.push(engineFrom);
        }

        const engineTo = this._toNumber(filters.engine_to);
        if (engineTo != null && fields.engine) {
            clauses.push(`${fields.engine} <= ?`);
            params.push(engineTo);
        }

        const priceFrom = this._toNumber(filters.price_from);
        if (priceFrom != null && fields.price) {
            clauses.push(`${fields.price} >= ?`);
            params.push(priceFrom);
        }

        const priceTo = this._toNumber(filters.price_to);
        if (priceTo != null && fields.price) {
            clauses.push(`${fields.price} <= ?`);
            params.push(priceTo);
        }

        const mileageFrom = this._toNumber(filters.mileage_from, parseInt);
        if (mileageFrom != null && fields.mileage) {
            clauses.push(`${this._mileageExpr(fields.mileage)} >= ?`);
            params.push(mileageFrom);
        }

        const mileageTo = this._toNumber(filters.mileage_to, parseInt);
        if (mileageTo != null && fields.mileage) {
            clauses.push(`${this._mileageExpr(fields.mileage)} <= ?`);
            params.push(mileageTo);
        }

        const transmissionValue = this._normalizeFilterValue(filters.transmission) ||
            this._normalizeFilterValue(filters.transmission_group);
        if (transmissionValue && fields.transmission) {
            const mapped = this._resolveMappedValues(transmissionValue, this.transmissionGroups);
            this._pushInClause(clauses, params, fields.transmission, mapped);
        }

        const driveValue = this._normalizeFilterValue(filters.drive) ||
            this._normalizeFilterValue(filters.drive_group);
        if (driveValue && fields.drive) {
            const mapped = this._resolveMappedValues(driveValue, this.driveGroups);
            this._pushInClause(clauses, params, fields.drive, mapped);
        }

        const fuelValue = this._normalizeFilterValue(filters.fuel_type) ||
            this._normalizeFilterValue(filters.fuel_group);
        if (fuelValue && fields.fuel_type) {
            const mapped = this._resolveMappedValues(fuelValue, this.fuelGroups);
            this._pushInClause(clauses, params, fields.fuel_type, mapped);
        }

        return {
            table: safeTable,
            fields,
            whereSql: clauses.join(' AND '),
            params
        };
    }

    _emptyTransmissionGroups() {
        return {
            automatic: { name: 'Автоматическая', count: 0 },
            manual: { name: 'Механическая', count: 0 },
            cvt: { name: 'Вариатор (CVT)', count: 0 },
            hybrid: { name: 'Гибридная', count: 0 },
            sequential: { name: 'Секвентальная', count: 0 },
            other: { name: 'Другое', count: 0 }
        };
    }

    _emptyDriveGroups() {
        return {
            fwd: { name: 'Передний привод', count: 0 },
            rwd: { name: 'Задний привод', count: 0 },
            awd: { name: 'Полный привод', count: 0 },
            other: { name: 'Другое', count: 0 }
        };
    }

    _mapFuelCodeToName(code) {
        const normalized = this._normalizeFilterValue(code).toUpperCase();
        return this.fuelNames[normalized] || (normalized || '—');
    }

    _detectTransmissionGroup(rawCode) {
        const code = this._normalizeFilterValue(rawCode).toUpperCase();
        if (!code) return 'other';

        if (code.includes('CVT')) return 'cvt';
        if (code === 'MT' || code.endsWith('MT')) return 'manual';
        if (
            code === 'AT' ||
            code === 'A' ||
            code.includes('AUTO') ||
            code.includes('DCT') ||
            code.includes('DSG') ||
            code.includes('PDK') ||
            code.endsWith('AT')
        ) return 'automatic';
        if (code === 'HL' || code === 'H') return 'hybrid';
        if (code === 'SQ' || code === 'SEQ') return 'sequential';

        return 'other';
    }

    _detectDriveGroup(rawCode) {
        const code = this._normalizeFilterValue(rawCode).toUpperCase();
        if (!code) return 'other';

        if (code.includes('4WD') || code.includes('AWD') || code.includes('4X4')) return 'awd';
        if (code.includes('FWD') || code.includes('FF')) return 'fwd';
        if (code.includes('RWD') || code.includes('FR') || code.includes('RR')) return 'rwd';

        return 'other';
    }

    _groupTransmissionRows(rows = []) {
        const groups = this._emptyTransmissionGroups();
        rows.forEach(row => {
            const count = parseInt(row.count, 10) || 0;
            const bucket = this._detectTransmissionGroup(row.code);
            if (groups[bucket]) groups[bucket].count += count;
        });
        return groups;
    }

    _groupDriveRows(rows = []) {
        const groups = this._emptyDriveGroups();
        rows.forEach(row => {
            const count = parseInt(row.count, 10) || 0;
            const bucket = this._detectDriveGroup(row.code);
            if (groups[bucket]) groups[bucket].count += count;
        });
        return groups;
    }

    _formatFuelRows(rows = []) {
        return rows
            .map(row => {
                const code = this._normalizeFilterValue(row.code).toUpperCase();
                if (!code) return null;
                return {
                    code,
                    name: this._mapFuelCodeToName(code),
                    count: parseInt(row.count, 10) || 0
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.count - a.count);
    }

    async getCars(filters = {}, table = 'che_available') {
        try {
            const { table: safeTable, fields, whereSql, params } = this._buildWhereClause(filters, table);
            let sql = `SELECT * FROM ${safeTable} WHERE ${whereSql}`;

            // Сортировка
            if (fields.auction_date) {
                sql += ` ORDER BY ${fields.auction_date} DESC`;
            } else if (fields.created_at) {
                sql += ` ORDER BY ${fields.created_at} DESC`;
            } else {
                sql += ` ORDER BY ${fields.id} DESC`;
            }

            // Лимит и оффсет
            const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 20, 1), 200);
            const offset = Math.max(parseInt(filters.offset, 10) || 0, 0);
            sql += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);

            console.log(`[CHE-168] SQL: ${sql}`, params);
            const result = await db.query(sql, params);

            return this._extractRows(result);
        } catch (error) {
            console.error(`Error getting cars from ${table}:`, error.message);
            return [];
        }
    }

    async getCarById(carId, table = 'che_available') {
        try {
            const safeTable = this._getSafeTable(table);
            const result = await db.query(
                `SELECT * FROM ${safeTable} WHERE ID = ? AND deleted = 0`,
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
            const safeTable = this._getSafeTable(table);
            const fields = this._getFields(safeTable);
            const result = await db.query(
                `SELECT ${fields.price}, CALC_UPDATED_AT FROM ${safeTable} WHERE ID = ? AND deleted = 0`,
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
            const safeTable = this._getSafeTable(table);
            const fields = this._getFields(safeTable);
            const { whereSql, params } = this._buildWhereClause(currentFilters, safeTable);

            console.log(`[CHE-168] Getting filters for table: ${safeTable}`);

            const vendorsResult = await db.query(
                `SELECT DISTINCT ${fields.vendor} FROM ${safeTable}
                 WHERE deleted = 0 AND ${fields.vendor} IS NOT NULL
                 ORDER BY ${fields.vendor}`
            );

            const vendors = this._extractRows(vendorsResult);

            let models = [];
            if (currentFilters.vendor && fields.vendor && fields.model) {
                const modelRowsResult = await db.query(
                    `SELECT DISTINCT ${fields.model} FROM ${safeTable}
                     WHERE ${fields.vendor} = ? AND deleted = 0
                     AND ${fields.model} IS NOT NULL
                     ORDER BY ${fields.model}`,
                    [currentFilters.vendor]
                );

                const modelRows = this._extractRows(modelRowsResult);
                models = modelRows.map(row => row[fields.model]);
            }

            const yearsResult = await db.query(
                `SELECT DISTINCT ${fields.year} FROM ${safeTable}
                 WHERE ${whereSql} AND ${fields.year} IS NOT NULL
                 ORDER BY ${fields.year} DESC`,
                params
            );

            const years = this._extractRows(yearsResult);
            const yearRange = years
                .map(row => row[fields.year])
                .filter(y => y && y > 1900);

            const [fuelRowsResult, transmissionRowsResult, driveRowsResult] = await Promise.all([
                fields.fuel_type
                    ? db.query(
                        `SELECT ${fields.fuel_type} as code, COUNT(*) as count
                         FROM ${safeTable}
                         WHERE ${whereSql} AND ${fields.fuel_type} IS NOT NULL AND ${fields.fuel_type} != ''
                         GROUP BY ${fields.fuel_type}`,
                        params
                    )
                    : Promise.resolve([]),
                fields.transmission
                    ? db.query(
                        `SELECT ${fields.transmission} as code, COUNT(*) as count
                         FROM ${safeTable}
                         WHERE ${whereSql} AND ${fields.transmission} IS NOT NULL AND ${fields.transmission} != ''
                         GROUP BY ${fields.transmission}`,
                        params
                    )
                    : Promise.resolve([]),
                fields.drive
                    ? db.query(
                        `SELECT ${fields.drive} as code, COUNT(*) as count
                         FROM ${safeTable}
                         WHERE ${whereSql} AND ${fields.drive} IS NOT NULL AND ${fields.drive} != ''
                         GROUP BY ${fields.drive}`,
                        params
                    )
                    : Promise.resolve([])
            ]);

            const fuelRows = this._extractRows(fuelRowsResult);
            const transmissionRows = this._extractRows(transmissionRowsResult);
            const driveRows = this._extractRows(driveRowsResult);
            const { code, ...filtersWithoutCode } = currentFilters;

            return {
                vendors: vendors.map(row => row[fields.vendor]).filter(Boolean),
                models: models.filter(Boolean),
                years: yearRange,
                fuel_types: fields.fuel_type ? this._formatFuelRows(fuelRows) : [],
                transmissions: fields.transmission ? this._groupTransmissionRows(transmissionRows) : this._emptyTransmissionGroups(),
                drives: fields.drive ? this._groupDriveRows(driveRows) : this._emptyDriveGroups(),
                current_filters: filtersWithoutCode,
                table_support: {
                    has_fuel_filter: !!fields.fuel_type,
                    has_transmission_filter: !!fields.transmission,
                    has_drive_filter: !!fields.drive
                }
            };
        } catch (error) {
            console.error(`Error getting filters from ${table}:`, error.message);
            return {
                vendors: [],
                models: [],
                years: [],
                fuel_types: [],
                transmissions: this._emptyTransmissionGroups(),
                drives: this._emptyDriveGroups(),
                current_filters: {},
                table_support: {
                    has_fuel_filter: true,
                    has_transmission_filter: true,
                    has_drive_filter: true
                }
            };
        }
    }

    async getTotalCount(filters = {}, table = 'che_available') {
        try {
            const { table: safeTable, whereSql, params } = this._buildWhereClause(filters, table);
            const sql = `SELECT COUNT(*) as count FROM ${safeTable} WHERE ${whereSql}`;

            const result = await db.query(sql, params);
            const rows = this._extractRows(result);

            return rows.length > 0 ? parseInt(rows[0].count, 10) || 0 : 0;
        } catch (error) {
            console.error(`Error getting total count from ${table}:`, error.message);
            return 0;
        }
    }

    async getVendors(table = 'che_available') {
        try {
            const safeTable = this._getSafeTable(table);
            const fields = this._getFields(safeTable);
            const result = await db.query(
                `SELECT DISTINCT ${fields.vendor} as MARKA_NAME FROM ${safeTable}
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
            const safeTable = this._getSafeTable(table);
            const fields = this._getFields(safeTable);
            const result = await db.query(
                `SELECT DISTINCT ${fields.model} as MODEL_NAME FROM ${safeTable}
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
        try {
            const safeTable = this._getSafeTable(table);
            const fields = this._getFields(safeTable);
            if (!fields.fuel_type) return [];

            const result = await db.query(
                `SELECT ${fields.fuel_type} as code, COUNT(*) as count
                 FROM ${safeTable}
                 WHERE deleted = 0 AND ${fields.fuel_type} IS NOT NULL AND ${fields.fuel_type} != ''
                 GROUP BY ${fields.fuel_type}`
            );

            return this._formatFuelRows(this._extractRows(result));
        } catch (error) {
            console.error('Error getting fuel types:', error.message);
            return [];
        }
    }

    async getAvailableTransmissions(table = 'che_available') {
        try {
            const safeTable = this._getSafeTable(table);
            const fields = this._getFields(safeTable);
            if (!fields.transmission) return this._emptyTransmissionGroups();

            const result = await db.query(
                `SELECT ${fields.transmission} as code, COUNT(*) as count
                 FROM ${safeTable}
                 WHERE deleted = 0 AND ${fields.transmission} IS NOT NULL AND ${fields.transmission} != ''
                 GROUP BY ${fields.transmission}`
            );

            return this._groupTransmissionRows(this._extractRows(result));
        } catch (error) {
            console.error('Error getting transmissions:', error.message);
            return this._emptyTransmissionGroups();
        }
    }

    async getAvailableDrives(table = 'che_available') {
        try {
            const safeTable = this._getSafeTable(table);
            const fields = this._getFields(safeTable);
            if (!fields.drive) return this._emptyDriveGroups();

            const result = await db.query(
                `SELECT ${fields.drive} as code, COUNT(*) as count
                 FROM ${safeTable}
                 WHERE deleted = 0 AND ${fields.drive} IS NOT NULL AND ${fields.drive} != ''
                 GROUP BY ${fields.drive}`
            );

            return this._groupDriveRows(this._extractRows(result));
        } catch (error) {
            console.error('Error getting drives:', error.message);
            return this._emptyDriveGroups();
        }
    }
}

module.exports = Che168Provider;
