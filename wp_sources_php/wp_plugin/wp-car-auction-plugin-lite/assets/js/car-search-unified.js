/**
 * Car Search Unified - Адаптированный рабочий функционал поиска
 * Основан на проверенной логике car-auction.js и car-auction-theme-fixed.js
 */
class CarSearchUnified extends CarAuctionCore {
    constructor() {
        super();

        // ЗАЩИТА ОТ МНОЖЕСТВЕННЫХ ЭКЗЕМПЛЯРОВ
        /*
        if (window.carSearchInstance) {
            console.warn('CarSearchUnified: Instance already exists, returning existing instance');
            return window.carSearchInstance;
        }
        window.carSearchInstance = this;
        */
        
        // ДОБАВЬ ЭТО - защита от дублирования
        if (window.carSearchUnifiedInitialized) {
            console.log('CarSearchUnified: Already initialized, skipping');
            return window.carSearchInstance || this;
        }
        window.carSearchUnifiedInitialized = true;
        window.carSearchInstance = this;

        this.currentPage = 1;
        this.isLoading = false;
        this.isUpdatingPagination = false;
        this.hasMoreResults = true;
        this.currentMarket = 'main';
        this.currentView = 'grid';
        this.currentFilters = {};
        // Hold a pending model value when URL or user sets model before async model list loads
        this.pendingModelValue = null;
        this.pendingModelRetries = 0;
        // Защита от дублирования AJAX запросов загрузки моделей
        this.isLoadingModels = false;
        this.currentVendor = null;
        // Защита от дублирования AJAX запросов динамических фильтров
        this.isLoadingDynamicFilters = false;
        // Таймер для группировки изменений фильтров
        this.filterChangeTimeout = null;
        this.priceRefreshInProgress = false;

        console.log('CarSearchUnified: New instance created');
        
            // Новые свойства для отслеживания предыдущих значений
        this.previousFieldValues = {};
        this.fieldChangeTimeout = null;
    
        this.init();
    }

    init() {
        //console.log('CarSearchUnified: Initializing search functionality');

        this.detectMarket();
        this.bindEvents();
        this.initializeSearchForm();
        this.processCarCards();
    }

    // Улучшенное определение рынка из старого кода
    detectMarket() {
        var market = 'main';

        // Method 1: URL path detection (ПРИОРИТЕТ - самый надежный источник)
        var path = window.location.pathname;
        if (path.includes('/korea/')) {
            market = 'korea';
            //console.log('CarSearchUnified: Market detected from URL path (priority):', market);
            this.currentMarket = market;
            return;
        } else if (path.includes('/china/')) {
            market = 'china';
            //console.log('CarSearchUnified: Market detected from URL path (priority):', market);
            this.currentMarket = market;
            return;
        } else if (path.includes('/japan/')) {
            market = 'main';
            //console.log('CarSearchUnified: Market detected from URL path (priority):', market);
            this.currentMarket = market;
            return;
        } else if (path.includes('/bike/')) {
            market = 'bike';
            //console.log('CarSearchUnified: Market detected from URL path (priority):', market);
            this.currentMarket = market;
            return;
        } else if (path.includes('/che_available/')) {
            market = 'che_available';
            //console.log('CarSearchUnified: Market detected from URL path (priority):', market);
            this.currentMarket = market;
            return;
        }

        // Method 2: Form data-market attribute (fallback)
        var $form = $('form[data-market]').first();
        if ($form.length > 0) {
            market = $form.data('market') || 'main';
            //console.log('CarSearchUnified: Market detected from form (fallback):', market);
            this.currentMarket = market;
            return;
        }

        // Method 3: Shortcode wrapper data-market (last fallback)
        var $wrapper = $('.car-auction-shortcode-wrapper[data-market]').first();
        if ($wrapper.length > 0) {
            market = $wrapper.data('market') || 'main';
            //console.log('CarSearchUnified: Market detected from wrapper (last fallback):', market);
            this.currentMarket = market;
            return;
        }

        //console.log('CarSearchUnified: Market defaulted to:', market);
        this.currentMarket = market;
    }

    // Извлечение рынка из URL пути
    getMarketFromUrl() {
        var path = window.location.pathname;
        if (path.includes('/korea/')) {
            return 'korea';
        } else if (path.includes('/china/')) {
            return 'china';
        } else if (path.includes('/japan/')) {
            return 'main';
        } else if (path.includes('/bike/')) {
            return 'bike';
        } else if (path.includes('/che_available/')) {
            return 'che_available';
        }
        return 'main'; // default
    }

    bindEvents() {
        console.log('CarSearchUnified: Binding events');

        // Отключаем ВСЕ старые обработчики для предотвращения дублирования
        $(document).off('click', '.car-auction-pagination .page-btn');
        $(document).off('click', '.pagination-btn');
        $('.car-auction-pagination').off('click', '.page-btn');
        $('.car-auction-pagination').off('click', '.pagination-btn');

        // ВАЖНО: Отключаем старые обработчики смены vendor для предотвращения дублирования AJAX запросов
        $(document).off('change', 'select[name="vendor"], .car-auction-vendor-select');
        $(document).off('click', '.facet-dropdown-item');
        $(document).off('click', '.custom-select-trigger');

        console.log('CarSearchUnified: Disabled old handlers to prevent duplication');

        // Основные события поиска из старого кода
        $(document).on('click', '.car-auction-search-btn, .button-red.long', this.handleSearch.bind(this));
        $(document).on('submit', 'form[data-market], #wf-form-filter', this.handleFormSubmit.bind(this));
        $(document).on('click', '.car-auction-reset-btn, #reset', this.handleReset.bind(this));

        // Обработка смены производителя
        $(document).on('change', 'select[name="vendor"], .car-auction-vendor-select', this.handleVendorChange.bind(this));

        // Обработка изменения других фильтров для динамического обновления
        $(document).on('change', 'select[name="model"], input[name="year_from"], input[name="year_to"], input[name="price_from"], input[name="price_to"]', this.handleFilterChange.bind(this));
        $(document).on('change', 'select[name="fuel_type"], select[name="transmission"], select[name="drive"]', this.handleFilterChange.bind(this));

        // ИСПРАВЛЕНИЕ: Добавляем обработчик для изменения модели - обновляем URL сразу при выборе
        $(document).on('change', 'select[name="model"]', this.handleModelChange.bind(this));

        // Обработка кастомных дропдаунов из theme-fixed
        $(document).on('click', '.facet-dropdown-item', this.handleDropdownClick.bind(this));
        $(document).on('click', '.custom-select-trigger', this.handleDropdownTrigger.bind(this));

        // Закрытие дропдаунов при клике снаружи
        $(document).on('click', this.handleOutsideClick.bind(this));

        // Пагинация - с namespace для избежания конфликтов
        $(document).on('click.carSearchUnified', '.car-auction-pagination .page-btn', this.handlePagination.bind(this));

        // Клики по карточкам автомобилей - перенаправление на детальную страницу
        $(document).on('click', '.one-car-wrapper', this.handleCarCardClick.bind(this));

        //console.log('CarSearchUnified: New events bound with namespace');
        
        // ОТСЛЕЖИВАНИЕ ИЗМЕНЕНИЙ ПОЛЕЙ В РЕАЛЬНОМ ВРЕМЕНИ
        $(document).on('input change', 'input[name="year_from"], input[name="year_to"], input[name="price_from"], input[name="price_to"], input[name="mileage_from"], input[name="mileage_to"]', this.handleFieldChange.bind(this));
        
        $(document).on('change', 'select[name="fuel_type"], select[name="transmission"], select[name="drive"]', this.handleFieldChange.bind(this));
        
        console.log('CarSearchUnified: Real-time field tracking enabled');
    }
    
    handleFieldChange(e) {
        var $field = $(e.target);
        var fieldName = $field.attr('name');
        var currentValue = $field.val();
        
        console.log('CarSearchUnified: Field changed:', fieldName, '=', currentValue);
        
        // Задержка для группировки быстрых изменений
        clearTimeout(this.fieldChangeTimeout);
        this.fieldChangeTimeout = setTimeout(() => {
            this.updateUrlForSingleField(fieldName, currentValue);
        }, 500);
    }
    
    // ===== ОСНОВНОЙ МЕТОД ОБНОВЛЕНИЯ URL ДЛЯ ОДНОГО ПОЛЯ =====
    updateUrlForSingleField(fieldName, currentValue) {
        if (!(window.history && window.history.replaceState)) return;
        
        console.log('CarSearchUnified: Updating URL for field:', fieldName, 'value:', currentValue);
        
        var currentUrl = new URL(window.location);
        var searchParams = currentUrl.searchParams;
        
        // Маппинг имен полей формы на параметры URL
        var fieldToUrlMapping = {
            'vendor': '_brand',
            'model': '_model', 
            'year_from': 'year_from',
            'year_to': 'year_to',
            'price_from': 'price_from',
            'price_to': 'price_to',
            'mileage_from': 'mileage_from',
            'mileage_to': 'mileage_to',
            'fuel_type': 'fuel_type',
            'transmission': 'transmission',
            'drive': 'drive'
        };
        
        var urlParam = fieldToUrlMapping[fieldName];
        
        if (!urlParam) {
            console.warn('CarSearchUnified: No URL mapping for field:', fieldName);
            return;
        }
        
        // Проверяем, является ли значение пустым или значением по умолчанию
        var isEmpty = this.isEmptyFieldValue(fieldName, currentValue);
        
        if (isEmpty) {
            // УДАЛЯЕМ параметр из URL если поле пустое
            if (searchParams.has(urlParam)) {
                searchParams.delete(urlParam);
                console.log('CarSearchUnified: Removed URL parameter (empty field):', urlParam);
            }
        } else {
            // ДОБАВЛЯЕМ/ОБНОВЛЯЕМ параметр в URL
            searchParams.set(urlParam, currentValue);
            console.log('CarSearchUnified: Set URL parameter:', urlParam, '=', currentValue);
        }
        
        var newUrl = currentUrl.pathname + (searchParams.toString() ? '?' + searchParams.toString() : '');
        
        if (newUrl !== window.location.href) {
            window.history.replaceState({}, '', newUrl);
            console.log('CarSearchUnified: URL updated for field change:', newUrl);
        }
    }
    
    // ===== МЕТОД ПРОВЕРКИ ПУСТЫХ ЗНАЧЕНИЙ =====
    isEmptyFieldValue(fieldName, value) {
        if (value === undefined || value === null || value.toString().trim() === '') {
            return true;
        }
        
        var stringValue = value.toString().trim();
        var lowerValue = stringValue.toLowerCase();
        
        // Проверяем значения по умолчанию для разных типов полей
        var isDefaultValue = false;
        
        switch(fieldName) {
            case 'vendor':
                isDefaultValue = 
                    lowerValue === 'любая марка' ||
                    lowerValue === 'все марки' ||
                    lowerValue === 'выберите марку';
                break;
                
            case 'model':
                isDefaultValue = 
                    lowerValue === 'все модели' ||
                    lowerValue === 'любая модель' ||
                    lowerValue === 'all models' ||
                    lowerValue === 'выберите модель';
                break;
                
            case 'fuel_type':
                isDefaultValue = 
                    lowerValue === 'любое топливо' ||
                    lowerValue === '';
                break;
                
            case 'transmission':
                isDefaultValue = 
                    lowerValue === 'любая коробка' ||
                    lowerValue === '';
                break;
                
            case 'drive':
                isDefaultValue = 
                    lowerValue === 'любой привод' ||
                    lowerValue === '';
                break;
                
            default:
                // Для числовых полей проверяем на 0 и пустую строку
                if (['year_from', 'year_to', 'price_from', 'price_to', 'mileage_from', 'mileage_to'].includes(fieldName)) {
                    isDefaultValue = stringValue === '0' || stringValue === '';
                }
                break;
        }
        
        return isDefaultValue;
    }

    /*
    initializeSearchForm() {
        //console.log('CarSearchUnified: Initializing search form');

        // Проверяем соответствие формы и URL рынка
        var urlMarket = this.getMarketFromUrl();
        var $form = $('.car-auction-search-form, form[data-market], #wf-form-filter').first();
        var formMarket = $form.data('market') || 'main';

        if (urlMarket !== formMarket) {
            //conlole.warn('CarSearchUnified: Market mismatch! URL suggests:', urlMarket, 'but form shows:', formMarket);
            //conlole.warn('CarSearchUnified: Using URL market as priority:', urlMarket);
            this.currentMarket = urlMarket;
        } else {
            this.currentMarket = formMarket;
        }

        //console.log('CarSearchUnified: Final market determination:', this.currentMarket, '(URL:', urlMarket, ', Form:', formMarket, ')');

        // Проверяем, есть ли активные фильтры в URL
        var urlParams = new URLSearchParams(window.location.search);
        var hasActiveFilters = urlParams.has('_brand') || urlParams.has('_model') ||
            urlParams.has('year_from') || urlParams.has('year_to') ||
            urlParams.has('price_from') || urlParams.has('price_to');

        //console.log('CarSearchUnified: Active URL filters detected:', hasActiveFilters, {
        //    _brand: urlParams.get('_brand'),
        //    _model: urlParams.get('_model'),
        //    _year_from: urlParams.get('year_from'),
        //    _year_to: urlParams.get('year_to'),
        //    _price_from: urlParams.get('price_from'),
        //    _price_to: urlParams.get('price_to')
        //});

        if (hasActiveFilters) {
            // Есть активные фильтры - предзаполняем форму и выполняем поиск
            //console.log('CarSearchUnified: Active filters detected, performing search immediately');
            this.currentPage = parseInt(urlParams.get('car_page')) || 1;

            // Debug: показать доступные бренды для текущего рынка
            this.debugAvailableBrands();

            this.prefillFormFromUrl();
            this.performSearch(true); // reset = true, чтобы очистить предзагруженные результаты
        } else {
            // Нет активных фильтров - загружаем предзагруженные результаты с пагинацией
            var $autoResults = $('.car-auction-auto-results');
            var $paginationContainer = $('.posts-list .car-auction-pagination');

            if ($autoResults.length > 0 && $paginationContainer.length > 0) {
                // Есть auto_search - получаем данные пагинации через AJAX
                this.loadInitialPaginationData();
            } else {
                // Инициализируем пагинацию из текущих параметров страницы
                this.initializePaginationFromPage();
            }
        }
    }
    */
    
    // ===== ОБНОВЛЯЕМ МЕТОД ИНИЦИАЛИЗАЦИИ ПОИСКА =====
    /*
    initializeSearchForm() {
        console.log('CarSearchUnified: Initializing search form');
        
        // Проверяем соответствие формы и URL рынка
        var urlMarket = this.getMarketFromUrl();
        var $form = $('.car-auction-search-form, form[data-market], #wf-form-filter').first();
        var formMarket = $form.data('market') || 'main';
        
        if (urlMarket !== formMarket) {
            console.warn('CarSearchUnified: Market mismatch! URL suggests:', urlMarket, 'but form shows:', formMarket);
            console.warn('CarSearchUnified: Using URL market as priority:', urlMarket);
            this.currentMarket = urlMarket;
        } else {
            this.currentMarket = formMarket;
        }
        
        console.log('CarSearchUnified: Final market determination:', this.currentMarket, '(URL:', urlMarket, ', Form:', formMarket, ')');
        
        // Проверяем, есть ли активные фильтры в URL
        var urlParams = new URLSearchParams(window.location.search);
        var hasActiveFilters = urlParams.has('_brand') || urlParams.has('_model') ||
            urlParams.has('year_from') || urlParams.has('year_to') ||
            urlParams.has('price_from') || urlParams.has('price_to');
        
        console.log('CarSearchUnified: Active URL filters detected:', hasActiveFilters, {
            _brand: urlParams.get('_brand'),
            _model: urlParams.get('_model'),
            _year_from: urlParams.get('year_from'),
            _year_to: urlParams.get('year_to'),
            _price_from: urlParams.get('price_from'),
            _price_to: urlParams.get('price_to')
        });
        
        if (hasActiveFilters) {
            // Есть активные фильтры - предзаполняем форму и выполняем поиск
            console.log('CarSearchUnified: Active filters detected, performing search immediately');
            this.currentPage = parseInt(urlParams.get('car_page')) || 1;
            
            // Debug: показать доступные бренды для текущего рынка
            this.debugAvailableBrands();
            
            // ИСПРАВЛЕНИЕ: Сначала предзаполняем форму, потом выполняем поиск
            this.prefillFormFromUrl();
            
            // Небольшая задержка для гарантии что форма заполнилась
            setTimeout(() => {
                this.performSearch(true); // reset = true, чтобы очистить предзагруженные результаты
            }, 100);
            
        } else {
            // Нет активных фильтров - загружаем предзагруженные результаты с пагинацией
            var $autoResults = $('.car-auction-auto-results');
            var $paginationContainer = $('.posts-list .car-auction-pagination');
            
            if ($autoResults.length > 0 && $paginationContainer.length > 0) {
                // Есть auto_search - получаем данные пагинации через AJAX
                this.loadInitialPaginationData();
            } else {
                // Инициализируем пагинацию из текущих параметров страницы
                this.initializePaginationFromPage();
            }
        }
    }
    */
    
    // ===== ОБНОВЛЯЕМ МЕТОД ИНИЦИАЛИЗАЦИИ ПОИСКА =====
    // ===== ПЕРЕПИСАННЫЙ МЕТОД ИНИЦИАЛИЗАЦИИ ПОИСКА =====
    initializeSearchForm() {
        console.log('CarSearchUnified: Initializing search form');
        
        if (this.initialSearchDone) return;
        this.initialSearchDone = true;
        
        // Проверяем соответствие формы и URL рынка
        var urlMarket = this.getMarketFromUrl();
        var $form = $('.car-auction-search-form, form[data-market], #wf-form-filter').first();
        var formMarket = $form.data('market') || 'main';
        
        if (urlMarket !== formMarket) {
            console.warn('CarSearchUnified: Market mismatch! URL suggests:', urlMarket, 'but form shows:', formMarket);
            console.warn('CarSearchUnified: Using URL market as priority:', urlMarket);
            this.currentMarket = urlMarket;
        } else {
            this.currentMarket = formMarket;
        }
        
        console.log('CarSearchUnified: Final market determination:', this.currentMarket, '(URL:', urlMarket, ', Form:', formMarket, ')');
        
        // Проверяем, есть ли активные фильтры в URL
        var urlParams = new URLSearchParams(window.location.search);
        var hasActiveFilters = urlParams.has('_brand') || urlParams.has('_model') ||
            urlParams.has('year_from') || urlParams.has('year_to') ||
            urlParams.has('price_from') || urlParams.has('price_to');
        
        console.log('CarSearchUnified: Active URL filters detected:', hasActiveFilters, {
            _brand: urlParams.get('_brand'),
            _model: urlParams.get('_model'),
            _year_from: urlParams.get('year_from'),
            _year_to: urlParams.get('year_to'),
            _price_from: urlParams.get('price_from'),
            _price_to: urlParams.get('price_to')
        });
        
        if (hasActiveFilters) {
            // Есть активные фильтры - предзаполняем форму и выполняем поиск
            console.log('CarSearchUnified: Active filters detected, performing search after form setup');
            this.currentPage = parseInt(urlParams.get('car_page')) || 1;
            
            // Debug: показать доступные бренды для текущего рынка
            this.debugAvailableBrands();
            
            // ИСПРАВЛЕНИЕ: Сначала предзаполняем форму, потом ждем загрузки моделей и только потом выполняем поиск
            this.prefillFormFromUrl();
            
            // Проверяем, есть ли модель в URL и нужно ли ждать загрузки моделей
            var hasModelInUrl = urlParams.has('_model');
            var modelValue = hasModelInUrl ? urlParams.get('_model') : null;
            
            if (hasModelInUrl && modelValue) {
                console.log('CarSearchUnified: Model in URL detected, waiting for model loading:', modelValue);
                
                // Ждем пока модель подставится в форму
                var checkModelInterval = setInterval(() => {
                    var $modelSelect = $('select[name="model"]');
                    var modelSelectValue = $modelSelect.val();
                    
                    console.log('CarSearchUnified: Checking model select value:', modelSelectValue);
                    
                    if (modelSelectValue && modelSelectValue !== '') {
                        // Модель подставлена - выполняем поиск
                        clearInterval(checkModelInterval);
                        console.log('CarSearchUnified: Model successfully set, performing search');
                        
                        // Принудительно синхронизируем кастомные селекты перед поиском
                        try {
                            this.syncCustomSelects();
                        } catch (e) {
                            console.warn('CarSearchUnified: Failed to sync custom selects before search:', e);
                        }
                        
                        // Выполняем поиск
                        setTimeout(() => {
                            this.performSearch(true);
                        }, 100);
                    }
                }, 100);
                
                // Таймаут на случай если модель не подставится
                // setTimeout(() => {
                //     clearInterval(checkModelInterval);
                //     console.log('CarSearchUnified: Model loading timeout, performing search anyway');
                //     this.performSearch(true);
                // }, 3000);
                
            } else {
                // Нет модели в URL - выполняем поиск сразу
                console.log('CarSearchUnified: No model in URL, performing search immediately');
                setTimeout(() => {
                    this.performSearch(true);
                }, 100);
            }
            
        } else {
            // Нет активных фильтров - загружаем предзагруженные результаты с пагинацией
            var $autoResults = $('.car-auction-auto-results');
            var $paginationContainer = $('.posts-list .car-auction-pagination');
            
            if ($autoResults.length > 0 && $paginationContainer.length > 0) {
                // Есть auto_search - получаем данные пагинации через AJAX
                this.loadInitialPaginationData();
            } else {
                // Инициализируем пагинацию из текущих параметров страницы
                this.initializePaginationFromPage();
            }
        }
    }

