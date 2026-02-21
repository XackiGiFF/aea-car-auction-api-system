const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

class Che168Parser {
    constructor() {
        this.apiBase = 'https://cacheapigo.che168.com/shop/v1/searchv2.ashx';
        this.pageBase = 'https://www.che168.com/dealer';
        this.dealerId = 625793;
        this.dealerType = 9;
        this.userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 YaBrowser/25.10.0.0 Safari/537.36';

        this.batchSize = 50;
        this.maxPages = 0;
        this.maxParallelRequests = 1;
        this.isRunning = false;
        this.downloadMedia = String(process.env.CHE_MEDIA_DOWNLOAD_ENABLED || 'false').toLowerCase() === 'true';
        this.mediaRoot = process.env.CHE_MEDIA_ROOT || '/app/media';
        this.mediaBaseUrl = (process.env.CHE_MEDIA_BASE_URL || '').replace(/\/+$/, '');
        this.mediaServiceUrl = (process.env.MEDIA_SERVICE_URL || '').replace(/\/+$/, '');
        this.mediaServiceToken = process.env.MEDIA_SERVICE_TOKEN || '';
        this.mediaServiceTimeoutMs = Number(process.env.MEDIA_SERVICE_TIMEOUT_MS || 25000);

        // Словарь для перевода китайских марок на английские
        this.brandTranslations = {
            '丰田': 'TOYOTA',
            '本田': 'HONDA',
            '马自达': 'MAZDA',
            '奥迪': 'AUDI',
            '大众': 'VOLKSWAGEN',
            '宝马': 'BMW',
            '奔驰': 'MERCEDES',
            '斯柯达': 'SKODA',
            '日产': 'NISSAN',
            '现代': 'HYUNDAI',
            '起亚': 'KIA',
            '吉利汽车': 'GEELY',
            '哈弗': 'HAVAL',
            '奇瑞': 'CHERY',
            '斯巴鲁': 'SUBARU',
            '长安': 'CHANGAN',
            '比亚迪': 'BYD',
            '特斯拉': 'TESLA',
            '福特': 'FORD',
            '雪佛兰': 'CHEVROLET',
            '别克': 'BUICK',
            '雷克萨斯': 'LEXUS',
            '长安启源': 'CHANGAN QIYUAN',
            '领克': 'LYNK&CO'
        };

        // Словарь для перевода моделей
        this.modelTranslations = {
            'CX-30': 'CX-30',
            'CX-5': 'CX-5',
            'XR-V': 'XR-V',
            'A3': 'A3',
            'T-ROC探歌': 'T-ROC',
            '雷凌': 'LEVIN',
            '卡罗拉': 'COROLLA',
            '雅阁': 'ACCORD',
            '思域': 'CIVIC',
            'CR-V': 'CR-V',
            '途观': 'TIGUAN',
            '帕萨特': 'PASSAT',
            '朗逸': 'LAVIDA',
            '速腾': 'SAGITAR',
            '昂克赛拉': 'AXELA',
            '探岳': 'TAYRON',
            '森林人': 'FORESTER',
            '明锐': 'OCTAVIA',
            '雷克萨斯NX': 'NX',
            '缤智': 'VEZEL',
            '凌渡': 'LAMANDO',
            '雷凌': 'LEVIN'
        };

        // Маппинг цветов
        this.colorTranslations = {
            '白色': 'white',
            '黑色': 'black',
            '银色': 'silver',
            '灰色': 'gray',
            '蓝色': 'blue',
            '红色': 'red',
            '棕色': 'brown',
            '金色': 'gold',
            '绿色': 'green',
            '黄色': 'yellow'
        };

        // Маппинг типов топлива [2]
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

        // Маппинг трансмиссий [2]
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

        // Маппинг приводов [2]
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

        this.defaultImageBlacklist = [
            'default-che168.png',
            '/2scimg/m/'
        ];
    }

