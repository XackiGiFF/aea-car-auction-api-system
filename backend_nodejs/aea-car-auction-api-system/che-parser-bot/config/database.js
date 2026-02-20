const mysql = require('mysql2/promise');
require('dotenv').config();

class Database {
    constructor() {
        this.config = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            charset: 'utf8mb4',
            connectionLimit: 10, // Уменьшаем до разумного значения
            acquireTimeout: 60000,
            timeout: 60000,
            waitForConnections: true,
            queueLimit: 1000,
            reconnect: true,
            // Важные настройки для стабильности
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000,
            // Увеличиваем таймауты
            connectTimeout: 10000,
        };

        this.pool = null;
        this.retryCount = 0;
        this.maxRetries = 5;
    }

    async init() {
        try {
            console.log('🔌 Creating database pool...');
            this.pool = mysql.createPool(this.config);

            // Тестируем соединение
            const connection = await this.pool.getConnection();
            await connection.execute('SELECT 1');
            connection.release();

            console.log('✅ Database pool created successfully');
            return this.pool;
        } catch (error) {
            console.error('❌ Database pool creation failed:', error.message);

            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`🔄 Retrying database connection (attempt ${this.retryCount}/${this.maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.init();
            }

            throw error;
        }
    }

    async getConnection() {
        if (!this.pool) {
            await this.init();
        }

        try {
            return await this.pool.getConnection();
        } catch (error) {
            console.error('❌ Failed to get database connection:', error.message);
            throw error;
        }
    }

    async query(sql, params = []) {
        let connection;
        try {
            connection = await this.getConnection();
            const [rows] = await connection.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('Database query error:', error.message);

            // Переподключаемся при ошибках соединения
            if (error.code === 'PROTOCOL_CONNECTION_LOST' ||
                error.code === 'ECONNREFUSED' ||
                error.code === 'ETIMEDOUT') {
                console.log('🔄 Reconnecting to database...');
                this.pool = null;
                await this.init();
                return this.query(sql, params);
            }

            throw error;
        } finally {
            if (connection) {
                try {
                    connection.release();
                } catch (releaseError) {
                    console.error('Error releasing connection:', releaseError.message);
                }
            }
        }
    }

    async close() {
        if (this.pool) {
            try {
                await this.pool.end();
                console.log('🔌 Database connection closed');
            } catch (error) {
                console.error('Error closing pool:', error.message);
            }
        }
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