    // AJAX запрос для получения данных пагинации при загрузки страницы
    loadInitialPaginationData() {
        //console.log('CarSearchUnified: Loading initial pagination data via AJAX');

        // Показываем loading в правильном месте
        var $loading = $('.posts-list .car-auction-loading');
        var $autoResults = $('.car-auction-auto-results');
        var $paginationContainer = $('.posts-list .car-auction-pagination');

        $loading.show();
        $autoResults.hide();
        $paginationContainer.empty();

        // Получаем номер страницы из URL
        var urlParams = new URLSearchParams(window.location.search);
        var pageFromUrl = parseInt(urlParams.get('car_page')) || 1;

        // Собираем текущие фильтры из URL и формы
        var currentFilters = this.collectCurrentFilters();
        currentFilters.page = pageFromUrl;

        //console.log('CarSearchUnified: Making AJAX request for pagination data:', currentFilters);

        // Делаем AJAX запрос только для получения данных (без HTML)
        $.ajax({
            url: this.ajaxUrl,
            type: 'POST',
            data: {
                action: 'car_auction_html_search',
                nonce: this.nonce,
                market: this.currentMarket,
                filters: currentFilters
            },
            timeout: 15000,
            dataType: 'json',
            success: (response) => {
                //console.log('CarSearchUnified: Pagination data received:', response);

                if (response && response.success && response.data) {
                    // Создаем пагинацию на основе полученных данных
                    this.updatePagination(response.data);

                    // Обновляем внутреннее состояние
                    this.currentPage = response.data.page || pageFromUrl;

                    //console.log('CarSearchUnified: Pagination initialized for page', this.currentPage);
                } else {
                    //conlole.warn('CarSearchUnified: No pagination data received');
                }

                // Показываем auto-results и скрываем loading
                $loading.hide();
                $autoResults.show();

                // Обрабатываем 4WD значения в существующих карточках
                this.processNewResults();
            },
            error: (xhr, status, error) => {
                //conlole.error('CarSearchUnified: Failed to load pagination data:', {
                //    status: status,
                //    error: error,
                //    statusCode: xhr.status
                //});

                // В случае ошибки скрываем loading и показываем результаты без пагинации
                $loading.hide();
                $autoResults.show();

                // Обрабатываем 4WD значения в существующих карточках даже при ошибке
                this.processNewResults();
            }
        });
    }

    // Маппинг кодов топлива в tks_type группы (соответствует CarModel.js)
    fuelCodeToTksType(fuelCode) {
        const fuelCodeMapping = {
            'G': 'G', //'petrol',
            'L': 'L', //'petrol',
            'C': 'C', // 'petrol',
            '': '', // 'petrol',
            'D': 'D', //'diesel',
            'H': 'H', //'petrol_electric',
            'P': 'P', //'petrol_electric',
            '&': '&', //'diesel_electric',
            'E': 'E' //'electric'
        };
        return fuelCodeMapping[fuelCode] || null;
    }

    // ИСПРАВЛЕННАЯ версия сбора текущих фильтров из формы (приоритет) и URL (резерв)
    
    /*
    collectCurrentFilters() {
        var filters = {};

        // ОБЯЗАТЕЛЬНО синхронизируем кастомные селекты в скрытые поля перед сбором
        try {
            this.syncCustomSelects();
            console.log('CarSearchUnified: Custom selects synchronized');
        } catch (e) {
            console.warn('CarSearchUnified: Failed to sync custom selects:', e);
        }

        // ПРИОРИТЕТ: Фильтры из формы (берем только НЕпустые значения)
        var $form = $('.car-auction-search-form').first();
        if ($form.length === 0) {
            $form = $('form[data-market]').first();
        }
        if ($form.length === 0) {
            $form = $('#wf-form-filter');
        }

        if ($form.length > 0) {
            var self = this; // Сохраняем контекст для доступа к методам класса
            $form.find('input, select').each(function() {
                var $input = $(this);
                var name = $input.attr('name');
                var value = $input.val();

                // Берем только НЕпустые значения, исключая значения по умолчанию
                if (name && value !== '' &&
                    value.toLowerCase() !== 'все модели' &&
                    value.toLowerCase() !== 'любая модель' &&
                    value.toLowerCase() !== 'all models' &&
                    value.toLowerCase() !== 'выберите модель' &&
                    value.toLowerCase() !== 'любая марка' &&
                    value.toLowerCase() !== 'все марки' &&
                    value.toLowerCase() !== 'выберите марку') {

                    // ИСПРАВЛЕНО: Конвертируем код топлива в tks_type группу для API
                    if (name === 'fuel_type') {
                        var tksType = self.fuelCodeToTksType(value);
                        if (tksType) {
                            filters[name] = tksType;
                            console.log('CarSearchUnified: From form field:', name, '=', value, '-> tks_type:', tksType);
                        }
                    } else {
                        filters[name] = value;
                        console.log('CarSearchUnified: From form field:', name, '=', value);
                    }
                }
            });
        }

        // РЕЗЕРВ: Фильтры из URL (используем если поле формы пустое ИЛИ отсутствует)
        var urlParams = new URLSearchParams(window.location.search);

        var urlToFormMapping = {
            '_brand': 'vendor',
            '_model': 'model',
            'year_from': 'year_from',
            'year_to': 'year_to',
            'price_from': 'price_from',
            'price_to': 'price_to',
            'mileage_from': 'mileage_from',
            'mileage_to': 'mileage_to',
            'fuel_type': 'fuel_type',
            'transmission': 'transmission',
            'drive': 'drive'
        };

        for (var urlParam in urlToFormMapping) {
            var formField = urlToFormMapping[urlParam];

            // ИСПРАВЛЕНО: Используем URL параметр если НЕТ значения в filters (т.е. поле формы пустое)
            if (urlParams.has(urlParam) && !filters.hasOwnProperty(formField)) {
                var rawVal = urlParams.get(urlParam);
                if (rawVal && rawVal.trim() !== '') {
                    if (formField === 'vendor') {
                        filters[formField] = rawVal.toString().toUpperCase().trim();
                    } else if (formField === 'model') {
                        // Для модели: декодируем %20 в пробелы, верхний регистр
                        filters[formField] = decodeURIComponent(rawVal.toString().trim()).toUpperCase();
                    } else {
                        filters[formField] = rawVal;
                    }
                    console.log('CarSearchUnified: From URL fallback:', formField, '=', filters[formField]);
                }
            }
        }
        
        // ДОПОЛНИТЕЛЬНО: Проверяем кастомные селекты напрямую для бренда
        if (!filters.vendor || filters.vendor === '') {
            var $vendorFacet = $('.facetwp-facet-brand');
            if ($vendorFacet.length > 0) {
                var $selectedItem = $vendorFacet.find('.facet-dropdown-item.selected');
                if ($selectedItem.length > 0) {
                    var vendorValue = $selectedItem.attr('data-value') || $selectedItem.text();
                    if (vendorValue && vendorValue.trim() !== '' &&
                        vendorValue.toLowerCase() !== 'любая марка' &&
                        vendorValue.toLowerCase() !== 'все марки' &&
                        vendorValue.toLowerCase() !== 'выберите марку') {
                        filters.vendor = vendorValue.toString().toUpperCase().trim();
                        console.log('CarSearchUnified: From custom vendor select:', filters.vendor);
                    }
                }
            }
        }

        // ИСПРАВЛЕНО: Проверяем кастомные селекты напрямую для модели
        if (!filters.model || filters.model === '') {
            var $modelFacet = $('.facetwp-facet-model');
            if ($modelFacet.length > 0) {
                var $selectedItem = $modelFacet.find('.facet-dropdown-item.selected');
                if ($selectedItem.length > 0) {
                    var modelValue = $selectedItem.attr('data-value') || $selectedItem.text();
                    if (modelValue && modelValue.trim() !== '' &&
                        modelValue.toLowerCase() !== 'все модели' &&
                        modelValue.toLowerCase() !== 'любая модель' &&
                        modelValue.toLowerCase() !== 'выберите модель' &&
                        modelValue.toLowerCase() !== 'all models') {
                        
                            
                        filters.model = modelValue.toString().trim().replace(/\s+/g, '_').toUpperCase();
                        
                        
                        console.log('CarSearchUnified: From custom model select:', filters.model);
                    } else {
                        // Если выбрана "все модели" или пустое значение - НЕ добавляем в фильтры
                        console.log('CarSearchUnified: Custom model select has default value, skipping');
                    }
                }
            }
        }

        // Финальная нормализация значений
        if (filters.vendor) {
            filters.vendor = filters.vendor.toString().toUpperCase().trim();
        }
        if (filters.model) {
            filters.model = filters.model.toString().toUpperCase().trim();
        }

        console.log('CarSearchUnified: FINAL collected filters:', filters);
        return filters;
    }
    */
    
    // ===== ИСПРАВЛЕННЫЙ МЕТОД СБОРА ФИЛЬТРОВ =====
    collectCurrentFilters() {
        var filters = {};
        
        // ОБЯЗАТЕЛЬНО синхронизируем кастомные селекты в скрытые поля перед сбором
        try {
            this.syncCustomSelects();
            console.log('CarSearchUnified: Custom selects synchronized');
        } catch (e) {
            console.warn('CarSearchUnified: Failed to sync custom selects:', e);
        }
        
        // ПРИОРИТЕТ: Фильтры из формы (берем только НЕпустые значения)
        var $form = $('.car-auction-search-form').first();
        if ($form.length === 0) {
            $form = $('form[data-market]').first();
        }
        if ($form.length === 0) {
            $form = $('#wf-form-filter');
        }
        
        if ($form.length > 0) {
            var self = this;
            $form.find('input, select').each(function() {
                var $input = $(this);
                var name = $input.attr('name');
                var value = $input.val();
                
                // Берем только НЕпустые значения, исключая значения по умолчанию
                if (name && value !== '' &&
                    value.toLowerCase() !== 'все модели' &&
                    value.toLowerCase() !== 'любая модель' &&
                    value.toLowerCase() !== 'all models' &&
                    value.toLowerCase() !== 'выберите модель' &&
                    value.toLowerCase() !== 'любая марка' &&
                    value.toLowerCase() !== 'все марки' &&
                    value.toLowerCase() !== 'выберите марку') {
                    
                    // ИСПРАВЛЕНО: Конвертируем код топлива в tks_type группу для API
                    if (name === 'fuel_type') {
                        var tksType = self.fuelCodeToTksType(value);
                        if (tksType) {
                            filters[name] = tksType;
                            console.log('CarSearchUnified: From form field:', name, '=', value, '-> tks_type:', tksType);
                        }
                    } else {
                        filters[name] = value;
                        console.log('CarSearchUnified: From form field:', name, '=', value);
                    }
                }
            });
        }
        
        // РЕЗЕРВ: Фильтры из URL (используем если поле формы пустое ИЛИ отсутствует)
        var urlParams = new URLSearchParams(window.location.search);
        var urlToFormMapping = {
            '_brand': 'vendor',
            '_model': 'model',
            'year_from': 'year_from',
            'year_to': 'year_to',
            'price_from': 'price_from',
            'price_to': 'price_to',
            'mileage_from': 'mileage_from',
            'mileage_to': 'mileage_to',
            'fuel_type': 'fuel_type',
            'transmission': 'transmission',
            'drive': 'drive'
        };
        
        for (var urlParam in urlToFormMapping) {
            var formField = urlToFormMapping[urlParam];
            
            // ИСПРАВЛЕНО: Используем URL параметр если НЕТ значения в filters (т.е. поле формы пустое)
            if (urlParams.has(urlParam) && !filters.hasOwnProperty(formField)) {
                var rawVal = urlParams.get(urlParam);
                if (rawVal && rawVal.trim() !== '') {
                    if (formField === 'vendor') {
                        filters[formField] = rawVal.toString().toUpperCase().trim();
                    } else if (formField === 'model') {
                        // Для модели: декодируем %20 в пробелы, верхний регистр
                        var decodedModel = decodeURIComponent(rawVal.toString().trim());
                        filters[formField] = decodedModel.toUpperCase();
                        console.log('CarSearchUnified: From URL fallback (decoded):', formField, '=', filters[formField]);
                    } else {
                        filters[formField] = rawVal;
                    }
                    console.log('CarSearchUnified: From URL fallback:', formField, '=', filters[formField]);
                }
            }
        }
        
        // ДОПОЛНИТЕЛЬНО: Проверяем кастомные селекты напрямую для бренда
        if (!filters.vendor || filters.vendor === '') {
            var $vendorFacet = $('.facetwp-facet-brand');
            if ($vendorFacet.length > 0) {
                var $selectedItem = $vendorFacet.find('.facet-dropdown-item.selected');
                if ($selectedItem.length > 0) {
                    var vendorValue = $selectedItem.attr('data-value') || $selectedItem.text();
                    if (vendorValue && vendorValue.trim() !== '' &&
                        vendorValue.toLowerCase() !== 'любая марка' &&
                        vendorValue.toLowerCase() !== 'все марки' &&
                        vendorValue.toLowerCase() !== 'выберите марку') {
                        filters.vendor = vendorValue.toString().toUpperCase().trim();
                        console.log('CarSearchUnified: From custom vendor select:', filters.vendor);
                    }
                }
            }
        }
        
        // ИСПРАВЛЕНО: Проверяем кастомные селекты напрямую для модели
        if (!filters.model || filters.model === '') {
            var $modelFacet = $('.facetwp-facet-model');
            if ($modelFacet.length > 0) {
                var $selectedItem = $modelFacet.find('.facet-dropdown-item.selected');
                if ($selectedItem.length > 0) {
                    var modelValue = $selectedItem.attr('data-value') || $selectedItem.text();
                    if (modelValue && modelValue.trim() !== '' &&
                        modelValue.toLowerCase() !== 'все модели' &&
                        modelValue.toLowerCase() !== 'любая модель' &&
                        modelValue.toLowerCase() !== 'выберите модель' &&
                        modelValue.toLowerCase() !== 'all models') {
                        
                        filters.model = modelValue.toString().trim().replace(/\s+/g, '_').toUpperCase();
                        console.log('CarSearchUnified: From custom model select:', filters.model);
                    } else {
                        // Если выбрана "все модели" или пустое значение - НЕ добавляем в фильтры
                        console.log('CarSearchUnified: Custom model select has default value, skipping');
                    }
                }
            }
        }
        
        // ИСПРАВЛЕНИЕ: Проверяем URL параметр модели еще раз, если он не попал в фильтры
        // Это нужно для случаев когда модель динамически добавляется в селект
        if (!filters.model && urlParams.has('_model')) {
            var urlModel = urlParams.get('_model');
            if (urlModel && urlModel.trim() !== '') {
                var decodedModel = decodeURIComponent(urlModel.toString().trim());
                filters.model = decodedModel.toUpperCase();
                console.log('CarSearchUnified: Force adding model from URL to filters:', filters.model);
            }
        }
        
        // Финальная нормализация значений
        if (filters.vendor) {
            filters.vendor = filters.vendor.toString().toUpperCase().trim();
        }
        if (filters.model) {
            filters.model = filters.model.toString().toUpperCase().trim();
        }
        
        console.log('CarSearchUnified: FINAL collected filters:', filters);
        return filters;
    }

    // ===== ОБРАБОТКА СОБЫТИЙ =====
    /*
    handleVendorChange(e) {
        var vendor = $(e.target).val();
        var $modelSelect = $('select[name="model"], .car-auction-model-select');

        console.log('CarSearchUnified: Vendor changed to:', vendor);

        // ВАЖНО: Сбрасываем модель из URL при смене марки (только при ручной смене пользователем)
        this.clearModelFromUrl();

        // Сбрасываем выбранную модель в селектах
        this.resetModelSelection();

        if (vendor) {
            this.loadModels(vendor, $modelSelect);
            // После загрузки моделей обновляем другие фильтры
            this.loadDynamicFilters();
        } else {
            $modelSelect.html('<option value="">Все модели</option>').prop('disabled', true);
            // Сбрасываем и блокируем кастомный селект модели
            this.disableCustomModelSelect('Все модели');
            // Обновляем фильтры для пустого вендора
            this.loadDynamicFilters();
        }
    }
    */
    // ===== ОБНОВЛЯЕМ handleVendorChange ДЛЯ МГНОВЕННОГО ОБНОВЛЕНИЯ =====
    handleVendorChange(e) {
        var vendor = $(e.target).val();
        var $modelSelect = $('select[name="model"], .car-auction-model-select');
        console.log('CarSearchUnified: Vendor changed to:', vendor);
        
        // НЕМЕДЛЕННО обновляем URL для вендора
        this.updateUrlForSingleField('vendor', vendor);
        
        // ВАЖНО: Сбрасываем модель из URL при смене марки
        this.clearModelFromUrl();
        
        // Сбрасываем выбранную модель в селектах
        this.resetModelSelection();
        
        if (vendor) {
            this.loadModels(vendor, $modelSelect);
            // После загрузки моделей обновляем другие фильтры
            this.loadDynamicFilters();
        } else {
            $modelSelect.html('<option value="">Все модели</option>').prop('disabled', true);
            // Сбрасываем и блокируем кастомный селект модели
            this.disableCustomModelSelect('Все модели');
            // Обновляем фильтры для пустого вендора
            this.loadDynamicFilters();
        }
    }

