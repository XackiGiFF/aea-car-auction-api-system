<?php
/**
 * Car Auction Indexer Class - Optimized Version
 *
 * Handles SEO indexing and background processing without performance issues
 */
namespace aea\Wp_Car_Auction_Lite\core;
use aea\Wp_Car_Auction_Lite\api\Car_Auction_API;
use Exception;
use function __ as translate;
use function _e as translate_echo;
use function _n as translate_n;
use function _x as translate_x;

if (!defined('ABSPATH')) {
    exit;
}

class Car_Auction_Indexer {

    private Car_Auction_API $api;
    private $batch_size = 20; // Оптимальный размер батча
    private $min_views_threshold = 3; // Минимальное количество просмотров для индексации
    private $max_concurrent_processes = 3; // Максимум параллельных процессов

    public function __construct(Car_Auction_API $api) {
        $this->api = $api;

        // Schedule optimized cron jobs
        add_action('wp', array($this, 'schedule_optimized_cron_jobs'));

        // Optimized cron job handlers
        add_action('car_auction_cleanup_cache', array($this, 'cleanup_cache'));
        add_action('car_auction_download_images_batch', array($this, 'download_images_batch'));
        add_action('car_auction_update_vendors_batch', array($this, 'update_vendors_cache_batch'));
        //add_action('car_auction_index_popular_cars_batch', array($this, 'index_popular_cars_batch'));

        // WordPress post creation (только по требованию)
        add_action('car_auction_create_wp_post', array($this, 'create_wordpress_post'), 10, 2);

        // Track views without immediate indexing
        add_action('car_auction_track_view', array($this, 'track_car_view'), 10, 2);

        // Admin hooks
        add_action('wp_ajax_car_auction_manual_index', array($this, 'ajax_manual_index'));
        add_action('wp_ajax_car_auction_bulk_index', array($this, 'ajax_bulk_index'));

        // Add meta boxes
        //add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
    }

    /**
     * Schedule optimized cron jobs without overlapping
     */
    public function schedule_optimized_cron_jobs(): void
    {
        // Daily cache cleanup - низкий приоритет
        if (!wp_next_scheduled('car_auction_cleanup_cache')) {
            wp_schedule_event(strtotime('02:00'), 'daily', 'car_auction_cleanup_cache');
        }

        // Vendor cache update - каждые 6 часов
        if (!wp_next_scheduled('car_auction_update_vendors_batch')) {
            wp_schedule_event(strtotime('04:00'), 'car_auction_6hours', 'car_auction_update_vendors_batch');
        }

        // Popular cars indexing - раз в сутки в непиковое время
        if (!wp_next_scheduled('car_auction_index_popular_cars_batch')) {
            wp_schedule_event(strtotime('03:00'), 'daily', 'car_auction_index_popular_cars_batch');
        }

        // Add custom intervals
        add_filter('cron_schedules', array($this, 'add_custom_cron_intervals'));
    }

    /**
     * Add custom cron intervals
     */
    public function add_custom_cron_intervals($schedules): array
    {
        $schedules['car_auction_6hours'] = array(
                'interval' => 6 * HOUR_IN_SECONDS,
                'display'  => translate('Every 6 Hours', 'car-auction')
        );

        $schedules['car_auction_15min'] = array(
                'interval' => 15 * MINUTE_IN_SECONDS,
                'display'  => translate('Every 15 Minutes', 'car-auction')
        );

        return $schedules;
    }

    /**
     * Clean up expired cache entries - оптимизировано
     */
    public function cleanup_cache(): void
    {
        global $wpdb;

        $cache_table = $wpdb->prefix . 'car_auction_cache';

        // Удаляем по батчам чтобы не блокировать таблицу
        $batch_size = 1000;
        $deleted_total = 0;

        do {
            $deleted = $wpdb->query(
                    "DELETE FROM $cache_table 
                 WHERE expires_at < NOW() 
                 LIMIT $batch_size"
            );

            $deleted_total += $deleted;

            if ($deleted > 0) {
                // Даем БД передышку
                usleep(100000); // 0.1 секунда
            }

        } while ($deleted > 0);

        if ($deleted_total > 0) {
            error_log("Car Auction: Cleaned up {$deleted_total} expired cache entries");

            // Оптимизируем только если было много удалений
            if ($deleted_total > 100) {
                $wpdb->query("OPTIMIZE TABLE $cache_table");
            }
        }
    }

