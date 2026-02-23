const axios = require('axios');
const fs = require('fs');
const path = require('path');
const CarModel = require('../models/CarModel');
require('dotenv').config();

class CalcAvtoScheduler {
    constructor() {
        this.tables = ['main', 'korea', 'china', 'bike', 'che_available'];
        this.requestDelay = process.env.CALC_AVTO_REQUEST_DELAY_MS ? parseInt(process.env.CALC_AVTO_REQUEST_DELAY_MS) : 800;
        this.maxParallelRequests = process.env.CALC_AVTO_MAX_PARALLEL ? parseInt(process.env.CALC_AVTO_MAX_PARALLEL) : 2;

	    this.isRunning = false;
	    this.lastRunTime = null;
        this.inFlightCars = new Map();


        // tokens: prefer env, fallback to examples (not secrets)
        // this.carToken = process.env.AJES_CAR_TOKEN || '0f71f82a7a13db2ea083e66c803f90f0';  // Tax RU only
        
        // Токены для разных рынков
        this.carTokenJPY = process.env.AJES_CAR_TOKEN_JPY || '0f71f82a7a13db2ea083e66c803f90f0';
        this.carTokenCNY = process.env.AJES_CAR_TOKEN_CNY || '3e83bb7d55307c1d4ccb1c839a342c0d';
        this.carTokenKRW = process.env.AJES_CAR_TOKEN_KRW || '4e6dc4dee6e462f873a9ed420cb3cb1b';
        this.bikeToken = process.env.AJES_BIKE_TOKEN || '700dd9ad315d2fd9afb126f81532410f';
        
        // Карта токенов по рынкам
        this.tokenMap = {
            'main': this.carTokenJPY,     // Япония
            'korea': this.carTokenKRW,    // Корея  
            'china': this.carTokenCNY,    // Китай
            'che_available': this.carTokenCNY,    // Китай
            'bike': this.bikeToken        // Мотоциклы
        };

        this.failedLog = path.join(__dirname, 'calc_avto_failed.log');
        this.debug = (process.env.CALC_AVTO_DEBUG === 'true');

        // Наценки для разных рынков
        this.markups = {
            china: { currency: 16000, rub: 140000 },
            che_available: { currency: 16000, rub: 140000 },
            korea: { currency: 1600000, rub: 150000 },
            japan: {
                standard: { currency: 110000, rub: 140000 },
                sanctions: { currency: 3000, rub: 180000 }
            },
            bike: { currency: 110000, rub: 140000 }
        };

        // Карта исходных валют по рынкам (каждому market свой originalCurrency)
        this.marketCurrencyMap = {
            main: 'JPY',
            korea: 'KRW',
            china: 'CNY',
            che_available: 'CNY',
            bike: 'JPY'
        };

        // currency cache
        this.currencyRates = {};
        this.currencyCacheTime = 0;
        this.currencyCacheDuration = 3600000; // 1 hour

        // Наценка к курсу валют +2%
        this.currencyMarkupPercent = 0.02;
    }

    // Определение спорных годов
    getControversialYears() {
        const currentYear = new Date().getFullYear();
        return [
            currentYear - 3, // a: текущий_год - 3
            currentYear - 5, // б: текущий_год - 5
            currentYear - 7  // в: текущий_год - 7
        ];
    }

    // Проверка является ли год спорным
    isControversialYear(year) {
        const controversialYears = this.getControversialYears();
        return controversialYears.includes(parseInt(year));
    }

    adjustControversialYear(year, fuelType, market) {
        const currentYear = new Date().getFullYear();
        const yearInt = parseInt(year);

        // Определяем возраст автомобиля
        const carAge = currentYear - yearInt;

        // Для электроавтомобилей - особая логика (только 2 группы)
        if (fuelType === 3) { // электро
            if (carAge === 3) {
                // Спорный год на границе "менее 3 лет" и "3-5 лет" для электро
                // Выбираем категорию с меньшей пошлиной
                const duties = this.getElectricDuties(market);
                if (duties.less3 < duties.from3to5) {
                    return currentYear; // оставляем в "менее 3 лет"
                } else {
                    return currentYear - 4; // переводим в "3-5 лет"
                }
            }
            return yearInt;
        }

        // Для обычных автомобилей (бензин, дизель, гибриды)
        if (carAge === 3) {
            // Спорный год: ровно 3 года
            // Выбираем между "менее 3 лет" и "3-5 лет"
            const duties = this.getCarDuties(market, fuelType);
            if (duties.less3 < duties.from3to5) {
                return yearInt; // оставляем в "менее 3 лет" (дешевле)
            } else {
                return currentYear - 4; // переводим в "3-5 лет" (дешевле)
            }
        } else if (carAge === 5) {
            // Спорный год: ровно 5 лет
            // Выбираем между "3-5 лет" и "5-7 лет"
            const duties = this.getCarDuties(market, fuelType);
            if (duties.from3to5 < duties.from5to7) {
                return currentYear - 4; // оставляем в "3-5 лет" (дешевле)
            } else {
                return currentYear - 6; // переводим в "5-7 лет" (дешевле)
            }
        } else if (carAge === 7) {
            // Спорный год: ровно 7 лет
            // Выбираем между "5-7 лет" и "старше 7 лет"
            const duties = this.getCarDuties(market, fuelType);
            if (duties.from5to7 < duties.over7) {
                return currentYear - 6; // оставляем в "5-7 лет" (дешевле)
            } else {
                return currentYear - 8; // переводим в "старше 7 лет" (дешевле)
            }
        }

        return yearInt; // Если не спорный - возвращаем как есть
    }

