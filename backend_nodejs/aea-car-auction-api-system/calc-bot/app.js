const cron = require('node-cron');
require('dotenv').config();
const Database = require('./config/database');
const CarModel = require('./models/CarModel');
const CalcAvtoScheduler = require('./worker/calc_avto');

class AeaCalculatorApp {
    constructor() {
        // this.port = process.env.PORT || 3001;
        this.calcScheduler = new CalcAvtoScheduler();
    }

    async initialize() {
        try {
            // Инициализация базы данных
            await Database.init();
            await CarModel.createTables();

            // Запуск планировщиков
            this.startSchedulers();

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
        console.log('✅ Calculator bot stopped');
        process.exit(0);
    }
}

// Запуск приложения
const app = new AeaCalculatorApp();
app.run().catch(console.error);

module.exports = AeaCalculatorApp;