    /**
     * Batch image download - без sleep()
     */
    public function download_images_batch(): void
    {
        // Проверяем, не запущен ли уже процесс
        if (get_transient('car_auction_image_download_running')) {
            return;
        }

        set_transient('car_auction_image_download_running', true, 10 * MINUTE_IN_SECONDS);

        global $wpdb;
        $table = $wpdb->prefix . 'car_auction_indexed';

        // Получаем cars без локальных изображений
        $cars_to_process = $wpdb->get_results(
                "SELECT car_id, images 
             FROM $table 
             WHERE images IS NOT NULL 
             AND images != '' 
             AND images NOT LIKE '%/car-auction-images/%'
             ORDER BY viewed_count DESC 
             LIMIT " . $this->batch_size
        );

        $processed = 0;

        foreach ($cars_to_process as $car) {
            if ($processed >= $this->batch_size) {
                break;
            }

            $this->download_car_images($car->car_id, $car->images);
            $processed++;

            // Небольшая пауза между запросами, но не sleep()
            if ($processed % 5 === 0) {
                usleep(50000); // 0.05 секунды
            }
        }

        delete_transient('car_auction_image_download_running');
        error_log("Car Auction: Batch image download processed {$processed} cars");
    }

    /**
     * Download images for single car - оптимизировано
     */
    private function download_car_images($car_id, $images_string): void
    {
        if (empty($images_string)) {
            return;
        }

        $upload_dir = wp_upload_dir();
        $car_auction_dir = $upload_dir['basedir'] . '/car-auction-images';

        if (!file_exists($car_auction_dir)) {
            wp_mkdir_p($car_auction_dir);
        }

        $images = explode('#', $images_string);
        $local_images = array();
        $downloaded_count = 0;
        $max_per_car = 5; // Уменьшили лимит

        // Используем curl multi для параллельной загрузки
        $multi_handle = curl_multi_init();
        $handles = array();

        foreach ($images as $index => $image_url) {
            if ($downloaded_count >= $max_per_car) {
                break;
            }

            $clean_url = $this->clean_image_url($image_url);
            $filename = $car_id . '_' . ($index + 1) . '.jpg';
            $local_path = $car_auction_dir . '/' . $filename;

            if (file_exists($local_path)) {
                $local_images[] = $upload_dir['baseurl'] . '/car-auction-images/' . $filename;
                $downloaded_count++;
                continue;
            }

            $handles[$index] = $this->create_image_curl_handle($clean_url, $local_path);
            curl_multi_add_handle($multi_handle, $handles[$index]);
        }

        // Выполняем параллельные запросы
        $this->execute_parallel_requests($multi_handle);

        // Обрабатываем результаты
        foreach ($handles as $index => $handle) {
            $filename = $car_id . '_' . ($index + 1) . '.jpg';
            $local_path = $car_auction_dir . '/' . $filename;

            if (file_exists($local_path) && filesize($local_path) > 0) {
                $local_images[] = $upload_dir['baseurl'] . '/car-auction-images/' . $filename;
                $downloaded_count++;
            }

            curl_multi_remove_handle($multi_handle, $handle);
            curl_close($handle);
        }

        curl_multi_close($multi_handle);

        // Обновляем БД только если есть изменения
        if (!empty($local_images)) {
            global $wpdb;
            $table = $wpdb->prefix . 'car_auction_indexed';

            $wpdb->update(
                    $table,
                    array('images' => implode('#', $local_images)),
                    array('car_id' => $car_id),
                    array('%s'),
                    array('%s')
            );
        }
    }

    /**
     * Clean image URL
     */
    private function clean_image_url($url): string
    {
        $url = preg_replace('/[&?](h|w|size)=\d+/', '', $url);
        return strtok($url, '&');
    }

    /**
     * Create curl handle for image download
     */
    private function create_image_curl_handle($url, $save_path)
    {
        $file_handle = fopen($save_path, 'w+');

        $ch = curl_init($url);
        curl_setopt_array($ch, [
                CURLOPT_FILE => $file_handle,
                CURLOPT_TIMEOUT => 15,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_USERAGENT => 'Car-Auction-Image-Downloader/1.0',
                CURLOPT_SSL_VERIFYPEER => false,
        ]);

        return $ch;
    }

    /**
     * Batch vendor cache update
     */
    public function update_vendors_cache_batch(): void
    {
        $markets = array('main', 'korea', 'china', 'bike', 'che_available');
        $processed = 0;

        foreach ($markets as $market) {
            if ($processed >= $this->max_concurrent_processes) {
                break;
            }

            try {
                $this->update_market_vendors($market);
                $processed++;

            } catch (Exception $e) {
                error_log("Car Auction: Failed to update vendors for {$market}: " . $e->getMessage());
            }
        }
    }

