const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const Database = require('./config/database');
const CarModel = require('./models/CarModel');
const apiRoutes = require('./api/service');
const { specs, swaggerUi } = require('./swagger');

class CarAuctionApp {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
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
            this.app.use('/api', apiRoutes);

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
            console.log(`❤️  Health check at http://localhost:${this.port}/health`);
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