    // Адаптированная функция загрузки моделей из старого кода с защитой от дублирования
    /*
    loadModels(vendor, $modelSelect) {
        console.log('CarSearchUnified: Loading models for vendor:', vendor, 'in market:', this.currentMarket);

        // ЗАЩИТА ОТ ДУБЛИРОВАНИЯ: проверяем, не загружаем ли уже модели для того же производителя
        if (this.isLoadingModels && this.currentVendor === vendor) {
            console.log('CarSearchUnified: Already loading models for', vendor, '- skipping duplicate request');
            return;
        }

        // Если загружаем модели для другого производителя, прерываем предыдущий запрос
        if (this.isLoadingModels && this.currentVendor !== vendor) {
            console.log('CarSearchUnified: Cancelling previous model loading for different vendor');
            // jQuery AJAX запросы можно отменить, но здесь просто отметим что загрузка идет для нового vendor
        }

        this.isLoadingModels = true;
        this.currentVendor = vendor;

        $modelSelect.prop('disabled', true).html('<option value="">Загрузка...</option>');

        $.ajax({
            url: this.ajaxUrl,
            type: 'POST',
            data: {
                action: 'car_auction_get_models',
                nonce: this.nonce,
                market: this.currentMarket,
                vendor: vendor
            },
            timeout: 15000,
            dataType: 'json',
            success: (response) => {
                //console.log('CarSearchUnified: Models response received:', response);
                if (response && response.success && Array.isArray(response.data)) {
                    var html = '<option value="">Все модели</option>';
                    response.data.forEach((model) => {
                        if (model) {
                            html += '<option value="' + model + '">' +
                                model + '</option>';
                        }
                    });
                    $modelSelect.html(html).prop('disabled', false);

                    // Обновляем кастомный селект модели
                    this.updateCustomModelSelect(response.data);

                    // Если был ожидаемый выбор модели (из URL или ранее), попробуем применить его после загрузки
                    if (this.pendingModelValue) {
                        var matchedModel = this.isValidFacetValue('model', this.pendingModelValue);
                        if (matchedModel) {
                            try {
                                this.updateCustomSelect('model', matchedModel);
                            } catch (e) {
                                // ignore
                            }
                        } else {
                            // Не найдено в списке моделей, игнорируем
                            //console.warn('CarSearchUnified: Pending model not found in loaded models:', this.pendingModelValue);
                        }

                        this.pendingModelValue = null;
                    }

                    console.log('CarSearchUnified: Loaded', response.data.length, 'models for', vendor, 'in market', this.currentMarket);

                    // Автоматически загружаем динамические фильтры после загрузки моделей
                    this.loadDynamicFilters();
                } else {
                    $modelSelect.html('<option value="">Ошибка загрузки</option>');
                    this.disableCustomModelSelect('Ошибка загрузки');
                    var errorMsg = (response && response.data) ? response.data : 'Неизвестная ошибка';
                    //conlole.error('CarSearchUnified: Failed to load models for vendor', vendor, 'in market', this.currentMarket, ':', errorMsg);
                }

                // Сбрасываем флаги защиты после успешной загрузки
                this.isLoadingModels = false;
                this.currentVendor = null;
            },
            error: (xhr, status, error) => {
                $modelSelect.html('<option value="">Ошибка соединения</option>');
                this.disableCustomModelSelect('Ошибка соединения');
                //conlole.error('CarSearchUnified: AJAX error loading models:', {
                //    vendor: vendor,
                //    market: this.currentMarket,
                //    status: status,
                //    error: error,
                //    statusCode: xhr.status,
                //    responseText: xhr.responseText ? xhr.responseText.substring(0, 100) : 'empty'
                //});

                // Сбрасываем флаги защиты после ошибки
                this.isLoadingModels = false;
                this.currentVendor = null;
            }
        });
    }
    */
    
    // ===== ОБНОВЛЯЕМ МЕТОД ЗАГРУЗКИ МОДЕЛЕЙ =====
    /*
    loadModels(vendor, $modelSelect) {
        console.log('CarSearchUnified: Loading models for vendor:', vendor, 'in market:', this.currentMarket);
        
        // ЗАЩИТА ОТ ДУБЛИРОВАНИЯ: проверяем, не загружаем ли уже модели для того же производителя
        if (this.isLoadingModels && this.currentVendor === vendor) {
            console.log('CarSearchUnified: Already loading models for', vendor, '- skipping duplicate request');
            return;
        }
        
        this.isLoadingModels = true;
        this.currentVendor = vendor;
        $modelSelect.prop('disabled', true).html('<option value="">Загрузка...</option>');
        
        $.ajax({
            url: this.ajaxUrl,
            type: 'POST',
            data: {
                action: 'car_auction_get_models',
                nonce: this.nonce,
                market: this.currentMarket,
                vendor: vendor
            },
            timeout: 15000,
            dataType: 'json',
            success: (response) => {
                console.log('CarSearchUnified: Models response received:', response);
                
                if (response && response.success && Array.isArray(response.data)) {
                    var html = '<option value="">Все модели</option>';
                    response.data.forEach((model) => {
                        if (model) {
                            html += '<option value="' + model + '">' + model + '</option>';
                        }
                    });
                    $modelSelect.html(html).prop('disabled', false);
                    
                    // Обновляем кастомный селект модели
                    this.updateCustomModelSelect(response.data);
                    
                    // ИСПРАВЛЕНИЕ: Применяем ожидаемое значение модели ПОСЛЕ загрузки моделей
                    if (this.pendingModelValue) {
                        console.log('CarSearchUnified: Applying pending model after loading:', this.pendingModelValue);
                        
                        var matchedModel = this.isValidFacetValue('model', this.pendingModelValue);
                        if (matchedModel) {
                            console.log('CarSearchUnified: Found matching model:', matchedModel);
                            try {
                                this.updateCustomSelect('model', matchedModel);
                                // Обновляем URL с правильным значением
                                this.updateUrlForSingleField('model', matchedModel);
                            } catch (e) {
                                console.warn('CarSearchUnified: Failed to update custom select:', e);
                            }
                        } else {
                            console.warn('CarSearchUnified: Pending model not found in loaded models:', this.pendingModelValue);
                            // Добавляем опцию если не найдено
                            this.addModelOption(this.pendingModelValue);
                        }
                        this.pendingModelValue = null;
                    }
                    
                    console.log('CarSearchUnified: Loaded', response.data.length, 'models for', vendor, 'in market', this.currentMarket);
                    
                    // Автоматически загружаем динамические фильтры после загрузки моделей
                    this.loadDynamicFilters();
                    
                } else {
                    $modelSelect.html('<option value="">Ошибка загрузки</option>');
                    this.disableCustomModelSelect('Ошибка загрузки');
                    var errorMsg = (response && response.data) ? response.data : 'Неизвестная ошибка';
                    console.error('CarSearchUnified: Failed to load models for vendor', vendor, 'in market', this.currentMarket, ':', errorMsg);
                }
                
                // Сбрасываем флаги защиты после успешной загрузки
                this.isLoadingModels = false;
                this.currentVendor = null;
            },
            error: (xhr, status, error) => {
                $modelSelect.html('<option value="">Ошибка соединения</option>');
                this.disableCustomModelSelect('Ошибка соединения');
                console.error('CarSearchUnified: AJAX error loading models:', {
                    vendor: vendor,
                    market: this.currentMarket,
                    status: status,
                    error: error,
                    statusCode: xhr.status,
                    responseText: xhr.responseText ? xhr.responseText.substring(0, 100) : 'empty'
                });
                
                // Сбрасываем флаги защиты после ошибки
                this.isLoadingModels = false;
                this.currentVendor = null;
            }
        });
    } */
    
    // ===== ОБНОВЛЯЕМ МЕТОД ЗАГРУЗКИ МОДЕЛЕЙ =====
    loadModels(vendor, $modelSelect) {
        console.log('CarSearchUnified: Loading models for vendor:', vendor, 'in market:', this.currentMarket);
        
        // ЗАЩИТА ОТ ДУБЛИРОВАНИЯ: проверяем, не загружаем ли уже модели для того же производителя
        if (this.isLoadingModels && this.currentVendor === vendor) {
            console.log('CarSearchUnified: Already loading models for', vendor, '- skipping duplicate request');
            return;
        }
        
        this.isLoadingModels = true;
        this.currentVendor = vendor;
        $modelSelect.prop('disabled', true).html('<option value="">Загрузка...</option>');
        
        $.ajax({
            url: this.ajaxUrl,
            type: 'POST',
            data: {
                action: 'car_auction_get_models',
                nonce: this.nonce,
                market: this.currentMarket,
                vendor: vendor
            },
            timeout: 15000,
            dataType: 'json',
            success: (response) => {
                console.log('CarSearchUnified: Models response received:', response);
                
                if (response && response.success && Array.isArray(response.data)) {
                    var html = '<option value="">Все модели</option>';
                    response.data.forEach((model) => {
                        if (model) {
                            html += '<option value="' + model + '">' + model + '</option>';
                        }
                    });
                    $modelSelect.html(html).prop('disabled', false);
                    
                    // Обновляем кастомный селект модели
                    this.updateCustomModelSelect(response.data);
                    
                    // ИСПРАВЛЕНИЕ: Применяем ожидаемое значение модели ПОСЛЕ загрузки моделей
                    if (this.pendingModelValue) {
                        console.log('CarSearchUnified: Applying pending model after loading:', this.pendingModelValue);
                        
                        var matchedModel = this.isValidFacetValue('model', this.pendingModelValue);
                        if (matchedModel) {
                            console.log('CarSearchUnified: Found matching model:', matchedModel);
                            try {
                                this.updateCustomSelect('model', matchedModel);
                                // Обновляем URL с правильным значением
                                this.updateUrlForSingleField('model', matchedModel);
                                
                                // ИСПРАВЛЕНИЕ: Немедленно выполняем поиск после установки модели
                                console.log('CarSearchUnified: Model set, performing search');
                                setTimeout(() => {
                                    this.performSearch(true);
                                }, 100);
                                
                            } catch (e) {
                                console.warn('CarSearchUnified: Failed to update custom select:', e);
                            }
                        } else {
                            console.warn('CarSearchUnified: Pending model not found in loaded models:', this.pendingModelValue);
                            // Добавляем опцию если не найдено
                            this.addModelOption(this.pendingModelValue);
                            
                            // ИСПРАВЛЕНИЕ: Выполняем поиск даже если модель не найдена в списке
                            console.log('CarSearchUnified: Performing search with custom model');
                            setTimeout(() => {
                                this.performSearch(true);
                            }, 100);
                        }
                        this.pendingModelValue = null;
                    }
                    
                    console.log('CarSearchUnified: Loaded', response.data.length, 'models for', vendor, 'in market', this.currentMarket);
                    
                    // Автоматически загружаем динамические фильтры после загрузки моделей
                    this.loadDynamicFilters();
                    
                } else {
                    $modelSelect.html('<option value="">Ошибка загрузки</option>');
                    this.disableCustomModelSelect('Ошибка загрузки');
                    var errorMsg = (response && response.data) ? response.data : 'Неизвестная ошибка';
                    console.error('CarSearchUnified: Failed to load models for vendor', vendor, 'in market', this.currentMarket, ':', errorMsg);
                }
                
                // Сбрасываем флаги защиты после успешной загрузки
                this.isLoadingModels = false;
                this.currentVendor = null;
            },
            error: (xhr, status, error) => {
                $modelSelect.html('<option value="">Ошибка соединения</option>');
                this.disableCustomModelSelect('Ошибка соединения');
                console.error('CarSearchUnified: AJAX error loading models:', {
                    vendor: vendor,
                    market: this.currentMarket,
                    status: status,
                    error: error,
                    statusCode: xhr.status,
                    responseText: xhr.responseText ? xhr.responseText.substring(0, 100) : 'empty'
                });
                
                // Сбрасываем флаги защиты после ошибки
                this.isLoadingModels = false;
                this.currentVendor = null;
            }
        });
    }
    
    // ===== ДОБАВЛЯЕМ МЕТОД ПРИНУДИТЕЛЬНОГО СБОРА ФИЛЬТРОВ С УЧЕТОМ URL =====
    collectFiltersWithUrlPriority() {
        console.log('CarSearchUnified: Collecting filters with URL priority');
        
        var filters = this.collectCurrentFilters();
        var urlParams = new URLSearchParams(window.location.search);
        
        // ИСПРАВЛЕНИЕ: Принудительно добавляем модель из URL если она есть
        if (urlParams.has('_model')) {
            var urlModel = urlParams.get('_model');
            if (urlModel && urlModel.trim() !== '') {
                var decodedModel = decodeURIComponent(urlModel.toString().trim());
                filters.model = decodedModel.toUpperCase();
                console.log('CarSearchUnified: Force added model from URL to filters:', filters.model);
            }
        }
        
        // ИСПРАВЛЕНИЕ: Принудительно добавляем бренд из URL если он есть
        if (urlParams.has('_brand')) {
            var urlBrand = urlParams.get('_brand');
            if (urlBrand && urlBrand.trim() !== '') {
                filters.vendor = urlBrand.toString().toUpperCase().trim();
                console.log('CarSearchUnified: Force added brand from URL to filters:', filters.vendor);
            }
        }
        
        console.log('CarSearchUnified: Final filters with URL priority:', filters);
        return filters;
    }

    // ===== РАБОТА С КАСТОМНЫМИ СЕЛЕКТАМИ =====
    updateCustomModelSelect(models) {
        var $modelFacet = $('.facetwp-facet-model');
        if ($modelFacet.length === 0) {
            //console.log('CarSearchUnified: Custom model select not found');
            return;
        }

        //console.log('CarSearchUnified: Updating custom model select with', models.length, 'models');

        // Создаем HTML для опций
        var html = '<option value="">Все модели</option>';
        models.forEach((model) => {
            if (model && model) {
                html += '<option value="' + model + '">' +
                    model + '</option>';
            }
        });

        // Обновляем скрытый селект
        var $hiddenSelect = $modelFacet.find('select');
        $hiddenSelect.html(html).prop('disabled', false);

        // Обновляем дропдоун список
        var $dropdownList = $modelFacet.find('.facet-dropdown-list');
        var dropdownHtml = '';
        dropdownHtml += '<div class="facet-dropdown-item selected" data-value="">Все модели</div>';
        models.forEach((model) => {
            if (model && model) {
                dropdownHtml += '<div class="facet-dropdown-item" data-value="' + model + '">' +
                    model + '</div>';
            }
        });
        $dropdownList.html(dropdownHtml);

        // Обновляем текст триггера
        var $trigger = $modelFacet.find('.custom-select-trigger');
        $trigger.text('Все модели');

        // Разблокируем кастомный селект
        $modelFacet.css({
            'opacity': '1',
            'pointer-events': 'auto'
        }).removeClass('disabled');

        //console.log('CarSearchUnified: Custom model select updated and enabled');
    }

    disableCustomModelSelect(errorText) {
        var $modelFacet = $('.facetwp-facet-model');
        if ($modelFacet.length === 0) {
            return;
        }

        //console.log('CarSearchUnified: Disabling custom model select');

        // Обновляем скрытый селект
        var $hiddenSelect = $modelFacet.find('select');
        $hiddenSelect.html('<option value="">' + errorText + '</option>').prop('disabled', true);

        // Обновляем дропдаун список
        var $dropdownList = $modelFacet.find('.facet-dropdown-list');
        $dropdownList.html('<div class="facet-dropdown-item selected" data-value="">' + errorText + '</div>');

        // Обновляем текст триггера
        var $trigger = $modelFacet.find('.custom-select-trigger');
        $trigger.text(errorText);

        // Блокируем кастомный селект
        $modelFacet.css({
            'opacity': '0.5',
            'pointer-events': 'none'
        }).addClass('disabled');
    }

    // ===== ОБРАБОТКА ПОИСКА =====
    /*
    handleSearch(e) {
        if (e) e.preventDefault();

        if (this.isLoading) {
            //console.log('CarSearchUnified: Search already in progress, skipping');
            return;
        }

        //console.log('CarSearchUnified: Starting search');
        this.performSearch(true);
    }
    */
    handleSearch(e) {
        if (e) e.preventDefault();
        if (this.isLoading) {
            console.log('CarSearchUnified: Search already in progress, skipping');
            return;
        }
        
        console.log('CarSearchUnified: Starting search');
        
        // ГАРАНТИРУЕМ синхронизацию всех полей перед поиском
        this.syncAllFieldsToUrl();
        
        this.performSearch(true);
    }

    handleFormSubmit(e) {
        e.preventDefault();
        //console.log('CarSearchUnified: Form submitted');
        this.handleSearch();
    }

    handleReset(e) {
        if (e) e.preventDefault();

        //console.log('CarSearchUnified: Reset button clicked');

        // Сброс формы
        var $form = $('form[data-market], #wf-form-filter');
        $form[0].reset();

        // Сброс кастомных селектов
        $('.custom-select-trigger').each(function() {
            var $trigger = $(this);
            var $container = $trigger.closest('.facetwp-facet');
            var defaultText = $container.find('.facet-dropdown-item').first().text();
            $trigger.text(defaultText);
            $container.find('.facet-dropdown-item').removeClass('selected').first().addClass('selected');
        });

        // Сброс селекта моделей
        $('select[name="model"], .car-auction-model-select').html('<option value="">Все модели</option>').prop('disabled', true);

        // Сброс кастомного селека модели
        this.disableCustomModelSelect('Все модели');

        this.currentPage = 1;
        this.hasMoreResults = true;

        // Очистка результатов поиска и показ авто-результатов
        $('.posts-list .car-auction-results-content').empty();
        $('.car-auction-load-more-container').remove();

        // Очистка пагинации и загрузка данных для auto-results
        $('.posts-list .car-auction-pagination').empty();

        // ИСПРАВЛЕНО: Очищаем URL от всех фильтров после сброса
        this.clearAllFiltersFromUrl();

        // Загружаем пагинацию для предзагруженных результатов
        this.loadInitialPaginationData();

        //console.log('CarSearchUnified: Reset complete');
    }

    handlePagination(e) {
        e.preventDefault();

        var page = parseInt($(e.currentTarget).data('page'));
        if (!page || page === this.currentPage) {
            return;
        }

        //console.log('CarSearchUnified: Pagination clicked - going to page', page, '(AJAX mode)');

        // ВСЕГДА используем AJAX пагинацию для избежания перезагрузки страницы
        var $resultsContent = $('.posts-list .car-auction-results-content');
        var $autoResults = $('.car-auction-auto-results');
        var $paginationContainer = $('.posts-list .car-auction-pagination');

        // Определяем, нужно ли загружать предзагруженные данные или результаты поиска
        var hasSearchResults = $resultsContent.children().length > 0;
        var autoResultsHidden = $autoResults.is(':hidden') || $autoResults.css('display') === 'none';
        var hasActiveFilters = this.currentFilters && Object.keys(this.currentFilters).length > 1;

        //console.log('CarSearchUnified: AJAX pagination mode detection:', {
        //    hasSearchResults: hasSearchResults,
        //    autoResultsHidden: autoResultsHidden,
        //    hasActiveFilters: hasActiveFilters,
        //    currentFilters: this.currentFilters
        //});

        // Прокручиваем к началу результатов
        var scrollTarget = hasSearchResults && autoResultsHidden ? $resultsContent : $autoResults;
        if (scrollTarget.length > 0) {
            $('html, body').animate({
                scrollTop: scrollTarget.offset().top - 100
            }, 300);
        }

        this.currentPage = page;

        if ((hasSearchResults && autoResultsHidden) || hasActiveFilters) {
            // Результаты поиска - используем стандартную функцию поиска
            //console.log('CarSearchUnified: Loading search results via AJAX for page', page);
            this.performSearch(false);
        } else {
            // Предзагруженные результаты - загружаем их через AJAX
            //console.log('CarSearchUnified: Loading auto-results via AJAX for page', page);
            this.loadAutoResultsPage(page);
        }
    }

