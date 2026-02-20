<?php

namespace aea\Wp_Car_Auction_Lite\api;

class Car_Auction_API {

    private string $api_base_url;
    private string $api_code;
    private int $timeout = 15;

    /**
     * Market configurations
     */
    private array $market_configs = array(
        'main' => array(
            'table' => 'main',
            'cache_minutes' => 30,
            'currency' => 'JPY',
            'country' => 'japan'
        ),
        'korea' => array(
            'table' => 'korea',
            'cache_minutes' => 720,
            'currency' => 'KRW',
            'country' => 'korea'
        ),
        'china' => array(
            'table' => 'china',
            'cache_minutes' => 720,
            'currency' => 'CNY',
            'country' => 'china'
        ),
        'bike' => array(
            'table' => 'bike',
            'cache_minutes' => 720,
            'currency' => 'USD',
            'country' => 'bike'
        ),
        'che_available' => array(
            'table' => 'che_available',
            'cache_minutes' => 720,
            'currency' => 'CNY',
            'country' => 'che_available'
        ),
        'stats' => array(
            'table' => 'stats',
            'cache_minutes' => 1440,
            'currency' => 'JPY',
            'country' => 'japan'
        )
    );

    public function __construct($api_base_url, $api_code) {
        $this->api_base_url = trailingslashit($api_base_url);
        $this->api_code = $api_code;
    }

    /**
     * Получение IP клиента
     */
    private function get_client_ip() {
        $ip = '';

        // Приоритет: X-Forwarded-For (для прокси и балансировщиков)
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $ip = trim($ips[0]);
        }
        // Затем HTTP_CLIENT_IP
        elseif (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            $ip = $_SERVER['HTTP_CLIENT_IP'];
        }
        // И только потом REMOTE_ADDR
        elseif (!empty($_SERVER['REMOTE_ADDR'])) {
            $ip = $_SERVER['REMOTE_ADDR'];
        }

