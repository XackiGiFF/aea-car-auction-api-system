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
const CarModel = require('../models/CarModel');
require('dotenv').config();

const router = express.Router();
const CALC_BOT_URL = process.env.CALC_BOT_URL || 'http://calc-bot:3001';
const CALC_BOT_INTERNAL_TOKEN = process.env.CALC_BOT_INTERNAL_TOKEN || '';
const ON_DEMAND_CALC_ENABLED = process.env.ON_DEMAND_CALC_ENABLED !== 'false';
const ON_DEMAND_CALC_TIMEOUT_MS = parseInt(process.env.ON_DEMAND_CALC_TIMEOUT_MS || '12000', 10);

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
            limit = 20,
            offset = 0,
            ...filters
        } = req.query;
        const clientIP = client_ip || ip;

        if (provider === 'ajes' && !clientIP) {
            return res.status(400).json({ error: 'Client IP required for AJES' });
        }

        const queryFilters = {
            limit: parseInt(limit),
            offset: parseInt(offset),
            ...filters
        };

        // Запускаем параллельно подсчет и получение данных
        const [totalCount, cars] = await Promise.all([
            CarModel.getTotalCount(queryFilters, table, provider, clientIP),
            CarModel.getCarsByFilter(queryFilters, table, provider, clientIP)
        ]);

        // Получаем фильтры для UI (можно вынести в отдельный запрос для скорости)
        const availableFilters = await CarModel.getDynamicFilters(queryFilters, table, provider, clientIP);

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
                    limit: parseInt(limit),
                    offset: parseInt(offset),
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
        const clientIP = client_ip || ip;

        if (provider === 'ajes' && !clientIP) {
            return res.status(400).json({ error: 'Client IP required' });
        }

        const car = await CarModel.getCarById(id, table, provider, clientIP);

        if (!car) {
            return res.status(404).json({ error: 'Car not found' });
        }

        let recalculation = { success: false, skipped: true, reason: 'not_requested' };
        const shouldRecalculate = String(recalc).toLowerCase() !== 'false';

        if (shouldRecalculate) {
            recalculation = await runOnDemandRecalculation(id, table);
            const priceData = await CarModel.getCarPriceById(id, table, provider);
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

        let recalculation = { success: false, skipped: true, reason: 'not_requested' };
        const shouldRecalculate = String(recalc).toLowerCase() !== 'false';

        if (shouldRecalculate) {
            recalculation = await runOnDemandRecalculation(id, table);
        }

        const priceData = await CarModel.getCarPriceById(id, table, provider);

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
            ...filters
        } = req.query;
        const clientIP = client_ip || ip;

        if (provider === 'ajes' && !clientIP) {
            return res.status(400).json({ error: 'Client IP required' });
        }

        const data = await CarModel.getDynamicFilters(filters, table, provider, clientIP);

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

        console.log(`[API] Запрос динамических фильтров /filters ${table}, provider: ${provider}`);

        // Используем существующий метод с пустыми фильтрами
        const filters = await CarModel.getDynamicFilters(
            {}, // Пустые фильтры
            table,
            provider,
            client_ip
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