    handleCarCardClick(e) {
        e.preventDefault();
        var carUrl = $(e.currentTarget).data('car-url');
        if (carUrl) {
            window.location.href = carUrl;
        }
    }

    // ===== ОБРАБОТКА ДРОПДАУНОВ (из theme-fixed) =====
    handleDropdownTrigger(e) {
        var $trigger = $(e.currentTarget);
        var $container = $trigger.closest('.facetwp-facet');
        var $dropdown = $container.find('.facet-dropdown-list');

        // Закрыть другие дропдауны
        $('.facet-dropdown-list').not($dropdown).hide();

        // Переключить текущий дропдаун
        $dropdown.toggle();

        //console.log('CarSearchUnified: Dropdown toggled');
    }

/*
    handleDropdownClick(e) {
        var $item = $(e.currentTarget);
        var value = $item.data('value');
        var $container = $item.closest('.facetwp-facet');
        var $select = $container.find('select');
        var $trigger = $container.find('.custom-select-trigger');

        // Обновить скрытый селект
        $select.val(value);

        // Обновить текст триггера
        $trigger.text($item.text());

        // Обновить аыбранное состояние
        $container.find('.facet-dropdown-item').removeClass('selected');
        $item.addClass('selected');

        // Скрыть дропдаун
        $container.find('.facet-dropdown-list').hide();

        // Вызвать change если это селект производителя
        if ($select.attr('name') === 'vendor') {
            $select.trigger('change');
        }

        // ИСПРАВЛЕНИЕ: Специальная обработка для клика на "Все модели"
        if ($select.attr('name') === 'model') {
            var itemText = $item.text().trim();
            console.log('CarSearchUnified: Model dropdown clicked - value:', value, 'text:', itemText);

            // Если это "Все модели" или пустое значение - немедленно очищаем модель из URL
            if (!value || value === '' ||
                itemText.toLowerCase() === 'все модели' ||
                itemText.toLowerCase() === 'любая модель' ||
                itemText.toLowerCase() === 'выберите модель') {

                console.log('CarSearchUnified: "Все модели" selected - clearing model from URL immediately');
                this.clearModelFromUrl();
            }

            // Всегда вызываем change для обновления других фильтров
            $select.trigger('change');
        }

        //console.log('CarSearchUnified: Custom select changed to:', value);
    }
    */
    
    // ===== МЕТОД ПРИНУДИТЕЛЬНОЙ СИНХРОНИЗАЦИИ ВСЕХ ПОЛЕЙ =====
    syncAllFieldsToUrl() {
        console.log('CarSearchUnified: Syncing all fields to URL');
        
        // Синхронизируем кастомные селекты
        try {
            this.syncCustomSelects();
        } catch (e) {
            console.warn('CarSearchUnified: Failed to sync custom selects:', e);
        }
        
        // Обновляем URL для всех полей формы
        var $form = $('.car-auction-search-form').first();
        if ($form.length === 0) {
            $form = $('form[data-market]').first();
        }
        if ($form.length === 0) {
            $form = $('#wf-form-filter');
        }
        
        if ($form.length > 0) {
            var fields = [
                'vendor', 'model', 'year_from', 'year_to', 
                'price_from', 'price_to', 'mileage_from', 'mileage_to',
                'fuel_type', 'transmission', 'drive'
            ];
            
            fields.forEach((fieldName) => {
                var $field = $form.find('[name="' + fieldName + '"]');
                if ($field.length > 0) {
                    var value = $field.val();
                    this.updateUrlForSingleField(fieldName, value);
                }
            });
        }
        
        console.log('CarSearchUnified: All fields synced to URL');
    }
    
    // ===== ОБНОВЛЯЕМ handleDropdownClick ДЛЯ КАСТОМНЫХ СЕЛЕКТОВ =====
    handleDropdownClick(e) {
        var $item = $(e.currentTarget);
        var value = $item.data('value');
        var $container = $item.closest('.facetwp-facet');
        var $select = $container.find('select');
        var $trigger = $container.find('.custom-select-trigger');
        
        // Определяем имя поля по классам контейнера
        var fieldName = '';
        if ($container.hasClass('facetwp-facet-brand') || $container.hasClass('facetwp-facet-vendor')) {
            fieldName = 'vendor';
        } else if ($container.hasClass('facetwp-facet-model')) {
            fieldName = 'model';
        } else if ($container.hasClass('facetwp-facet-fuel_type') || $container.hasClass('facetwp-facet-fuel')) {
            fieldName = 'fuel_type';
        } else if ($container.hasClass('facetwp-facet-transmission')) {
            fieldName = 'transmission';
        } else if ($container.hasClass('facetwp-facet-drive')) {
            fieldName = 'drive';
        }
        
        // Обновить скрытый селект
        $select.val(value);
        
        // Обновить текст триггера
        $trigger.text($item.text());
        
        // Обновить выбранное состояние
        $container.find('.facet-dropdown-item').removeClass('selected');
        $item.addClass('selected');
        
        // Скрыть дропдаун
        $container.find('.facet-dropdown-list').hide();
        
        // НЕМЕДЛЕННО обновляем URL для этого поля
        if (fieldName) {
            this.updateUrlForSingleField(fieldName, value);
        }
        
        // Вызвать change если это селект производителя
        if ($select.attr('name') === 'vendor') {
            $select.trigger('change');
        }
        
        // ИСПРАВЛЕНИЕ: Специальная обработка для клика на "Все модели"
        if ($select.attr('name') === 'model') {
            var itemText = $item.text().trim();
            console.log('CarSearchUnified: Model dropdown clicked - value:', value, 'text:', itemText);
            
            // Если это "Все модели" или пустое значение - немедленно очищаем модель из URL
            if (!value || value === '' ||
                itemText.toLowerCase() === 'все модели' ||
                itemText.toLowerCase() === 'любая модель' ||
                itemText.toLowerCase() === 'выберите модель') {
                console.log('CarSearchUnified: "Все модели" selected - clearing model from URL immediately');
                this.clearModelFromUrl();
            }
            
            // Всегда вызываем change для обновления других фильтров
            $select.trigger('change');
        }
        
        console.log('CarSearchUnified: Custom select changed to:', value, 'field:', fieldName);
    }

    handleOutsideClick(e) {
        if (!$(e.target).closest('.facetwp-facet').length) {
            $('.facet-dropdown-list').hide();
        }
    }

    // ===== ВЫПОЛНЕНИЕ ПОИСКА (адаптированная функция из старого кода) =====
    performSearch(reset, append) {
        if (this.isLoading) {
            //console.log('CarSearchUnified: Search already in progress');
            return;
        }

        this.isLoading = true;
        reset = reset || false;
        append = append || false;

        if (reset) {
            this.currentPage = 1;
            this.hasMoreResults = true;
        }

        //console.log('CarSearchUnified: Performing search - Reset:', reset, 'Market:', this.currentMarket);

        // Синхронизируем кастомные селекты с скрытыми select перед сбором фильтров
        try {
            this.syncCustomSelects();
        } catch (e) {
            // ignore
        }

        // Используем единый метод сбора фильтров (включает URL и форму)
        // var formData = this.collectCurrentFilters();
        
        var formData = this.collectFiltersWithUrlPriority();

        // Добавляем номер страницы
        formData.page = this.currentPage;
        this.currentFilters = formData;

        //console.log('CarSearchUnified: Using collected filters for search:', formData);

        // Показ индикатора загрузки
        var $loading = $('.posts-list .car-auction-loading');
        var $resultsContent = $('.posts-list .car-auction-results-content');
        var $autoResults = $('.car-auction-auto-results');

        // Скрыть авто-результаты во время поиска
        $autoResults.hide();

        if (!append) {
            $loading.show();
            $resultsContent.hide();
        }

        // AJAX запрос
        $.ajax({
            url: this.ajaxUrl,
            type: 'POST',
            data: {
                action: 'car_auction_html_search',
                nonce: this.nonce,
                market: this.currentMarket,
                filters: formData
            },
            timeout: 30000,
            dataType: 'json',
            success: (response) => {
                //console.log('CarSearchUnified: Search response received:', JSON.stringify(response).substring(0, 200) + '...');

                if (!response) {
                    //conlole.error('CarSearchUnified: No response received from server');
                    this.showError('Нет ответа от сервера');
                    this.isLoading = false;
                    $loading.hide();
                    return;
                }

                if (response.success) {
                    var results = response.data;

                    if (!results) {
                        //conlole.error('CarSearchUnified: No data in response');
                        this.showError('Нет данных в ответе сервера');
                        this.isLoading = false;
                        $loading.hide();
                        return;
                    }

                    //console.log('CarSearchUnified: Processing results:', {
                    //    empty: results.empty,
                    //    total: results.total,
                    //    hasHtml: !!(results.html),
                    //    htmlLength: results.html ? results.html.length : 0
                    //});

                    // Проверка на пустые результаты
                    if (results.empty === true || results.total === 0 || !results.html || results.html.trim() === '') {
                        $resultsContent.empty();
                        this.showEmptyResults(results.market || this.currentMarket);
                        $resultsContent.show();
                        this.isLoading = false;
                        $loading.hide();
                        //console.log('CarSearchUnified: Empty results displayed');
                        return;
                    }

                    if (results.html) {
                        if (reset || !append) {
                            // При сбросе - создаем полную структуру
                            $resultsContent.html('<div class="all-catalogue mob-grid">' + results.html + '</div>');
                        } else {
                            // При загрузке дополнительных - добавляем только карточки
                            var $catalogue = $resultsContent.find('.all-catalogue');
                            if ($catalogue.length > 0) {
                                $catalogue.append(results.html);
                            } else {
                                $resultsContent.html('<div class="all-catalogue mob-grid">' + results.html + '</div>');
                            }
                        }

                        // Обновляем пагинацию через JS
                        this.updatePagination(results);

                        // Обновляем URL с текущими фильтрами (передаём использованные фильтры)
                        this.updateUrlWithFilters(results.page || this.currentPage, formData);

                        // Обрабатываем 4WD значения в новых карточках
                        this.processNewResults();

                        // ДОБАВЛЕНО: Перезагружаем динамические фильтры после успешного поиска
                        this.loadDynamicFilters();

                        $resultsContent.show();
                        //console.log('CarSearchUnified: Search completed successfully. Total results:', results.total);
                    } else {
                        //conlole.error('CarSearchUnified: No HTML in results');
                        this.showError('API не вернул HTML данные');
                    }
                } else {
                    var errorMessage = 'Неизвестная ошибка';
                    if (response.data) {
                        errorMessage = response.data;
                    } else if (response.message) {
                        errorMessage = response.message;
                    }
                    //conlole.error('CarSearchUnified: Search failed:', errorMessage);
                    this.showError('Ошибка поиска: ' + errorMessage);
                }
            },
            error: (xhr, status, error) => {
                //conlole.error('CarSearchUnified: AJAX search failed:', {
                //    status: status,
                //    error: error,
                //    statusCode: xhr.status,
                //    responseText: xhr.responseText ? xhr.responseText.substring(0, 200) : 'empty'
                //});

                var errorMsg = 'Ошибка соединения с сервером';
                if (xhr.status === 0) {
                    errorMsg = 'Нет соединения с сервером';
                } else if (xhr.status === 404) {
                    errorMsg = 'AJAX endpoint не найден (404)';
                } else if (xhr.status === 500) {
                    errorMsg = 'Внутренняя ошибка сервера (500)';
                } else if (xhr.status === 403) {
                    errorMsg = 'Доступ запрещен (403) - возможно проблема в nonce';
                } else if (status === 'timeout') {
                    errorMsg = 'Время ожидания истекло';
                } else if (status === 'parsererror') {
                    errorMsg = 'Ошибка парсинга ответа сервера';
                } else {
                    errorMsg += ' (HTTP ' + xhr.status + ')';
                }

                //conlole.error('CarSearchUnified: Final error message:', errorMsg);
                this.showError(errorMsg);
            },
            complete: () => {
                this.isLoading = false;
                $loading.hide();
                //console.log('CarSearchUnified: AJAX request completed');
            }
        });
    }

    // ===== ДИНАМИЧЕСКИЕ ФИЛЬТРЫ =====
    // Загрузка динамических фильтров через AJAX
    loadDynamicFilters() {
        // Защита от дублирования запросов
        if (this.isLoadingDynamicFilters) {
            console.log('CarSearchUnified: Dynamic filters already loading, skipping');
            return;
        }

        this.isLoadingDynamicFilters = true;
        console.log('CarSearchUnified: Loading dynamic filters for market:', this.currentMarket);

        // Собираем текущие фильтры
        var currentFilters = this.collectCurrentFilters();
        console.log('CarSearchUnified: Current filters for dynamic update:', currentFilters);

        $.ajax({
            url: this.ajaxUrl,
            type: 'POST',
            data: {
                action: 'car_auction_get_dynamic_filters',
                nonce: this.nonce,
                market: this.currentMarket,
                filters: currentFilters
            },
            timeout: 15000,
            dataType: 'json',
            success: (response) => {
                console.log('CarSearchUnified: Dynamic filters response:', response);
                if (response && response.success && response.data) {
                    this.updateDynamicFiltersUI(response.data);
                    console.log('CarSearchUnified: Dynamic filters updated successfully');
                } else {
                    var errorMsg = (response && response.data) ? response.data : 'Неизвестная ошибка';
                    console.warn('CarSearchUnified: Failed to load dynamic filters:', errorMsg);
                }
                this.isLoadingDynamicFilters = false;
            },
            error: (xhr, status, error) => {
                console.error('CarSearchUnified: AJAX error loading dynamic filters:', {
                    status: status,
                    error: error,
                    statusCode: xhr.status,
                    responseText: xhr.responseText ? xhr.responseText.substring(0, 100) : 'empty'
                });
                this.isLoadingDynamicFilters = false;
            }
        });
    }

    // Обновление UI элементов на основе динамических фильтров
    updateDynamicFiltersUI(data) {
        console.log('CarSearchUnified: Updating UI with dynamic filters data:', data);

        // Обновляем типы топливо
        if (data.fuel_types && data.table_support && data.table_support.has_fuel_filter) {
            this.updateFuelTypeFilter(data.fuel_types);
        } else {
            this.hideFuelTypeFilter();
        }

        // Обновляем типы трансмиссии
        if (data.transmissions && data.table_support && data.table_support.has_transmission_filter) {
            this.updateTransmissionFilter(data.transmissions);
        } else {
            this.hideTransmissionFilter();
        }

        // Обновляем типы привода
        if (data.drives && data.table_support && data.table_support.has_drive_filter) {
            this.updateDriveFilter(data.drives);
        } else {
            this.hideDriveFilter();
        }

        console.log('CarSearchUnified: UI update completed');
    }

    // Обновление фильтра типов топлива
    updateFuelTypeFilter(fuelTypes) {
        var $fuelFacet = $('.facetwp-facet-fuel_type');
        if ($fuelFacet.length === 0) {
            // Пробуем альтернативные селекторы для топливного фасета
            $fuelFacet = $('.facetwp-facet-fuel, .facetwp-facet[data-name="fuel_type"], .facetwp-facet[data-name="fuel"]');
            if ($fuelFacet.length === 0) {
                // console.log('CarSearchUnified: Fuel type facet not found');
                return;
            }
        }

        // Показываем фасет если он был скрыт
        $fuelFacet.show().css('opacity', '1');

        var $select = $fuelFacet.find('select');
        var $dropdownList = $fuelFacet.find('.facet-dropdown-list');
        var $trigger = $fuelFacet.find('.custom-select-trigger');

        // Обновляем скрытый селект
        var html = '<option value="">Любое топливо</option>';
        fuelTypes.forEach((fuel) => {
            if (fuel && fuel.trim() !== '') {
                html += '<option value="' + fuel + '">' + fuel + '</option>';
            }
        });
        $select.html(html);

        // Обновляем дропдаун список
        var dropdownHtml = '<div class="facet-dropdown-item selected" data-value="">Любое топливо</div>';
        fuelTypes.forEach((fuel) => {
            if (fuel && fuel.trim() !== '') {
                dropdownHtml += '<div class="facet-dropdown-item" data-value="' + fuel + '">' + fuel + '</div>';
            }
        });
        $dropdownList.html(dropdownHtml);

        // Сбрасываем выбор на "Любое топливо"
        $trigger.text('Любое топливо');

        console.log('CarSearchUnified: Updated fuel type filter with', fuelTypes.length, 'options');
    }

    // Обновление фильтра трансмиссии
    updateTransmissionFilter(transmissions) {
        var $transmissionFacet = $('.facetwp-facet-transmission');
        if ($transmissionFacet.length === 0) {
            // Пробуем альтернативные селекторы для трансмиссии
            $transmissionFacet = $('.facetwp-facet[data-name="transmission"]');
            if ($transmissionFacet.length === 0) {
                // console.log('CarSearchUnified: Transmission facet not found');
                return;
            }
        }

        // Показываем фасет если он был скрыт
        $transmissionFacet.show().css('opacity', '1');

        var $select = $transmissionFacet.find('select');
        var $dropdownList = $transmissionFacet.find('.facet-dropdown-list');
        var $trigger = $transmissionFacet.find('.custom-select-trigger');

        // Обновляем скрытый селект
        var html = '<option value="">Любая коробка</option>';

        // Обрабатываем трансмиссии в новом формате (объекты с name и count)
        if (typeof transmissions === 'object' && !Array.isArray(transmissions)) {
            Object.keys(transmissions).forEach((key) => {
                var transmission = transmissions[key];
                if (transmission) {
                    // Новый формат: {name: 'Автомат', count: 5}
                    if (transmission.name) {
                        // Показываем все опции, но можно добавить счетчик
                        var label = transmission.name;
                        if (transmission.count > 0) {
                            label += ' (' + transmission.count + ')';
                        }
                        html += '<option value="' + key + '">' + label + '</option>';
                    }
                    // Старый формат: массив строк
                    else if (Array.isArray(transmission)) {
                        transmission.forEach((item) => {
                            if (item && item.trim() !== '') {
                                html += '<option value="' + item + '">' + item + '</option>';
                            }
                        });
                    }
                    // Простая строка
                    else if (typeof transmission === 'string' && transmission.trim() !== '') {
                        html += '<option value="' + transmission + '">' + transmission + '</option>';
                    }
                }
            });
        } else if (Array.isArray(transmissions)) {
            // Обычный массив трансмиссий
            transmissions.forEach((transmission) => {
                if (transmission && transmission.trim() !== '') {
                    html += '<option value="' + transmission + '">' + transmission + '</option>';
                }
            });
        }
        $select.html(html);

        // Обновляем дропдаун список
        var dropdownHtml = '<div class="facet-dropdown-item selected" data-value="">Любая коробка</div>';
        if (typeof transmissions === 'object' && !Array.isArray(transmissions)) {
            Object.keys(transmissions).forEach((key) => {
                var transmission = transmissions[key];
                if (transmission) {
                    // Новый формат: {name: 'Автомат', count: 5}
                    if (transmission.name) {
                        var label = transmission.name;
                        var disabled = transmission.count === 0 ? ' disabled' : '';
                        if (transmission.count > 0) {
                            label += ' (' + transmission.count + ')';
                        } else {
                            label += ' (0)';
                        }
                        dropdownHtml += '<div class="facet-dropdown-item' + disabled + '" data-value="' + key + '">' + label + '</div>';
                    }
                    // Старый формат: массив строк
                    else if (Array.isArray(transmission)) {
                        transmission.forEach((item) => {
                            if (item && item.trim() !== '') {
                                dropdownHtml += '<div class="facet-dropdown-item" data-value="' + item + '">' + item + '</div>';
                            }
                        });
                    }
                    // Простая строка
                    else if (typeof transmission === 'string' && transmission.trim() !== '') {
                        dropdownHtml += '<div class="facet-dropdown-item" data-value="' + transmission + '">' + transmission + '</div>';
                    }
                }
            });
        } else if (Array.isArray(transmissions)) {
            transmissions.forEach((transmission) => {
                if (transmission && transmission.trim() !== '') {
                    dropdownHtml += '<div class="facet-dropdown-item" data-value="' + transmission + '">' + transmission + '</div>';
                }
            });
        }
        $dropdownList.html(dropdownHtml);

        // Сбрасываем выбор на "Любая коробка"
        $trigger.text('Любая коробка');

        var transmissionCount = 0;
        if (Array.isArray(transmissions)) {
            transmissionCount = transmissions.length;
        } else if (typeof transmissions === 'object' && transmissions !== null) {
            transmissionCount = Object.keys(transmissions).reduce((count, key) => {
                var transmission = transmissions[key];
                if (transmission) {
                    // Новый формат: считаем все опции (не только с count > 0)
                    if (transmission.name) {
                        return count + 1;
                    }
                    // Старый формат: массив
                    else if (Array.isArray(transmission)) {
                        return count + transmission.length;
                    }
                    // Простая строка
                    else if (typeof transmission === 'string' && transmission.trim() !== '') {
                        return count + 1;
                    }
                }
                return count;
            }, 0);
        }
        console.log('CarSearchUnified: Updated transmission filter with', transmissionCount, 'options');
    }

