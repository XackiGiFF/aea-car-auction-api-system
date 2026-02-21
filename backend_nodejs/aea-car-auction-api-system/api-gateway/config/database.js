const mysql = require('mysql2/promise');
require('dotenv').config();

class Database {
    constructor() {
        const intEnv = (name, fallback) => {
            const value = parseInt(process.env[name], 10);
            return Number.isFinite(value) ? value : fallback;
        };

        this.config = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            charset: 'utf8mb4',
            connectionLimit: intEnv('DB_POOL_SIZE', 10),
            maxIdle: intEnv('DB_POOL_MAX_IDLE', 10),
            idleTimeout: intEnv('DB_POOL_IDLE_TIMEOUT_MS', 60000),
            waitForConnections: true,
            queueLimit: intEnv('DB_POOL_QUEUE_LIMIT', 0),
            enableKeepAlive: true,
            keepAliveInitialDelay: intEnv('DB_POOL_KEEPALIVE_DELAY_MS', 0),
            connectTimeout: intEnv('DB_CONNECT_TIMEOUT_MS', 10000),
            decimalNumbers: true,
        };

        this.pool = null;
        this.initPromise = null;
        this.maxRetries = intEnv('DB_CONNECT_RETRIES', 5);
        this.queryRetryLimit = intEnv('DB_QUERY_RETRIES', 1);
        this.retryableErrorCodes = new Set([
            'PROTOCOL_CONNECTION_LOST',
            'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
            'ECONNREFUSED',
            'ECONNRESET',
            'ETIMEDOUT',
            'EPIPE'
        ]);
    }

    async init() {
        if (this.pool) return this.pool;

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._initWithRetry()
            .finally(() => {
                this.initPromise = null;
            });

        return this.initPromise;
    }

    async _initWithRetry() {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            let candidatePool = null;
            let connection = null;
            try {
                console.log(`🔌 Creating database pool (attempt ${attempt}/${this.maxRetries})...`);
                candidatePool = mysql.createPool(this.config);
                connection = await candidatePool.getConnection();
                await connection.ping();
                connection.release();
                this.pool = candidatePool;
                console.log('✅ Database pool created successfully');
                return this.pool;
            } catch (error) {
                if (connection) {
                    try { connection.release(); } catch (_) {}
                }
                if (candidatePool) {
                    try { await candidatePool.end(); } catch (_) {}
                }

                console.error('❌ Database pool creation failed:', error.message);

                if (attempt === this.maxRetries) {
                    throw error;
                }

                const delayMs = Math.min(1000 * attempt, 5000);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    async getConnection() {
        const pool = await this.init();

        try {
            return await pool.getConnection();
        } catch (error) {
            console.error('❌ Failed to get database connection:', error.message);
            throw error;
        }
    }

    _isRetryableError(error) {
        return !!(error && this.retryableErrorCodes.has(error.code));
    }

    async resetPool() {
        if (!this.pool) return;

        const oldPool = this.pool;
        this.pool = null;
        try {
            await oldPool.end();
        } catch (error) {
            console.error('Error while resetting pool:', error.message);
        }
    }

    async query(sql, params = [], attempt = 0) {
        try {
            const pool = await this.init();
            const [rows] = await pool.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('Database query error:', error.message);

            if (this._isRetryableError(error) && attempt < this.queryRetryLimit) {
                console.log(`🔄 Reconnecting to database and retrying query (${attempt + 1}/${this.queryRetryLimit})...`);
                await this.resetPool();
                return this.query(sql, params, attempt + 1);
            }

            throw error;
        }
    }

    async close() {
        await this.resetPool();
        console.log('🔌 Database connection closed');
    }

    // Метод для массовой вставки/обновления
    async bulkOperation(table, records, batchSize = 100) {
        if (!records || records.length === 0) return { processed: 0, errors: 0 };

        let processed = 0;
        let errors = 0;

        // Разбиваем на батчи
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);

            try {
                // Используем одно соединение для всего батча
                const connection = await this.getConnection();

                try {
                    await connection.beginTransaction();

                    for (const record of batch) {
                        try {
                            delete record.transmission_name;
                            delete record.transmission_group;
                            delete record.drive_group;
                            delete record.fuel_groups;
                            delete record.fuel_name;
                            delete record.raw_finish;
                            delete record.STOCK_PRICE;
                            delete record.CALC_RUB;
                            delete record.tks_type;
                            delete record.drive_name;


                            const fields = Object.keys(record).join(', ');
                            const values = Object.values(record);
                            const placeholders = Object.keys(record).map(() => '?').join(', ');

                            const updateSet = Object.keys(record)
                                .filter(key => !['ID', 'created_at'].includes(key))
                                .map(key => `${key} = VALUES(${key})`)
                                .join(', ');

                            const sql = `
                                INSERT INTO ${table} (${fields}, deleted) 
                                VALUES (${placeholders}, 0)
                                ON DUPLICATE KEY UPDATE 
                                    ${updateSet},
                                    updated_at = CURRENT_TIMESTAMP,
                                    deleted = 0
                            `;

                            await connection.execute(sql, values);
                            processed++;
                        } catch (recordError) {
                            errors++;
                            console.error(`❌ Error processing record:`, recordError.message);
                        }
                    }

                    await connection.commit();
                } catch (transactionError) {
                    await connection.rollback();
                    errors += batch.length;
                    console.error('Transaction failed:', transactionError.message);
                } finally {
                    connection.release();
                }

            } catch (connectionError) {
                errors += batch.length;
                console.error('Connection error:', connectionError.message);
            }

            // Небольшая пауза между батчами
            if (i + batchSize < records.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return { processed, errors };
    }
}

module.exports = new Database();
