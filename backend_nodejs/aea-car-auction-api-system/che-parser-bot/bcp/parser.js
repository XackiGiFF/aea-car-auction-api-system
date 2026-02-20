const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const Database = require('../config/database');
require('dotenv').config();

class Che168Parser {
    constructor() {
        this.apiBase = 'https://cacheapigo.che168.com/shop/v1/searchv2.ashx';
        this.pageBase = 'https://www.che168.com/dealer';
        this.dealerId = 625793;
        this.dealerType = 9;
        this.userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 YaBrowser/25.10.0.0 Safari/537.36';

        // Конфигурация
        this.batchSize = 50;
        this.maxPages = 0; // 0 = все страницы
        this.maxParallelRequests = 1;
        this.isRunning = false;

        // Маппинг данных из CarModel [5]
        this.fuelTypes = [
            { code: 'H', name: 'Гибрид (H)', tks_type: 'petrol_electric' },
            { code: 'G', name: 'Бензин (G)', tks_type: 'petrol' },
            { code: 'D', name: 'Дизель (D)', tks_type: 'diesel' },
            { code: 'E', name: 'Электро (E)', tks_type: 'electric' },
            { code: 'L', name: 'Газ (L)', tks_type: 'petrol' },
            { code: 'P', name: 'Подзаряжаемый гибрид (P)', tks_type: 'petrol_electric' },
            { code: '&', name: 'Гибрид дизель-электрический (&)', tks_type: 'diesel_electric' },
            { code: 'C', name: 'Газ метан (C)', tks_type: 'petrol' },
            { code: '', name: 'Не указано', tks_type: 'petrol' }
        ];

        // Маппинг трансмиссий [5]
        this.transmissionMapping = {
            'AT': 'automatic',
            'MT': 'manual',
            'CVT': 'cvt',
            '自动': 'AT',
            '手动': 'MT',
            'CVT科技版': 'CVT',
            'DCT': 'automatic',
            'DSG': 'automatic',
            'PDK': 'automatic'
        };

        // Маппинг приводов [5]
        this.driveMapping = {
            'FF': 'FWD',
            'FWD': 'FWD',
            'FR': 'RWD',
            'RWD': 'RWD',
            'RR': 'RWD',
            '4WD': 'AWD',
            'AWD': 'AWD',
            'FULLTIME4WD': 'AWD',
            'PARTTIME4WD': 'PARTTIME_AWD',
            '前驱': 'FWD',
            '后驱': 'RWD',
            '四驱': 'AWD'
        };
    }