    // Обновление фильтра привода
    updateDriveFilter(drives) {
        var $driveFacet = $('.facetwp-facet-drive');
        if ($driveFacet.length === 0) {
            // Пробуем альтернативные селекторы для привода
            $driveFacet = $('.facetwp-facet[data-name="drive"]');
            if ($driveFacet.length === 0) {
                // console.log('CarSearchUnified: Drive facet not found');
                return;
            }
        }

        // Показываем фасет если он был скрыт
        $driveFacet.show().css('opacity', '1');

        var $select = $driveFacet.find('select');
        var $dropdownList = $driveFacet.find('.facet-dropdown-list');
        var $trigger = $driveFacet.find('.custom-select-trigger');

        // Обновляем скрытый селект
        var html = '<option value="">Любой привод</option>';

        // Обрабатываем приводы в новом формате (объекты с name и count)
        if (typeof drives === 'object' && !Array.isArray(drives)) {
            Object.keys(drives).forEach((key) => {
                var drive = drives[key];
                if (drive) {
                    // Новый формат: {name: 'Полный привод', count: 5}
                    if (drive.name) {
                        // Показываем все опции, но можно добавить счетчик
                        var label = drive.name;
                        if (drive.count > 0) {
                            label += ' (' + drive.count + ')';
                        }
                        html += '<option value="' + key + '">' + label + '</option>';
                    }
                    // Старый формат: массив строк
                    else if (Array.isArray(drive)) {
                        drive.forEach((item) => {
                            if (item && item.trim() !== '') {
                                html += '<option value="' + item + '">' + item + '</option>';
                            }
                        });
                    }
                    // Простая строка
                    else if (typeof drive === 'string' && drive.trim() !== '') {
                        html += '<option value="' + drive + '">' + drive + '</option>';
                    }
                }
            });
        } else if (Array.isArray(drives)) {
            // Обычный массив приводов
            drives.forEach((drive) => {
                if (drive && drive.trim() !== '') {
                    html += '<option value="' + drive + '">' + drive + '</option>';
                }
            });
        }
        $select.html(html);

        // Обновляем дропдаун список
        var dropdownHtml = '<div class="facet-dropdown-item selected" data-value="">Любой привод</div>';
        if (typeof drives === 'object' && !Array.isArray(drives)) {
            Object.keys(drives).forEach((key) => {
                var drive = drives[key];
                if (drive) {
                    // Новый формат: {name: 'Полный привод', count: 5}
                    if (drive.name) {
                        var label = drive.name;
                        var disabled = drive.count === 0 ? ' disabled' : '';
                        if (drive.count > 0) {
                            label += ' (' + drive.count + ')';
                        } else {
                            label += ' (0)';
                        }
                        dropdownHtml += '<div class="facet-dropdown-item' + disabled + '" data-value="' + key + '">' + label + '</div>';
                    }
                    // Старый формат: массив строк
                    else if (Array.isArray(drive)) {
                        drive.forEach((item) => {
                            if (item && item.trim() !== '') {
                                dropdownHtml += '<div class="facet-dropdown-item" data-value="' + item + '">' + item + '</div>';
                            }
                        });
                    }
                    // Простая строка
                    else if (typeof drive === 'string' && drive.trim() !== '') {
                        dropdownHtml += '<div class="facet-dropdown-item" data-value="' + drive + '">' + drive + '</div>';
                    }
                }
            });
        } else if (Array.isArray(drives)) {
            drives.forEach((drive) => {
                if (drive && drive.trim() !== '') {
                    dropdownHtml += '<div class="facet-dropdown-item" data-value="' + drive + '">' + drive + '</div>';
                }
            });
        }
        $dropdownList.html(dropdownHtml);

        // Сбрасываем выбор на "Любой привод"
        $trigger.text('Любой привод');

        var driveCount = 0;
        if (Array.isArray(drives)) {
            driveCount = drives.length;
        } else if (typeof drives === 'object' && drives !== null) {
            driveCount = Object.keys(drives).reduce((count, key) => {
                var drive = drives[key];
                if (drive) {
                    // Новый формат: считаем все опции (не только с count > 0)
                    if (drive.name) {
                        return count + 1;
                    }
                    // Старый формат: массив
                    else if (Array.isArray(drive)) {
                        return count + drive.length;
                    }
                    // Простая строка
                    else if (typeof drive === 'string' && drive.trim() !== '') {
                        return count + 1;
                    }
                }
                return count;
            }, 0);
        }
        console.log('CarSearchUnified: Updated drive filter with', driveCount, 'options');
    }

    // Скрытие фильтра типов топлива
    hideFuelTypeFilter() {
        var $fuelFacet = $('.facetwp-facet-fuel_type');
        if ($fuelFacet.length > 0) {
            $fuelFacet.hide();
            console.log('CarSearchUnified: Fuel type filter hidden (not supported for current market)');
        }
    }

    // Скрытие фильтра трансмиссии
    hideTransmissionFilter() {
        var $transmissionFacet = $('.facetwp-facet-transmission');
        if ($transmissionFacet.length > 0) {
            $transmissionFacet.hide();
            console.log('CarSearchUnified: Transmission filter hidden (not supported for current market)');
        }
    }

    // Скрытие фильтра привода
    hideDriveFilter() {
        var $driveFacet = $('.facetwp-facet-drive');
        if ($driveFacet.length > 0) {
            $driveFacet.hide();
            console.log('CarSearchUnified: Drive filter hidden (not supported for current market)');
        }
    }

    // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
    // УЛУЧШЕННАЯ синхронизация значений кастомных селектов в скрытые select перед отправкой формы
    syncCustomSelects() {
        var syncCount = 0;
        var errorCount = 0;

        $('.facetwp-facet').each(function() {
            var $facet = $(this);
            var $select = $facet.find('select');
            var facetName = $facet.attr('class').replace(/.*facetwp-facet-(\w+).*/, '$1') || 'unknown';

            if ($select.length === 0) {
                // Игнорируем отсутствующие фасеты без лишних логов
                // console.log('CarSearchUnified: Facet has no select:', facetName);
                return;
            }

            var currentValue = $select.val();
            var syncSuccessful = false;

            // ПРИОРИТЕТ 1: Используем selected item с data-value
            var $selectedItem = $facet.find('.facet-dropdown-item.selected').first();
            if ($selectedItem.length > 0) {
                var dv = $selectedItem.attr('data-value');
                var itemText = $selectedItem.text().trim();

                if (typeof dv !== 'undefined' && dv !== '') {
                    // Проверяем, что это не пустое значение по умолчанию
                    if (dv !== '' &&
                        itemText.toLowerCase() !== 'все модели' &&
                        itemText.toLowerCase() !== 'любая модель' &&
                        itemText.toLowerCase() !== 'любая марка' &&
                        itemText.toLowerCase() !== 'все марки') {

                        if ($select.val() !== dv) {
                            $select.val(dv);
                            console.log('CarSearchUnified: Synced', facetName, 'from selected item data-value:', dv);
                            syncSuccessful = true;
                            syncCount++;
                        }
                    }
                }
            }

            // ПРИОРИТЕТ 2: Если не нашли selected item, попробуем по триггеру
            if (!syncSuccessful) {
                var $trigger = $facet.find('.custom-select-trigger');
                if ($trigger.length > 0) {
                    var txt = $trigger.text().trim();
                    if (txt && txt !== '' &&
                        txt.toLowerCase() !== 'все модели' &&
                        txt.toLowerCase() !== 'любая модель' &&
                        txt.toLowerCase() !== 'любая марка' &&
                        txt.toLowerCase() !== 'все марки' &&
                        txt.toLowerCase() !== 'выберите модель' &&
                        txt.toLowerCase() !== 'выберите марку') {

                        var matched = null;
                        $select.find('option').each(function() {
                            var $opt = $(this);
                            var optText = $opt.text().trim();
                            var optValue = $opt.val();

                            // Проверяем точное совпадение текста или значения
                            if (optText.toLowerCase() === txt.toLowerCase() ||
                                optValue.toLowerCase() === txt.toLowerCase()) {
                                matched = optValue;
                                return false;
                            }
                        });

                        if (matched !== null && $select.val() !== matched) {
                            $select.val(matched);
                            console.log('CarSearchUnified: Synced', facetName, 'from trigger text:', txt, '->', matched);
                            syncSuccessful = true;
                            syncCount++;
                        }
                    }
                }
            }

            // ПРИОРИТЕТ 3: Проверяем, что текущее значение select валидно
            if (!syncSuccessful && currentValue && currentValue !== '') {
                var $currentOption = $select.find('option[value="' + currentValue + '"]');
                if ($currentOption.length === 0) {
                    // Текущее значение невалидно - сбрасываем
                    $select.val('');
                    console.warn('CarSearchUnified: Reset invalid value for', facetName, ':', currentValue);
                    errorCount++;
                }
            }
        });

        console.log('CarSearchUnified: Sync completed - synced:', syncCount, 'errors:', errorCount);
    }

    // Проверяет, действительно ли переданное значение присутствует в списка опций для фасета
    isValidFacetValue(fieldName, value) {
        if (!value) return null;

        // Нормализация входного значения - приводим к виду как в форме
        // var normalizeValue = function(s) {
        //     return (s || '').toString().trim().replace(/[-_]+/g, ' ').toUpperCase();
        // };
        
        // Замени функцию normalizeValue на эту:
        var normalizeValue = function(s, fieldName) {
            if (!s) return '';
            
            var str = s.toString().trim();
            // Для моделей Mercedes оставляем дефисы в названиях (E-CLASS, S-CLASS и т.д.)
            if (fieldName === 'model') {
                // Для других моделей заменяем дефисы/подчеркивания на пробелы
                return str.replace(/\s+/g, '_').toUpperCase();
            }
            
            // Для остальных полей стандартная нормализация
            return str.replace(/[-_]+/g, ' ').toUpperCase();
        };

        var targetNorm = normalizeValue(value, fieldName);

        var $facet = $('.facetwp-facet-' + fieldName);
        if ($facet.length === 0) {
            $facet = $('[name="' + fieldName + '"]').closest('.facetwp-facet');
        }
        if ($facet.length === 0) {
            // Если фасет не найден, для моделей возвращаем исходное значение
            // (они загружаются асинхронно после выбора марки)
            if (fieldName === 'model') {
                return value.toString().trim();
            }
            return null;
        }

        // Проверяем data-value атрибуты в dropdown элементах
        var found = null;
        $facet.find('.facet-dropdown-item').each(function() {
            var $item = $(this);
            var dv = $item.attr('data-value') || '';
            var txt = $item.text() || dv;

            // Сравниваем нормализованные значения
            if (normalizeValue(dv, fieldName) === targetNorm || normalizeValue(txt, fieldName) === targetNorm) {
                found = dv;
                return false; // break
            }
        });

        if (found !== null) return found;

        // Проверяем скрытый select как запасной вариант
        var $select = $facet.find('select');
        if ($select.length > 0) {
            var foundOpt = null;
            $select.find('option').each(function() {
                var $opt = $(this);
                var v = $opt.val() || '';
                var t = $opt.text() || v;

                if (normalizeValue(v, fieldName) === targetNorm || normalizeValue(t, fieldName) === targetNorm) {
                    foundOpt = v;
                    return false; // break
                }
            });
            if (foundOpt !== null) return foundOpt;
        }

        // Для моделей: если точного совпадения нет, но это похоже на валидное значение, возвращаем его
        if (fieldName === 'model' && targetNorm.length > 0 && /^[A-ZА-ЯЁ0-9\s]+$/.test(targetNorm)) {
            return targetNorm;
        }

        return null;
    }

    // Сбрасывает модель из URL параметров при смене марки
    clearModelFromUrl() {
        if (window.history && window.history.replaceState) {
            var currentUrl = new URL(window.location);
            var searchParams = currentUrl.searchParams;

            var hadModelParam = searchParams.has('_model');
            console.log('CarSearchUnified: Before clearing - URL has _model param:', hadModelParam);

            // Удаляем параметр модели из URL
            searchParams.delete('_model');

            var newUrl = currentUrl.pathname + (searchParams.toString() ? '?' + searchParams.toString() : '');
            window.history.replaceState({}, '', newUrl);
            console.log('CarSearchUnified: Model cleared from URL. Old URL:', window.location.href, 'New URL:', newUrl);
        } else {
            console.warn('CarSearchUnified: Browser does not support history.replaceState');
        }
    }

    // ИСПРАВЛЕНО: Очищает все фильтры из URL при полном сбросе
    clearAllFiltersFromUrl() {
        if (window.history && window.history.replaceState) {
            var currentUrl = new URL(window.location);
            var searchParams = currentUrl.searchParams;

            // Удаляем все параметры фильтров
            var filterParams = ['_brand','_model','year_from','year_to','price_from','price_to','mileage_from','mileage_to','fuel_type','transmission_group','transmission','drive','car_page'];
            filterParams.forEach(function(param) {
                searchParams.delete(param);
            });

            var newUrl = currentUrl.pathname + (searchParams.toString() ? '?' + searchParams.toString() : '');
            window.history.replaceState({}, '', newUrl);
            console.log('CarSearchUnified: All filters cleared from URL:', newUrl);
        }
    }

    // ИСПРАВЛЕНИЕ: Добавляем отдельный обработчик для изменения модели
    /*
    handleModelChange(e) {
        var modelValue = $(e.target).val();
        console.log('CarSearchUnified: Model changed to:', modelValue);

        // Если модель пустая или "Все модели" - очищаем немедленно
        if (!modelValue || modelValue === '') {
            console.log('CarSearchUnified: Empty model value - clearing from URL');
            this.clearModelFromUrl();
        } else {
            // Иначе обновляем URL с текущими фильтрами
            this.updateUrlWithCurrentFilters();
        }

        // Также перезагружаем динамические фильтры
        clearTimeout(this.filterChangeTimeout);
        this.filterChangeTimeout = setTimeout(() => {
            this.loadDynamicFilters();
        }, 300);
    }
    */
    
    // ===== ОБНОВЛЯЕМ handleModelChange ДЛЯ МГНОВЕННОГО ОБНОВЛЕНИЯ =====
    handleModelChange(e) {
        var modelValue = $(e.target).val();
        console.log('CarSearchUnified: Model changed to:', modelValue);
        
        // Если модель пустая или "Все модели" - очищаем немедленно
        if (!modelValue || modelValue === '') {
            console.log('CarSearchUnified: Empty model value - clearing from URL');
            this.clearModelFromUrl();
        } else {
            // Иначе обновляем URL с текущими фильтрами
            this.updateUrlWithCurrentFilters();
        }
        
        // НЕМЕДЛЕННО обновляем URL для модели
        this.updateUrlForSingleField('model', modelValue);
        
        // Также перезагружаем динамические фильтры
        clearTimeout(this.filterChangeTimeout);
        this.filterChangeTimeout = setTimeout(() => {
            this.loadDynamicFilters();
        }, 300);
    }

    // Обработчик изменения других фильтров
    handleFilterChange(e) {
        var filterName = $(e.target).attr('name');
        var filterValue = $(e.target).val();

        console.log('CarSearchUnified: Filter changed:', filterName, '=', filterValue);

        // Небольшая задержка для группировка быстрых изменений
        clearTimeout(this.filterChangeTimeout);
        this.filterChangeTimeout = setTimeout(() => {
            this.loadDynamicFilters();
        }, 300);
    }

    // Сбрасывает выбранную модель в селектах
    resetModelSelection() {
        // Сбрасываем скрытый селект модели
        var $modelSelect = $('select[name="model"]');
        if ($modelSelect.length > 0) {
            $modelSelect.val('');
        }

        // Сбрасываем кастомный селект модели
        var $modelFacet = $('.facetwp-facet-model');
        if ($modelFacet.length > 0) {
            // Сбрасываем выбранный элемент
            $modelFacet.find('.facet-dropdown-item').removeClass('selected');
            $modelFacet.find('.facet-dropdown-item').first().addClass('selected');

            // Сбрасываем текст триггера
            var $trigger = $modelFacet.find('.custom-select-trigger');
            $trigger.text('Все модели');
        }

        // ИСПРАВЛЕНО: Обновляем URL при сбросе модели
        this.updateUrlWithCurrentFilters();

        console.log('CarSearchUnified: Model selection reset and URL updated');
    }

    // ИСПРАВЛЕНИЕ: Метод для быстрого обновления URL с текущими фильтрами
    updateUrlWithCurrentFilters() {
        try {
            this.syncCustomSelects();
            var currentFilters = this.collectCurrentFilters();
            console.log('CarSearchUnified: updateUrlWithCurrentFilters - collected filters:', currentFilters);
            this.updateUrlWithFilters(this.currentPage, currentFilters);
        } catch (e) {
            console.warn('CarSearchUnified: Failed to update URL with current filters:', e);
        }
    }

    showEmptyResults(market) {
        var message = (market === 'bike') ? 'Мотоцикл не найден' : 'Автомобиль не найден';
        var icon = (market === 'bike') ? '🏍️' : '🚗';
        var emptyHtml = '<div class="car-auction-empty" style="background: #f8f9fa; border: 2px solid #e9ecef; color: #495057; padding: 40px 20px; margin: 20px 0; border-radius: 12px; text-align: center; font-size: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">' +
            '<div style="font-size: 64px; color: #adb5bd; margin-bottom: 20px;">' + icon + '</div>' +
            '<h3 style="color: #495057; margin: 0 0 15px 0; font-size: 24px;">' + message + '</h3>' +
            '<div style="font-size: 16px; color: #6c757d; line-height: 1.5;">Попробуйте изменить параметры поиска<br>или выберите другие критерии</div>' +
            '</div>';
        $('.posts-list .car-auction-results-content').html(emptyHtml);
        //console.log('CarSearchUnified: Empty results displayed for market:', market);
    }

