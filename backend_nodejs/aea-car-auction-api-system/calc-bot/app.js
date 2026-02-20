const http = require('http');
const cron = require('node-cron');
require('dotenv').config();
const Database = require('./config/database');
const CarModel = require('./models/CarModel');
const CalcAvtoScheduler = require('./worker/calc_avto');

class AeaCalculatorApp {
    constructor() {
        this.port = process.env.PORT || 3001;
        this.internalToken = process.env.CALC_BOT_INTERNAL_TOKEN || process.env.API_BARRIER_CODE || '';
        this.calcScheduler = new CalcAvtoScheduler();
        this.server = null;
    }

    async initialize() {
        try {
            // Инициализация базы данных
            await Database.init();
            await CarModel.createTables();

            // Запуск планировщиков
            this.startSchedulers();
            this.startInternalApi();

            console.log('✅ Calculator bot initialized');

        } catch (error) {
            console.error('❌ Calculator initialization failed:', error);
            process.exit(1);
        }
    }

    startSchedulers() {
        // Расчет цен каждый час [1]
        cron.schedule('0 * * * *', async () => {
            console.log('⏰ Starting scheduled calculation...');
            await this.calcScheduler.processAllTables();
        });

        // Немедленный запуск при старте
        console.log('🚀 Starting immediate calculation...');
        this.calcScheduler.processAllTables().catch(error => {
            console.error('❌ Immediate calculation failed:', error);
        });

        console.log('⏰ Schedulers started - running every hour');
    }

    startInternalApi() {
        this.server = http.createServer(async (req, res) => {
            const url = new URL(req.url, `http://${req.headers.host}`);

            if (req.method === 'GET' && url.pathname === '/health') {
                return this.sendJson(res, 200, {
                    success: true,
                    data: {
                        status: 'ok',
                        service: 'calc-bot',
                        timestamp: new Date().toISOString(),
                        is_running: this.calcScheduler.isRunning
                    }
                });
            }

            if (req.method === 'POST' && url.pathname === '/internal/recalculate') {
                const token = req.headers['x-internal-token'];
                if (!this.internalToken || token !== this.internalToken) {
                    return this.sendJson(res, 401, {
                        success: false,
                        error: 'Unauthorized internal token'
                    });
                }

                try {
                    const body = await this.readJsonBody(req);
                    const carId = String(body.id || '').trim();
                    const table = String(body.table || 'main').trim();

                    if (!carId) {
                        return this.sendJson(res, 400, {
                            success: false,
                            error: 'Field "id" is required'
                        });
                    }

                    const result = await this.calcScheduler.recalculateCarById(carId, table);
                    const statusCode = result.success ? 200 : 422;
                    return this.sendJson(res, statusCode, {
                        success: result.success,
                        data: result
                    });
                } catch (error) {
                    return this.sendJson(res, 500, {
                        success: false,
                        error: error.message
                    });
                }
            }

            return this.sendJson(res, 404, {
                success: false,
                error: 'Not found'
            });
        });

        this.server.listen(this.port, () => {
            console.log(`🧮 Calc internal API listening on port ${this.port}`);
        });
    }

    readJsonBody(req) {
        return new Promise((resolve, reject) => {
            let raw = '';
            req.on('data', chunk => {
                raw += chunk;
                if (raw.length > 1_000_000) {
                    reject(new Error('Payload too large'));
                    req.destroy();
                }
            });
            req.on('end', () => {
                if (!raw) return resolve({});
                try {
                    resolve(JSON.parse(raw));
                } catch (error) {
                    reject(new Error('Invalid JSON body'));
                }
            });
            req.on('error', reject);
        });
    }

    sendJson(res, status, payload) {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(payload));
    }

    async run() {
        await this.initialize();

        // Keep the process running
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());

        // console.log(`🚀 Calculator bot running on port ${this.port}`);
        console.log(`🚀 Calculator bot running`);
    }

    async shutdown() {
        console.log('\n🛑 Shutting down calculator bot...');
        // Можно добавить закрытие соединений с БД
        if (this.server) {
            this.server.close();
        }
        console.log('✅ Calculator bot stopped');
        process.exit(0);
    }
}

// Запуск приложения
const app = new AeaCalculatorApp();
app.run().catch(console.error);

module.exports = AeaCalculatorApp;
