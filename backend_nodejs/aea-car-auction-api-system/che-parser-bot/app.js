const cron = require('node-cron');
require('dotenv').config();
const Database = require('./config/database');
const CarModel = require('./models/CarModel');
const Che168Parser = require('./worker/parser');

class CheParserApp {
    constructor() {
        this.port = process.env.PORT || 3003;
        this.parser = new Che168Parser();
        this.parseArgs();
    }

    parseArgs() {
        const args = process.argv.slice(2);
        this.options = {
            parse: false,
            test: false,
            limit: null
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            switch (arg) {
                case '--parse':
                    this.options.parse = true;
                    break;
                case '--test':
                    this.options.test = true;
                    break;
                case '--limit':
                    this.options.limit = parseInt(args[++i]);
                    break;
            }
        }
    }

    async initialize() {
        try {
            // Инициализация базы данных
            await Database.init();
            await CarModel.createTables();

            // Создаем таблицу che_available если ее нет
            await this.createCheAvailableTable();
            await this.reconcileCheAvailableSchema();

            console.log('✅ Che Parser bot initialized');
        } catch (error) {
            console.error('❌ Parser initialization failed:', error);
            process.exit(1);
        }
    }

    async createCheAvailableTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS che_available (
                ID VARCHAR(50) PRIMARY KEY,
                SOURCE VARCHAR(20) DEFAULT 'che168',
                AUCTION_DATE DATETIME NULL,
                AUCTION VARCHAR(255) NULL,
                LOT VARCHAR(50) NULL,
                MARKA_ID VARCHAR(10),
                MARKA_NAME VARCHAR(255),
                MODEL_ID VARCHAR(10),
                MODEL_NAME VARCHAR(255),
                YEAR VARCHAR(4),
                TOWN VARCHAR(50),
                ENG_V VARCHAR(10),
                PW VARCHAR(255),
                KUZOV VARCHAR(255),
                GRADE VARCHAR(255),
                COLOR VARCHAR(30),
                KPP VARCHAR(255),
                KPP_TYPE VARCHAR(255),
                PRIV VARCHAR(255),
                MILEAGE VARCHAR(20),
                EQUIP TEXT,
                RATE VARCHAR(10),
                START VARCHAR(10),
                FINISH VARCHAR(10),
                STATUS VARCHAR(20),
                TIME VARCHAR(10),
                SANCTION VARCHAR(10),
                AVG_PRICE VARCHAR(20),
                AVG_STRING TEXT,
                IMAGES TEXT,
                PRICE_CALC DECIMAL(15,2) NULL,
                CALC_RUB DECIMAL(15,2) NULL,
                CALC_UPDATED_AT TIMESTAMP NULL,
                original_price DECIMAL(15,2) NULL,
                original_currency VARCHAR(10) NULL,
                converted_price DECIMAL(15,2) NULL,
                tks_total DECIMAL(15,2) NULL,
                markup DECIMAL(15,2) NULL,
                response_time INT NULL,
                LOCATION VARCHAR(255),
                URL VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                deleted TINYINT(1) DEFAULT 0,
                INDEX idx_marka_model (MARKA_NAME, MODEL_NAME),
                INDEX idx_price_calc (PRICE_CALC),
                INDEX idx_calc_rub (CALC_RUB),
                INDEX idx_calc_updated (CALC_UPDATED_AT),
                INDEX idx_source (SOURCE),
                INDEX idx_status (STATUS),
                INDEX idx_auction_date (AUCTION_DATE)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `;

        try {
            const db = require('./config/database');
            await db.query(sql);
            console.log('✅ Table che_available created/verified');
        } catch (error) {
            console.error('❌ Error creating che_available table:', error.message);
        }
    }

    async reconcileCheAvailableSchema() {
        const db = require('./config/database');

        const columnMigrations = [
            `ALTER TABLE che_available ADD COLUMN AUCTION_DATE DATETIME NULL AFTER SOURCE`,
            `ALTER TABLE che_available ADD COLUMN AUCTION VARCHAR(255) NULL AFTER AUCTION_DATE`,
            `ALTER TABLE che_available ADD COLUMN LOT VARCHAR(50) NULL AFTER AUCTION`
        ];

        const indexMigrations = [
            `ALTER TABLE che_available ADD INDEX idx_auction_date (AUCTION_DATE)`
        ];

        for (const sql of columnMigrations) {
            try {
                await db.query(sql);
                console.log(`✅ Schema migration applied: ${sql}`);
            } catch (error) {
                if (/Duplicate column name/i.test(error.message)) {
                    continue;
                }
                console.error(`❌ Schema migration failed: ${sql}`, error.message);
            }
        }

        for (const sql of indexMigrations) {
            try {
                await db.query(sql);
                console.log(`✅ Index migration applied: ${sql}`);
            } catch (error) {
                if (/Duplicate key name/i.test(error.message)) {
                    continue;
                }
                console.error(`❌ Index migration failed: ${sql}`, error.message);
            }
        }
    }

    startSchedulers() {
        // Парсинг каждый день в 00:00
        cron.schedule('0 0 * * *', async () => {
            console.log('⏰ Starting scheduled Che168 parsing...');
            await this.parser.parseAllPages();
        });

        // Немедленный запуск при старте
        console.log('🚀 Starting immediate Che168 parsing...');
        this.parser.parseAllPages().catch(error => {
            console.error('❌ Immediate parsing failed:', error);
        });

        console.log('⏰ Parser schedulers started - running daily at 00:00');
    }

    async run() {
        await this.initialize();

        try {
            if (this.options.parse) {
                await this.parser.parseAllPages(this.options.limit);
            } else if (this.options.test) {
                await this.parser.runTest(this.options.limit || 3);
            } else {
                // Запуск по расписанию
                this.startSchedulers();

                // Keep the process running
                process.on('SIGINT', () => this.shutdown());
                process.on('SIGTERM', () => this.shutdown());
            }
        } catch (error) {
            console.error('❌ Parser service failed:', error);
            process.exit(1);
        }
    }

    async shutdown() {
        console.log('\n🛑 Shutting down Che parser bot...');
        console.log('✅ Che parser bot stopped');
        process.exit(0);
    }
}

// Запуск приложения
const app = new CheParserApp();
app.run().catch(console.error);

module.exports = CheParserApp;