    // Логирование в консоль [2]
    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[CHE168][${timestamp}] ${message}`;
        console.log(logMessage);
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }
    }

    // Генерация ID автомобиля [2]
    generateCarId(apiCar, brand, model, year, mileage, price) {
        if (apiCar && apiCar.carid) {
            const normalized = String(apiCar.carid).replace(/[^a-zA-Z0-9]/g, '');
            if (normalized.length > 0) {
                return normalized;
            }
        }
        const base = `${brand}_${model}_${year}_${mileage}_${price}`;
        const hash = crypto.createHash('md5').update(base).digest('hex');
        return `${hash.substring(0, 12)}`;
    }

    containsNonAscii(value) {
        return /[^\x20-\x7E]/.test(value || '');
    }

    slugify(value) {
        return (value || '')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'unknown';
    }

    escapeRegex(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    normalizeBrand(apiCar) {
        const brandRaw = (apiCar.BrandName || '').trim();
        if (!brandRaw) {
            return apiCar.Brandid ? `BRAND_${apiCar.Brandid}` : 'UNKNOWN';
        }

        if (this.brandTranslations[brandRaw]) {
            return this.brandTranslations[brandRaw];
        }

        if (!this.containsNonAscii(brandRaw)) {
            return brandRaw.toUpperCase();
        }

        return apiCar.Brandid ? `BRAND_${apiCar.Brandid}` : 'UNKNOWN';
    }

    normalizeModel(apiCar, normalizedBrand) {
        const seriesName = (apiCar.SeriesName || '').trim();
        const carName = (apiCar.carname || '').trim();
        const specName = (apiCar.SpecName || '').trim();

        const raw = seriesName || carName || specName;
        if (!raw) {
            return apiCar.Seriesid ? `SERIES_${apiCar.Seriesid}` : 'MODEL_UNKNOWN';
        }

        for (const [cn, en] of Object.entries(this.modelTranslations)) {
            if (raw.includes(cn) || carName.includes(cn) || seriesName.includes(cn)) {
                return en.toUpperCase();
            }
        }

        let cleaned = raw
            .replace(/\s+\d{4}款.*$/u, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (normalizedBrand) {
            cleaned = cleaned.replace(new RegExp(`^${this.escapeRegex(normalizedBrand)}\\s*`, 'i'), '');
        }
        const brandRaw = (apiCar.BrandName || '').trim();
        if (brandRaw) {
            cleaned = cleaned.replace(new RegExp(`^${this.escapeRegex(brandRaw)}\\s*`, 'u'), '');
        }

        const modelCodeMatch = cleaned.match(/[A-Za-z][A-Za-z0-9\-+]{0,20}/g);
        if (modelCodeMatch && modelCodeMatch.length > 0) {
            return modelCodeMatch[0].toUpperCase();
        }

        if (!this.containsNonAscii(cleaned)) {
            return cleaned.toUpperCase() || (apiCar.Seriesid ? `SERIES_${apiCar.Seriesid}` : 'MODEL_UNKNOWN');
        }

        return apiCar.Seriesid ? `SERIES_${apiCar.Seriesid}` : 'MODEL_UNKNOWN';
    }

    inferTransmission(apiCar, puppeteerDetails) {
        const text = `${apiCar.carname || ''} ${apiCar.SpecName || ''}`.toUpperCase();

        if (puppeteerDetails.transmission) {
            return puppeteerDetails.transmission;
        }
        if (text.includes('CVT')) return 'CVT';
        if (text.includes('MT') || /手动/u.test(apiCar.carname || '') || /手动/u.test(apiCar.SpecName || '')) return 'MT';
        if (text.includes('DCT') || text.includes('DSG') || text.includes('PDK')) return 'AT';
        if (text.includes('AT') || /自动/u.test(apiCar.carname || '') || /自动/u.test(apiCar.SpecName || '')) return 'AT';
        return 'AT';
    }

    inferFuelType(apiCar, puppeteerDetails) {
        const text = `${apiCar.carname || ''} ${apiCar.SpecName || ''}`.toUpperCase();
        const textCn = `${apiCar.carname || ''} ${apiCar.SpecName || ''}`;

        if (puppeteerDetails.fuelType) {
            return puppeteerDetails.fuelType;
        }
        if (/柴油/u.test(textCn) || /\bTDI\b/.test(text)) return 'D';
        if (/插电|增程/u.test(textCn) || /\bPHEV\b/.test(text)) return 'P';
        if (/混动|双擎|混合动力/u.test(textCn) || /\bHEV\b|\bHYBRID\b/.test(text)) return 'H';
        if (/纯电|电动/u.test(textCn) || /\bEV\b/.test(text)) return 'E';
        return 'G';
    }

    inferDrive(apiCar, puppeteerDetails) {
        const text = `${apiCar.carname || ''} ${apiCar.SpecName || ''}`.toUpperCase();
        const textCn = `${apiCar.carname || ''} ${apiCar.SpecName || ''}`;

        if (puppeteerDetails.drive) {
            return puppeteerDetails.drive;
        }
        if (/四驱/u.test(textCn) || /\b4WD\b|\bAWD\b|\bXDRIVE\b|\bQUATTRO\b/.test(text)) return '4WD';
        if (/后驱/u.test(textCn) || /\bRWD\b|\bFR\b/.test(text)) return 'FR';
        if (/前驱|两驱/u.test(textCn) || /\bFWD\b|\bFF\b/.test(text)) return 'FF';
        return 'FF';
    }

    extractEngineCc(apiCar, puppeteerDetails) {
        if (puppeteerDetails.engineVolume) {
            return String(puppeteerDetails.engineVolume);
        }
        const text = `${apiCar.carname || ''} ${apiCar.SpecName || ''}`;
        const m = text.match(/(\d\.\d)\s*L/i);
        if (m) {
            return String(Math.round(parseFloat(m[1]) * 1000));
        }
        return '';
    }

    normalizeImageList(rawImages) {
        const list = (rawImages || '')
            .split('#')
            .map((u) => (u || '').trim())
            .filter(Boolean)
            .filter((u) => /^https?:\/\//i.test(u))
            .filter((u) => !this.defaultImageBlacklist.some((bad) => u.includes(bad)));

        return [...new Set(list)];
    }

    async localizeImages(imageUrls, brand, model, carId) {
        if (this.mediaServiceUrl && this.mediaServiceToken) {
            const result = [];
            for (let i = 0; i < imageUrls.length; i++) {
                const localized = await this.localizeImageByService({
                    imageUrl: imageUrls[i],
                    provider: 'che168',
                    brand,
                    model,
                    carId,
                    imageIndex: i + 1
                });
                if (localized) {
                    result.push(localized);
                }
            }

            if (result.length > 0) {
                return result;
            }

            if (!this.downloadMedia || !this.mediaBaseUrl) {
                this.log('Media service configured, but no images localized. Skipping donor URLs.');
                return [];
            }
        }

        if (!this.downloadMedia || !this.mediaBaseUrl) {
            return imageUrls;
        }

        const brandSlug = this.slugify(brand);
        const modelSlug = this.slugify(model);
        const baseDir = path.join(this.mediaRoot, 'che168', brandSlug, modelSlug, String(carId));
        await fs.mkdir(baseDir, { recursive: true });

        const result = [];
        for (let i = 0; i < imageUrls.length; i++) {
            const url = imageUrls[i];
            try {
                const response = await axios.get(url, {
                    timeout: 20000,
                    responseType: 'arraybuffer',
                    headers: {
                        'User-Agent': this.userAgent,
                        'Referer': 'https://www.che168.com/'
                    }
                });

                const contentType = (response.headers['content-type'] || '').toLowerCase();
                let ext = '.jpg';
                if (contentType.includes('webp') || url.includes('.webp')) ext = '.webp';
                else if (contentType.includes('png') || url.includes('.png')) ext = '.png';
                else if (contentType.includes('jpeg') || url.includes('.jpeg')) ext = '.jpeg';

                const fileName = `${String(i + 1).padStart(2, '0')}${ext}`;
                const filePath = path.join(baseDir, fileName);
                await fs.writeFile(filePath, response.data);
                result.push(`${this.mediaBaseUrl}/che168/${brandSlug}/${modelSlug}/${carId}/${fileName}`);
            } catch (error) {
                this.log(`Image localization failed for ${url}: ${error.message}`);
            }
        }

        return result.length > 0 ? result : imageUrls;
    }

    async localizeImageByService({ imageUrl, provider, brand, model, carId, imageIndex }) {
        try {
            const response = await axios.post(
                `${this.mediaServiceUrl}/internal/media/fetch`,
                {
                    source_url: imageUrl,
                    provider,
                    brand,
                    model,
                    car_id: String(carId),
                    image_index: imageIndex
                },
                {
                    timeout: this.mediaServiceTimeoutMs,
                    headers: {
                        'x-media-token': this.mediaServiceToken
                    }
                }
            );

            if (response.data?.ok && response.data?.url) {
                return response.data.url;
            }
            return null;
        } catch (error) {
            this.log(`Image service failed for ${imageUrl}: ${error.message}`);
            return null;
        }
    }

    // Получение списка автомобилей с API [2]
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

            // Обработка JSONP ответа [2]
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
                    '--single-process',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--window-size=1920,1080'
                ]
            });

            const page = await browser.newPage();

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            await page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': 'https://www.che168.com/',
                'Upgrade-Insecure-Requests': '1'
            });

            const url = `${this.pageBase}/${this.dealerId}/${carId}.html?offertype=110`;
            this.log(`Navigating to: ${url}`);

            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            // Проверяем Security Verification
            const pageTitle = await page.title();
            if (pageTitle.includes('Security') || pageTitle.includes('Verification')) {
                this.log(`Security verification detected, trying to bypass...`);

                await page.waitForTimeout(5000);
                await page.reload({ waitUntil: 'networkidle2' });

                const newTitle = await page.title();
                if (newTitle.includes('Security') || newTitle.includes('Verification')) {
                    this.log(`Cannot bypass security for car ${carId}`);
                    return { error: 'Security verification blocked' };
                }
            }

            // Ждем появления контента
            try {
                await page.waitForSelector('body', { timeout: 10000 });
                await page.waitForFunction(() => {
                    const bodyText = document.body.textContent;
                    return bodyText && bodyText.length > 500;
                }, { timeout: 15000 });
            } catch (waitError) {
                this.log(`Content wait timeout for car ${carId}, continuing anyway`);
            }

            const html = await page.content();
            const details = this.parseDetailsFromHTML(html);

            // Извлекаем изображения из галереи
            details.images = await this.extractGalleryImages(page);

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

    // Извлечение изображений из галереи
    async extractGalleryImages(page) {
        try {
            const images = await page.evaluate(() => {
                const imageUrls = [];

                // Ищем галерею с id="pic_li" [1]
                const galleryImages = document.querySelectorAll('#pic_li img.LazyloadImg, #pic_li a img');
                galleryImages.forEach(img => {
                    // Берем URL из data-original (высокое качество)
                    const dataOriginal = img.getAttribute('data-original');
                    if (dataOriginal) {
                        const fullUrl = dataOriginal.startsWith('//') ? `https:${dataOriginal}` : dataOriginal;
                        if (!imageUrls.includes(fullUrl)) {
                            imageUrls.push(fullUrl);
                        }
                    }

                    // Также берем обычный src
                    if (img.src && img.src.startsWith('http') && !imageUrls.includes(img.src)) {
                        imageUrls.push(img.src);
                    }
                });

                return imageUrls.slice(0, 20);
            });

            this.log(`Extracted ${images.length} gallery images`);
            return images.join('#');
        } catch (error) {
            this.log(`Error extracting gallery images:`, error.message);
            return '';
        }
    }

    // Парсинг данных из HTML
    parseDetailsFromHTML(html) {
        const $ = cheerio.load(html);
        const details = {};
        const bodyText = $('body').text();

        this.log(`Parsing HTML, body length: ${bodyText.length} chars`);

        // Проверяем Security Verification
        if (bodyText.length < 1000 || bodyText.includes('Security Verification')) {
            this.log(`Warning: Page appears to be security verification page`);
            details.security_blocked = true;
        }

        // Извлекаем данные из заголовка [1]
        const titleText = $('title').text();
        if (titleText.includes('马自达3 昂克赛拉')) {
            details.brand = '马自达';
            details.model = '马自达3 昂克赛拉';
            details.brand_en = this.brandTranslations[details.brand] || details.brand;
            details.model_en = this.modelTranslations['昂克赛拉'] || details.model;
        }

        // Цена [1]
        let priceMatch = null;
        const priceSelectors = [
            'div:contains("报价")',
            '.price',
            '.car-price',
            '.offer-price',
            'span:contains("万")',
            'b:contains("万")'
        ];

        for (const selector of priceSelectors) {
            const element = $(selector).first();
            if (element.length) {
                const priceText = element.text();
                const match = priceText.match(/(\d+\.?\d*)万/);
                if (match) {
                    priceMatch = match;
                    this.log(`Found price with selector "${selector}": ${match[1]}万`);
                    break;
                }
            }
        }

        if (!priceMatch) {
            const matches = bodyText.match(/(\d+\.?\d*)万/g);
            if (matches && matches.length > 0) {
                for (const match of matches) {
                    const value = match.match(/(\d+\.?\d*)万/);
                    if (value && !bodyText.includes(`${value[1]}万公里`)) {
                        priceMatch = value;
                        this.log(`Found price in text: ${value[1]}万`);
                        break;
                    }
                }
            }
        }

        if (priceMatch) {
            details.price = parseFloat(priceMatch[1]) * 10000;
            this.log(`Final price: ${priceMatch[1]}万 = ${details.price} CNY`);
        }

        // Пробег [1]
        const mileageMatch = bodyText.match(/(\d+\.?\d*)万公里/);
        if (mileageMatch) {
            details.mileage = parseFloat(mileageMatch[1]) * 10000;
            this.log(`Found mileage: ${mileageMatch[1]}万公里 = ${details.mileage} km`);
        }

        // Год [1]
        const yearMatch = bodyText.match(/(202\d|201\d)年/);
        if (yearMatch) {
            details.year = parseInt(yearMatch[1]);
            this.log(`Found year: ${details.year}`);
        }

        // Цвет
        const colorMatch = bodyText.match(/(白色|黑色|银色|灰色|蓝色|红色|棕色|金色|绿色|黄色)/);
        if (colorMatch) {
            details.color = colorMatch[1];
            details.color_en = this.colorTranslations[colorMatch[1]] || colorMatch[1];
            this.log(`Found color: ${details.color} (${details.color_en})`);
        }

        // Объем двигателя
        const engineMatch = bodyText.match(/(\d\.\d)\s*L/i);
        if (engineMatch) {
            details.engineVolume = Math.round(parseFloat(engineMatch[1]) * 1000);
            this.log(`Found engine volume: ${engineMatch[1]}L = ${details.engineVolume} cc`);
        }

        // Трансмиссия [1]
        if (bodyText.includes('自动')) {
            details.transmission = 'AT';
            this.log(`Found transmission: AT`);
        } else if (bodyText.includes('手动')) {
            details.transmission = 'MT';
            this.log(`Found transmission: MT`);
        } else if (bodyText.includes('CVT')) {
            details.transmission = 'CVT';
            this.log(`Found transmission: CVT`);
        }

        // Привод
        if (bodyText.includes('四驱') || bodyText.includes('4WD') || bodyText.includes('AWD')) {
            details.drive = '4WD';
        } else if (bodyText.includes('后驱') || bodyText.includes('RWD') || bodyText.includes('FR')) {
            details.drive = 'FR';
        } else if (bodyText.includes('前驱') || bodyText.includes('两驱') || bodyText.includes('FWD') || bodyText.includes('FF')) {
            details.drive = 'FF';
        }

        // Тип топлива (строго по "энергетическим" ключам, чтобы не ловить ложные "电动座椅")
        const energyBlock = bodyText.match(/(能源类型|燃料类型|动力类型).{0,24}/u)?.[0] || '';
        const fuelSourceText = `${energyBlock} ${bodyText.substring(0, 4000)}`;
        if (/插电式混合|增程/u.test(fuelSourceText)) {
            details.fuelType = 'P';
            this.log('Found fuel type: P (plug-in hybrid)');
        } else if (/油电混合|混合动力|双擎/u.test(fuelSourceText)) {
            details.fuelType = 'H';
            this.log('Found fuel type: H (hybrid)');
        } else if (/纯电|新能源/u.test(energyBlock)) {
            details.fuelType = 'E';
            this.log('Found fuel type: E (electric)');
        } else if (/柴油/u.test(fuelSourceText)) {
            details.fuelType = 'D';
            this.log('Found fuel type: D (diesel)');
        } else if (/汽油/u.test(fuelSourceText)) {
            details.fuelType = 'G';
            this.log('Found fuel type: G (petrol)');
        }

        return details;
    }

    // Преобразование данных автомобиля в формат для базы данных
    async prepareCarData(apiCar, puppeteerDetails) {
        try {
            // Применяем нормализацию бренда/модели без иероглифов.
            const brandEnglish = this.normalizeBrand(apiCar);
            const modelEnglish = this.normalizeModel(apiCar, brandEnglish);

            // Генерация ID [2]
            const carId = this.generateCarId(
                apiCar,
                brandEnglish,
                modelEnglish,
                apiCar.registrationdate,
                apiCar.mileage,
                apiCar.price
            );

            const fuelType = this.inferFuelType(apiCar, puppeteerDetails);
            const transmission = this.inferTransmission(apiCar, puppeteerDetails);
            const drive = this.inferDrive(apiCar, puppeteerDetails);
            const engineCc = this.extractEngineCc(apiCar, puppeteerDetails);
            const imageList = this.normalizeImageList(puppeteerDetails.images || apiCar.image || '');
            const localizedImages = await this.localizeImages(imageList, brandEnglish, modelEnglish, carId);
            const basePrice = puppeteerDetails.price ? puppeteerDetails.price : (parseFloat(apiCar.price) * 10000);

            // Формируем данные в формате CarModel [2]
            const carData = {
                ID: carId,
                SOURCE: 'che168',
                MARKA_ID: '',
                MARKA_NAME: brandEnglish,
                MODEL_ID: '',
                MODEL_NAME: modelEnglish,
                YEAR: puppeteerDetails.year || apiCar.registrationdate || '',
                TOWN: apiCar.cname || '',
                ENG_V: engineCc,
                PW: puppeteerDetails.horsepower ? puppeteerDetails.horsepower.toString() : '',
                KUZOV: '',
                GRADE: '',
                COLOR: puppeteerDetails.color_en || puppeteerDetails.color || '',
                KPP: transmission,
                KPP_TYPE: transmission,
                PRIV: drive,
                MILEAGE: puppeteerDetails.mileage ? puppeteerDetails.mileage.toString() : (parseFloat(apiCar.mileage) * 10000).toString(),
                EQUIP: '',
                RATE: '',
                START: basePrice.toString(),
                FINISH: basePrice.toString(),
                STATUS: 'available',
                TIME: fuelType,
                SANCTION: '',
                AVG_PRICE: basePrice.toString(),
                AVG_STRING: '',
                IMAGES: localizedImages.join('#'),
                PRICE_CALC: null,
                CALC_RUB: null,
                CALC_UPDATED_AT: null,
                original_price: basePrice,
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

    // Запуск теста (для отладки) [2]
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

    // Сохранение автомобиля в базу данных [2]
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

    // Обработка одного автомобиля [2]
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

    // Парсинг всех страниц [2]
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

            // 3. Обрабатываем каждый автомобиль [2]
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

                // Пауза между запросами автомобилей (5 секунд) [2]
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
}
// Экспорт класса
module.exports = Che168Parser;