    // Получение пошлин для автомобилей по рынку и типу топлива
    getCarDuties(market, fuelType) {
        const duties = {
            'main': { // Япония
                less3: 5822.0,    // менее 3 лет
                from3to5: 6305.0, // 3-5 лет
                from5to7: 11149.0, // 5-7 лет
                over7: 11149.0    // старше 7 лет (такая же)
            },
            'china': { // Китай
                less3: 8169.0,
                from3to5: 6345.0,
                from5to7: 11189.0,
                over7: 111890.0
            },
            'che_available': { // Китай
                less3: 8169.0,
                from3to5: 6345.0,
                from5to7: 11189.0,
                over7: 111890.0
            },
            'korea': { // Корея
                less3: 5822.0,
                from3to5: 6305.0,
                from5to7: 11149.0,
                over7: 111490.0
            }
        };

        return duties[market] || duties['main'];
    }

    // Получение пошлин для электроавтомобилей
    getElectricDuties(market) {
        const duties = {
            'main': {
                less3: 576.0,    // менее 3 лет
                from3to5: 598.0  // 3-5 лет
            },
            'china': {
                less3: 4356.0,
                from3to5: 4378.0
            },
            'korea': {
                less3: 174.0,
                from3to5: 196.0
            }
        };

        return duties[market] || duties['main'];
    }

    // Применение наценки к курсу валют +2%
    applyCurrencyMarkup(rate) {
        return rate * (1 + this.currencyMarkupPercent);
    }

    formatTs() { return new Date().toISOString(); }
    log(table, ...args) { const prefix = `[${this.formatTs()}] ${table ? table + ' -' : ''}`; console.log(prefix, ...args); }
    error(table, ...args) { const prefix = `[${this.formatTs()}] ${table ? table + ' -' : ''}`; console.error(prefix, ...args); }
    debugLog(table, ...args) { if (!this.debug) return; const prefix = `[${this.formatTs()}] ${table ? table + ' -' : ''}`; console.log(prefix, ...args); }
    maskSensitiveUrl(rawUrl) {
        const url = String(rawUrl || '');
        return url
            .replace(/(\/api\/)[^-/?]+(-auc\.asiaexpressauto\.ru_Dftr)/i, '$1***$2')
            .replace(/([?&]code=)[^&]*/i, '$1***');
    }