    /**
     * Update vendors for single market
     */
    private function update_market_vendors($market): void
    {
        $vendors = $this->api->get_vendors($market);

        if (!empty($vendors)) {
            $cache_key = md5($market . '_vendors_list');
            global $wpdb;
            $cache_table = $wpdb->prefix . 'car_auction_cache';

            $expires_at = date('Y-m-d H:i:s', time() + (12 * HOUR_IN_SECONDS));

            $wpdb->replace($cache_table, array(
                    'cache_key' => $cache_key,
                    'cache_value' => json_encode($vendors),
                    'expires_at' => $expires_at
            ), array('%s', '%s', '%s'));
        }
    }

    /**
     * Batch popular cars indexing - ОСНОВНОЕ ИСПРАВЛЕНИЕ
     */
    public function index_popular_cars_batch(): void
    {
        // Проверяем, не запущен ли уже процесс
        if (get_transient('car_auction_indexing_running')) {
            return;
        }

        set_transient('car_auction_indexing_running', true, 30 * MINUTE_IN_SECONDS);

        global $wpdb;
        $indexed_table = $wpdb->prefix . 'car_auction_indexed';

        // ТОЛЬКО бренды с достаточным количеством просмотров
        $popular_brands = $wpdb->get_results(
                "SELECT market, brand, SUM(viewed_count) as total_views 
             FROM $indexed_table 
             WHERE viewed_count > 0 
             GROUP BY market, brand 
             HAVING total_views >= {$this->min_views_threshold}
             ORDER BY total_views DESC 
             LIMIT 20" // Ограничиваем количество брендов
        );

        if (empty($popular_brands)) {
            error_log("Car Auction: No brands meet the minimum view threshold ({$this->min_views_threshold})");
            delete_transient('car_auction_indexing_running');
            return;
        }

        $indexed_count = 0;

        foreach ($popular_brands as $brand_data) {
            $indexed_count += $this->index_brand_cars_batch(
                    $brand_data->market,
                    $brand_data->brand,
                    3 // Всего 3 машины на бренд
            );

            // Останавливаемся если достигли лимита
            if ($indexed_count >= 50) {
                break;
            }
        }

        delete_transient('car_auction_indexing_running');
        error_log("Car Auction: Batch indexing completed. Indexed {$indexed_count} cars across " . count($popular_brands) . " brands");
    }

    /**
     * Index cars for brand in batch mode
     */
    private function index_brand_cars_batch($market, $brand, $limit = 3): int
    {
        $indexed_count = 0;

        try {
            $filters = array('vendor' => $brand);
            $results = $this->api->search_cars($market, $filters);

            if (!empty($results['cars'])) {
                $cars_to_index = array_slice($results['cars'], 0, $limit);

                foreach ($cars_to_index as $car) {
                    $result = $this->index_single_car($car, $market);

                    if ($result) {
                        $indexed_count++;
                    }

                    // Небольшая пауза между API запросами
                    if ($indexed_count % 5 === 0) {
                        usleep(100000); // 0.1 секунда
                    }
                }
            }

        } catch (Exception $e) {
            error_log("Car Auction: Failed to index cars for brand {$brand} in {$market}: " . $e->getMessage());
        }

        return $indexed_count;
    }

    /**
     * Track car view without immediate indexing - КРИТИЧЕСКИ ВАЖНО
     */
    public function track_car_view($car_id, $market): void
    {
        global $wpdb;
        $table = $wpdb->prefix . 'car_auction_indexed';

        // Просто увеличиваем счетчик - БЫСТРО!
        $wpdb->query($wpdb->prepare(
                "UPDATE $table 
             SET viewed_count = viewed_count + 1, 
                 last_viewed = NOW() 
             WHERE car_id = %s",
                $car_id
        ));

        // WordPress post создается ТОЛЬКО по требованию, не здесь!
    }

    /**
     * Index a single car - оптимизировано
     */
    public function index_single_car(array $car_data, string $market): bool|int|string
    {
        global $wpdb;
        $table = $wpdb->prefix . 'car_auction_indexed';
        $car = $this->api->format_car_data($car_data, $market);

        // Проверяем существование быстро
        $exists = $wpdb->get_var($wpdb->prepare(
                "SELECT id FROM $table WHERE car_id = %s",
                $car['id']
        ));

        if ($exists) {
            return $exists;
        }

        // Вставляем минимальные данные
        $result = $wpdb->insert($table, array(
                'car_id' => $car['id'],
                'market' => $market,
                'brand' => $car['brand'] ?? '',
                'model' => $car['model'] ?? '',
                'year' => $car['year'] ?? null,
                'images' => $car['images'] ?? '',
                'data' => json_encode($car),
                'viewed_count' => 0,
                'indexed_at' => current_time('mysql')
        ), array(
                '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%d', '%s'
        ));

        if ($result) {
            $new_id = $wpdb->insert_id;

            // Откладываем загрузку изображений на cron
            if (!empty($car_data['images'])) {
                wp_schedule_single_event(
                        time() + 3600, // Через час
                        'car_auction_download_images_batch'
                );
            }

            return $new_id;
        }

        return false;
    }