    showError(message) {
        var errorHtml = '<div class="car-auction-error" style="background: #ffebee; border: 1px solid #f44336; color: #c62828; padding: 15px; margin: 10px 0; border-radius: 4px;">' +
            '<strong>Ошибка:</strong> ' + message + '</div>';
        $('.posts-list .car-auction-results-content').html(errorHtml).show();
        //conlole.error('CarSearchUnified:', message);
    }

    // ===== ПРАВИЛЬНАЯ ПАГИНАЦИЯ =====
    updatePagination(results) {
        // Используем более специфичный селектор для избежания конфликтоф
        var $paginationContainer = $('.posts-list .car-auction-pagination').first();

        console.log('CarSearchUnified: Found', $('.posts-list .car-auction-pagination').length, 'pagination containers, using first one');

        // Защита от дублирования - проверяем, если пагинация уже создается
        if (this.isUpdatingPagination) {
            //console.log('CarSearchUnified: Pagination update already in progress, skipping');
            return;
        }
        this.isUpdatingPagination = true;

        // Очистить только контейнер пагинации, который используем, чтобы не ломать другие блоки
        $paginationContainer.empty();

        // Вычисляем total/total_pages с запасными вариантами
        var total = 0;
        if (results) {
            if (typeof results.total !== 'undefined') {
                total = parseInt(results.total) || 0;
            } else if (results.pagination && typeof results.pagination.total !== 'undefined') {
                total = parseInt(results.pagination.total) || 0;
            }
        }

        var per_page = results && results.per_page ? parseInt(results.per_page) : 20;
        var total_pages = results && results.total_pages ? parseInt(results.total_pages) : (per_page > 0 ? Math.ceil(total / per_page) : 1);
        var current_page = results && results.page ? parseInt(results.page) : this.currentPage;

        if (!results || total_pages <= 1) {
            // Нет пагинации если страниц мало
            this.isUpdatingPagination = false;
            return;
        }

        // Обновляем внутреннее состояние
        this.currentPage = current_page;
        this.hasMoreResults = current_page < total_pages;

        //console.log('CarSearchUnified: Creating pagination for page', current_page, 'of', total_pages);

        // Создаем HTML пагинации
        var paginationHtml = this.createPaginationHTML({
            total: total,
            total_pages: total_pages,
            current_page: current_page,
            per_page: per_page
        });

        // Оставляем в правильное место
        $paginationContainer.html(paginationHtml);

        // Освобождаем флаг
        this.isUpdatingPagination = false;
    }

    createPaginationHTML(data) {
        var { total_pages, current_page, total, per_page } = data;

        var html = '';

        // Кнопка "Показать еще" временно скрыта
        html += '<div class="load-more-wrapper" style="display: none;">';
        html += '<button type="button" class="button-red long m-100 h-60 w-button car-auction-search-btn load-more-btn" disabled>';
        html += 'Показать еще';
        html += '</button>';
        html += '</div>';

        // ИСПРАВЛЕННАЯ логика номеров страниц - ограничиваем максимум 5 кнопок подряд
        var startPage, endPage;
        var maxButtons = 5; // Жёсткое ограничение количества основных кнопок

        // Принудительное приведение к числам
        total_pages = parseInt(total_pages) || 1;
        current_page = parseInt(current_page) || 1;
        current_page = Math.max(1, Math.min(total_pages, current_page));

        if (total_pages <= maxButtons) {
            // Если страниц мало, показываем все
            startPage = 1;
            endPage = total_pages;
        } else {
            // Вычисляем диапазон кнопок вокруг текущей страницы
            var half = Math.floor(maxButtons / 2);
            startPage = Math.max(1, current_page - half);
            endPage = Math.min(total_pages, startPage + maxButtons - 1);

            // Корректируем начало если диапазон короткий
            if (endPage - startPage + 1 < maxButtons) {
                startPage = Math.max(1, endPage - maxButtons + 1);
            }
        }

        //console.log('CarSearchUnified: Pagination logic - total_pages:', total_pages, 'current_page:', current_page, 'startPage:', startPage, 'endPage:', endPage);

        // Первая страница и многоточие
        if (startPage > 1) {
            html += this.createPageButton(1, current_page);
            //console.log('CarSearchUnified: Added first page button');
            if (startPage > 2) {
                html += '<span class="ellipsis">...</span>';
                //console.log('CarSearchUnified: Added first ellipsis');
            }
        }

        // Основные номера страниц с защитой от переполнения
        var buttonsCount = 0;
        var maxMainButtons = 5; // Жёсткий лимит основных кнопок
        for (var i = startPage; i <= endPage && buttonsCount < maxMainButtons; i++) {
            html += this.createPageButton(i, current_page);
            buttonsCount++;
        }
        //console.log('CarSearchUnified: Added', buttonsCount, 'main page buttons from', startPage, 'to', Math.min(endPage, startPage + maxMainButtons - 1));

        // Многоточие и последняя страница
        if (endPage < total_pages) {
            if (endPage < total_pages - 1) {
                html += '<span class="ellipsis">...</span>';
            }
            html += this.createPageButton(total_pages, current_page);
        }

        // Навигация вперед
        if (current_page < total_pages) {
            html += '<button type="button" class="page-btn next" data-page="' + (current_page + 1) + '">';
            html += '&gt;';
            html += '</button>';
            //console.log('CarSearchUnified: Added next button');
        }

        // Проверяем финальный HTML и контролируем количество кнопок
        var buttonCount = (html.match(/page-btn/g) || []).length;
        //console.log('CarSearchUnified: Final pagination HTML contains', buttonCount, 'buttons');
        //console.log('CarSearchUnified: HTML length:', html.length, 'characters');

        // Критическая проверка - если кнопок слишком много, выводим предупреждение
        if (buttonCount > 10) {
            //conlole.error('CarSearchUnified: КРИТИЧЕСКАЯ ОШИБКА - Слишком много кнопок пагинации:', buttonCount);
            //conlole.error('CarSearchUnified: Параметры - total_pages:', total_pages, 'current_page:', current_page, 'startPage:', startPage, 'endPage:', endPage);
        }

        return html;
    }

    createPageButton(page, current_page) {
        var isActive = (page == current_page);
        var activeClass = isActive ? ' active' : '';

        var html = '<button type="button" class="page-btn' + activeClass + '" data-page="' + page + '">';
        html += page;
        html += '</button>';

        return html;
    }

    // Инициализация пагинации из параметров страницы (без auto_search)
    initializePaginationFromPage() {
        //console.log('CarSearchUnified: Initializing pagination from page parameters');

        // Получаем номер страницы из URL
        var urlParams = new URLSearchParams(window.location.search);
        var pageFromUrl = parseInt(urlParams.get('car_page')) || 1;

        // Пытаемся определить общее количество страниц из контента
        var $autoResults = $('.car-auction-auto-results');
        if ($autoResults.length > 0) {
            // Получаем данные пагинации через AJAX для корректного отображения
            this.loadInitialPaginationData();
        }
    }

    // Новая функция для загрузки предзагруженных результатов через AJAX
    loadAutoResultsPage(page) {
        if (this.isLoading) {
            //console.log('CarSearchUnified: Auto-results loading already in progress');
            return;
        }

        this.isLoading = true;
        //console.log('CarSearchUnified: Loading auto-results for page', page);

        var $loading = $('.posts-list .car-auction-loading');
        var $autoResults = $('.car-auction-auto-results');
        var $resultsContent = $('.posts-list .car-auction-results-content');

        // Показываем индикатор загрузки
        $loading.show();
        $autoResults.hide();
        $resultsContent.empty();

        // Собираем текущие фильтры для предзагруженных результатов
        var filters = this.collectAutoResultsFilters();
        filters.page = page;

        //console.log('CarSearchUnified: Auto-results filters:', filters);

        // Делаем AJAX запрос для загрузки предзагруженных результатов
        $.ajax({
            url: this.ajaxUrl,
            type: 'POST',
            data: {
                action: 'car_auction_load_auto_results',
                nonce: this.nonce,
                market: this.currentMarket,
                filters: filters
            },
            timeout: 30000,
            dataType: 'json',
            success: (response) => {
                //console.log('CarSearchUnified: Auto-results loaded:', response);

                if (response && response.success && response.data) {
                    var results = response.data;

                    if (results.html) {
                        // Покызываем результаты в auto-results контейнере
                        $autoResults.html(results.html).show();

                        // Обновляем пагинацию
                        this.updatePagination(results);

                        // Обновляем URL без перезагрузки страницы с текущими фильтрами
                        this.updateUrlWithFilters(page, filters);

                        // Обрабатываем 4WD значения в новых карточках
                        this.processNewResults();

                        //console.log('CarSearchUnified: Auto-results page', page, 'loaded successfully');
                    } else {
                        this.showError('Нет данных для отображения');
                    }
                } else {
                    var errorMsg = (response && response.data) ? response.data : 'Ошибка загрузки';
                    this.showError('Ошибка загрузки страницы: ' + errorMsg);
                }
            },
            error: (xhr, status, error) => {
                //conlole.error('CarSearchUnified: Auto-results loading failed:', {
                //    status: status,
                //    error: error,
                //    statusCode: xhr.status,
                //    responseText: xhr.responseText ? xhr.responseText.substring(0, 200) : 'empty'
                //});

                var errorMsg = 'Ошибка соединения с сервером';
                if (xhr.status === 0) {
                    errorMsg = 'Нет соединения с сервером';
                } else if (xhr.status === 404) {
                    errorMsg = 'Функция загрузки не найдена (404)';
                } else if (xhr.status === 500) {
                    errorMsg = 'Внутренняя ошибка сервера (500)';
                } else if (status === 'timeout') {
                    errorMsg = 'Время ожидания истекло';
                }

                this.showError(errorMsg);
            },
            complete: () => {
                this.isLoading = false;
                $loading.hide();
                //console.log('CarSearchUnified: Auto-results request completed');
            }
        });
    }

    // Собираем фильтры для предзагруженных результатов
    collectAutoResultsFilters() {
        var filters = {};

        // Синхронизируем кастомные селекты в скрытые поля перед сбором
        try { this.syncCustomSelects(); } catch (e) {}

        // ПРИОРИТЕТ: Фильтры из формы
        var $form = $('.car-auction-search-form').first();
        if ($form.length === 0) {
            $form = $('form[data-market]').first();
        }
        if ($form.length === 0) {
            $form = $('#wf-form-filter');
        }

        if ($form.length > 0) {
            $form.find('input, select').each(function() {
                var $input = $(this);
                var name = $input.attr('name');
                var value = $input.val();

                if (name && value !== '') {
                    filters[name] = value;
                    //console.log('CarSearchUnified: Auto-results from form:', name, '=', value);
                }
            });
        }

        // РЕЗЕРВ: Фильтры из URL (только если поле формы пустое)
        var urlParams = new URLSearchParams(window.location.search);

        var urlToFormMapping = {
            '_brand': 'vendor',
            '_model': 'model',
            'year_from': 'year_from',
            'year_to': 'year_to',
            'price_from': 'price_from',
            'price_to': 'price_to',
            'mileage_from': 'mileage_from',
            'mileage_to': 'mileage_to',
            'fuel_type': 'fuel_type',
            'transmission': 'transmission',
            'drive': 'drive'
        };

        for (var urlParam in urlToFormMapping) {
            var formField = urlToFormMapping[urlParam];

            // Используем URL параметр только если поле формы пустое
            if (urlParams.has(urlParam) && !filters.hasOwnProperty(formField)) {
                filters[formField] = urlParams.get(urlParam);
                //console.log('CarSearchUnified: Auto-results from URL fallback:', formField, '=', filters[formField]);
            }
        }


        // Определяем страну из URL или контекста
        var path = window.location.pathname;
        if (path.includes('/korea/')) {
            filters['country'] = 'korea';
        } else if (path.includes('/china/')) {
            filters['country'] = 'china';
        } else if (path.includes('/japan/')) {
            filters['country'] = 'japan';
        } else if (path.includes('/bike/')) {
            filters['country'] = 'bike';
        } else if (path.includes('/che_available/')) {
            filters['country'] = 'che_available';
        }

        // Базовые параметры для предзагруженных результатов
        filters['load_type'] = 'auto_results';

        //console.log('CarSearchUnified: Collected auto-results filters:', filters);
        return filters;
    }

    // Обновляем URL без перезагрузки страницы
    updateUrlWithoutReload(page) {
        if (window.history && window.history.pushState) {
            var currentUrl = new URL(window.location);
            if (page > 1) {
                currentUrl.searchParams.set('car_page', page);
            } else {
                currentUrl.searchParams.delete('car_page');
            }

            var newUrl = currentUrl.toString();
            if (newUrl !== window.location.href) {
                window.history.pushState({ page: page }, '', newUrl);
                //console.log('CarSearchUnified: URL updated to:', newUrl);
            }
        }
    }

    // Обновить URL параметрами фильтров без перезагрузки (для копирования ссылки)
    
    updateUrlWithFilters(page, providedFilters) {
        if (!(window.history && window.history.pushState)) return;

        var filters = providedFilters || null;

        try {
            // Если фильтры не переданы, синхронизируем кастомные селекты и соберём их
            if (!filters) {
                try { this.syncCustomSelects(); } catch (e) {}
                filters = this.collectCurrentFilters() || {};
            }
        } catch (e) {
            filters = filters || {};
        }

        var currentUrl = new URL(window.location);
        var searchParams = currentUrl.searchParams;

        // Remove existing filter params we manage
        var removeKeys = ['_brand','_model','year_from','year_to','price_from','price_to','mileage_from','mileage_to','fuel_type','transmission_group','transmission','drive','car_page'];
        removeKeys.forEach(function(k){ searchParams.delete(k); });

        // Map filters to URL params
        if (filters.vendor) {
            searchParams.set('_brand', filters.vendor.toString().toLowerCase());
        }

        // ИСПРАВЛЕНО: Правильная обработка модели для URL
        if (filters.model) {
            var modelValue = filters.model.toString().trim();
            // Проверяем, что это не пустое значение и не "все модели"
            if (modelValue !== '' &&
                modelValue.toLowerCase() !== 'все модели' &&
                modelValue.toLowerCase() !== 'любая модель' &&
                modelValue.toLowerCase() !== 'all models' &&
                modelValue.toLowerCase() !== 'выберите модель') {
                // Кодируем пробелы в %20
                var urlModel = encodeURIComponent(modelValue);
                if (urlModel.length > 0) {
                    searchParams.set('_model', urlModel);
                    console.log('CarSearchUnified: Adding model to URL:', modelValue, '->', urlModel);
                }
            }
        } else {
            // Если фильтр модели отсутствует - также удаляем параметр из URL
            console.log('CarSearchUnified: Removing model from URL (no model filter)');
            searchParams.delete('_model');
        }

        // Other numeric/text filters: keep as-is
        var otherKeys = ['year_from','year_to','price_from','price_to','mileage_from','mileage_to','fuel_type','transmission_group','transmission','drive'];
        otherKeys.forEach(function(k){
            if (filters[k]) {
                searchParams.set(k, filters[k]);
            }
        });

        // Page
        if (page && page > 1) {
            searchParams.set('car_page', page);
        }

        var newUrl = currentUrl.pathname + '?' + searchParams.toString();
        if (newUrl !== window.location.pathname + window.location.search) {
            window.history.replaceState({ filters: true }, '', newUrl);
            console.log('CarSearchUnified: URL with filters updated:', newUrl);
        }
    }

    // Предзаполнение формы значениями из URL параметров
    /*
    prefillFormFromUrl() {
        //console.log('CarSearchUnified: Prefilling form from URL parameters');

        var urlParams = new URLSearchParams(window.location.search);
        var $form = $('.car-auction-search-form').first();
        if ($form.length === 0) {
            $form = $('form[data-market]').first();
        }
        if ($form.length === 0) {
            $form = $('#wf-form-filter');
        }

        if ($form.length === 0) {
            //conlole.warn('CarSearchUnified: Form not found for prefilling');
            return;
        }

        // Предзаполняем обычные поля
        var paramMapping = {
            '_brand': 'vendor',
            '_model': 'model',
            'year_from': 'year_from',
            'year_to': 'year_to',
            'price_from': 'price_from',
            'price_to': 'price_to',
            'mileage_from': 'mileage_from',
            'mileage_to': 'mileage_to',
            'fuel_type': 'fuel_type',
            'transmission': 'transmission',
            'drive': 'drive'
        };

        for (var urlParam in paramMapping) {
            if (urlParams.has(urlParam)) {
                var fieldName = paramMapping[urlParam];
                var value = urlParams.get(urlParam);

                var $field = $form.find('[name="' + fieldName + '"]');
                if ($field.length > 0 && !$field.val()) {
                    // Заполняем только если поле пустое
                    $field.val(value);
                    //console.log('CarSearchUnified: Set empty field', fieldName, 'to', value);
                } else if ($field.length > 0 && $field.val()) {
                    //console.log('CarSearchUnified: Field', fieldName, 'already has value:', $field.val(), '- skipping URL value:', value);
                }
            }
        }

        // Специальная обработка для кастомных селектов (vendor/brand)
        if (urlParams.has('_brand')) {
            var $vendorSelect = $form.find('[name="vendor"]');
            var brandValue = urlParams.get('_brand');

            // Заполняем только если поле пустое
            if ($vendorSelect.length > 0 && !$vendorSelect.val()) {
                // Validate that brand exists in options
                var matchedBrand = this.isValidFacetValue('vendor', brandValue);
                if (matchedBrand) {
                    this.updateCustomSelect('vendor', matchedBrand, 'Марка');

                    // Загружаем модели для выбранного бренда
                    setTimeout(() => {
                        if ($vendorSelect.length > 0) {
                            $vendorSelect.trigger('change');
                        }
                    }, 100);

                    //console.log('CarSearchUnified: Set empty custom select vendor to:', matchedBrand);
                } else {
                    //console.warn('CarSearchUnified: URL brand not found in options, skipping:', brandValue);
                }
            } else if ($vendorSelect.length > 0 && $vendorSelect.val()) {
                //console.log('CarSearchUnified: Vendor field already has value:', $vendorSelect.val(), '- skipping URL brand:', brandValue);
            }
        }

        // Предзаполняем модель если есть
        if (urlParams.has('_model')) {
            var $modelSelect = $form.find('[name="model"]');
            var modelValue = urlParams.get('_model');

            // Функция попытки установки модели с ретраями (если модели загружаются асинхронно)
            var attemptSetModel = (retriesLeft) => {
                var $ms = $form.find('[name="model"]');
                if ($ms.length > 0) {
                    var currentVal = $ms.val();
                    var optionsLoaded = $ms.find('option').length > 1;

                    if (!currentVal || currentVal === '') {
                        if (optionsLoaded) {
                            // Опции загружены — валидируем значение
                            var matched = this.isValidFacetValue('model', modelValue);
                            if (matched) {
                                this.updateCustomSelect('model', matched, 'Модель');
                                this.pendingModelValue = null;
                                return;
                            } else {
                                if (retriesLeft <= 0) {
                                    this.pendingModelValue = null;
                                    return;
                                }
                            }
                        } else {
                            // Опции не загружены — пробуем установить временно
                            this.updateCustomSelect('model', modelValue, 'Модель');
                            if (($ms.val() && $ms.val().toString().toLowerCase() === modelValue.toString().toLowerCase()) || retriesLeft <= 0) {
                                this.pendingModelValue = null;
                                return;
                            }
                        }
                    } else {
                        // Поле уже заполнено — ничего не делаем
                        this.pendingModelValue = null;
                        return;
                    }
                } else {
                    // Если селекта нет — ничего не делаем
                    this.pendingModelValue = null;
                    return;
                }

                // Ретрай
                if (retriesLeft > 0) {
                    setTimeout(function() { attemptSetModel(retriesLeft - 1); }, 400);
                }
            };

            // Сохраняем желаемое значение модели и начнём попытки применения
            this.pendingModelValue = modelValue;
            this.pendingModelRetries = 6;
            attemptSetModel(6); // попытаемся до ~2.4s в сумме
        }

        //console.log('CarSearchUnified: Form prefilling completed');
    }
    
    */
    
