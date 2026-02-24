/**
 * @swagger
 * tags:
 *   - name: Cars
 *     description: Управление автомобилями
 *   - name: Filters
 *     description: Фильтры и поиск
 *   - name: Statistics
 *     description: Статистика
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Car:
 *       type: object
 *       properties:
 *         ID:
 *           type: string
 *           example: "6XRbj3bDkAdf4V"
 *         MARKA_NAME:
 *           type: string
 *           example: "TOYOTA"
 *         MODEL_NAME:
 *           type: string
 *           example: "PRIUS"
 *         YEAR:
 *           type: string
 *           example: "2024"
 *         PRICE_CALC:
 *           type: number
 *           format: float
 *           example: 1098156.90
 *         CALC_RUB:
 *           type: number
 *           format: float
 *           example: 1098156.90
 *
 *     Filter:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *           example: "G"
 *         name:
 *           type: string
 *           example: "Бензин (G)"
 *         type:
 *           type: string
 *           example: "petrol"
 *
 *     Pagination:
 *       type: object
 *       properties:
 *         limit:
 *           type: integer
 *           example: 100
 *         offset:
 *           type: integer
 *           example: 0
 *         total:
 *           type: integer
 *           example: 1000
 *
 *     PriceRange:
 *       type: object
 *       properties:
 *         min:
 *           type: number
 *           example: 100000
 *         max:
 *           type: number
 *           example: 5000000
 *         currency:
 *           type: string
 *           example: "RUB"
 *     FuelType:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *           example: "H"
 *         name:
 *           type: string
 *           example: "Гибрид (H)"
 *         tks_type:
 *           type: string
 *           example: "petrol_electric"
 *         count:
 *           type: integer
 *           example: 3674
 *     TransmissionGroups:
 *       type: object
 *       properties:
 *         automatic:
 *           $ref: '#/components/schemas/FilterGroup'
 *         manual:
 *           $ref: '#/components/schemas/FilterGroup'
 *         cvt:
 *           $ref: '#/components/schemas/FilterGroup'
 *         sequential:
 *           $ref: '#/components/schemas/FilterGroup'
 *         other:
 *           $ref: '#/components/schemas/FilterGroup'
 *     DriveGroups:
 *       type: object
 *       properties:
 *         fwd:
 *           $ref: '#/components/schemas/FilterGroup'
 *         rwd:
 *           $ref: '#/components/schemas/FilterGroup'
 *         awd:
 *           $ref: '#/components/schemas/FilterGroup'
 *         other:
 *           $ref: '#/components/schemas/FilterGroup'
 *     FilterGroup:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: "Автоматическая"
 *         count:
 *           type: integer
 *           example: 13187
 */



const express = require('express');
const axios = require('axios');
const net = require('node:net');
const CarModel = require('../models/CarModel');
require('dotenv').config();