    escapeSqlLiteral(value) {
        return String(value || '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "''");
    }

    // Sleep helper
    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // Progress printer (only when debug). If startTs provided, show ETA estimate.
    printProgress(current, total, message = 'Processing', startTs = null) {
        if (!this.debug) return;
        const percentage = total > 0 ? Math.round((current / total) * 100) : 100;
        const progressBar = `[${'='.repeat(Math.floor(percentage / 5))}${' '.repeat(20 - Math.floor(percentage / 5))}]`;

        let etaStr = '';
        if (startTs && current > 0 && total > current) {
            const elapsed = Date.now() - startTs; // ms
            const avgPerItem = elapsed / current; // ms
            const remaining = total - current;
            const etaMs = Math.round(avgPerItem * remaining);
            const etaSec = Math.round(etaMs / 1000);
            etaStr = ` ETA: ${etaSec}s`;
        }

        process.stdout.write(`\r${message}: ${progressBar} ${percentage}% (${current}/${total})${etaStr}`);
        if (current === total) process.stdout.write('\n');
    }

    logT(table, ...args) {
        const prefix = `[${this.formatTs()}] ${table ? table + ' -' : ''}`;
        console.log(prefix, ...args);
    }

    async processAllTables() {
        if (this.isRunning) {
            console.log('[CALC] ⏳ Calculation already running, skipping');
            return;
        }

        this.isRunning = true;
        this.log(null, '[CALC_AVTO] Starting AJES-based calculation for all tables');
        try {
            // Start processing all tables and wait for them to finish
            const promises = this.tables.map((table, idx) => {
                // stagger the starts slightly to avoid burst
                return new Promise(resolve => setTimeout(resolve, idx * 200)).then(() =>
                    this.processTable(table).catch(err => {
                        this.error(table, 'Table processing failed:', err.message);
                    })
                );
            });

            await Promise.all(promises);
            this.log(null, '[CALC_AVTO] All tables processed');

        } catch (err) {
            this.error(null, '[CALC_AVTO] Fatal error:', err.message);
        } finally {
            this.isRunning = false;
            this.lastRunTime = new Date();
        }
    }

    async processTable(table) {

        this.log(table, '[CALC_AVTO] Processing table');
        const market = this.getMarketFromTable(table);
        try {
            const cars = await CarModel.getCarsForCalculation(table, 0, 24);
            if (!cars || cars.length === 0) {
                this.log(table, '[CALC_AVTO] No cars to calculate');
                return;
            }

            // process batches of limited parallel requests with progress
            const total = cars.length;
            let processedCount = 0;

            const tableStart = Date.now();
            for (let i = 0; i < total; i += this.maxParallelRequests) {
                const batch = cars.slice(i, i + this.maxParallelRequests);
                const promises = batch.map(car => this.processSingleCar(car, market, table).then(ok => { if (ok) processedCount++; }));
                await Promise.all(promises);

                // print debug progress with ETA
                this.printProgress(processedCount, total, `[CALC_AVTO] ${table} progress`, tableStart);

                await this.sleep(this.requestDelay);
            }

            this.log(table, `[CALC_AVTO] Finished processing ${total} cars`);
        } catch (err) {
            this.error(table, '[CALC_AVTO] Error in processTable:', err.message);
	}
    }

    async recalculateCarById(carId, table = 'main') {
        const normalizedTable = this.tables.includes(table) ? table : 'main';
        const key = `${normalizedTable}:${carId}`;

        if (this.inFlightCars.has(key)) {
            return this.inFlightCars.get(key);
        }

        const task = (async () => {
            const market = this.getMarketFromTable(normalizedTable);
            const car = await CarModel.getCarById(carId, normalizedTable);

            if (!car) {
                return {
                    success: false,
                    reason: 'not_found',
                    table: normalizedTable,
                    carId
                };
            }

            const ok = await this.processSingleCar(car, market, normalizedTable);
            const updated = await CarModel.getCarById(carId, normalizedTable);

            return {
                success: ok,
                reason: ok ? 'recalculated' : 'calculation_failed',
                table: normalizedTable,
                carId,
                calc_rub: updated ? updated.CALC_RUB : null,
                calc_updated_at: updated ? updated.CALC_UPDATED_AT : null
            };
        })();

        this.inFlightCars.set(key, task);
        try {
            return await task;
        } finally {
            this.inFlightCars.delete(key);
        }
    }

    getMarketFromTable(table) {
        const map = { main: 'main', korea: 'korea', china: 'china', bike: 'bike', che_available: 'che_available' };
        return map[table] || 'main';
    }

    async processSingleCar(car, market, table) {
        try {
            const fresh = await CarModel.getCarById(car.ID, table);
            if (!fresh || fresh.deleted === 1) {
                this.log(table, `[CALC_AVTO] Car ${car.ID} missing or deleted, skipping`);
                return;
            }

            // ОБЯЗАТЕЛЬНЫЕ ПОЛЯ. Пропускать авто с невалидным годом
            const year = parseInt(car.YEAR) || 0;
            if (year === 0 || year < 1960) {
                this.debugLog(table, `[CALC_AVTO] Car ${car.ID} has invalid YEAR (${car.YEAR}), skipping`);
                return false;
            }

            // ОБЯЗАТЕЛЬНЫЕ ПОЛЯ. Пропускать авто с отсутствующим объемом двигателя ENG_V
            // Исключение: электрокары (fuel code 3)
            const fuelCode = this.getFuelCode(car);
            const engineVolume = parseInt(car.ENG_V) || 0;

            if (fuelCode !== 3 && engineVolume === 0) {
                this.debugLog(table, `[CALC_AVTO] Car ${car.ID} has no ENG_V data and is not electric, skipping`);
                return false;
            }

            // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: для мотоциклов с ценой выше 10,000 у.е.
            if (market === 'bike') {
                // Получаем максимальную цену из всех возможных полей
                const maxPrice = Math.max(
                    parseFloat(car.START) || 0,
                    parseFloat(car.FINISH) || 0,
                );

                if (maxPrice > 10000) {
                    this.debugLog(table, `[CALC_AVTO] Bike ${car.ID} has price ${maxPrice} > 10000, skipping`);
                    return false;
                }
            }

            // Compute original price and apply bike-specific rules inside getCarPrice
            const originalPriceCandidate = this.getCarPrice(car, market);
            if (originalPriceCandidate === null) {
                this.debugLog(table, `[CALC_AVTO] Car ${car.ID} skipped due to price rules (bike sentinel or no valid price)`);
                return false;
            }

            const result = await this.calculateWithAjes(car, market);
            if (!result) return false;

            const still = await CarModel.getCarById(car.ID, table);
            if (!still || still.deleted === 1) {
                this.debugLog(table, `[CALC_AVTO] Car ${car.ID} disappeared after calc, skipping DB update`);
                return false;
            }

            await CarModel.updateCarPrice(car.ID, result.price_calc, result.calc_rub, table, {
                original_price: result.original_price,
                original_currency: result.original_currency,
                converted_price: result.converted_price,
                tks_total: result.tks_total,
                markup: result.markup || 0,
                response_time: result.response_time
            });

            this.debugLog(table, `[CALC_AVTO] ✅ ${car.ID}: ${result.calc_rub} RUB (original_converted: ${result.converted_price} tks_total: ${result.tks_total} RUB; markup: ${result.markup})`);
            return true;
        } catch (err) {
            this.error(table, `[CALC_AVTO] ❌ Error processing car ${car.ID}:`, err.message);
            try {
                fs.appendFileSync(this.failedLog, JSON.stringify({ ts: new Date().toISOString(), table, id: car.ID, error: err.message }) + '\n');
            } catch (e) {}
            return false;
        }
    }

    // Minimal XML extraction helpers
    // extractTag(xml, tag) {
    //     const re = new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`, 'i');
    //     const m = xml.match(re);
    //     return m ? m[1].trim() : null;
    // }

    // Универсальный метод для извлечения тегов из XML
    extractTag(xml, tagName, index = null) {
        if (index === null) {
            // Режим 1: извлечь первый найденный тег (оригинальная логика)
            const re = new RegExp(`<${tagName}>([\\s\\S]*?)<\/${tagName}>`, 'i');
            const m = xml.match(re);
            return m ? m[1].trim() : null;
        } else {
            // Режим 2: извлечь тег по индексу (для массивов одинаковых тегов)
            const regex = new RegExp(`<${tagName}>([^<]+)</${tagName}>`, 'g');
            const matches = [];
            let match;

            while ((match = regex.exec(xml)) !== null) {
                matches.push(match[1]);
            }

            return matches.length > index ? matches[index] : null;
        }
    }

    // Получение курсов валют с кэшированием
    async getCurrencyRates() {
        const now = Date.now();
        if (now - this.currencyCacheTime < this.currencyCacheDuration && Object.keys(this.currencyRates).length > 0) {
            return this.currencyRates;
        }

        try {
            const start = Date.now();
            const resp = await axios.get('https://www.cbr-xml-daily.ru/daily_json.js', { timeout: 5000 });
            const responseTime = Date.now() - start;
            if (resp && resp.data && resp.data.Valute) {
                for (const [k, v] of Object.entries(resp.data.Valute)) {
                    this.currencyRates[k] = this.applyCurrencyMarkup(v.Value / v.Nominal);
                }

                this.currencyRates['JPY'] = this.currencyRates['JPY'] || 0.54;
                this.currencyRates['KRW'] = this.currencyRates['KRW'] || 0.058;
                this.currencyRates['CNY'] = this.currencyRates['CNY'] || 11.17;
                this.currencyRates['USD'] = this.currencyRates['USD'] || 80.0;

                this.currencyCacheTime = now;
                this.log(null, `[CALC_AVTO] 💰 Currency rates updated with +2% markup in ${responseTime}ms`);
            }
        } catch (err) {
            this.error(null, '[CALC_AVTO] ❌ CBR API error, using fallback rates with +2% markup');
            this.currencyRates = {
                JPY: this.applyCurrencyMarkup(0.54),
                KRW: this.applyCurrencyMarkup(0.058),
                CNY: this.applyCurrencyMarkup(11.17),
                USD: this.applyCurrencyMarkup(80.0)
            };
        }

        return this.currencyRates;
    }

    calculateMarkup(market, carData, rates, currencyBlock = null) {
        const marketMarkup = this.markups[market] || this.markups.japan;
        let markup = 0;

        // Проверка санкций для Японии
        const isSanctions = (() => {
            try {
                const engineVolume = parseInt(carData.ENG_V) || 0;
                const fuelCode = carData.TIME || '';
                const isHybrid = fuelCode.includes('H') || fuelCode.includes('P') || fuelCode.includes('&');
                return engineVolume > 1900 && isHybrid;
            } catch (e) {
                return false;
            }
        })();

        // ОБРАБОТКА КИТАЯ
        if (market === 'china' || market === 'che_available') {
            const amount = marketMarkup.currency; // 16,000 CNY
            const currency = 'CNY';
            const currencyMarkup = marketMarkup.rub; // 140,000 RUB

            if (currencyBlock) {
                // Используем курсы AJES для конвертации
                const cnyMatch = currencyBlock.match(/USDCNY_system:([\d.]+)/);
                const usdRubMatch = currencyBlock.match(/USDRUB_system:([\d.]+)/);
                if (cnyMatch && usdRubMatch) {
                    const usdCnyRate = parseFloat(cnyMatch[1]);
                    const usdRubRate = parseFloat(usdRubMatch[1]);
                    // CNY → USD → RUB
                    // Применяем наценку +2% к курсу
                    const actualRate = this.applyCurrencyMarkup(usdRubRate / usdCnyRate);
                    markup = (amount * actualRate) + currencyMarkup;
                } else {
                    // Fallback на курс ЦБ
                    markup = (amount * (rates[currency] || 1)) + currencyMarkup;
                }
            } else {
                markup = (amount * (rates[currency] || 1)) + currencyMarkup;
            }
            return markup;
        }

        // ОБРАБОТКА КОРЕИ
        if (market === 'korea') {
            const amount = marketMarkup.currency; // 1,600,000 KRW
            const currency = 'KRW';
            const currencyMarkup = marketMarkup.rub; // 150,000 RUB

            if (currencyBlock) {
                // Используем курсы AJES для конвертации
                const krwMatch = currencyBlock.match(/USDKRW_system:([\d.]+)/);
                const usdRubMatch = currencyBlock.match(/USDRUB_system:([\d.]+)/);
                if (krwMatch && usdRubMatch) {
                    const usdKrwRate = parseFloat(krwMatch[1]);
                    const usdRubRate = parseFloat(usdRubMatch[1]);
                    // KRW → USD → RUB
                    const actualRate = this.applyCurrencyMarkup(usdRubRate / usdKrwRate);
                    markup = (amount * actualRate) + currencyMarkup;
                } else {
                    // Fallback на курс ЦБ
                    markup = (amount * (rates[currency] || 1)) + currencyMarkup;
                }
            } else {
                markup = (amount * (rates[currency] || 1)) + currencyMarkup;
            }
            return markup;
        }

        // Обработка Японии (существующий код)
        if (market === 'main') {
            const marketMk = marketMarkup;
            const amount = isSanctions ? marketMk.sanctions.currency : marketMk.standard.currency;
            const currency = isSanctions ? 'USD' : 'JPY';
            const currencyMarkup = isSanctions ? marketMk.sanctions.rub : marketMk.standard.rub;

            if (currencyBlock) {
                let actualRate = rates[currency] || 1;
                if (currency === 'JPY') {
                    const jpyMatch = currencyBlock.match(/USDJPY_system:([\d.]+)/);
                    const usdRubMatch = currencyBlock.match(/USDRUB_system:([\d.]+)/);
                    if (jpyMatch && usdRubMatch) {
                        const usdJpyRate = parseFloat(jpyMatch[1]);
                        const usdRubRate = parseFloat(usdRubMatch[1]);
                        // Применяем наценку +2% к курсу
                        const actualRate = this.applyCurrencyMarkup(usdRubRate / usdJpyRate);
                        markup = (amount * actualRate) + currencyMarkup;
                    }
                } else if (currency === 'USD') {
                    const usdRubMatch = currencyBlock.match(/USDRUB_system:([\d.]+)/);
                    if (usdRubMatch) {
                        actualRate = parseFloat(usdRubMatch[1]);
                    }
                }
                markup = (amount * actualRate) + currencyMarkup;
            } else {
                markup = (amount * (rates[currency] || 1)) + currencyMarkup;
            }
            return markup;
        }

        // Обработка мотоциклов (существующий код)
        if (market === 'bike') {
            const currencyMap = {
                'bike': { amount: marketMarkup.currency, currency: 'JPY' }
            };
            if (currencyMap[market]) {
                const { amount, currency } = currencyMap[market];
                const currencyMarkup = marketMarkup.rub;

                if (currencyBlock && currency === 'JPY') {
                    const jpyMatch = currencyBlock.match(/USDJPY_system:([\d.]+)/);
                    const usdRubMatch = currencyBlock.match(/USDRUB_system:([\d.]+)/);
                    if (jpyMatch && usdRubMatch) {
                        const usdJpyRate = parseFloat(jpyMatch[1]);
                        const usdRubRate = parseFloat(usdRubMatch[1]);

                        // Применяем наценку +2% к курсу
                        const actualRate = this.applyCurrencyMarkup(usdRubRate / usdJpyRate);
                        markup = (amount * actualRate) + currencyMarkup;
                    } else {
                        markup = (amount * (rates[currency] || 1)) + currencyMarkup;
                    }
                } else {
                    markup = (amount * (rates[currency] || 1)) + currencyMarkup;
                }
            }
            return markup;
        }

        return markup;
    }

    getMarketCurrencyCode(market) {
        const currencyMap = {
            'main': 'JPY', 'korea': 'KRW', 'china': 'CNY', 'bike': 'JPY', 'che_available': 'CNY'
        };
        return currencyMap[market] || 'JPY';
    }

    // // Альтернативный вариант - если не хотим создавать экземпляр SyncScheduler
    // async fetchPowerFromAPIAlternative(carId, market) {
    //     const tableMap = {
    //         'main': 'main',
    //         'korea': 'korea',
    //         'china': 'china',
    //         'bike': 'bike'
    //     };
    //     const table = tableMap[market] || 'main';
    //
    //     const axios = require('axios');
    //     const apiBase = process.env.API_BASE_URL;
    //     const apiParams = {
    //         ip: process.env.API_IP,
    //         code: process.env.API_CODE
    //     };
    //
    //     try {
    //         const sql = `SELECT PW FROM ${table} WHERE id = '${carId}'`;
    //         const params = new URLSearchParams({
    //             ip: apiParams.ip,
    //             code: apiParams.code,
    //             sql: sql
    //         });
    //
    //         const url = `${apiBase}?json&${params}`;
    //
    //         this.debugLog(market, `[CALC_AVTO] API URL : ${url}`);
    //
    //         const response = await axios.get(url, {
    //             timeout: 30000,
    //             headers: {
    //                 'User-Agent': 'CarAuctionCalc/1.0'
    //             }
    //         });
    //
    //         const data = response.data;
    //         let power = 0;
    //
    //         // Парсим ответ
    //         if (Array.isArray(data) && data.length > 0) {
    //             power = parseInt(data[0].PW) || 0;
    //         } else if (data && data.PW !== undefined) {
    //             power = parseInt(data.PW) || 0;
    //         }
    //
    //         if (power > 0) {
    //             return power;
    //         } else {
    //             throw new Error('Power value is 0 or not found');
    //         }
    //
    //     } catch (error) {
    //         this.debugLog(market, `[CALC_AVTO] ❌ Direct API power fetch failed for ${carId}: ${error.message}`);
    //         throw error;
    //     }
    // }

    async fetchPowerFromAPISecure(carId, market) {
        const tableMap = {
            'main': 'main', 'korea': 'korea', 'china': 'china', 'bike': 'bike', 'che_available': 'che_available'
        };
        const table = tableMap[market] || 'main';
        const axios = require('axios');

        try {
            // БЕЗОПАСНЫЙ SQL с валидацией
            if (!/^[a-zA-Z0-9_-]+$/.test(carId)) {
                throw new Error('Invalid car ID format');
            }

            // ПЕРВЫЙ ЗАПРОС - конкретная машина
            const sql = `SELECT PW, MARKA_NAME, MODEL_NAME FROM ${table} WHERE id = '${carId}'`;
            const params = new URLSearchParams({
                ip: process.env.API_IP,
                code: process.env.API_CODE,
                sql: sql
            });
            const url = `${process.env.API_BASE_URL}?json&${params}`;

            this.debugLog(market, `[POWER_API] Fetching power for ${carId}`);
            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'CarAuctionCalc/2.0',
                    'Accept': 'application/json'
                }
            });