    // ===== ИСПРАВЛЕННЫЙ МЕТОД ПРЕДЗАПОЛНЕНИЯ ФОРМЫ =====
    /*
    prefillFormFromUrl() {
        console.log('CarSearchUnified: Prefilling form from URL parameters');
        var urlParams = new URLSearchParams(window.location.search);
        var $form = $('.car-auction-search-form').first();
        if ($form.length === 0) {
            $form = $('form[data-market]').first();
        }
        if ($form.length === 0) {
            $form = $('#wf-form-filter');
        }
        if ($form.length === 0) {
            console.warn('CarSearchUnified: Form not found for prefilling');
            return;
        }
    
        // Предзаполняем обычные поля
        var paramMapping = {
            '_brand': 'vendor',
            '_model': 'model',
            'year_from': 'year_from',
            'year_to': 'year_to',
            'price_from': 'price_from',
            'price_to': 'price_to',
            'mileage_from': 'mileage_from',
            'mileage_to': 'mileage_to',
            'fuel_type': 'fuel_type',
            'transmission': 'transmission',
            'drive': 'drive'
        };
    
        for (var urlParam in paramMapping) {
            if (urlParams.has(urlParam)) {
                var fieldName = paramMapping[urlParam];
                var value = urlParams.get(urlParam);
                var $field = $form.find('[name="' + fieldName + '"]');
                
                if ($field.length > 0 && !$field.val()) {
                    // Заполняем только если поле пустое
                    $field.val(value);
                    console.log('CarSearchUnified: Set empty field', fieldName, 'to', value);
                } else if ($field.length > 0 && $field.val()) {
                    console.log('CarSearchUnified: Field', fieldName, 'already has value:', $field.val(), '- skipping URL value:', value);
                }
            }
        }
    
        // Специальная обработка для кастомных селектов (vendor/brand)
        if (urlParams.has('_brand')) {
            var $vendorSelect = $form.find('[name="vendor"]');
            var brandValue = urlParams.get('_brand');
            
            // Заполняем только если поле пустое
            if ($vendorSelect.length > 0 && !$vendorSelect.val()) {
                // Validate that brand exists in options
                var matchedBrand = this.isValidFacetValue('vendor', brandValue);
                if (matchedBrand) {
                    this.updateCustomSelect('vendor', matchedBrand, 'Марка');
                    console.log('CarSearchUnified: Set empty custom select vendor to:', matchedBrand);
                } else {
                    console.warn('CarSearchUnified: URL brand not found in options, skipping:', brandValue);
                }
            } else if ($vendorSelect.length > 0 && $vendorSelect.val()) {
                console.log('CarSearchUnified: Vendor field already has value:', $vendorSelect.val(), '- skipping URL brand:', brandValue);
            }
        }
    
        // ИСПРАВЛЕНИЕ: Правильное предзаполнение модели
        if (urlParams.has('_model')) {
            var $modelSelect = $form.find('[name="model"]');
            var modelValue = urlParams.get('_model');
            
            console.log('CarSearchUnified: Processing model from URL:', modelValue);
            
            // Декодируем URL-encoded значение
            var decodedModel = decodeURIComponent(modelValue);
            console.log('CarSearchUnified: Decoded model:', decodedModel);
            
            // Проверяем, есть ли уже значение в селекте
            if ($modelSelect.length > 0) {
                var currentVal = $modelSelect.val();
                var optionsLoaded = $modelSelect.find('option').length > 1;
                
                console.log('CarSearchUnified: Model select state - current value:', currentVal, 'options loaded:', optionsLoaded);
                
                // Если селект пустой и опции загружены - пытаемся установить значение
                if ((!currentVal || currentVal === '') && optionsLoaded) {
                    var matchedModel = this.isValidFacetValue('model', decodedModel);
                    if (matchedModel) {
                        console.log('CarSearchUnified: Setting model to matched value:', matchedModel);
                        this.updateCustomSelect('model', matchedModel, 'Модель');
                        this.pendingModelValue = null;
                    } else {
                        console.warn('CarSearchUnified: Model not found in options:', decodedModel);
                        // Добавляем опцию если не найдено
                        this.addModelOption(decodedModel);
                    }
                } else if (!optionsLoaded) {
                    // Опции еще не загружены - сохраняем для применения после загрузки
                    console.log('CarSearchUnified: Model options not loaded yet, saving for later:', decodedModel);
                    this.pendingModelValue = decodedModel;
                    this.pendingModelRetries = 10; // Увеличиваем количество попыток
                }
            }
        }
        
        console.log('CarSearchUnified: Form prefilling completed');
    }
    */
    
    // ===== ОБНОВЛЯЕМ МЕТОД ПРЕДЗАПОЛНЕНИЯ ФОРМЫ =====
    prefillFormFromUrl() {
        console.log('CarSearchUnified: Prefilling form from URL parameters');
        var urlParams = new URLSearchParams(window.location.search);
        var $form = $('.car-auction-search-form').first();
        if ($form.length === 0) {
            $form = $('form[data-market]').first();
        }
        if ($form.length === 0) {
            $form = $('#wf-form-filter');
        }
        if ($form.length === 0) {
            console.warn('CarSearchUnified: Form not found for prefilling');
            return;
        }
    
        // Предзаполняем обычные поля
        var paramMapping = {
            '_brand': 'vendor',
            '_model': 'model',
            'year_from': 'year_from',
            'year_to': 'year_to',
            'price_from': 'price_from',
            'price_to': 'price_to',
            'mileage_from': 'mileage_from',
            'mileage_to': 'mileage_to',
            'fuel_type': 'fuel_type',
            'transmission': 'transmission',
            'drive': 'drive'
        };
    
        for (var urlParam in paramMapping) {
            if (urlParams.has(urlParam)) {
                var fieldName = paramMapping[urlParam];
                var value = urlParams.get(urlParam);
                var $field = $form.find('[name="' + fieldName + '"]');
                
                if ($field.length > 0 && !$field.val()) {
                    // Заполняем только если поле пустое
                    $field.val(value);
                    console.log('CarSearchUnified: Set empty field', fieldName, 'to', value);
                } else if ($field.length > 0 && $field.val()) {
                    console.log('CarSearchUnified: Field', fieldName, 'already has value:', $field.val(), '- skipping URL value:', value);
                }
            }
        }
    
        // Специальная обработка для кастомных селектов (vendor/brand)
        if (urlParams.has('_brand')) {
            var $vendorSelect = $form.find('[name="vendor"]');
            var brandValue = urlParams.get('_brand');
            
            // Заполняем только если поле пустое
            if ($vendorSelect.length > 0 && !$vendorSelect.val()) {
                // Validate that brand exists in options
                var matchedBrand = this.isValidFacetValue('vendor', brandValue);
                if (matchedBrand) {
                    this.updateCustomSelect('vendor', matchedBrand, 'Марка');
                    console.log('CarSearchUnified: Set empty custom select vendor to:', matchedBrand);
                } else {
                    console.warn('CarSearchUnified: URL brand not found in options, skipping:', brandValue);
                }
            } else if ($vendorSelect.length > 0 && $vendorSelect.val()) {
                console.log('CarSearchUnified: Vendor field already has value:', $vendorSelect.val(), '- skipping URL brand:', brandValue);
            }
        }
    
        // ИСПРАВЛЕНИЕ: Правильное предзаполнение модели
        if (urlParams.has('_model')) {
            var $modelSelect = $form.find('[name="model"]');
            var modelValue = urlParams.get('_model');
            
            console.log('CarSearchUnified: Processing model from URL:', modelValue);
            
            // Декодируем URL-encoded значение
            var decodedModel = decodeURIComponent(modelValue);
            console.log('CarSearchUnified: Decoded model:', decodedModel);
            
            // Проверяем, есть ли уже значение в селекте
            if ($modelSelect.length > 0) {
                var currentVal = $modelSelect.val();
                var optionsLoaded = $modelSelect.find('option').length > 1;
                
                console.log('CarSearchUnified: Model select state - current value:', currentVal, 'options loaded:', optionsLoaded);
                
                // Если селект пустой и опции загружены - пытаемся установить значение
                if ((!currentVal || currentVal === '') && optionsLoaded) {
                    var matchedModel = this.isValidFacetValue('model', decodedModel);
                    if (matchedModel) {
                        console.log('CarSearchUnified: Setting model to matched value:', matchedModel);
                        this.updateCustomSelect('model', matchedModel, 'Модель');
                        this.pendingModelValue = null;
                        
                        // ИСПРАВЛЕНИЕ: Немедленно обновляем URL с правильным значением
                        this.updateUrlForSingleField('model', matchedModel);
                    } else {
                        console.warn('CarSearchUnified: Model not found in options:', decodedModel);
                        // Добавляем опцию если не найдено
                        this.addModelOption(decodedModel);
                    }
                } else if (!optionsLoaded) {
                    // Опции еще не загружены - сохраняем для применения после загрузки
                    console.log('CarSearchUnified: Model options not loaded yet, saving for later:', decodedModel);
                    this.pendingModelValue = decodedModel;
                    this.pendingModelRetries = 10; // Увеличиваем количество попыток
                }
            }
        }
        
        console.log('CarSearchUnified: Form prefilling completed');
    }
    
    // ===== НОВЫЙ МЕТОД ДОБАВЛЕНИЯ ОПЦИИ МОДЕЛИ =====
    addModelOption(modelValue) {
        console.log('CarSearchUnified: Adding model option:', modelValue);
        
        var $modelSelect = $('select[name="model"]');
        var $modelFacet = $('.facetwp-facet-model');
        
        if ($modelSelect.length > 0) {
            // Проверяем, нет ли уже такой опции
            var exists = false;
            $modelSelect.find('option').each(function() {
                if ($(this).val().toLowerCase() === modelValue.toLowerCase()) {
                    exists = true;
                    return false;
                }
            });
            
            if (!exists) {
                // Добавляем опцию в селект
                var $newOption = $('<option>').val(modelValue).text(modelValue);
                $modelSelect.append($newOption);
                $modelSelect.val(modelValue);
                console.log('CarSearchUnified: Added model option to select:', modelValue);
            }
        }
        
        if ($modelFacet.length > 0) {
            // Добавляем опцию в кастомный селект
            var $dropdownList = $modelFacet.find('.facet-dropdown-list');
            var $selectedItem = $modelFacet.find('.facet-dropdown-item.selected');
            
            // Создаем новую опцию
            var $newItem = $('<div class="facet-dropdown-item" data-value="' + modelValue + '">' + modelValue + '</div>');
            
            // Вставляем перед "Все модели"
            $selectedItem.after($newItem);
            
            // Устанавливаем как выбранную
            $modelFacet.find('.facet-dropdown-item').removeClass('selected');
            $newItem.addClass('selected');
            
            // Обновляем триггер
            var $trigger = $modelFacet.find('.custom-select-trigger');
            $trigger.text(modelValue);
            
            console.log('CarSearchUnified: Added model option to custom select:', modelValue);
        }
    }

    // Вспомогательный метод для обновления кастомных селектов
    updateCustomSelect(fieldName, value, placeholder) {
        var $facet = $('.facetwp-facet-' + fieldName);
        if ($facet.length === 0) {
            // Попробуем найти по имени поля
            $facet = $('[name="' + fieldName + '"]').closest('.facetwp-facet');
        }

        if ($facet.length === 0) {
            // Если не найден - попробуем просто установить значение в обычный select
            var $plainSelect = $('[name="' + fieldName + '"]');
            if ($plainSelect.length > 0) {
                // Найдём опцию по value или тексту
                var matched = null;
                $plainSelect.find('option').each(function() {
                    var $opt = $(this);
                    if ($opt.val() && $opt.val().toString().toLowerCase() === value.toString().toLowerCase()) {
                        matched = $opt.val();
                    }
                    if (!matched && $opt.text() && $opt.text().toString().toLowerCase() === value.toString().toLowerCase()) {
                        matched = $opt.val();
                    }
                });
                if (matched !== null) {
                    $plainSelect.val(matched).trigger('change');
                }
            }
            return;
        }

        var $select = $facet.find('select');
        var $trigger = $facet.find('.custom-select-trigger');
        var $items = $facet.find('.facet-dropdown-item');

        // Try exact data-value match
        var selectorEscaped = '[data-value="' + value + '"]';
        var $targetItem = $items.filter(selectorEscaped);

        // Try matching by value/text ignoring case and non-alphanumeric characters
        function normalize(s) {
            if (!s && s !== 0) return '';
            return s.toString().toLowerCase().replace(/[^a-z0-9а-яё\u0400-\u04FF]/g, '');
        }

        if ($targetItem.length === 0 && value) {
            var normValue = normalize(value);
            $items.each(function() {
                var $it = $(this);
                var dv = $it.attr('data-value') || '';
                var txt = $it.text() || dv;
                if (normalize(dv) === normValue || normalize(txt) === normValue) {
                    $targetItem = $it;
                    return false; // break
                }
            });
        }

        if ($targetItem.length > 0) {
            var actualValue = $targetItem.attr('data-value');
            // Обновляем скрытый селект
            if ($select.length > 0) {
                $select.val(actualValue).trigger('change');
            }

            // Обновляем UI
            $items.removeClass('selected');
            $targetItem.addClass('selected');
            if (fieldName === 'model') {
                // Для модели показываем в верхнем регистре и заменяем дефисы на пробелы
                var displayText = (actualValue && actualValue.toString()) ? actualValue.toString().replace(/-/g, ' ').toUpperCase() : $targetItem.text().replace(/-/g, ' ').toUpperCase();
                $trigger.text(displayText);

                // Фолбэк: через 1 секунду повторно применим выбор, если другой код его перезаписал
                setTimeout(function() {
                    try {
                        var $sel = $facet.find('select');
                        if ($sel.length > 0) {
                            $sel.val(actualValue).trigger('change');
                        }
                        $trigger.text(displayText);
                    } catch (e) {
                        // ignore
                    }
                }, 1000);
            } else {
                $trigger.text($targetItem.text());
            }
            return;
        }

        // If nothing found - try to add option to select (useful for models that are not loaded yet)
        if ($select.length > 0 && value) {
            // Avoid duplicating
            var exists = $select.find('option').filter(function() { return $(this).val() === value; }).length > 0;
            if (!exists) {
                try {
                    var displayVal = value.toString();
                    if (fieldName === 'model') {
                        displayVal = displayVal.replace(/-/g, ' ');
                    }
                    var $newOpt = $('<option>').val(value).text(displayVal);
                    $select.append($newOpt);
                    $select.val(value).trigger('change');
                    if ($trigger.length) {
                        if (fieldName === 'model') {
                            $trigger.text(displayVal.toUpperCase());

                            // Фолбэк через 1s
                            setTimeout(function() {
                                try {
                                    $select.val(value).trigger('change');
                                    $trigger.text(displayVal.toUpperCase());
                                } catch (e) {}
                            }, 1000);
                        } else {
                            $trigger.text(value);
                        }
                    }
                } catch (e) {
                    // ignore
                }
            }
        }
    }

    // Поиск соответствующего бренда в доступных опциях
    findMatchingBrand(searchValue, $items) {
        if (!searchValue) return null;

        // Нормализуем искомое значение
        var searchNormalized = searchValue.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Создаем список всех доступных брендов
        var availableBrands = [];
        $items.each(function() {
            var value = $(this).attr('data-value');
            if (value && value !== '') {
                availableBrands.push(value);
            }
        });

        // Ищем точное совпадение (игнорируя регистр)
        for (var i = 0; i < availableBrands.length; i++) {
            var brand = availableBrands[i];
            if (brand.toLowerCase() === searchValue.toLowerCase()) {
                return brand;
            }
        }

        // Ищем совпадение без специальных символов
        for (var i = 0; i < availableBrands.length; i++) {
            var brand = availableBrands[i];
            var brandNormalized = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (brandNormalized === searchNormalized) {
                return brand;
            }
        }

        // Маппинг известных вариантов брендов
        var brandMappings = {
            'mercedes-benz': ['MERCEDES BENZ', 'Mercedes-Benz', 'Mercedes Benz', 'MERCEDES-BENZ'],
            'mercedes': ['MERCEDES BENZ', 'Mercedes-Benz', 'Mercedes Benz'],
            'bmw': ['BMW'],
            'audi': ['AUDI', 'Audi'],
            'volkswagen': ['VOLKSWAGEN', 'Volkswagen'],
            'toyota': ['TOYOTA', 'Toyota'],
            'honda': ['HONDA', 'Honda'],
            'nissan': ['NISSAN', 'Nissan'],
            'mazda': ['MAZDA', 'Mazda'],
            'mitsubishi': ['MITSUBISHI', 'Mitsubishi'],
            'subaru': ['SUBARU', 'Subaru'],
            'lexus': ['LEXUS', 'Lexus'],
            'infiniti': ['INFINITI', 'Infiniti'],
            'acura': ['ACURA', 'Acura'],
            'hyundai': ['HYUNDAI', 'Hyundai'],
            'kia': ['KIA', 'Kia'],
            'genesis': ['GENESIS', 'Genesis'],
            'ssangyong': ['SSANGYONG', 'SsangYong'],
            'daewoo': ['DAEWOO', 'Daewoo']
        };

        // Проверяем маппинг
        var searchKey = searchValue.toLowerCase();
        if (brandMappings[searchKey]) {
            for (var j = 0; j < brandMappings[searchKey].length; j++) {
                var mappedBrand = brandMappings[searchKey][j];
                if (availableBrands.indexOf(mappedBrand) !== -1) {
                    return mappedBrand;
                }
            }
        }

        //console.log('CarSearchUnified: No brand mapping found for:', searchValue);
        return null;
    }