const router = express.Router();
const CALC_BOT_URL = process.env.CALC_BOT_URL || 'http://calc-bot:3001';
const CALC_BOT_INTERNAL_TOKEN = process.env.CALC_BOT_INTERNAL_TOKEN || '';
const ON_DEMAND_CALC_ENABLED = process.env.ON_DEMAND_CALC_ENABLED !== 'false';
const ON_DEMAND_CALC_TIMEOUT_MS = parseInt(process.env.ON_DEMAND_CALC_TIMEOUT_MS || '12000', 10);
const PAGINATION_LIMIT_DEFAULT = (() => {
    const parsed = Number.parseInt(process.env.API_PAGINATION_LIMIT_DEFAULT || '20', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 20;
})();
const PAGINATION_LIMIT_MAX = (() => {
    const parsed = Number.parseInt(process.env.API_PAGINATION_LIMIT_MAX || '200', 10);
    if (!Number.isInteger(parsed) || parsed < PAGINATION_LIMIT_DEFAULT) {
        return 200;
    }
    return parsed;
})();
const PAGINATION_OFFSET_MAX = (() => {
    const parsed = Number.parseInt(process.env.API_PAGINATION_OFFSET_MAX || '1000000', 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 1000000;
})();
const FILTER_STRING_MAX_LEN = (() => {
    const parsed = Number.parseInt(process.env.API_FILTER_STRING_MAX_LEN || '120', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 120;
})();
const YEAR_MIN = 1900;
const YEAR_MAX = new Date().getUTCFullYear() + 2;
const ENGINE_MIN = 0;
const ENGINE_MAX = 10000;
const MILEAGE_MIN = 0;
const MILEAGE_MAX = 5000000;
const PRICE_MIN = 0;
const PRICE_MAX = 1000000000;

const ALLOWED_FILTER_KEYS = new Set([
    'vendor',
    'model',
    'year',
    'year_from',
    'year_to',
    'engine',
    'engine_from',
    'engine_to',
    'mileage',
    'mileage_from',
    'mileage_to',
    'price',
    'price_from',
    'price_to',
    'transmission',
    'transmission_group',
    'drive',
    'drive_group',
    'fuel',
    'fuel_type',
    'fuel_group',
    'page'
]);

const TRANSMISSION_GROUP_VALUES = new Set(['automatic', 'manual', 'cvt', 'hybrid', 'sequential', 'other', 'unknown']);
const DRIVE_GROUP_VALUES = new Set(['fwd', 'rwd', 'awd', 'other', 'unknown']);
const FUEL_GROUP_VALUES = new Set(['petrol', 'diesel', 'hybrid', 'electric', 'other', 'unknown']);

const TRANSMISSION_RAW_VALUES = new Set([
    'AT', 'A', 'AUTO', 'OA', 'FAT', 'FA', '4FAT', '5FAT', '7FAT', '3FAT', 'DAT', 'DA', 'IAT', 'IA',
    '6DAT', '5DAT', '4DAT', 'SAT', 'SEMIAT', 'PAT', '6X2', '8X2', 'DCT', 'DSG', 'PDK', '6D',
    '4AT', '5AT', '6AT', '7AT', '8AT', '9AT', '3AT', '-', '...', '..S', '7..', 'F', 'FM', '??', 'X',
    'MT', 'M', 'FMT', 'IMT', 'DMT', '5MT', '6MT', '7MT', '4MT', 'F5', 'F6', 'F4', 'F7', 'F9', '5F',
    '6F', 'I5', 'I6', 'I7', 'CVT', 'FCVT', 'DCVT', 'CCVT', 'AC', 'CVT7', 'CVT8', 'VC', 'C', 'CA',
    'CAT', 'C3', 'C4', 'C5', 'C6', 'HL', 'HL5', 'HL6', 'HL8', 'HL9', 'H', 'SQ', 'SEQ'
]);

const DRIVE_RAW_TOKEN_VALUES = new Set([
    'FF', 'FWD', '2WD', 'FR', 'RWD', 'RR', '4WD', 'AWD', '4X4', 'FULLTIME4WD', 'PARTTIME4WD', 'MIDSHIP', 'PARTTIME'
]);

const FUEL_RAW_VALUES = new Set(['G', 'P', 'L', 'C', 'D', 'H', 'HE', '&', 'E', 'O', 'B']);

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

// Middleware для проверки барьерного кода
const validateBarrierCode = (req, res, next) => {
    const barrierCode = req.query.code || req.headers['x-api-code'];

    if (!barrierCode || barrierCode !== process.env.API_BARRIER_CODE) {
        return res.status(401).json({
            error: 'Invalid or missing barrier code',
            code: 'UNAUTHORIZED'
        });
    }

    next();
};

const runOnDemandRecalculation = async (carId, table) => {
    if (!ON_DEMAND_CALC_ENABLED) {
        return { success: false, skipped: true, reason: 'disabled' };
    }

    if (!CALC_BOT_INTERNAL_TOKEN) {
        return { success: false, skipped: true, reason: 'missing_internal_token' };
    }

    try {
        const response = await axios.post(
            `${CALC_BOT_URL}/internal/recalculate`,
            { id: carId, table },
            {
                timeout: ON_DEMAND_CALC_TIMEOUT_MS,
                validateStatus: () => true,
                headers: {
                    'x-internal-token': CALC_BOT_INTERNAL_TOKEN,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.status >= 400) {
            return {
                success: false,
                error: response.data?.error || response.data?.data?.reason || `status_${response.status}`,
                data: response.data?.data || null
            };
        }

        return {
            success: !!response.data?.success,
            data: response.data?.data || null
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.error || error.message
        };
    }
};

const normalizeLegacyFilterAliases = (filters = {}) => {
    const normalized = { ...filters };
    const hasFuelType = normalized.fuel_type !== undefined && normalized.fuel_type !== null && String(normalized.fuel_type).trim() !== '';
    const hasFuelGroup = normalized.fuel_group !== undefined && normalized.fuel_group !== null && String(normalized.fuel_group).trim() !== '';
    const hasLegacyFuel = normalized.fuel !== undefined && normalized.fuel !== null && String(normalized.fuel).trim() !== '';

    // Обратная совместимость: поддержка старого параметра fuel=hybrid
    if (!hasFuelType && !hasFuelGroup && hasLegacyFuel) {
        normalized.fuel_group = String(normalized.fuel).trim();
    }

    return normalized;
};

const sanitizeRequestContext = (tableRaw, providerRaw) => {
    const table = String(tableRaw || 'main').trim().toLowerCase();
    const provider = String(providerRaw || 'ajes').trim().toLowerCase();
    const allowedTables = new Set(CarModel.getTables());
    const allowedProviders = new Set(CarModel.getAvailableProviders());

    if (!allowedTables.has(table)) {
        return { error: `Unsupported table: ${table}` };
    }

    if (!allowedProviders.has(provider)) {
        return { error: `Unsupported provider: ${provider}` };
    }

    return { table, provider };
};

const parseStrictInteger = (value) => {
    const raw = String(value ?? '').trim();
    if (!/^-?\d+$/.test(raw)) {
        return null;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isSafeInteger(parsed) ? parsed : null;
};

const resolvePagination = (limitRaw, offsetRaw) => {
    let limit = PAGINATION_LIMIT_DEFAULT;
    let offset = 0;

    const hasLimit = limitRaw !== undefined && limitRaw !== null && String(limitRaw).trim() !== '';
    const hasOffset = offsetRaw !== undefined && offsetRaw !== null && String(offsetRaw).trim() !== '';

    if (hasLimit) {
        const parsedLimit = parseStrictInteger(limitRaw);
        if (parsedLimit === null) {
            return { error: 'Invalid limit: integer expected' };
        }
        if (parsedLimit < 1 || parsedLimit > PAGINATION_LIMIT_MAX) {
            return { error: `Invalid limit: allowed range is 1..${PAGINATION_LIMIT_MAX}` };
        }
        limit = parsedLimit;
    }

    if (hasOffset) {
        const parsedOffset = parseStrictInteger(offsetRaw);
        if (parsedOffset === null) {
            return { error: 'Invalid offset: integer expected' };
        }
        if (parsedOffset < 0 || parsedOffset > PAGINATION_OFFSET_MAX) {
            return { error: `Invalid offset: allowed range is 0..${PAGINATION_OFFSET_MAX}` };
        }
        offset = parsedOffset;
    }

    return { limit, offset };
};

const hasFilterValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const readSingleValue = (field, value) => {
    if (Array.isArray(value)) {
        return { error: `Duplicate parameter is not allowed: ${field}` };
    }
    return { value };
};

const parseStrictNumber = (value) => {
    const raw = String(value ?? '').trim();
    if (!/^-?\d+(\.\d+)?$/.test(raw)) {
        return null;
    }
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
};

const validateClientIP = (ipRaw) => {
    if (!hasFilterValue(ipRaw)) {
        return { error: 'Client IP required' };
    }

    const single = readSingleValue('client_ip', ipRaw);
    if (single.error) {
        return { error: single.error };
    }

    const ip = String(single.value).trim();
    if (net.isIP(ip) === 0) {
        return { error: 'Invalid client_ip format' };
    }

    return { clientIP: ip };
};

const validateStringFilter = (field, value, maxLen = FILTER_STRING_MAX_LEN) => {
    if (!hasFilterValue(value)) {
        return { value: undefined };
    }

    const single = readSingleValue(field, value);
    if (single.error) return { error: single.error };

    const normalized = String(single.value).trim();
    if (normalized.length === 0) {
        return { value: undefined };
    }
    if (normalized.length > maxLen) {
        return { error: `Invalid ${field}: max length is ${maxLen}` };
    }
    if (/[\u0000-\u001F\u007F]/.test(normalized)) {
        return { error: `Invalid ${field}: control characters are not allowed` };
    }
    if (/[<>`]/.test(normalized)) {
        return { error: `Invalid ${field}: unsafe characters are not allowed` };
    }

    return { value: normalized };
};

const validateEnumFilter = (field, value, allowedValues) => {
    if (!hasFilterValue(value)) {
        return { value: undefined };
    }

    const single = readSingleValue(field, value);
    if (single.error) return { error: single.error };

    const normalized = String(single.value).trim().toLowerCase();
    if (!allowedValues.has(normalized)) {
        return { error: `Invalid ${field}: unsupported value` };
    }

    return { value: normalized };
};

const validateIntegerRangeFilter = (field, value, min, max) => {
    if (!hasFilterValue(value)) {
        return { value: undefined };
    }

    const single = readSingleValue(field, value);
    if (single.error) return { error: single.error };

    const parsed = parseStrictInteger(single.value);
    if (parsed === null) {
        return { error: `Invalid ${field}: integer expected` };
    }
    if (parsed < min || parsed > max) {
        return { error: `Invalid ${field}: allowed range is ${min}..${max}` };
    }

    return { value: parsed };
};

const validateNumberRangeFilter = (field, value, min, max) => {
    if (!hasFilterValue(value)) {
        return { value: undefined };
    }

    const single = readSingleValue(field, value);
    if (single.error) return { error: single.error };

    const parsed = parseStrictNumber(single.value);
    if (parsed === null) {
        return { error: `Invalid ${field}: number expected` };
    }
    if (parsed < min || parsed > max) {
        return { error: `Invalid ${field}: allowed range is ${min}..${max}` };
    }

    return { value: parsed };
};

const validateTransmissionRaw = (value) => {
    if (!hasFilterValue(value)) {
        return { value: undefined };
    }

    const single = readSingleValue('transmission', value);
    if (single.error) return { error: single.error };

    const raw = String(single.value).trim();
    if (raw.length === 0) return { value: undefined };

    const asGroup = raw.toLowerCase();
    if (TRANSMISSION_GROUP_VALUES.has(asGroup)) {
        return { value: asGroup };
    }

    const asCode = raw.toUpperCase();
    if (!TRANSMISSION_RAW_VALUES.has(asCode)) {
        return { error: 'Invalid transmission: unsupported value' };
    }

    return { value: asCode };
};

const validateDriveRaw = (value) => {
    if (!hasFilterValue(value)) {
        return { value: undefined };
    }

    const single = readSingleValue('drive', value);
    if (single.error) return { error: single.error };

    const raw = String(single.value).trim();
    if (raw.length === 0) return { value: undefined };

    const asGroup = raw.toLowerCase();
    if (DRIVE_GROUP_VALUES.has(asGroup)) {
        return { value: asGroup };
    }

    const tokens = raw.toUpperCase().split(',').map((token) => token.trim()).filter(Boolean);
    if (tokens.length === 0 || tokens.some((token) => !DRIVE_RAW_TOKEN_VALUES.has(token))) {
        return { error: 'Invalid drive: unsupported value' };
    }

    return { value: tokens.join(',') };
};

const validateFuelRaw = (field, value) => {
    if (!hasFilterValue(value)) {
        return { value: undefined };
    }

    const single = readSingleValue(field, value);
    if (single.error) return { error: single.error };

    const raw = String(single.value).trim();
    if (raw.length === 0) return { value: undefined };

    const asGroup = raw.toLowerCase();
    if (FUEL_GROUP_VALUES.has(asGroup)) {
        return { value: asGroup };
    }

    const asCode = raw.toUpperCase();
    if (!FUEL_RAW_VALUES.has(asCode)) {
        return { error: `Invalid ${field}: unsupported value` };
    }

    return { value: asCode };
};

const validateAndNormalizeFilters = (rawFilters = {}) => {
    const unknownKeys = Object.keys(rawFilters).filter((key) => !ALLOWED_FILTER_KEYS.has(key));
    if (unknownKeys.length > 0) {
        return { error: `Unsupported filter parameter(s): ${unknownKeys.join(', ')}` };
    }

    const normalized = {};

    const vendor = validateStringFilter('vendor', rawFilters.vendor);
    if (vendor.error) return { error: vendor.error };
    if (vendor.value !== undefined) normalized.vendor = vendor.value;

    const model = validateStringFilter('model', rawFilters.model);
    if (model.error) return { error: model.error };
    if (model.value !== undefined) normalized.model = model.value;

    const year = validateIntegerRangeFilter('year', rawFilters.year, YEAR_MIN, YEAR_MAX);
    if (year.error) return { error: year.error };
    if (year.value !== undefined) normalized.year = year.value;

    const yearFrom = validateIntegerRangeFilter('year_from', rawFilters.year_from, YEAR_MIN, YEAR_MAX);
    if (yearFrom.error) return { error: yearFrom.error };
    if (yearFrom.value !== undefined) normalized.year_from = yearFrom.value;

    const yearTo = validateIntegerRangeFilter('year_to', rawFilters.year_to, YEAR_MIN, YEAR_MAX);
    if (yearTo.error) return { error: yearTo.error };
    if (yearTo.value !== undefined) normalized.year_to = yearTo.value;

    const engine = validateNumberRangeFilter('engine', rawFilters.engine, ENGINE_MIN, ENGINE_MAX);
    if (engine.error) return { error: engine.error };
    if (engine.value !== undefined) normalized.engine = engine.value;

    const engineFrom = validateNumberRangeFilter('engine_from', rawFilters.engine_from, ENGINE_MIN, ENGINE_MAX);
    if (engineFrom.error) return { error: engineFrom.error };
    if (engineFrom.value !== undefined) normalized.engine_from = engineFrom.value;

    const engineTo = validateNumberRangeFilter('engine_to', rawFilters.engine_to, ENGINE_MIN, ENGINE_MAX);
    if (engineTo.error) return { error: engineTo.error };
    if (engineTo.value !== undefined) normalized.engine_to = engineTo.value;

    const mileage = validateIntegerRangeFilter('mileage', rawFilters.mileage, MILEAGE_MIN, MILEAGE_MAX);
    if (mileage.error) return { error: mileage.error };
    if (mileage.value !== undefined) normalized.mileage = mileage.value;

    const mileageFrom = validateIntegerRangeFilter('mileage_from', rawFilters.mileage_from, MILEAGE_MIN, MILEAGE_MAX);
    if (mileageFrom.error) return { error: mileageFrom.error };
    if (mileageFrom.value !== undefined) normalized.mileage_from = mileageFrom.value;

    const mileageTo = validateIntegerRangeFilter('mileage_to', rawFilters.mileage_to, MILEAGE_MIN, MILEAGE_MAX);
    if (mileageTo.error) return { error: mileageTo.error };
    if (mileageTo.value !== undefined) normalized.mileage_to = mileageTo.value;

    const price = validateNumberRangeFilter('price', rawFilters.price, PRICE_MIN, PRICE_MAX);
    if (price.error) return { error: price.error };
    if (price.value !== undefined) normalized.price = price.value;

    const priceFrom = validateNumberRangeFilter('price_from', rawFilters.price_from, PRICE_MIN, PRICE_MAX);
    if (priceFrom.error) return { error: priceFrom.error };
    if (priceFrom.value !== undefined) normalized.price_from = priceFrom.value;

    const priceTo = validateNumberRangeFilter('price_to', rawFilters.price_to, PRICE_MIN, PRICE_MAX);
    if (priceTo.error) return { error: priceTo.error };
    if (priceTo.value !== undefined) normalized.price_to = priceTo.value;

    const transmissionGroup = validateEnumFilter('transmission_group', rawFilters.transmission_group, TRANSMISSION_GROUP_VALUES);
    if (transmissionGroup.error) return { error: transmissionGroup.error };
    if (transmissionGroup.value !== undefined) normalized.transmission_group = transmissionGroup.value;

    const transmission = validateTransmissionRaw(rawFilters.transmission);
    if (transmission.error) return { error: transmission.error };
    if (transmission.value !== undefined) normalized.transmission = transmission.value;

    const driveGroup = validateEnumFilter('drive_group', rawFilters.drive_group, DRIVE_GROUP_VALUES);
    if (driveGroup.error) return { error: driveGroup.error };
    if (driveGroup.value !== undefined) normalized.drive_group = driveGroup.value;

    const drive = validateDriveRaw(rawFilters.drive);
    if (drive.error) return { error: drive.error };
    if (drive.value !== undefined) normalized.drive = drive.value;

    const fuelGroup = validateEnumFilter('fuel_group', rawFilters.fuel_group, FUEL_GROUP_VALUES);
    if (fuelGroup.error) return { error: fuelGroup.error };
    if (fuelGroup.value !== undefined) normalized.fuel_group = fuelGroup.value;

    const fuelType = validateFuelRaw('fuel_type', rawFilters.fuel_type);
    if (fuelType.error) return { error: fuelType.error };
    if (fuelType.value !== undefined) normalized.fuel_type = fuelType.value;

    const fuelLegacy = validateFuelRaw('fuel', rawFilters.fuel);
    if (fuelLegacy.error) return { error: fuelLegacy.error };
    if (fuelLegacy.value !== undefined) normalized.fuel = fuelLegacy.value;

    const page = validateIntegerRangeFilter('page', rawFilters.page, 1, 100000);
    if (page.error) return { error: page.error };
    if (page.value !== undefined) normalized.page = page.value;

    if (normalized.year !== undefined) {
        if (normalized.year_from === undefined) normalized.year_from = normalized.year;
        if (normalized.year_to === undefined) normalized.year_to = normalized.year;
        delete normalized.year;
    }
    if (normalized.engine !== undefined) {
        if (normalized.engine_from === undefined) normalized.engine_from = normalized.engine;
        if (normalized.engine_to === undefined) normalized.engine_to = normalized.engine;
        delete normalized.engine;
    }
    if (normalized.mileage !== undefined) {
        if (normalized.mileage_from === undefined) normalized.mileage_from = normalized.mileage;
        if (normalized.mileage_to === undefined) normalized.mileage_to = normalized.mileage;
        delete normalized.mileage;
    }
    if (normalized.price !== undefined) {
        if (normalized.price_from === undefined) normalized.price_from = normalized.price;
        if (normalized.price_to === undefined) normalized.price_to = normalized.price;
        delete normalized.price;
    }

    if (
        normalized.year_from !== undefined &&
        normalized.year_to !== undefined &&
        normalized.year_from > normalized.year_to
    ) {
        return { error: 'Invalid year range: year_from must be less than or equal to year_to' };
    }

    if (
        normalized.engine_from !== undefined &&
        normalized.engine_to !== undefined &&
        normalized.engine_from > normalized.engine_to
    ) {
        return { error: 'Invalid engine range: engine_from must be less than or equal to engine_to' };
    }

    if (
        normalized.mileage_from !== undefined &&
        normalized.mileage_to !== undefined &&
        normalized.mileage_from > normalized.mileage_to
    ) {
        return { error: 'Invalid mileage range: mileage_from must be less than or equal to mileage_to' };
    }

    if (
        normalized.price_from !== undefined &&
        normalized.price_to !== undefined &&
        normalized.price_from > normalized.price_to
    ) {
        return { error: 'Invalid price range: price_from must be less than or equal to price_to' };
    }

    return { filters: normalized };
};

// ==================== РОУТЫ ====================

/**
 * @swagger
 * /api/cars:
 *   get:
 *     summary: Поиск автомобилей с фильтрами
 *     description: Возвращает список автомобилей с поддержкой фильтрации по различным параметрам. Для получения доступных фильтров используйте /api/filters/dynamic.
 *     tags: [Cars]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: table
 *         schema:
 *           type: string
 *           enum: [main, korea, china, bike]
 *         description: Таблица для поиска
 *         example: main
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [ajes, che-168]
 *           default: ajes
 *         description: Источник данных
 *         example: ajes
 *       - in: query
 *         name: client_ip
 *         schema:
 *           type: string
 *         description: IP адрес клиента (обязателен для AJES)
 *         example: 79.174.91.181
 *       - in: query
 *         name: vendor
 *         schema:
 *           type: string
 *         description: Марка автомобиля
 *         example: TOYOTA
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: Модель автомобиля
 *         example: PRIUS
 *       - in: query
 *         name: transmission_group
 *         schema:
 *           type: string
 *           enum: [automatic, manual, cvt, hybrid, sequential, other, unknown]
 *         description: Группа трансмиссий
 *         example: automatic
 *       - in: query
 *         name: drive_group
 *         schema:
 *           type: string
 *           enum: [fwd, rwd, awd, other, unknown]
 *         description: Группа приводов
 *         example: fwd
 *       - in: query
 *         name: fuel_group
 *         schema:
 *           type: string
 *           enum: [petrol, diesel, hybrid, electric, other, unknown]
 *         description: Группа типов топлива
 *         example: hybrid
 */
router.get('/cars', validateBarrierCode, async (req, res) => {
    try {
        const {
            table = 'main',
            provider = 'ajes',
            client_ip,
            ip,
            code: _code,
            limit = 20,
            offset = 0,
            ...filters
        } = req.query;
        let clientIP = null;
        if (hasFilterValue(client_ip) || hasFilterValue(ip)) {
            const ipValidation = validateClientIP(hasFilterValue(client_ip) ? client_ip : ip);
            if (ipValidation.error) {
                return res.status(400).json({ error: ipValidation.error });
            }
            clientIP = ipValidation.clientIP;
        }

        const context = sanitizeRequestContext(table, provider);
        if (context.error) {
            return res.status(400).json({ error: context.error });
        }
        const safeTable = context.table;
        const safeProvider = context.provider;

        if (safeProvider === 'ajes' && !clientIP) {
            return res.status(400).json({ error: 'Client IP required for AJES' });
        }

        const pagination = resolvePagination(limit, offset);
        if (pagination.error) {
            return res.status(400).json({ error: pagination.error });
        }

        const normalizedFilters = normalizeLegacyFilterAliases(filters);
        const validatedFilters = validateAndNormalizeFilters(normalizedFilters);
        if (validatedFilters.error) {
            return res.status(400).json({ error: validatedFilters.error });
        }
        const queryFilters = {
            limit: pagination.limit,
            offset: pagination.offset,
            ...validatedFilters.filters
        };

        // Запускаем параллельно подсчет и получение данных
        const [totalCount, cars] = await Promise.all([
            CarModel.getTotalCount(queryFilters, safeTable, safeProvider, clientIP),
            CarModel.getCarsByFilter(queryFilters, safeTable, safeProvider, clientIP)
        ]);

        // Получаем фильтры для UI (можно вынести в отдельный запрос для скорости)
        const availableFilters = await CarModel.getDynamicFilters(queryFilters, safeTable, safeProvider, clientIP);

        // Рассчитываем мин/макс цену из полученных авто (так как SQL агрегация по цене сложна в API)
        let minPrice = 0, maxPrice = 0;
        if (cars.length > 0) {
            const prices = cars.map(c => c.CALC_RUB).filter(p => p > 0);
            if (prices.length > 0) {
                minPrice = Math.min(...prices);
                maxPrice = Math.max(...prices);
            }
        }

        res.json({
            success: true,
            data: {
                cars,
                pagination: {
                    limit: pagination.limit,
                    offset: pagination.offset,
                    total: totalCount
                },
                price_range: {
                    min: minPrice,
                    max: maxPrice,
                    currency: 'RUB'
                },
                available_filters: availableFilters
            }
        });

    } catch (error) {
        console.error('API Error /cars:', error.message);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

/**
 * @swagger
 * /api/car/{id}:
 *   get:
 *     summary: Получить автомобиль по ID
 *     tags: [Cars]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID автомобиля
 *         example: "YGczC35umASrhi"
 *       - in: query
 *         name: table
 *         schema:
 *           type: string
 *           enum: [main, korea, china, bike]
 *         description: Таблица для поиска
 *         example: main
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [ajes, che-168]
 *           default: ajes
 *         description: Источник данных
 *         example: ajes
 *       - in: query
 *         name: client_ip
 *         schema:
 *           type: string
 *         description: IP адрес клиента (обязателен для AJES)
 *         example: 79.174.91.181
 */
router.get('/car/:id', validateBarrierCode, async (req, res) => {
    try {
        const { id } = req.params;
        const { table = 'main', provider = 'ajes', client_ip, ip, recalc = 'true' } = req.query;
        let clientIP = null;
        if (hasFilterValue(client_ip) || hasFilterValue(ip)) {
            const ipValidation = validateClientIP(hasFilterValue(client_ip) ? client_ip : ip);
            if (ipValidation.error) {
                return res.status(400).json({ error: ipValidation.error });
            }
            clientIP = ipValidation.clientIP;
        }

        const context = sanitizeRequestContext(table, provider);
        if (context.error) {
            return res.status(400).json({ error: context.error });
        }
        const safeTable = context.table;
        const safeProvider = context.provider;

        if (safeProvider === 'ajes' && !clientIP) {
            return res.status(400).json({ error: 'Client IP required' });
        }

        const car = await CarModel.getCarById(id, safeTable, safeProvider, clientIP);

        if (!car) {
            return res.status(404).json({ error: 'Car not found' });
        }

        let recalculation = { success: false, skipped: true, reason: 'not_requested' };
        const shouldRecalculate = String(recalc).toLowerCase() !== 'false';

        if (shouldRecalculate) {
            recalculation = await runOnDemandRecalculation(id, safeTable);
            const priceData = await CarModel.getCarPriceById(id, safeTable, safeProvider);
            if (priceData?.calc_rub) {
                car.CALC_RUB = priceData.calc_rub;
            }
        }

        res.json({ success: true, data: car, recalculation });

    } catch (error) {
        console.error('API Error /car/:id:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/car/{id}/price:
 *   get:
 *     summary: Получить цену автомобиля по ID
 *     tags: [Cars]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID автомобиля
 *         example: "YGczC35umASrhi"
 *       - in: query
 *         name: table
 *         schema:
 *           type: string
 *           enum: [main, korea, china, bike]
 *         description: Таблица для поиска
 *         example: main
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [ajes, che-168]
 *           default: ajes
 *         description: Источник данных
 *         example: ajes
 */
router.get('/car/:id/price', validateBarrierCode, async (req, res) => {
    try {
        const { id } = req.params;
        const { table = 'main', provider = 'ajes', recalc = 'true' } = req.query;

        const context = sanitizeRequestContext(table, provider);
        if (context.error) {
            return res.status(400).json({ error: context.error });
        }
        const safeTable = context.table;
        const safeProvider = context.provider;

        let recalculation = { success: false, skipped: true, reason: 'not_requested' };
        const shouldRecalculate = String(recalc).toLowerCase() !== 'false';

        if (shouldRecalculate) {
            recalculation = await runOnDemandRecalculation(id, safeTable);
        }

        const priceData = await CarModel.getCarPriceById(id, safeTable, safeProvider);

        if (!priceData) {
            return res.status(404).json({ error: 'Price not found', recalculation });
        }

        res.json({ success: true, data: priceData, recalculation });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/filters/dynamic:
 *   get:
 *     summary: Получить динамические фильтры
 *     description: Возвращает доступные фильтры с учетом текущих выбранных условий
 *     tags: [Filters]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: table
 *         schema:
 *           type: string
 *           enum: [main, korea, china, bike]
 *         description: Таблица для фильтров
 *         example: main
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [ajes, che-168]
 *           default: ajes
 *         description: Источник данных
 *         example: ajes
 *       - in: query
 *         name: client_ip
 *         schema:
 *           type: string
 *         description: IP адрес клиента (обязателен для AJES)
 *         example: 79.174.91.181
 *       - in: query
 *         name: vendor
 *         schema:
 *           type: string
 *         description: Марка автомобиля для получения моделей
 *         example: TOYOTA
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: Модель автомобиля
 *         example: PRIUS
 */
router.get('/filters/dynamic', validateBarrierCode, async (req, res) => {
    try {
        const {
            table = 'main',
            provider = 'ajes',
            client_ip,
            ip,
            code: _code,
            ...filters
        } = req.query;
        let clientIP = null;
        if (hasFilterValue(client_ip) || hasFilterValue(ip)) {
            const ipValidation = validateClientIP(hasFilterValue(client_ip) ? client_ip : ip);
            if (ipValidation.error) {
                return res.status(400).json({ error: ipValidation.error });
            }
            clientIP = ipValidation.clientIP;
        }

        const context = sanitizeRequestContext(table, provider);
        if (context.error) {
            return res.status(400).json({ error: context.error });
        }
        const safeTable = context.table;
        const safeProvider = context.provider;

        if (safeProvider === 'ajes' && !clientIP) {
            return res.status(400).json({ error: 'Client IP required' });
        }

        const normalizedFilters = normalizeLegacyFilterAliases(filters);
        const validatedFilters = validateAndNormalizeFilters(normalizedFilters);
        if (validatedFilters.error) {
            return res.status(400).json({ error: validatedFilters.error });
        }
        const data = await CarModel.getDynamicFilters(validatedFilters.filters, safeTable, safeProvider, clientIP);

        res.json({ success: true, data });

    } catch (error) {
        console.error('API Error /filters/dynamic:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/filters:
 *   get:
 *     summary: Получить доступные фильтры
 *     tags: [Filters]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: table
 *         schema:
 *           type: string
 *           enum: [main, korea, china, bike]
 *         description: Таблица для фильтров
 *         example: main
 *     responses:
 *       200:
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     fuel_types:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Filter'
 *                     transmissions:
 *                       type: object
 *                       properties:
 *                         automatic:
 *                           type: string
 *                           example: "Автоматическая"
 *                         manual:
 *                           type: string
 *                           example: "Механическая"
 */
router.get('/filters', validateBarrierCode, async (req, res) => {
    try {
        const {
            table = 'main',
            provider = 'ajes', // Добавляем параметр провайдера
            client_ip
        } = req.query;
        let clientIP = null;
        if (hasFilterValue(client_ip)) {
            const ipValidation = validateClientIP(client_ip);
            if (ipValidation.error) {
                return res.status(400).json({ error: ipValidation.error });
            }
            clientIP = ipValidation.clientIP;
        }

        const context = sanitizeRequestContext(table, provider);
        if (context.error) {
            return res.status(400).json({ error: context.error });
        }
        const safeTable = context.table;
        const safeProvider = context.provider;

        if (safeProvider === 'ajes' && !clientIP) {
            return res.status(400).json({ error: 'Client IP required' });
        }

        console.log(`[API] Запрос динамических фильтров /filters ${safeTable}, provider: ${safeProvider}`);

        // Используем существующий метод с пустыми фильтрами
        const filters = await CarModel.getDynamicFilters(
            {}, // Пустые фильтры
            safeTable,
            safeProvider,
            clientIP
        );

        res.json({
            success: true,
            data: filters
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/providers:
 *   get:
 *     summary: Получить доступные провайдеры
 *     description: Возвращает список доступных источников данных
 *     tags: [System]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/providers', validateBarrierCode, (req, res) => {
    try {
        const providers = CarModel.getAvailableProviders();

        res.json({
            success: true,
            data: providers
        });

    } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/tables:
 *   get:
 *     summary: Получить доступные таблицы
 *     description: Возвращает список доступных таблиц для поиска
 *     tags: [System]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/tables', validateBarrierCode, (req, res) => {
    try {
        const tables = CarModel.getTables();

        res.json({
            success: true,
            data: tables
        });

    } catch (error) {
        console.error('API Error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Проверка здоровья API
 *     description: Возвращает статус работы API
 *     tags: [System]
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        }
    });
});

module.exports = router;