    // Логирование в консоль
    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[CHE168][${timestamp}] ${message}`;
        console.log(logMessage);
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }
    }

    // Генерация ID автомобиля
    generateCarId(brand, model, year, mileage, price) {
        const base = `${brand}_${model}_${year}_${mileage}_${price}`;
        const hash = crypto.createHash('md5').update(base).digest('hex');
        return `${hash.substring(0, 12)}`;
    }

    // Получение списка автомобилей с API
    async fetchPage(pageIndex, pageSize = 6) {
        const params = {
            _appid: '2scapp.ios',
            dealerid: this.dealerId,
            dealertype: this.dealerType,
            pageindex: pageIndex,
            pagesize: pageSize,
            _callback: 'jsonp5'
        };

        try {
            this.log(`Fetching page ${pageIndex}...`);

            const response = await axios.get(this.apiBase, {
                params,
                timeout: 20000,
                headers: {
                    'User-Agent': this.userAgent
                }
            });

            // Обработка JSONP ответа
            const jsonpData = response.data;
            const jsonStr = jsonpData.replace(/^jsonp5\(/, '').replace(/\)$/, '');
            const data = JSON.parse(jsonStr);

            this.log(`Page ${pageIndex} fetched: ${data.result?.carlist?.length || 0} cars`);
            return data;

        } catch (error) {
            this.log(`Error fetching page ${pageIndex}:`, error.message);
            throw error;
        }
    }

    // Парсинг детальной страницы через Puppeteer
    async parseCarDetailsWithPuppeteer(carId) {
        let browser = null;
        try {
            this.log(`Starting Puppeteer for car ${carId}`);

            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process'
                ]
            });

            const page = await browser.newPage();

            // Устанавливаем заголовки
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            await page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'ru,en;q=0.9,pt;q=0.8,la;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': 'https://dealers.che168.com/'
            });

            // Переходим на страницу
            const url = `${this.pageBase}/${this.dealerId}/${carId}.html?offertype=110`;
            this.log(`Navigating to: ${url}`);

            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            // Ждем появления контента
            await page.waitForFunction(() => {
                const bodyText = document.body.textContent;
                return bodyText && bodyText.length > 100;
            }, { timeout: 10000 });

            // Проверяем размер страницы
            const html = await page.content();
            if (html.length < 1000) {
                this.log(`Page too small (${html.length} bytes), retrying...`);
                await page.waitForTimeout(3000);
                await page.reload({ waitUntil: 'networkidle2' });
            }

            // Парсим данные из HTML
            const details = this.parseDetailsFromHTML(html);
            return details;

        } catch (error) {
            this.log(`Puppeteer error for car ${carId}:`, error.message);
            return { error: error.message };
        } finally {
            if (browser) {
                await browser.close();
                this.log(`Browser closed for car ${carId}`);
            }
        }
    }

    // Парсинг данных из HTML
    parseDetailsFromHTML(html) {
        const $ = cheerio.load(html);
        const details = {};
        const bodyText = $('body').text();

        this.log(`Parsing HTML, body length: ${bodyText.length} chars`);

        // 1. Цена в CNY (китайских юанях)
        let priceMatch = null;
        const priceElement = $('div:contains("报价")').first();
        if (priceElement.length) {
            const priceText = priceElement.text();
            const match = priceText.match(/(\d+\.?\d*)万/);
            if (match) priceMatch = match;
        }

        if (!priceMatch) {
            const titleMatch = bodyText.match(/_(\d+\.?\d*)万_/);
            if (titleMatch) priceMatch = titleMatch;
        }

        if (!priceMatch) {
            const generalMatch = bodyText.match(/(\d+\.?\d*)万(?![公里])/);
            if (generalMatch) priceMatch = generalMatch;
        }

        if (priceMatch) {
            details.price = parseFloat(priceMatch[1]) * 10000; // Храним в CNY
            this.log(`Found price: ${priceMatch[1]}万 = ${details.price} CNY`);
        }

        // 2. Структурированные данные
        const brandUnitList = $('ul.brand-unit-item.fn-clear');
        if (brandUnitList.length > 0) {
            brandUnitList.find('li').each((index, liElement) => {
                const pText = $(liElement).find('p').text().trim();
                const h4Text = $(liElement).find('h4').text().trim();

                // Пробег
                if (pText.includes('表显里程') || pText.includes('里程')) {
                    const mileageMatch = h4Text.match(/(\d+\.?\d*)万公里/);
                    if (mileageMatch) {
                        details.mileage = parseFloat(mileageMatch[1]) * 10000;
                        this.log(`Found mileage: ${mileageMatch[1]}万公里 = ${details.mileage} km`);
                    }
                }

                // Год
                if (pText.includes('上牌时间') || pText.includes('时间')) {
                    const yearMatch = h4Text.match(/(202\d|201\d)年/);
                    if (yearMatch) {
                        details.year = parseInt(yearMatch[1]);
                        this.log(`Found year: ${details.year}`);
                    }
                }

                // Трансмиссия и объем двигателя
                if (pText.includes('挡位') || pText.includes('排量')) {
                    const parts = h4Text.split('/').map(part => part.trim());
                    if (parts.length >= 2) {
                        // Трансмиссия - маппинг на коды из CarModel [5]
                        const transmissionText = parts[0];
                        if (transmissionText.includes('自动')) {
                            details.transmission = 'AT';
                        } else if (transmissionText.includes('手动')) {
                            details.transmission = 'MT';
                        } else if (transmissionText.includes('CVT')) {
                            details.transmission = 'CVT';
                        }

                        // Объем двигателя
                        const volumeMatch = parts[1].match(/(\d+\.?\d*)L/);
                        if (volumeMatch) {
                            const volume = parseFloat(volumeMatch[1]);
                            if (volume > 0.5 && volume < 10) {
                                details.engineVolume = volume * 1000;
                                this.log(`Found engine volume: ${volumeMatch[1]}L = ${details.engineVolume} cc`);
                            }
                        }
                    }
                }
            });
        }

        // 3. Дополнительный парсинг из общего текста
        // Пробег
        if (!details.mileage) {
            const mileageMatch = bodyText.match(/(\d+\.?\d*)万公里/);
            if (mileageMatch) {
                details.mileage = parseFloat(mileageMatch[1]) * 10000;
                this.log(`Found mileage in body text: ${mileageMatch[1]}万公里 = ${details.mileage} km`);
            }
        }

        // Год
        if (!details.year) {
            const yearMatch = bodyText.match(/(202\d|201\d)年/);
            if (yearMatch) {
                details.year = parseInt(yearMatch[1]);
                this.log(`Found year in body text: ${details.year}`);
            }
        }

        // Объем двигателя
        if (!details.engineVolume) {
            const engineVolumeMatch1 = bodyText.match(/排量\s*(\d+\.?\d*)L/);
            const engineVolumeMatch2 = bodyText.match(/发动机\s*(\d+\.?\d*)L/);

            let engineVolume = null;
            if (engineVolumeMatch1) {
                engineVolume = parseFloat(engineVolumeMatch1[1]) * 1000;
                this.log(`Found engine volume (排量): ${engineVolumeMatch1[1]}L = ${engineVolume} cc`);
            } else if (engineVolumeMatch2) {
                engineVolume = parseFloat(engineVolumeMatch2[1]) * 1000;
                this.log(`Found engine volume (发动机): ${engineVolumeMatch2[1]}L = ${engineVolume} cc`);
            }

            if (engineVolume) {
                details.engineVolume = engineVolume;
            }
        }

        // Мощность
        const horsepowerMatch = bodyText.match(/(\d+)\s*马力/);
        if (horsepowerMatch) {
            details.horsepower = parseInt(horsepowerMatch[1]);
            this.log(`Found horsepower: ${horsepowerMatch[1]} л.с.`);
        }

        // Трансмиссия
        if (!details.transmission) {
            if (bodyText.includes('CVT') || bodyText.includes('CVT科技版')) {
                details.transmission = 'CVT';
                this.log(`Found transmission in body text: CVT`);
            } else if (bodyText.includes('自动') || bodyText.includes('变速箱自动')) {
                details.transmission = 'AT';
                this.log(`Found transmission in body text: AT`);
            } else if (bodyText.includes('手动')) {
                details.transmission = 'MT';
                this.log(`Found transmission in body text: MT`);
            }
        }

        // Тип топлива - маппинг на коды из CarModel [5]
        if (bodyText.includes('汽油') || bodyText.includes('92号') || bodyText.includes('95号')) {
            details.fuelType = 'G';
            this.log(`Found fuel type: G (petrol)`);
        } else if (bodyText.includes('柴油')) {
            details.fuelType = 'D';
            this.log(`Found fuel type: D (diesel)`);
        } else if (bodyText.includes('电动') || bodyText.includes('新能源')) {
            details.fuelType = 'E';
            this.log(`Found fuel type: E (electric)`);
        } else if (bodyText.includes('混动') || bodyText.includes('混合动力')) {
            details.fuelType = 'H';
            this.log(`Found fuel type: H (hybrid)`);
        }

        // Марка и модель
        details.title = $('title').text() || 'No title';
        this.log(`Page title: ${details.title}`);

        return details;
    }

    // Преобразование данных автомобиля в формат для базы данных
    async prepareCarData(apiCar, puppeteerDetails) {
        try {
            // Генерация ID
            const carId = this.generateCarId(
                apiCar.BrandName,
                apiCar.carname,
                apiCar.registrationdate,
                apiCar.mileage,
                apiCar.price
            );

            // Маппинг типа топлива
            let fuelType = 'G'; // По умолчанию бензин
            if (puppeteerDetails.fuelType) {
                fuelType = puppeteerDetails.fuelType;
            }

            // Маппинг трансмиссии
            let transmission = 'AT'; // По умолчанию автоматическая
            if (puppeteerDetails.transmission) {
                transmission = puppeteerDetails.transmission;
            }

            // Формируем данные в формате CarModel [5]
            const carData = {
                ID: carId,
                SOURCE: 'che168',
                MARKA_ID: '',
                MARKA_NAME: apiCar.BrandName || '',
                MODEL_ID: '',
                MODEL_NAME: apiCar.carname || '',
                YEAR: puppeteerDetails.year || apiCar.registrationdate || '',
                TOWN: apiCar.cname || '',
                ENG_V: puppeteerDetails.engineVolume ? puppeteerDetails.engineVolume.toString() : '',
                PW: puppeteerDetails.horsepower ? puppeteerDetails.horsepower.toString() : '',
                KUZOV: '',
                GRADE: '',
                COLOR: '',
                KPP: transmission,
                KPP_TYPE: transmission,
                PRIV: '',
                MILEAGE: puppeteerDetails.mileage ? puppeteerDetails.mileage.toString() : (parseFloat(apiCar.mileage) * 10000).toString(),
                EQUIP: '',
                RATE: '',
                START: puppeteerDetails.price ? puppeteerDetails.price.toString() : (parseFloat(apiCar.price) * 10000).toString(),
                FINISH: puppeteerDetails.price ? puppeteerDetails.price.toString() : (parseFloat(apiCar.price) * 10000).toString(),
                STATUS: 'available',
                TIME: fuelType,
                SANCTION: '',
                AVG_PRICE: puppeteerDetails.price ? puppeteerDetails.price.toString() : (parseFloat(apiCar.price) * 10000).toString(),
                AVG_STRING: '',
                IMAGES: '',
                PRICE_CALC: null,
                CALC_RUB: null,
                CALC_UPDATED_AT: null,
                original_price: puppeteerDetails.price || parseFloat(apiCar.price) * 10000,
                original_currency: 'CNY',
                converted_price: null,
                tks_total: null,
                markup: null,
                response_time: null,
                LOCATION: `${apiCar.pname || ''} ${apiCar.cname || ''}`.trim(),
                URL: `${this.pageBase}/${this.dealerId}/${apiCar.carid}.html?offertype=110`
            };

            return carData;

        } catch (error) {
            this.log(`Error preparing car data:`, error.message);
            return null;
        }
    }

    // Сохранение автомобиля в базу данных
    async saveCarToDatabase(carData) {
        if (!carData) return false;

        try {
            const db = require('../config/database');

            // Формируем SQL запрос
            const fields = Object.keys(carData).join(', ');
            const values = Object.values(carData);
            const placeholders = Object.keys(carData).map(() => '?').join(', ');

            const sql = `
                INSERT INTO che_available (${fields}, created_at, updated_at, deleted)
                VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
                ON DUPLICATE KEY UPDATE
                    ${Object.keys(carData).map(key => `${key} = VALUES(${key})`).join(', ')},
                    updated_at = CURRENT_TIMESTAMP,
                    deleted = 0
            `;

            await db.query(sql, values);
            this.log(`Saved car ${carData.ID} to database`);
            return true;

        } catch (error) {
            this.log(`Error saving car ${carData?.ID} to database:`, error.message);
            return false;
        }
    }

    // Обработка одного автомобиля
    async processCar(apiCar) {
        try {
            this.log(`Processing car: ${apiCar.carname} (ID: ${apiCar.carid})`);

            // Получаем детальную информацию через Puppeteer
            const puppeteerDetails = await this.parseCarDetailsWithPuppeteer(apiCar.carid);

            if (puppeteerDetails.error) {
                this.log(`Skipping car ${apiCar.carid} due to Puppeteer error:`, puppeteerDetails.error);
                return false;
            }

            // Подготавливаем данные для базы
            const carData = await this.prepareCarData(apiCar, puppeteerDetails);

            if (!carData) {
                this.log(`Failed to prepare data for car ${apiCar.carid}`);
                return false;
            }

            // Сохраняем в базу
            const saved = await this.saveCarToDatabase(carData);

            if (saved) {
                this.log(`Successfully processed car ${apiCar.carname}`);
                return true;
            } else {
                this.log(`Failed to save car ${apiCar.carname}`);
                return false;
            }

        } catch (error) {
            this.log(`Error processing car ${apiCar.carid}:`, error.message);
            return false;
        }
    }

    // Парсинг всех страниц
    async parseAllPages(limitPages = null) {
        if (this.isRunning) {
            this.log(`Parser already running, skipping`);
            return;
        }

        this.isRunning = true;
        this.log(`🚀 Starting Che168 parser...`);

        try {
            // 1. Получаем первую страницу для определения общего количества
            const firstPageData = await this.fetchPage(1, 6);

            if (!firstPageData.result || !firstPageData.result.carlist) {
                this.log(`No car list in response`);
                return;
            }

            const totalPages = firstPageData.result.pagecount;
            const totalCars = firstPageData.result.rowcount;

            this.log(`Total pages: ${totalPages}, Total cars: ${totalCars}`);

            // Определяем сколько страниц обрабатывать
            const pagesToProcess = limitPages === null ? totalPages : Math.min(limitPages, totalPages);
            this.log(`Processing ${pagesToProcess} pages...`);

            const allCars = [];

            // 2. Получаем данные со всех страниц
            for (let pageIndex = 1; pageIndex <= pagesToProcess; pageIndex++) {
                this.log(`Fetching page ${pageIndex}/${pagesToProcess}...`);

                const pageData = await this.fetchPage(pageIndex, 6);

                if (pageData.result && pageData.result.carlist) {
                    allCars.push(...pageData.result.carlist);
                    this.log(`Added ${pageData.result.carlist.length} cars from page ${pageIndex}`);
                }

                // Пауза между запросами страниц
                if (pageIndex < pagesToProcess) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            this.log(`Total cars collected: ${allCars.length}`);

            // 3. Обрабатываем каждый автомобиль
            let processed = 0;
            let errors = 0;

            for (let i = 0; i < allCars.length; i++) {
                const car = allCars[i];

                this.log(`Processing car ${i + 1}/${allCars.length}: ${car.carname}`);

                const success = await this.processCar(car);

                if (success) {
                    processed++;
                } else {
                    errors++;
                }

                // Пауза между запросами автомобилей (5 секунд)
                if (i < allCars.length - 1) {
                    this.log(`Waiting 5 seconds before next car...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            this.log(`✅ Parsing completed: ${processed} processed, ${errors} errors`);

        } catch (error) {
            this.log(`❌ Parsing failed:`, error.message);
        } finally {
            this.isRunning = false;
        }
    }

    // Запуск теста (для отладки)
    async runTest(limit = 5) {
        this.log(`🚀 Starting test with ${limit} cars...`);

        try {
            const firstPageData = await this.fetchPage(1, 6);

            if (!firstPageData.result || !firstPageData.result.carlist) {
                this.log(`No car list in response`);
                return;
            }

            const testCars = firstPageData.result.carlist.slice(0, limit);
            this.log(`Testing with ${testCars.length} cars`);

            for (let i = 0; i < testCars.length; i++) {
                const car = testCars[i];
                this.log(`\nTest car ${i + 1}: ${car.carname}`);

                const success = await this.processCar(car);

                if (success) {
                    this.log(`✅ Test car ${i + 1} processed successfully`);
                } else {
                    this.log(`❌ Test car ${i + 1} failed`);
                }

                if (i < testCars.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }

            this.log(`\n🎉 Test completed`);

        } catch (error) {
            this.log(`❌ Test failed:`, error.message);
        }
    }
}

// Экспорт класса
module.exports = Che168Parser;