    // Отладочный метод для просмотра доступных брендов
    debugAvailableBrands() {
        //console.log('CarSearchUnified: Debug - Available brands for market:', this.currentMarket);

        var $vendorSelect = $('[name="vendor"]');
        if ($vendorSelect.length > 0) {
            var brands = [];
            $vendorSelect.find('option').each(function() {
                var value = $(this).val();
                var text = $(this).text();
                if (value && value !== '') {
                    brands.push({ value: value, text: text });
                }
            });

            //console.log('CarSearchUnified: Available brands (' + brands.length + '):', brands);

            // Проверяем, есть ли искомый бренд
            var urlParams = new URLSearchParams(window.location.search);
            var searchBrand = urlParams.get('_brand');
            if (searchBrand) {
                // Точное совпадения
                var found = brands.find(b => b.value.toLowerCase() === searchBrand.toLowerCase());
                //console.log('CarSearchUnified: Looking for brand "' + searchBrand + '" (exact match), found:', found);

                if (!found) {
                    // Попробуем найти через наш метод
                    var $items = $('.facetwp-facet-vendor .facet-dropdown-item, .facetwp-facet-brand .facet-dropdown-item');
                    var matchingBrand = this.findMatchingBrand(searchBrand, $items);

                    if (matchingBrand) {
                        //console.log('CarSearchUnified: Found matching brand through normalization:', searchBrand, '->', matchingBrand);
                    } else {
                        //console.warn('CarSearchUnified: Brand "' + searchBrand + '" not found in available brands!');

                        // Ищем похожие бренды
                        var similarBrands = brands.filter(b => {
                            var brandNormalized = b.value.toLowerCase().replace(/[^a-z0-9]/g, '');
                            var searchNormalized = searchBrand.toLowerCase().replace(/[^a-z0-9]/g, '');
                            return brandNormalized.indexOf(searchNormalized) !== -1 || searchNormalized.indexOf(brandNormalized) !== -1;
                        });

                        if (similarBrands.length > 0) {
                            //console.log('CarSearchUnified: Similar brands found:', similarBrands.map(b => b.value));
                        } else {
                            //console.log('CarSearchUnified: Top 10 available brands:', brands.slice(0, 10).map(b => b.value));
                        }
                    }
                }
            }
        } else {
            //console.warn('CarSearchUnified: Vendor select not found');
        }
    }

    // Обработка карточек автомобилей - упрощение 4WD значений
    processCarCards() {
        this.process4WDInCards();
        this.refreshPendingCardPrices($(document));
    }

    // Обработка значений заканчивающихся на 4WD - показываем просто 4WD
    /*
    process4WDInCards() {
        //console.log('CarSearchUnified: Processing 4WD values in car cards');

        // Обрабатываем все карточки автомобилей
        $('.one-car-wrapper').each(function() {
            var $card = $(this);

            // Ищем все текстовые элементы в карточке
            $card.find('.one-car-prop .m-20-500').each(function() {
                var $element = $(this);
                var text = $element.text().trim();

                // Проверяем, заканчивается ли текст на "4WD"
                if (text.length > 3 && text.endsWith('4WD')) {
                    // Если да, заменяем на просто "4WD"
                    $element.text('4WD');
                    //console.log('CarSearchUnified: Simplified "' + text + '" to "4WD"');
                }
            });
        });
    }
    */
    process4WDInCards() {
        //console.log('CarSearchUnified: Processing 4WD values in car cards');
        // Обрабатываем все карточки автомобилей
        $('.one-car-wrapper').each(function() {
            var $card = $(this);
            // Ищем все текстовые элементы в карточке
            $card.find('.one-car-prop .m-20-500').each(function() {
                var $element = $(this);
                var originalText = $element.text().trim();
                var text = originalText.toUpperCase(); // Приводим к верхнему регистру для поиска

                // Варианты, которые нужно заменять на "4WD"
                var patterns = [
                    '4WD',
                    'FULLTIME4WD',
                    'PARTTIME4WD',
                    '4X4',
                    'AWD' // Если нужно включать и AWD
                ];

                var shouldReplace = false;

                // Проверяем все паттерны
                for (var i = 0; i < patterns.length; i++) {
                    if (text.includes(patterns[i])) {
                        shouldReplace = true;
                        break;
                    }
                }

                // Дополнительная проверка для строк с запятыми
                if (text.includes(',') && text.includes('4WD')) {
                    shouldReplace = true;
                }

                if (shouldReplace) {
                    $element.text('4WD');
                    //console.log('CarSearchUnified: Simplified "' + originalText + '" to "4WD"');
                }
            });
        });
    }

    // Обработка 4WD после загрузки новых результатов
    processNewResults() {
        // Вызываем обработку 4WD для новых карточек
        setTimeout(() => {
            this.process4WDInCards();
            this.refreshPendingCardPrices($('.posts-list .car-auction-results-content:visible, .car-auction-auto-results:visible'));
        }, 100);
    }

    refreshPendingCardPrices($scope) {
        if (this.priceRefreshInProgress) {
            return;
        }

        const $root = ($scope && $scope.length) ? $scope : $(document);
        const $pendingCards = $root.find('.js-async-price[data-price-state="pending"]');
        if ($pendingCards.length === 0) {
            return;
        }

        const ids = [];
        $pendingCards.each(function() {
            const $card = $(this);
            const id = $card.data('car-id');
            if (!id) {
                return;
            }
            ids.push(String(id));
            $card.attr('data-price-state', 'loading');
        });

        const uniqueIds = [...new Set(ids)];
        if (uniqueIds.length === 0) {
            return;
        }

        this.priceRefreshInProgress = true;

        $.ajax({
            url: this.ajaxUrl,
            type: 'POST',
            timeout: 30000,
            dataType: 'json',
            traditional: true,
            data: {
                action: 'load_cars_prices_ajax',
                nonce: this.nonce,
                market: this.currentMarket,
                ids: uniqueIds
            },
            success: (response) => {
                const prices = response?.data?.prices || {};

                uniqueIds.forEach((id) => {
                    const $cards = $('.js-async-price[data-car-id="' + id + '"]');
                    if ($cards.length === 0) {
                        return;
                    }

                    const item = prices[id];
                    if (item && item.has_price && item.formatted_value) {
                        $cards.each(function() {
                            const $card = $(this);
                            $card.find('.js-price-value').text(item.formatted_value);
                            const rubIcon = $card.data('rub-icon');
                            if (rubIcon) {
                                $card.find('.js-price-currency').attr('src', rubIcon);
                            }
                            $card.attr('data-price-state', 'ready');
                        });
                    } else {
                        $cards.attr('data-price-state', 'no_price');
                    }
                });
            },
            error: () => {
                $('.js-async-price[data-price-state="loading"]').attr('data-price-state', 'pending');
            },
            complete: () => {
                this.priceRefreshInProgress = false;
            }
        });
    }

    // ===== ОТЛАДОЧНЫЕ ФУНКЦИИ =====
    // Детальная диагностика проблем фильтрации
    debugFilterState() {
        console.group('🔍 ДИАГНОСТИКА ФИЛЬТРАЦИИ CarSearchUnified');

        // 1. Общее состояние
        console.log('📋 Общее состояние:');
        console.log('   - Текущий рынок:', this.currentMarket);
        console.log('   - Загрузка в процессе:', this.isLoading);
        console.log('   - Текущая страница:', this.currentPage);
        console.log('   - AJAX URL:', this.ajaxUrl);
        console.log('   - Nonce доступен:', !!this.nonce);

        // 2. Состояние форм
        console.log('📝 Состояние форм:');
        var $forms = ['#wf-form-filter', 'form[data-market]', '.car-auction-search-form'];
        $forms.forEach(function(selector) {
            var $form = $(selector);
            if ($form.length > 0) {
                console.log('   ✅ Найдена форма:', selector);
                console.log('      - data-market:', $form.data('market'));
                console.log('      - Количество полей:', $form.find('input, select').length);

                $form.find('input, select').each(function() {
                    var $field = $(this);
                    var name = $field.attr('name');
                    var value = $field.val();
                    if (name) {
                        console.log('      - ' + name + ':', value || '(пусто)');
                    }
                });
            } else {
                console.log('   ❌ Форма не найдена:', selector);
            }
        });

        // 3. Состояние кастомных селектов
        console.log('🎛️ Кастомные селекты:');
        $('.facetwp-facet').each(function() {
            var $facet = $(this);
            var facetName = $facet.attr('class').match(/facetwp-facet-(\w+)/);
            facetName = facetName ? facetName[1] : 'неизвестно';

            var $select = $facet.find('select');
            var $trigger = $facet.find('.custom-select-trigger');
            var $selected = $facet.find('.facet-dropdown-item.selected');

            console.log('   📁 Фасет:', facetName);
            console.log('      - Скрытый select значение:', $select.length > 0 ? $select.val() : 'не найден');
            console.log('      - Триггер текст:', $trigger.length > 0 ? $trigger.text() : 'не найден');
            console.log('      - Выбранный элемент:', $selected.length > 0 ? $selected.text() : 'не найден');
            if ($selected.length > 0) {
                console.log('      - data-value:', $selected.attr('data-value'));
            }
            console.log('      - Количество опций:', $facet.find('.facet-dropdown-item').length);
        });

        // 4. URL параметры
        console.log('🌐 URL параметры:');
        var urlParams = new URLSearchParams(window.location.search);
        var filterParams = ['_brand', '_model', 'year_from', 'year_to', 'price_from', 'price_to', 'car_page'];
        filterParams.forEach(function(param) {
            if (urlParams.has(param)) {
                console.log('   - ' + param + ':', urlParams.get(param));
            }
        });

        // 5. Собранные фильтры
        console.log('⚙️ Собранные фильтры:');
        try {
            var filters = this.collectCurrentFilters();
            Object.keys(filters).forEach(function(key) {
                console.log('   - ' + key + ':', filters[key]);
            });
            if (Object.keys(filters).length === 0) {
                console.log('   ⚠ Фильтры не собраны или пусты!');
            }
        } catch (e) {
            console.error('   ❌ Ошибка сбора фильтров:', e.message);
        }

        // 6. Результаты поиска
        console.log('📊 Результаты:');
        var $resultsContent = $('.posts-list .car-auction-results-content');
        var $autoResults = $('.car-auction-auto-results');
        console.log('   - Результаты поиска видны:', $resultsContent.is(':visible'), '(элементов:', $resultsContent.children().length, ')');
        console.log('   - Авто-результаты видны:', $autoResults.is(':visible'), '(элементов:', $autoResults.children().length, ')');
        console.log('   - Загрузка видна:', $('.posts-list .car-auction-loading').is(':visible'));

        console.groupEnd();

        return {
            market: this.currentMarket,
            isLoading: this.isLoading,
            currentPage: this.currentPage,
            hasNonce: !!this.nonce,
            formCount: $('form[data-market], #wf-form-filter').length,
            facetCount: $('.facetwp-facet').length,
            urlParams: Object.fromEntries(urlParams),
            collectedFilters: this.collectCurrentFilters()
        };
    }

    // Быстрая диагностика конкретной проблемы с моделью
    debugModelIssue() {
        console.group('🚗 ДИАГНОСТИКА ПРОБЛЕМЫ С МОДЕЛЬЮ');

        // Проверяем селект модели
        var $modelSelect = $('select[name="model"]');
        console.log('📋 Селект модели:');
        console.log('   - Найден:', $modelSelect.length > 0);
        if ($modelSelect.length > 0) {
            console.log('   - Значение:', $modelSelect.val());
            console.log('   - Отключен:', $modelSelect.prop('disabled'));
            console.log('   - Количество опций:', $modelSelect.find('option').length);
            $modelSelect.find('option').each(function() {
                var $opt = $(this);
                console.log('     * ', $opt.val(), '→', $opt.text());
            });
        }

        // Проверяем кастомный селект модели
        var $modelFacet = $('.facetwp-facet-model');
        console.log('🎛️ Кастомный селект модели:');
        console.log('   - Найден:', $modelFacet.length > 0);
        if ($modelFacet.length > 0) {
            var $trigger = $modelFacet.find('.custom-select-trigger');
            var $selected = $modelFacet.find('.facet-dropdown-item.selected');
            console.log('   - Триггер текст:', $trigger.text());
            console.log('   - Выбранный элемент:', $selected.length > 0 ? $selected.text() : 'не найден');
            console.log('   - data-value выбранного:', $selected.length > 0 ? $selected.attr('data-value') : 'нет');
            console.log('   - Заблокирован:', $modelFacet.hasClass('disabled'));
        }

        // Проверяем URL параметр модели
        var urlParams = new URLSearchParams(window.location.search);
        console.log('🌐 URL параметр _model:', urlParams.get('_model') || 'отсутствует');

        // Тестируем сбор фильтров
        console.log('⚙️ Результат collectCurrentFilters:');
        try {
            var filters = this.collectCurrentFilters();
            console.log('   - model в фильтрах:', filters.model || 'ОТСУТСТВУЕТ');
            console.log('   - vendor в фильтрах:', filters.vendor || 'отсутствует');
        } catch (e) {
            console.error('   ❌ Ошибка:', e.message);
        }

        console.groupEnd();
    }

}

// ИСПРАВЛЕННАЯ глобальная инициализация с защитой от дублирования
document.addEventListener('DOMContentLoaded', () => {
    // ПРОВЕРЯЕМ, что экземпляр еще не создан
    if (!window.carSearch) {
        window.carSearch = new CarSearchUnified();
        console.log('CarSearchUnified: Global initialization complete');
    } else {
        console.log('CarSearchUnified: Already initialized, skipping DOMContentLoaded initialization');
    }
});

// jQuery готовность для совместимости (запасной вариант)
jQuery(document).ready(function($) {
    if (!window.carSearch) {
        window.carSearch = new CarSearchUnified();
        console.log('CarSearchUnified: jQuery initialization complete (fallback)');
    } else {
        console.log('CarSearchUnified: Already initialized, skipping jQuery initialization');
    }

    // Основная функция добавления поиска
    function addSearchToDropdown(dropdownContainer) {
        const $container = $(dropdownContainer);
        const $dropdownList = $container.find('.facet-dropdown-list');
        const $items = $dropdownList.find('.facet-dropdown-item');

        // Проверяем, не добавлен ли уже поиск
        if ($dropdownList.find('.dropdown-search-input').length > 0) {
            return;
        }

        // Создаем поле поиска
        const $searchContainer = $('<div class="search-container" style="padding: 8px; border-bottom: 1px solid #eee; background: #f9f9f9;"></div>');
        const $searchInput = $('<input type="text" class="dropdown-search-input" placeholder="🔍 Поиск..." style="width: 92%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">');

        $searchContainer.append($searchInput);
        $dropdownList.prepend($searchContainer);

        // Функция безопасной нормализации текста
        function normalizeText(text) {
            if (typeof text !== 'string') return '';
            return text.toLowerCase()
                .replace(/[^a-zа-яё0-9]/g, '') // разрешаем буквы и цифры
                .replace(/ё/g, 'е'); // нормализуем букву ё
        }

        // Функция фильтрации элементов
        function filterItems(searchText) {
            const searchNormalized = normalizeText(searchText);

            let visibleCount = 0;

            $items.each(function() {
                const $item = $(this);
                const itemText = normalizeText($item.text());

                if (searchNormalized === '' || itemText.includes(searchNormalized)) {
                    $item.show();
                    visibleCount++;
                } else {
                    $item.hide();
                }
            });

            // Показываем сообщение, если ничего не найдено
            const $noResults = $dropdownList.find('.no-search-results');
            if (visibleCount === 0 && searchNormalized !== '') {
                if ($noResults.length === 0) {
                    $dropdownList.append(
                        $('<div class="no-search-results" style="padding: 15px; text-align: center; color: #666; font-style: italic;">Ничего не найдено</div>')
                    );
                }
            } else {
                $noResults.remove();
            }
        }

        // Обработчики событий
        $searchInput.on('input', function() {
            filterItems($(this).val());
        });

        // Очищаем поиск при закрытии dropdown
        $container.closest('.facetwp-facet').on('click', function(e) {
            if (!$(e.target).closest('.facet-dropdown-list').length) {
                setTimeout(() => {
                    $searchInput.val('');
                    filterItems('');
                }, 100);
            }
        });

        // Предотвращаем закрытие при клике на поле поиска
        $searchInput.on('click', function(e) {
            e.stopPropagation();
        });

        // Обработка клавиш
        $searchInput.on('keydown', function(e) {
            if (e.key === 'Escape') {
                $(this).val('').trigger('input');
                e.stopPropagation();
            }
        });
    }

    // Инициализация всех dropdown
    function initAllSearchDropdowns() {
        // Для брендов
        $('.facetwp-facet[data-name="brand"] .custom-select-container').each(function() {
            addSearchToDropdown(this);
        });

        // Для моделей
        $('.facetwp-facet[data-name="model"] .custom-select-container').each(function() {
            addSearchToDropdown(this);
        });
    }

    // Запускаем инициализацию
    function initializeSearch() {
        // Первая инициализация
        setTimeout(initAllSearchDropdowns, 300);

        // Повторная инициализация при изменении контента
        $(document).on('facetwp-loaded DOMSubtreeModified', function() {
            setTimeout(initAllSearchDropdowns, 200);
        });

        // Также инициализируем при ручном открытии dropdown
        $(document).on('click', '.custom-select-trigger', function() {
            setTimeout(initAllSearchDropdowns, 100);
        });
    }

    // Запускаем всё
    initializeSearch();

    // Добавляем CSS стили
    const searchStyles = `
        .dropdown-search-input:focus {
            outline: none;
            border-color: #007cba !important;
            box-shadow: 0 0 0 1px #007cba;
        }

        .search-container {
            position: sticky;
            top: 0;
            z-index: 10;
            background: white;
        }

        .no-search-results {
            padding: 20px;
            text-align: center;
            color: #999;
            font-style: italic;
        }

        /* Стили для неактивных опций фильтров */
        .facet-dropdown-item.disabled {
            opacity: 0.5;
            color: #999 !important;
            pointer-events: none;
            cursor: not-allowed;
        }

        .facet-dropdown-item.disabled:hover {
            background-color: transparent !important;
        }
    `;

    $('head').append(`<style>${searchStyles}</style>`);
});

// ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ ОТЛАДКИ =====
// Добавляем функции в window для удобного вызова из консоли браузера
window.debugCarFilters = function() {
    if (window.carSearch && typeof window.carSearch.debugFilterState === 'function') {
        return window.carSearch.debugFilterState();
    } else {
        console.error('CarSearchUnified не инициализирован или метод недоступен');
        return null;
    }
};

window.debugModelIssue = function() {
    if (window.carSearch && typeof window.carSearch.debugModelIssue === 'function') {
        return window.carSearch.debugModelIssue();
    } else {
        console.error('CarSearchUnified не инициализирован или метод недоступен');
        return null;
    }
};

window.testCarFilters = function() {
    console.log('🧪 ТЕСТИРОВАНИЕ ФИЛЬТРОВ');
    console.log('Для диагностики используйте:');
    console.log('  debugCarFilters() - полная диагностика');
    console.log('  debugModelIssue() - диагностика проблемы с моделью');

    if (window.carSearch) {
        console.log('✅ CarSearchUnified инициализирован');
        try {
            var filters = window.carSearch.collectCurrentFilters();
            console.log('📋 Текущие фильтры:', filters);

            if (filters.model) {
                console.log('✅ Модель найдена в фильтрах:', filters.model);
            } else {
                console.warn('⚠️ Модель НЕ найдена в фильтрах - это может быть проблемой!');
                console.log('Запустите debugModelIssue() для детальной диагностики');
            }

            return filters;
        } catch (e) {
            console.error('❌ Ошибка при сборе фильтров:', e.message);
            return null;
        }
    } else {
        console.error('❌ CarSearchUnified не инициализирован');
        return null;
    }
};

// Автоматический вывод информации о доступных функциях отладки при загрузке
jQuery(document).ready(function() {
    setTimeout(function() {
        console.log('🔧 CarSearchUnified: Функции отладки доступны в консоли:');
        console.log('   - debugCarFilters() - полная диагностика фильтрации');
        console.log('   - debugModelIssue() - диагностика проблемы с моделью');
        console.log('   - testCarFilters() - быстрый тест фильтров');
        console.log('💡 Используйте эти функции для диагностики проблем с фильтрами!');
    }, 2000);
});