    /**
     * Create WordPress post ONLY when needed (on-demand)
     */
    public function create_wordpress_post($car_id, $market): \WP_Error|bool|int
    {
        // Проверяем, не создан ли уже пост
        $existing_post = get_posts(array(
                'post_type' => 'car_page',
                'meta_key' => '_car_auction_id',
                'meta_value' => $car_id,
                'post_status' => 'any',
                'numberposts' => 1,
                'fields' => 'ids' // Только ID для экономии памяти
        ));

        if (!empty($existing_post)) {
            return $existing_post[0]; // Пост уже существует
        }

        // Получаем данные из индекса - быстро, без лишних полей
        global $wpdb;
        $table = $wpdb->prefix . 'car_auction_indexed';

        $indexed_car = $wpdb->get_row($wpdb->prepare(
                "SELECT car_id, brand, model, year, data 
             FROM $table 
             WHERE car_id = %s",
                $car_id
        ));

        if (!$indexed_car) {
            error_log("Car Auction: Car {$car_id} not found in index for post creation");
            return false;
        }

        $car_data = json_decode($indexed_car->data, true);

        // Создаем базовый контент (остальное можно генерировать на лету)
        $title = "{$indexed_car->brand} {$indexed_car->model} {$indexed_car->year}";
        $content = $this->generate_minimal_post_content($car_data, $indexed_car);

        // Создаем пост с минимальными метаданными
        $post_data = array(
                'post_title' => $title,
                'post_content' => $content,
                'post_status' => 'publish',
                'post_type' => 'car_page',
                'post_author' => 1,
                'meta_input' => array(
                        '_car_auction_id' => $car_id,
                        '_car_auction_market' => $market,
                        '_car_auction_brand' => $indexed_car->brand,
                        '_car_auction_model' => $indexed_car->model,
                        '_car_auction_year' => $indexed_car->year,
                        '_car_auction_data' => $indexed_car->data // Все данные в одном поле
                )
        );

        $post_id = wp_insert_post($post_data, true);

        if (is_wp_error($post_id)) {
            error_log("Car Auction: Failed to create post for car {$car_id}: " . $post_id->get_error_message());
            return false;
        }

        // Устанавливаем таксономии асинхронно
        wp_schedule_single_event(time() + 60, 'car_auction_set_post_taxonomies', array($post_id, $market, $indexed_car->brand));

        // Устанавливаем featured image асинхронно
        if (!empty($car_data['IMAGES'])) {
            wp_schedule_single_event(time() + 120, 'car_auction_set_featured_image', array($post_id, $car_data['IMAGES']));
        }

        return $post_id;
    }

    /**
     * Generate minimal post content (остальное через шорткоды/блоки)
     */
    private function generate_minimal_post_content($car_data, $indexed_car): string
    {
        return '<!-- wp:car-auction/car-details {"carId":"' . $indexed_car->car_id . '"} -->' .
                '<div class="car-auction-dynamic-content"></div>' .
                '<!-- /wp:car-auction/car-details -->';
    }

    /**
     * Set post taxonomies async
     */
    public function set_post_taxonomies_async($post_id, $market, $brand): void
    {
        if (!get_post($post_id)) {
            return;
        }

        // Устанавливаем таксономии
        wp_set_object_terms($post_id, $this->get_market_country($market), 'car_country');
        wp_set_object_terms($post_id, $brand, 'car_brand');
    }

    /**
     * Get market country
     */
    private function get_market_country($market): string
    {
        $countries = array(
                'main' => 'Japan',
                'korea' => 'Korea',
                'china' => 'China',
                'bike' => 'Motocycles',
                'che_available' => 'China (Available)'
        );

        return $countries[$market] ?? 'Japan';
    }

    /**
     * Set featured image async
     */
    public function set_featured_image_async($post_id, $images_string): void
    {
        if (empty($images_string) || !get_post($post_id)) {
            return;
        }

        $images = explode('#', $images_string);
        $first_image = $images[0];

        if ($first_image && str_contains($first_image, wp_upload_dir()['baseurl'])) {
            $attachment_id = attachment_url_to_postid($first_image);
            if ($attachment_id) {
                set_post_thumbnail($post_id, $attachment_id);
            }
        }
    }