            this.debugLog(market, `[POWER_API] ✅ RESPONSE STATUS: ${response.status} for ${carId}`);
            this.debugLog(market, `[POWER_API] ✅ RESPONSE DATA: ${JSON.stringify(response.data)} for ${carId}`);

            // Парсим ответ
            const power = this.parsePowerResponse(response.data);

            if (power > 0) {
                this.debugLog(market, `[POWER_API] ✅ Power: ${power} for ${carId}`);
                return power;
            }

            // ЕСЛИ МОЩНОСТЬ НЕ НАЙДЕНА - ИЩЕМ АНАЛОГИЧНЫЕ МАШИНЫ
            this.debugLog(market, `[POWER_API] 🔄 Power not found, searching similar cars...`);

            // Получаем марку и модель текущей машины
            const carData = response.data && response.data[0];
            const mark = carData?.MARKA_NAME;
            const model = carData?.MODEL_NAME;

            if (mark && model) {
                // ВТОРОЙ ЗАПРОС - поиск аналогичных машин
                const safeMark = this.escapeSqlLiteral(mark);
                const safeModel = this.escapeSqlLiteral(model);
                const similarSql = `SELECT PW FROM ${table} WHERE MARKA_NAME = '${safeMark}' AND MODEL_NAME = '${safeModel}' AND PW != '' AND PW IS NOT NULL LIMIT 5`;
                const similarParams = new URLSearchParams({
                    ip: process.env.API_IP,
                    code: process.env.API_CODE,
                    sql: similarSql
                });
                const similarUrl = `${process.env.API_BASE_URL}?json&${similarParams}`;

                const similarResponse = await axios.get(similarUrl, {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'CarAuctionCalc/2.0',
                        'Accept': 'application/json'
                    }
                });