        return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '127.0.0.1';
    }

    /**
     * Получение данных конкретного автомобиля
     */
    /**
     * Получение данных конкретного автомобиля (обновленная версия)
     * Теперь передаем client_ip в API запрос
     */
    public function get_car_details($car_id, $table = 'main'): array
    {
        // Получаем реальный IP клиента
        $client_ip = $this->get_client_ip();

        $provider = ($table === 'che_available') ? 'che-168' : 'ajes';

        $url = $this->build_api_url('/api/car/' . $car_id, [
            'table' => $table,
            'client_ip' => $client_ip, // Добавляем обязательный параметр
            'provider' => $provider
        ]);

        $response = $this->fast_api_request($url);

        if (isset($response['success']) && $response['success']) {
            return $this->format_car_data($response['data'], $table);
        }

        return [
            'success' => false,
            'error' => $response['error'] ?? 'Failed to get car details',
            'client_ip' => $client_ip // Для отладки
        ];
    }
    

    /**
     * Format car data for display
     */
    public function format_car_data($car, $market = 'main'): array
    {
        $config = $this->market_configs[$market] ?? $this->market_configs['main'];

        // Process images
        $images = array();
        $images_data = $car['images'] ??
            (!empty($car['IMAGES']) ? $car['IMAGES'] : '') ??
            $car['IMAGE0'] ?? '';

        if (!empty($images_data)) {
            // Заменяем любой поддомен ajes.com на https://7.ajes.com/
            $images_data = preg_replace(
                '~([a-z0-9]+\.)?ajes\.com/~',
                '7.ajes.com/',
                $images_data
            );
        }

        if(empty($car['tamozhennyj_list'])) {
            $tamozhennyj_list = null;
        } else {
            $tamozhennyj_list = $car['tamozhennyj_list'];
        }

        if (!empty($images_data) && is_string($images_data) ) {
            if (strpos($images_data, '#') !== false) {
                $image_urls = explode('#', $images_data);
                // Проверяем, что массив не пустой
                if (!empty($image_urls)) {
                    if($market == 'main' && empty($car['tamozhennyj_list'])){
                        // Извлекаем первое фото
                        $first_image = array_shift($image_urls);
                        // TODO: add first image on japan to $tamozhennyj_list and set to return array as ['tamozhennyj_list'] = first_image
                        $tamozhennyj_list = $first_image;
                    } elseif ($market == 'main' && !empty($car['tamozhennyj_list'])){
                        $tamozhennyj_list = $car['tamozhennyj_list'];
                    } else {
                        // Добавляем его в конец
                        $tamozhennyj_list = null;
                    }

                    // Форматируем оставшиеся изображения (теперь без первого)
                    $formatted_images = $image_urls;
                }

                foreach ($formatted_images as $url) {
                    if (!empty($url)) {
                        // Clean URL - remove size parameters that may interfere with display
                        $clean_url = $url;
                        $clean_url = preg_replace('/[&?]h=\d+/', '', $clean_url);
                        $clean_url = preg_replace('/[&?]w=\d+/', '', $clean_url);
                        $clean_url = preg_replace('/[&?]size=\d+/', '', $clean_url);
                        $images[] = $clean_url;
                    }
                }
            } else {
                $clean_url = $images_data;
                $clean_url = preg_replace('/[&?]h=\d+/', '', $clean_url);
                $clean_url = preg_replace('/[&?]w=\d+/', '', $clean_url);
                $clean_url = preg_replace('/[&?]size=\d+/', '', $clean_url);
                $images[] = $clean_url;
            }
        }

        // Format prices
        $start_price = intval($car['start'] ?? $car['START'] ?? 0);
        $finish_price = intval($car['finish'] ?? $car['FINISH'] ?? 0);
        $avg_price = intval($car['avg_price'] ?? $car['AVG_PRICE'] ?? 0);

        return array(
            'success' => true,
            'id' => $car['id'] ?? $car['ID'] ?? '',
            'lot' => $car['lot'] ?? $car['LOT'] ?? '',
            'brand' => $car['marka_name'] ?? $car['MARKA_NAME'] ?? '',
            'model' => $car['model_name'] ?? $car['MODEL_NAME'] ?? '',
            'year' => intval($car['year'] ?? $car['YEAR'] ?? 0),
            'engine_volume' => intval($car['eng_v'] ?? $car['ENG_V'] ?? 0),
            'mileage_numeric' => intval($car['mileage'] ?? $car['MILEAGE'] ?? 0),
            'transmission' => $car['kpp'] ?? $car['KPP'] ?? '',
            'drive' => $car['priv'] ?? $car['PRIV'] ?? '',
            'fuel' => $car['time'] ?? $car['TIME'] ?? '',
            'color' => $car['color'] ?? $car['COLOR'] ?? '',
            'grade' => $car['grade'] ?? $car['GRADE'] ?? '',
            'kuzov' => $car['kuzov'] ?? $car['KUZOV'] ?? '',
            'equipment' => $car['equip'] ?? $car['EQUIP'] ?? '',
            'rate' => $car['rate'] ?? $car['RATE'] ?? '',
            'orig_start_price' => $car['start'] ?? $car['START'] ?? 0,
            'orig_finish_price' => $car['finish'] ?? $car['FINISH'] ?? 0,
            'orig_avg_price' => $car['evg_price'] ?? $car['AVG_PRICE'] ?? 0,
            'calc_rub' => $car['calc_rub'] ?? $car['CALC_RUB'] ?? '', // RUB CALC
            'stock_price' => $car['stock_price'] ?? $car['STOCK_PRICE'] ?? '',
            'currency' => $config['currency'],
            'status' => $car['status'] ?? $car['STATUS'] ?? '',
            'auction_date' => $car['auction_date'] ?? $car['AUCTION_DATE'] ?? '',
            'auction' => $car['auction'] ?? $car['AUCTION'] ?? '',
            'images' => $images,
            'tamozhennyj_list' => $tamozhennyj_list,
            'market' => $market,
            'auction_grade' => $car['rate'] ?? $car['RATE'] ?? '',
            'info' =>  $car['info'] ?? $car['INFO'] ?? '',
            'raw_data' => $car
        );
    }

    /**
     * Получение динамических фильтров
     */
    public function get_dynamic_filters($table = 'main', $filters = array()) {
        // Получаем реальный IP клиента
        $client_ip = $this->get_client_ip();

        $provider = ($table === 'che_available') ? 'che-168' : 'ajes';

        $url = $this->build_api_url('/api/filters/dynamic', array_merge([
            'table' => $table,
            'only_calculated' => 'true',
            'client_ip' => $client_ip, // Добавляем обязательный параметр
            'provider' => $provider,
        ], $filters));

        $response = $this->fast_api_request($url);

        if (isset($response['success']) && $response['success']) {
            return $response['data'];
        }

        return $this->get_fallback_filters($table);
    }

    /**
     * Получение всех марок для указанного рынка
     */
    public function get_vendors($table = 'main') {
        $filters = $this->get_dynamic_filters($table);
        return $filters['vendors'] ?? [];
    }

    /**
     * Получение моделей для указанной марки
     */
    public function get_models($table, $vendor, $additional_filters = array()) {
        $filters = array_merge(['vendor' => $vendor], $additional_filters);
        $filters_data = $this->get_dynamic_filters($table, $filters);
        return $filters_data['models'] ?? [];
    }

    /**
     * Поиск автомобилей
     */
    public function search_cars($table = 'main', $filters = array(), $limit = 20, $offset = 0) {

        $page = max(1, intval($filters['page'] ?? 1));
        $per_page = min(20, intval(get_option('car_auction_items_per_page', 20)));
        $offset = ($page - 1) * $per_page;

        // Получаем реальный IP клиента
        $client_ip = $this->get_client_ip();

        $provider = ($table === 'che_available') ? 'che-168' : 'ajes';

        $params = array_merge([
            'table' => $table,
            'limit' => $limit,
            'offset' => $offset,
            'client_ip' => $client_ip, // Добавляем обязательный параметр
            'provider' => $provider,
            //'only_calculated' => 'true'
        ], $filters);

        $url = $this->build_api_url('/api/cars', $params);
        
        error_log('[URL] Request:' . $url);
        $response = $this->fast_api_request($url);

        if (isset($response['success']) && $response['success']) {
            return $response['data'];
        }

        return [
            'cars' => [],
            'pagination' => ['total' => 0, 'limit' => $limit, 'offset' => $offset],
            'price_range' => ['min' => 0, 'max' => 0]
        ];
    }

    /**
     * Получить расчетную цену автомобиля через отдельный endpoint.
     * Поддерживает on-demand пересчет на стороне api-gateway.
     */
    public function get_car_price($car_id, $table = 'main', $recalc = true): array
    {
        $first_result = null;

        foreach ($this->resolve_price_providers($table) as $provider) {
            $url = $this->build_api_url('/api/car/' . rawurlencode($car_id) . '/price', [
                'table' => $table,
                'provider' => $provider,
                'recalc' => $recalc ? 'true' : 'false'
            ]);

            $response = $this->fast_api_request($url, 20);
            if (empty($response['success']) || empty($response['data'])) {
                if ($first_result === null) {
                    $first_result = [
                        'success' => false,
                        'error' => $response['error'] ?? 'Failed to get car price',
                        'calc_rub' => null,
                        'formatted_value' => null,
                        'has_price' => false
                    ];
                }
                continue;
            }

            $calc_rub = $response['data']['calc_rub'] ?? null;
            $numeric = is_numeric($calc_rub) ? (float)$calc_rub : null;
            $has_price = $numeric !== null && $numeric > 0;

            $result = [
                'success' => true,
                'calc_rub' => $has_price ? $numeric : null,
                'formatted_value' => $has_price ? number_format($numeric, 0, '.', ' ') : null,
                'has_price' => $has_price,
                'recalculation' => $response['recalculation'] ?? null
            ];

            // Если у провайдера есть цена — сразу возвращаем.
            // Иначе пробуем fallback провайдер.
            if ($has_price) {
                return $result;
            }

            if ($first_result === null) {
                $first_result = $result;
            }
        }

        return $first_result ?? [
            'success' => false,
            'error' => 'Failed to get car price',
            'calc_rub' => null,
            'formatted_value' => null,
            'has_price' => false
        ];
    }

    /**
     * Получение типов топлива
     */
    public function get_fuel_types($table = 'main', $filters = array()) {
        $filters_data = $this->get_dynamic_filters($table, $filters);
        return $filters_data['fuel_types'] ?? [];
    }

    /**
     * Получение групп трансмиссий
     */
    public function get_transmission_groups($table = 'main', $filters = array()) {
        $filters_data = $this->get_dynamic_filters($table, $filters);
        return $filters_data['transmissions'] ?? [];
    }

    /**
     * Получение типов привода
     */
    public function get_drive_types($table = 'main', $filters = array()): array|string
    {
        $filters_data = $this->get_dynamic_filters($table, $filters);
        return $filters_data['drives'] ?? [];
    }

    /**
     * Проверка поддержки фильтров для таблицы
     */
    public function get_table_support($table = 'main', $filters = array()) {
        $filters_data = $this->get_dynamic_filters($table, $filters);
        return $filters_data['table_support'] ?? [
            'has_fuel_filter' => false,
            'has_transmission_filter' => false,
            'has_drive_filter' => false
        ];
    }

    /**
     * Построение URL для API запроса
     */
    private function build_api_url($endpoint, $params = array()): string
    {
        $base_params = [
            'code' => $this->api_code,
            'client_ip' => $this->get_client_ip()
        ];

        $all_params = array_merge($base_params, $params);
        $query_string = http_build_query($all_params);

        return $this->api_base_url . ltrim($endpoint, '/') . '?' . $query_string;
    }

    /**
     * Выполнение API запроса
     */
    private function make_api_request($url) {
        $args = [
            'timeout' => $this->timeout,
            'headers' => [
                'User-Agent' => 'WordPress/CarAuctionPlugin/1.0',
                'Accept' => 'application/json'
            ]
        ];

        $response = wp_remote_get($url, $args);

        if (is_wp_error($response)) {
            error_log('AEA API Error: ' . $response->get_error_message());
            return ['success' => false, 'error' => $response->get_error_message()];
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('AEA API JSON Error: ' . json_last_error_msg());
            return ['success' => false, 'error' => 'Invalid JSON response'];
        }

        return $data;
    }


    /**
     * Быстрый API запрос с приоритетом на скорость
     */
    private function fast_api_request($url, $timeout = 30) {
        $args = [
            'timeout' => $timeout,
            'headers' => [
                'User-Agent' => 'CarAuction/Fast/1.0',
                'Accept' => 'application/json',
                'Accept-Encoding' => 'gzip'
            ]
        ];

        $response = wp_remote_get($url, $args);

        if (is_wp_error($response)) {
            // Для быстрых запросов не делаем повторные попытки
            return ['success' => false, 'error' => $response->get_error_message()];
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            return ['success' => false, 'error' => 'Invalid JSON response'];
        }

        return $data;
    }

    /**
     * Резервные данные фильтров
     */
    private function get_fallback_filters($table): array
    {
        return [
            'vendors' => [],
            'models' => [],
            'fuel_types' => [],
            'transmissions' => [
                'automatic' => ['name' => 'Автоматическая', 'count' => 0],
                'manual' => ['name' => 'Механическая', 'count' => 0],
                'cvt' => ['name' => 'Вариатор', 'count' => 0],
                'sequential' => ['name' => 'Секвентальная', 'count' => 0],
                'other' => ['name' => 'Другое', 'count' => 0]
            ],
            'drives' => [
                'fwd' => ['name' => 'Передний привод', 'count' => 0],
                'rwd' => ['name' => 'Задний привод', 'count' => 0],
                'awd' => ['name' => 'Полный привод', 'count' => 0],
                'other' => ['name' => 'Другое', 'count' => 0]
            ],
            'current_filters' => [],
            'table_support' => [
                'has_fuel_filter' => ($table !== 'bike'),
                'has_transmission_filter' => ($table !== 'bike'),
                'has_drive_filter' => ($table !== 'bike')
            ]
        ];
    }

    /**
     * Валидация и санитизация входных данных
     */
    private function sanitize_input($input): array|string
    {
        if (is_array($input)) {
            return array_map([$this, 'sanitize_input'], $input);
        }

        return sanitize_text_field($input);
    }

    private function resolve_provider($table = 'main'): string
    {
        return $table === 'che_available' ? 'che-168' : 'ajes';
    }

    private function resolve_price_providers($table = 'main'): array
    {
        // Для Китая держим fallback на оба источника, чтобы не терять calc_rub.
        if ($table === 'china') {
            return ['che-168', 'ajes'];
        }

        if ($table === 'che_available') {
            return ['che-168'];
        }

        return ['ajes'];
    }

    /**
     * Получение динамических фильтров
     */
    public function getDynamicFilters($currentFilters = [], $table = 'main'): array
    {
        try {
            // Логгирование для отладки
            $debug_mode = get_option('car_auction_debug_mode', false);
            if ($debug_mode) {
                error_log('Car Auction API: getDynamicFilters called with table=' . $table . ', filters=' . print_r($currentFilters, true));
            }

            // Получаем IP клиента
            $client_ip = $this->get_client_ip();

            $provider = ($table === 'che_available') ? 'che-168' : 'ajes';

            // Подготовка параметров для API запроса
            $api_params = array_merge([
                'table' => $table,
                'client_ip' => $client_ip,
                'provider' => $provider
            ], $currentFilters); // Передаем фильтры напрямую в query string

            // Строим URL для запроса динамических фильтров
            $url = $this->build_api_url('/api/filters/dynamic', $api_params);

            if ($debug_mode) {
                error_log('Car Auction API: Making request to: ' . $url);
            }

            // Выполняем API запрос с увеличенным timeout для фильтров
            $response = $this->fast_api_request($url, 10); // Увеличиваем timeout для фильтров до 10 секунд

            if ($debug_mode) {
                error_log('Car Auction API: Response received: ' . print_r([
                    'success' => $response['success'] ?? 'not_set',
                    'has_data' => isset($response['data']),
                    'error' => $response['error'] ?? 'none'
                ], true));
            }

            // Проверяем успешность ответа
            if (isset($response['success']) && $response['success'] && isset($response['data'])) {
                $data = $response['data'];

                // Нормализуем данные под ожидаемый формат
                $normalized_data = [
                    'vendors' => $data['vendors'] ?? [],
                    'models' => $data['models'] ?? [],
                    'fuel_types' => $data['fuel_types'] ?? [],
                    'transmissions' => $data['transmissions'] ?? [],
                    'drives' => $data['drives'] ?? [],
                    'current_filters' => $data['current_filters'] ?? $currentFilters,
                    'table_support' => $data['table_support'] ?? [
                        'has_fuel_filter' => ($table !== 'bike'),
                        'has_transmission_filter' => ($table !== 'bike'),
                        'has_drive_filter' => ($table !== 'bike')
                    ]
                ];

                if ($debug_mode) {
                    error_log('Car Auction API: Normalized data: ' . print_r([
                        'vendors_count' => count($normalized_data['vendors']),
                        'models_count' => count($normalized_data['models']),
                        'fuel_types_count' => count($normalized_data['fuel_types']),
                        'transmissions_type' => gettype($normalized_data['transmissions']),
                        'drives_type' => gettype($normalized_data['drives']),
                        'table_support' => $normalized_data['table_support']
                    ], true));
                }

                return $normalized_data;
            }

            // В случае ошибки возвращаем fallback данные
            $error_message = $response['error'] ?? 'Unknown API error';
            if ($debug_mode) {
                error_log('Car Auction API: getDynamicFilters failed, using fallback. Error: ' . $error_message);
            }

            return $this->get_fallback_filters($table);

        } catch (\Exception $e) {
            if (get_option('car_auction_debug_mode', false)) {
                error_log('Car Auction API: getDynamicFilters exception: ' . $e->getMessage());
            }

            // В случае исключения возвращаем fallback данные
            return $this->get_fallback_filters($table);
        }
    }

    /**
     * Get fuel type name by code
     */
    public function get_fuel_name($fuel_code) {
        // P — бензин, D — дизель, E — электро, H — гибрид, HE — гибрид с электроприводом, L — сжиженный нефтяной газ, C — сжатый природный газ, O — другое
        $fuel_types = array(
            'G' => 'Бензин',
            'P' => 'Бензин',
            'D' => 'Дизель',
            'E' => 'Электро',
            'H' => 'Гибрид',
            'HE' => 'Гибрид (Э)',
            'L' => 'Газ (LPG)',
            'C' => 'Газ (CNG)',
            'O' => 'Другое',
            '&' => 'Гибрид (&)',
            '' => '—'
        );

        return isset($fuel_types[$fuel_code]) ? $fuel_types[$fuel_code] : ($fuel_code ?: '—');
    }
}