    /**
     * Execute parallel curl requests efficiently with proper error handling
     */
    private function execute_parallel_requests($multi_handle): void
    {
        $active = 0;
        $status = CURLM_OK;

        do {
            $status = curl_multi_exec($multi_handle, $active);

            // Wait for activity on any of the handles
            if ($active > 0 && $status === CURLM_OK) {
                curl_multi_select($multi_handle, 0.1); // 100ms timeout
            }

        } while ($active > 0 && $status === CURLM_OK);

        // Check for errors
        if ($status !== CURLM_OK) {
            error_log("Car Auction: cURL multi_exec error: " . $status);
        }
    }

    /**
     * AJAX handler for manual indexing - оптимизировано
     */
    public function ajax_manual_index(): void
    {
        check_ajax_referer('car_auction_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }

        $car_id = sanitize_text_field($_POST['car_id'] ?? '');
        $market = sanitize_text_field($_POST['market'] ?? 'main');

        if (empty($car_id)) {
            wp_send_json_error('Car ID is required');
        }

        // Отправляем сразу ответ, обработку делаем в фоне
        wp_send_json_success(array(
                'message' => 'Indexing started in background',
                'car_id' => $car_id
        ));

        // Запускаем в фоне
        wp_schedule_single_event(time() + 5, 'car_auction_background_index', array($car_id, $market));
    }

    /**
     * Background indexing process
     */
    public function background_indexing($car_id, $market): void
    {
        try {
            $car_data = $this->api->get_car_details($car_id, $market);

            if ($car_data) {
                $this->index_single_car($car_data, $market);
                error_log("Car Auction: Background indexing completed for car {$car_id}");
            }

        } catch (Exception $e) {
            error_log("Car Auction: Background indexing failed for car {$car_id}: " . $e->getMessage());
        }
    }

    /**
     * AJAX handler for bulk indexing - оптимизировано
     */
    public function ajax_bulk_index(): void
    {
        check_ajax_referer('car_auction_admin_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }

        $market = sanitize_text_field($_POST['market'] ?? 'main');
        $brand = sanitize_text_field($_POST['brand'] ?? '');
        $limit = min(intval($_POST['limit'] ?? 10), 20); // Жесткий лимит

        // Отправляем ответ сразу
        wp_send_json_success(array(
                'message' => 'Bulk indexing started in background',
                'market' => $market,
                'brand' => $brand
        ));

        // Запускаем в фоне
        wp_schedule_single_event(time() + 10, 'car_auction_background_bulk_index', array($market, $brand, $limit));
    }

    /**
     * Background bulk indexing
     */
    public function background_bulk_indexing($market, $brand, $limit): void
    {
        $indexed_count = 0;

        try {
            $filters = !empty($brand) ? array('vendor' => $brand) : array();
            $results = $this->api->search_cars($market, $filters);

            if (!empty($results['cars'])) {
                $cars_to_index = array_slice($results['cars'], 0, $limit);

                foreach ($cars_to_index as $car) {
                    $result = $this->index_single_car($car, $market);
                    if ($result) {
                        $indexed_count++;
                    }

                    // Пауза каждые 5 машин
                    if ($indexed_count % 5 === 0) {
                        sleep(1);
                    }
                }
            }

            error_log("Car Auction: Background bulk indexing completed. Indexed {$indexed_count} cars");

        } catch (Exception $e) {
            error_log("Car Auction: Background bulk indexing failed: " . $e->getMessage());
        }
    }

    /**
     * Get memory usage info for debugging
     */
    private function get_memory_usage(): string
    {
        $memory = memory_get_usage(true);
        return round($memory / 1024 / 1024, 2) . 'MB';
    }

    /**
     * Add memory limits to prevent crashes
     */
    private function check_memory_limit(): bool
    {
        $memory_limit = ini_get('memory_limit');
        $current_usage = memory_get_usage(true);

        if (preg_match('/^(\d+)(.)$/', $memory_limit, $matches)) {
            $limit = $matches[1];
            $unit = $matches[2];

            switch ($unit) {
                case 'G': $limit *= 1024 * 1024 * 1024; break;
                case 'M': $limit *= 1024 * 1024; break;
                case 'K': $limit *= 1024; break;
            }

            // Останавливаемся при 90% использования
            return ($current_usage < $limit * 0.9);
        }

        return true;
    }
}