                this.debugLog(market, `[POWER_API] 🔄 SIMILAR CARS: ${JSON.stringify(similarResponse.data)}`);

                // Берем первую найденную мощность
                const similarPower = this.parsePowerResponse(similarResponse.data);
                if (similarPower > 0) {
                    this.debugLog(market, `[POWER_API] ✅ Using similar car power: ${similarPower} for ${mark} ${model}`);
                    return similarPower;
                }
            }

            // ЕСЛИ АНАЛОГИ НЕ НАЙДЕНЫ - используем дефолт для электромобилей
            this.debugLog(market, `[POWER_API] ⚡ Similar cars not found, fallback power=150`);
            return 150;

        } catch (error) {
            this.debugLog(market, `[POWER_API] ❌ Failed for ${carId}: ${error.message}`);
            // При ошибке тоже возвращаем дефолт
            return 150;
        }
    }

// Улучшенный парсинг
    parsePowerResponse(data) {
        if (!Array.isArray(data) || data.length === 0) return 0;

        const firstItem = data[0];
        if (firstItem && firstItem.PW) {
            const power = parseInt(firstItem.PW);
            return isNaN(power) ? 0 : power;
        }

        return 0;
    }

    async calculateWithAjes(car, market) {
        const start = Date.now();
        const rates = await this.getCurrencyRates();
        const originalPrice = this.getCarPrice(car, market);
        const currency = this.getMarketCurrencyCode(market);

        const priceForAjes = Math.round(originalPrice) || 0;

        const year = car.YEAR || new Date().getFullYear();
        let power = parseInt(car.PW) || 0;
        const volume = parseInt(car.ENG_V) || 0;
        const isBike = market === 'bike';
        const fuelType = this.getFuelCode(car);

        // Корректируем спорный год для минимальной пошлины
        let adjustedYear = year;
        if (this.isControversialYear(year)) {
            adjustedYear = this.adjustControversialYear(year, this.getFuelCode(car), market);
            this.debugLog(market, `[CALC_AVTO] 🔄 Adjusted controversial year ${year} → ${adjustedYear} for car ${car.ID}`);
        }

        // Для электроавтомобилей получаем мощность через API, если не указана
        if (fuelType === 3 && power === 0) {
            try {
                power = await this.fetchPowerFromAPISecure(car.ID, market);
                this.debugLog(market, `[CALC_AVTO] ⚡ Fetched power for electric car ${car.ID}: ${power} kW`);
            } catch (error) {
                this.debugLog(market, `[CALC_AVTO] ❌ Failed to fetch power for electric car ${car.ID}, using default`);
                //power = 100; // значение по умолчанию для электроавтомобилей
                this.debugLog(market, `[CALC_AVTO] ❌ Cannot calculate electric car ${car.ID} - no power data available`);
                return null; // Пропускаем расчет полностью
            }
        }

        if (!Number.isFinite(power) || power <= 0) {
            this.debugLog(market, `[CALC_AVTO] Invalid power for ${car.ID}: ${power}, skipping`);
            return null; // Пропускаем расчет полностью
        }
        
        const token = this.tokenMap[market] || this.carTokenJPY;
        const base = `http://calcos.ajes.com/api/${token}-auc.asiaexpressauto.ru_Dftr`;

        let params = {};
        if (!isBike) {
            // car params
            params = {
                verbose: 1,
                price: priceForAjes,
                year: adjustedYear, // Используем скорректированный год
                passing: 1,
                power: power,
                volume: volume,
                fuel: fuelType,
                tax_mode: 2,
                or_change_tax_mode_to_2: ''
            };
        } else {
            // bike params (example keys from user)
            params = {
                verbose: 1,
                price: priceForAjes,
                sheet1: 0, // Владивосток
                power: power,
                vcc: volume,
                tax_mode: 2,
                or_change_tax_mode_to_2: ''
            };
        }

        // Build query string
        const qs = Object.entries(params)
            .map(([k, v]) => v === '' ? encodeURIComponent(k) + '=' : `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');
        const url = `${base}?${qs}`;

        // Log short (debug only)
        const safeUrl = this.maskSensitiveUrl(url);
        this.debugLog(isBike ? 'bike' : 'car', `[CALC_AVTO] ➤ AJES request: ${safeUrl.slice(0, 200)}`);

        let responseText;
        // Retry logic: 5 attempts, 2s delay
        const maxAttempts = 5;
        const retryDelay = 2000;
        let lastErr = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                this.debugLog(isBike ? 'bike' : 'car', `[CALC_AVTO] AJES request attempt ${attempt}/${maxAttempts} for ${car.ID}`);
                const resp = await axios.get(url, { timeout: 15000 });
                responseText = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
                lastErr = null;
                break;
            } catch (err) {
                lastErr = err;
                this.error(isBike ? 'bike' : 'car', `[CALC_AVTO] AJES request failed (${attempt}/${maxAttempts}):`, err.message, 'url:', safeUrl);
                if (attempt < maxAttempts) {
                    this.debugLog(isBike ? 'bike' : 'car', `[CALC_AVTO] Retrying in ${retryDelay}ms...`);
                    await this.sleep(retryDelay);
                }
            }
        }

        if (lastErr) {
            // failed after retries
            this.error(isBike ? 'bike' : 'car', `[CALC_AVTO] AJES request failed after ${maxAttempts} attempts for car ${car.ID}`);
            // write preview and return null so caller skips DB update
            try { fs.appendFileSync(this.failedLog, JSON.stringify({ ts: new Date().toISOString(), table: market, id: car.ID, url: safeUrl, error: lastErr.message }) + '\n'); } catch (e) {}
            return null;
        }

        // Parse XML: get <sum>, <info><fiz>, <info><jur>, <info><total>, <info><currency>
        const sumStr = this.extractTag(responseText, 'sum');
        const infoXml = this.extractTag(responseText, 'info') || '';
        const fizStr = this.extractTag(infoXml, 'fiz');
        const currencyBlock = this.extractTag(infoXml, 'currency');

        let tks_total = null;
        let tks_total_currency = null; // 'USD' or 'RUB'

        const raw_sum = fizStr ? parseFloat(fizStr.replace(',', '.')) : null;
        // В блоке парсинга XML для мотоциклов замените:
        if (isBike) {
            // Парсим конкретные компоненты вместо общей суммы
            const duty = this.extractTag(responseText, 'tag3', 2); // 3-й tag3 (индекс 2) - пошлина
            const excise = this.extractTag(responseText, 'tag3', 3); // 4-й tag3 (индекс 3) - акциз
            const vat = this.extractTag(responseText, 'tag3', 4); // 5-й tag3 (индекс 4) - НДС

            const dutyValue = duty ? parseFloat(duty.replace(',', '.')) : 0;
            const exciseValue = excise ? parseFloat(excise.replace(',', '.')) : 0;
            const vatValue = vat ? parseFloat(vat.replace(',', '.')) : 0;

            // Для мотоциклов берем только пошлину и НДС (акциз только если мощность > 150 л.с.)
            let power = parseInt(car.PW) || 0;
            let tks_components = dutyValue + vatValue;

            // Добавляем акциз только если мощность больше 150 л.с.
            if (power > 150) {
                tks_components += exciseValue;
                this.debugLog('bike', `[CALC_AVTO] Bike ${car.ID} power ${power} > 150, adding excise: ${exciseValue}`);
            }

            tks_total = tks_components;
            tks_total_currency = 'RUB';

            this.debugLog('bike', `[CALC_AVTO] Bike ${car.ID} components - Duty: ${dutyValue}, Excise: ${exciseValue}, VAT: ${vatValue}, Total: ${tks_total}`);
        } else {
            if (raw_sum === null) {
                this.error('car', '[CALC_AVTO] Invalid AJES response for car, no <sum>:', responseText.slice(0, 300));
                fs.appendFileSync(this.failedLog, JSON.stringify({ ts: new Date().toISOString(), url: safeUrl, response: responseText.slice(0, 500) }) + '\n');
                return null;
            }
            tks_total = raw_sum;
            tks_total_currency = 'USD';
        }

        const elapsed = Date.now() - start;

        // Используем курс AJES для конвертации
        let tks_total_rub = null;
        try {
            if (tks_total !== null && tks_total !== undefined) {
                if (tks_total_currency === 'RUB') {
                    // Для мотоциклов - сумма уже в RUB
                    tks_total_rub = tks_total;
                } else {
                    // Для автомобилей - конвертируем USD → RUB через курс AJES
                    if (currencyBlock) {
                        // Парсим USDRUB курс из ответа AJES
                        const usdRubMatch = currencyBlock.match(/USDRUB_system:([\d.]+)/);
                        if (usdRubMatch) {
                            const actualUsdRate = parseFloat(usdRubMatch[1]);
                            tks_total_rub = parseFloat((tks_total * actualUsdRate).toFixed(2));
                            this.debugLog(market, `[CALC_AVTO] Using AJES USDRUB rate: ${actualUsdRate}`);
                        } else {
                            // Fallback на курс ЦБ
                            tks_total_rub = parseFloat((tks_total * rates['USD']).toFixed(2));
                        }
                    } else {
                        // Fallback на курс ЦБ
                        tks_total_rub = parseFloat((tks_total * rates['USD']).toFixed(2));
                    }
                }
            }
        } catch (e) { tks_total_rub = tks_total; }

        // Конвертируем оригинальную цену в RUB используя курсы AJES
        let priceInRub = null;
        if (currencyBlock) {
            // Определяем нужный курс валюты для маркета
            let currencyRateKey = '';
            switch(market) {
                case 'main':
                    currencyRateKey = 'USDJPY_system'; // JPY → USD → RUB
                    break;
                case 'korea':
                    currencyRateKey = 'USDKRW_system'; // KRW → USD → RUB
                    break;
                case 'china':
                    currencyRateKey = 'USDCNY_system'; // CNY → USD → RUB
                    break;
                case 'che_available':
                    currencyRateKey = 'USDCNY_system'; // CNY → USD → RUB
                    break;
                case 'bike':
                    currencyRateKey = 'USDJPY_system'; // JPY → USD → RUB
                    break;
            }

            if (currencyRateKey) {
                // Парсим курс из currencyBlock
                const currencyMatch = currencyBlock.match(new RegExp(`${currencyRateKey}:([\\d.]+)`));
                const usdRubMatch = currencyBlock.match(/USDRUB_system:([\d.]+)/);

                if (currencyMatch && usdRubMatch) {
                    const currencyToUsdRate = parseFloat(currencyMatch[1]);

                    // +2% к курсу на стоимость авто в рублях (себестоимость)
                    const usdToRubRate = this.applyCurrencyMarkup(parseFloat(usdRubMatch[1]));

                    // Конвертация: оригинальная валюта → USD → RUB
                    const priceInUsd = originalPrice / currencyToUsdRate;
                    priceInRub = parseFloat((priceInUsd * usdToRubRate).toFixed(2));

                    this.debugLog(market, `[CALC_AVTO] Using AJES rates: ${currencyToUsdRate} ${currency}→USD, ${usdToRubRate} USD→RUB`);
                }
            }
        }

        if (!Number.isFinite(priceInRub)) {
            const fallbackRate = rates[currency];
            if (Number.isFinite(fallbackRate) && Number.isFinite(originalPrice)) {
                priceInRub = parseFloat((originalPrice * fallbackRate).toFixed(2));
                this.debugLog(market, `[CALC_AVTO] Fallback CBR rate used for ${car.ID}: ${currency}=${fallbackRate}`);
            }
        }

        if (!Number.isFinite(priceInRub) || !Number.isFinite(tks_total_rub)) {
            this.error(market, `[CALC_AVTO] Invalid numeric components for ${car.ID}`, {
                priceInRub,
                tks_total_rub,
                originalPrice,
                currency
            });
            return null;
        }

        // После получения tks_total_rub
        let finalPrice;

        let markup = this.calculateMarkup(market, car, rates, currencyBlock);
        if (!Number.isFinite(markup)) {
            markup = 0;
        }

        // Финальный расчет
        finalPrice = parseFloat((priceInRub + tks_total_rub + markup).toFixed(2)); // Стоимость + Пошлина + Утиль + Наценка
        if (!Number.isFinite(finalPrice)) {
            this.error(market, `[CALC_AVTO] Final price is invalid for ${car.ID}`);
            return null;
        }

        return {
            price_calc: finalPrice,
            calc_rub: finalPrice,
            tks_total: tks_total_rub,
            markup: markup || 0,
            original_price: originalPrice,
            original_currency: currency,
            converted_price: priceInRub,
            response_time: elapsed,
            raw_response: responseText
        };
    }

    getFuelCode(car) {
        this.debugLog('any', `[CALC_AVTO] CarData TIME: "${car.TIME}"`);

        // Безопасное получение кода топлива
        const fuelCode = car.TIME ? car.TIME.toUpperCase().trim() : '';

        if (!fuelCode) {
            this.debugLog('any', `[CALC_AVTO] Empty fuel code, defaulting to petrol (1)`);
            return 1; // бензин по умолчанию
        }

        // Точное сравнение кодов
        switch(fuelCode) {
            case 'G': return 1; // бензин
            case 'P': return 1;
            case 'D': return 2; // дизель
            case 'E': return 3; // электро
            case 'H': return 4; // Бензиновый электро
            case 'HE': return 4; // Бензиновый электро
            case '&': return 5; // дизельный гибрид
            case 'L': return 1; // ГБО (ставится на бензиновые)
            case 'C': return 1; // метан (ставится на бензиновые)
            default:
                this.debugLog('any', `[CALC_AVTO] Unknown fuel code "${fuelCode}", defaulting to petrol (1)`);
                return 1; // бензин по умолчанию
        }
    }

    getCarPrice(carData, market) {
        // For bikes: оставляем существующую логику без изменений
        if (market === 'bike') {
            const start = parseFloat(carData.START) || 0;
            const finish = parseFloat(carData.FINISH) || 0;
            const avg = parseFloat(carData.AVG_PRICE) || 0;

            const base = Math.max(start, finish) || avg || 0;
            if (!base || base <= 0) return null;

            if (base > 100000) {
                return base * 10;
            }
            if (base > 10000) {
                return base * 100;
            }
            return base * 1000;
        }

        // For cars: новая логика - приоритет AVG_PRICE, потом MAX(START, FINISH)
        const start = parseFloat(carData.START) || 0;
        const finish = parseFloat(carData.FINISH) || 0;
        const avg = parseFloat(carData.AVG_PRICE) || 0;

        // Приоритет 1: AVG_PRICE (средняя цена)
        if (avg > 0) {
            return avg;
        }

        // Приоритет 2: MAX(START, FINISH) - наибольшая из стартовой/финальной
        const maxStartFinish = Math.max(start, finish);
        if (maxStartFinish > 0) {
            return maxStartFinish;
        }

        // Если валидной цены нет - не рассчитываем
        return null;
    }
}

// Run if called directly
if (require.main === module) {
    const scheduler = new CalcAvtoScheduler();

    const runCalculation = async () => {
        try {
            await scheduler.processAllTables();
            process.exit(0);
        } catch (error) {
            console.error('[CALC_AVTO] Calculation failed:', error);
            process.exit(1);
        }
    };

    runCalculation();
}

module.exports = CalcAvtoScheduler;
