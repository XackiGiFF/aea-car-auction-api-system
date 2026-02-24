const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const Database = require('./config/database');
const CarModel = require('./models/CarModel');
const apiRoutes = require('./api/service');
const { specs, swaggerUi } = require('./swagger');

const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const createRateLimiter = ({ windowMs, maxRequests }) => {
    if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
        return (_req, _res, next) => next();
    }

    const hits = new Map();
    let lastCleanupAt = 0;

    return (req, res, next) => {
        // Health endpoint must stay available for Docker healthcheck.
        if (req.path === '/health') {
            return next();
        }

        const now = Date.now();
        if (now - lastCleanupAt > windowMs) {
            for (const [ip, state] of hits.entries()) {
                if (!state || state.resetAt <= now) {
                    hits.delete(ip);
                }
            }
            lastCleanupAt = now;
        }

        const forwardedForRaw = req.headers['x-forwarded-for'];
        const forwardedFor = Array.isArray(forwardedForRaw)
            ? forwardedForRaw[0]
            : String(forwardedForRaw || '').split(',')[0].trim();
        const clientIp = forwardedFor || req.ip || req.socket?.remoteAddress || 'unknown';

        const current = hits.get(clientIp);
        if (!current || current.resetAt <= now) {
            const nextState = { count: 1, resetAt: now + windowMs };
            hits.set(clientIp, nextState);
            res.setHeader('X-RateLimit-Limit', String(maxRequests));
            res.setHeader('X-RateLimit-Remaining', String(maxRequests - nextState.count));
            res.setHeader('X-RateLimit-Reset', String(Math.ceil(nextState.resetAt / 1000)));
            return next();
        }

        current.count += 1;
        hits.set(clientIp, current);

        const remaining = Math.max(maxRequests - current.count, 0);
        res.setHeader('X-RateLimit-Limit', String(maxRequests));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

        if (current.count > maxRequests) {
            return res.status(429).json({
                error: 'Too many requests',
                code: 'RATE_LIMIT_EXCEEDED',
                retry_after_ms: Math.max(current.resetAt - now, 0)
            });
        }

        return next();
    };
};

class CarAuctionApp {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        const rateWindowMs = parsePositiveInt(process.env.API_RATE_LIMIT_WINDOW_MS, 60000);
        const rateMaxRequests = parsePositiveInt(process.env.API_RATE_LIMIT_MAX_REQUESTS, 240);
        this.apiRateLimiter = createRateLimiter({
            windowMs: rateWindowMs,
            maxRequests: rateMaxRequests
        });
    }

    async initialize() {
        try {
            // Инициализация базы данных
            await Database.init();
            await CarModel.createTables();

            // Настройка middleware
            this.app.use(helmet());
            this.app.use(cors());
            this.app.use(express.json({ limit: '10mb' }));
            this.app.use(express.urlencoded({ extended: true }));

            // API routes
            this.app.use('/api', this.apiRateLimiter, apiRoutes);

            // Health check endpoint
            this.app.get('/api/health', (req, res) => {
                res.json({
                    status: 'OK',
                    timestamp: new Date().toISOString(),
                    service: 'Car Auction API'
                });
            });

            // Обработка ошибок
            this.app.use(this.errorHandler);

            // Graceful shutdown
            this.setupGracefulShutdown();

            // Swagger documentation
            this.app.use('/api/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
                explorer: true,
                customCss: '.swagger-ui .topbar { display: none }'
            }));

            console.log('📚 Swagger docs available at /api-docs');

        } catch (error) {
            console.error('❌ Application initialization failed:', error);
            process.exit(1);
        }
    }

    errorHandler(err, req, res, next) {
        console.error('Unhandled error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
        });
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n${signal} received, shutting down gracefully...`);

            // Остановка сервера
            if (this.server) {
                this.server.close(() => {
                    console.log('HTTP server closed');
                });
            }

            // Закрытие соединения с БД
            await Database.close();

            console.log('Graceful shutdown complete');
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }

    start() {
        this.server = this.app.listen(this.port, () => {
            console.log(`🚀 Server running on port ${this.port}`);
            console.log(`📊 API available at http://localhost:${this.port}/api`);
            console.log(`❤️  Health check at http://localhost:${this.port}/api/health`);
        });
    }

    async run() {
        await this.initialize();
        this.start();
    }
}

// Запуск приложения
const app = new CarAuctionApp();
app.run().catch(console.error);

module.exports = app;
