<?php
/**
 * Car Auction Auto Creator Class
 * 
 * Handles creation of WordPress posts using existing 'auto' post type
 */

namespace aea\Wp_Car_Auction_Lite\core;

use aea\Wp_Car_Auction_Lite\api\Car_Auction_API;
use aea\Wp_Car_Auction_Lite\Wp_Car_Auction_Plugin_Lite;
use Exception;

if (!defined('ABSPATH')) {
    exit;
}

class Car_Auction_Auto_Creator {
    
    private Car_Auction_API $api;
    
    public function __construct(Car_Auction_API $api) {
        $this->api = $api;
            // Initialize API when WordPress is ready
        add_action('init', array($this, 'init_api'), 10);

        // Hook for creating WordPress posts
        add_action('car_auction_create_wp_post', array($this, 'create_car_post'), 10, 2);

        // Hook for delayed post creation
        add_action('car_auction_create_delayed_post', array($this, 'create_car_post'), 10, 2);

        // Add admin interface for manual post creation
        add_action('wp_ajax_car_auction_create_post', array($this, 'ajax_create_post'));

        // Handle template for auto posts
        add_filter('template_include', array($this, 'auto_template'));
    }
    
    /**
     * Create WordPress post for indexed car using 'auto' post type
     */
    public function create_car_post($car_id, $market): \WP_Error|bool|int
    {
        // Allow automatic creation for indexing purposes

        // Update queue status to processing
        $this->update_queue_status($car_id, $market, 'processing');

        try {
            // Check if post already exists
            $existing_post_id = $this->find_existing_auto_post_id($car_id);
            if ($existing_post_id) {
                // Post already exists, mark queue as completed
                $this->update_queue_status($car_id, $market, 'completed', null, $existing_post_id);
                return $existing_post_id;
            }
        
        $car_data = $this->api->get_car_details($car_id, $market);
        if (!$car_data) {
            error_log("Car Auction: Failed to get car data for post creation - ID: $car_id, Market: $market");
            return false;
        }

        // Проверяем наличие рассчитанной цены calc_rub
        if (empty($car_data['calc_rub']) || !is_numeric($car_data['calc_rub']) || floatval($car_data['calc_rub']) <= 0) {
            error_log("Car Auction: Car ID $car_id has no calculated price (calc_rub), skipping post creation. calc_rub value: " . ($car_data['calc_rub'] ?? 'NULL'));
            // Обновляем статус очереди как "пропущено" вместо "неудачно"
            $this->update_queue_status($car_id, $market, 'skipped', 'No calculated price (calc_rub)');
            return false;
        }

        $formatted_car = $car_data;

        error_log("Car Auction: NEW Formatted car - " . json_encode($formatted_car));
        
        // Create post title
        $post_title = 'Заказать ' . $formatted_car['brand'] . ' ' . $formatted_car['model'] . ' ';
        if (!empty($formatted_car['year'])) {
            $post_title .= $formatted_car['year'] . ' года ';
        }
        $car_price = $car_data['calc_rub'];
        if($car_price){
            $post_title .= 'за ' . number_format($car_price, 0, '.', ' ') . ' ₽ ';
        }
        
        if($market == 'main') {
            $market_name = 'Японии';
        } elseif($market == 'korea') {
            $market_name = 'Кореи';
        } elseif($market == 'china') {
            $market_name = 'Китая';
        } elseif($market == 'bike') {
            $market_name = 'Японии';
        } elseif($market == 'che_available') {
            $market_name = 'Китая (В наличии)';
        }
        
        $post_title .= ' из ' . $market_name;
        
        error_log("[AutoCreator]: NEW Formatted Title - " . $post_title);
        
        
        // Add unique identifier to handle duplicates
        $unique_suffix = substr($car_id, -6); // Last 6 chars of car ID
        //$post_title .= ' (№' . $unique_suffix . ')';
        
        // Create post content
        $post_content = $this->generate_car_content($formatted_car);
        
        // Create post slug with unique suffix to handle duplicates
        $brand_slug = sanitize_title($formatted_car['brand']);
        $model_slug = sanitize_title($formatted_car['model']);
        $unique_slug = $brand_slug . '_' . $model_slug . '_' . $unique_suffix;
        
        // Create the post
        $post_data = array(
            'post_title' => $post_title,
            'post_content' => $post_content,
            'post_status' => 'publish',
            'post_type' => 'auto',
            'post_name' => $unique_slug, // Custom slug with unique ID
            'post_author' => 1,
        );
        
        $post_id = wp_insert_post($post_data);
        
        if (is_wp_error($post_id)) {
            error_log("Car Auction: Failed to create post - " . $post_id->get_error_message());
            return false;
        }
        
        // Save meta data using ACF field names
        $this->save_car_meta_data($post_id, $formatted_car, $car_data, $car_id, $market);
        
        // Set taxonomies
        $this->set_car_taxonomies($post_id, $formatted_car, $market);
        
        // Set featured image
        $this->set_car_featured_image($post_id, $formatted_car);
        
        error_log("Car Auction: Created auto post ID: $post_id for car: $car_id");

        // Mark as completed in queue
        $this->update_queue_status($car_id, $market, 'completed', null, $post_id);

        return $post_id;

        } catch (Exception $e) {
            error_log("Car Auction: Exception creating post for car $car_id: " . $e->getMessage());
            $this->update_queue_status($car_id, $market, 'failed', $e->getMessage());
            return false;
        }
    }

    private function find_existing_auto_post_id(string $car_id): ?int
    {
        global $wpdb;

        $post_id = $wpdb->get_var($wpdb->prepare(
            "SELECT p.ID
             FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID
             WHERE pm.meta_key = '_car_auction_id'
               AND pm.meta_value = %s
               AND p.post_type = 'auto'
               AND p.post_status IN ('publish', 'future', 'draft', 'pending', 'private')
             ORDER BY p.ID DESC
             LIMIT 1",
            $car_id
        ));

        return $post_id ? intval($post_id) : null;
    }
    
    /**
     * Save car meta data using ACF field names
     */
    private function save_car_meta_data($post_id, $formatted_car, $raw_car_data, $car_id, $market): void
    {

        $car_fields_group_id = 'group_684bf6aab475a';

        error_log("Car Auction: Saving META DATA...");

        // Basic car info using ACF field names
        update_post_meta($post_id, '_car_auction_id', $car_id);
        update_post_meta($post_id, '_car_auction_market', $market);
        
        // Map to ACF field names according to the provided list
        update_field('model', $formatted_car['model'] ?? '', $post_id);

        // Временно добавьте проверку перед сохранением

        update_field('car_year', intval($formatted_car['year'] ?? 0), $post_id);
        update_field('car_probeg', intval($formatted_car['mileage_numeric'] ?? 0), $post_id);
        
        $max_price = max($formatted_car['orig_finish_price'], $formatted_car['orig_finish_price'], $formatted_car['orig_avg_price']);
        
        update_field('price', intval( $max_price ), $post_id);

        // Map fuel type by code
        update_field('tip_topliva', $this->map_fuel_type($formatted_car['fuel'] ?? ''), $post_id);

        // Map transmission
        update_field('transmissiya', $this->map_transmission($formatted_car['transmission'] ?? ''), $post_id);

        // Map drive type
        update_field('privod', $this->map_drive_type($formatted_car['drive'] ?? ''), $post_id);

        // Additional text fields
        update_field('kuzov', $formatted_car['kuzov'] ?? '', $post_id);
        
        
        if (!empty($formatted_car['equipment'])) {
                        if (is_array($formatted_car['equipment'])) {
                            $equipment_items = $formatted_car['equipment'];
                        } else {
                            $equipment_items = array_filter(array_map('trim', explode(';', $formatted_car['equipment'])));
                        }
                    }
        
        
        
        //update_field('komplektaciya', $equipment_items ?? '', $post_id);
        update_field('obem_dvigatelya', $formatted_car['engine_volume'] ?? '', $post_id);
        update_field('ocenka_aukciona', $formatted_car['rate'] ?? '', $post_id);

        // Price breakdown fields
        update_field('stoimost_avto', number_format($formatted_car['calc_rub'] ?? 0) . ' ₽', $post_id);
        update_field('poshlina', 'Рассчитывается индивидуально', $post_id);
        update_field('tamozhnya', 'Рассчитывается индивидуально', $post_id);
        update_field('dostavka', 'Рассчитывается индивидуально', $post_id);
        update_field('kurs', 'Актуальный курс валют', $post_id);
        
        // Process images for fotografii repeater with download limit management
        if (!empty($formatted_car['images'])) {
            $fotografii = array();
            $pending_images = array(); // Для отслеживания изображений, которые не загружены

            foreach ($formatted_car['images'] as $image_url) {
                $image_data = array();

                // Пытаемся загрузить изображение
                $image_id = $this->process_image_with_limit($image_url, $post_id);

                if ($image_id) {
                    error_log("Car Auction: Image ID: {$image_id}");
                    // Если изображение загружено - формируем массив ACF
                    $image_data = array(
                        'foto' => array(
                            'ID' => $image_id,
                            'id' => $image_id,
                            'title' => get_the_title($image_id),
                            'filename' => basename(get_attached_file($image_id)),
                            'url' => wp_get_attachment_url($image_id), // Исправлено: $image_id вместо $image_url
                            'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true),
                            'caption' => wp_get_attachment_caption($image_id),
                            'description' => get_post($image_id)->post_content,
                            'mime_type' => get_post_mime_type($image_id),
                            'sizes' => array()
                        )
                    );
                } else {
                    error_log("Car Auction: Set URL for pending download: {$image_url}");
                    // Если лимит превышен - сохраняем как URL и помечаем для последующей загрузки
                    $image_data = array(
                        'foto' => array(
                            'url' => $image_url,
                            'pending_download' => true, // Маркер для крона
                            'title' => 'Image from API',
                            'alt' => 'Car image',
                            'caption' => '',
                            'description' => '',
                            'mime_type' => 'image/jpeg'
                        )
                    );
                    $pending_images[] = $image_url;
                }

                $fotografii[] = $image_data;
            }

            update_field('fotografii', $fotografii, $post_id);

            // Если есть изображения в ожидании загрузки, сохраняем их в мета-поле
            if (!empty($pending_images)) {
                update_post_meta($post_id, '_car_auction_pending_images', $pending_images);
                update_post_meta($post_id, '_car_auction_images_limit_reached', current_time('mysql'));
                error_log("Car Auction: Saved {count} pending images for post {$post_id}: " . implode(', ', $pending_images));
            }
            
        }

        if (!empty($formatted_car['tamozhennyj_list'])) {
            error_log("Car Auction: FOUND TAMOZHENYJ LIST Image:");
            //error_log("IN: " . print_r($formatted_car['tamozhennyj_list']));
            $tamozhennyj_list = array();
            $tamozhennyj_list_pending_images = array();

            $image_url = $formatted_car['tamozhennyj_list'];
            $image_data = array();

            // Пытаемся загрузить изображение
            $image_id = $this->process_image_with_limit($image_url, $post_id);

            if ($image_id) {
                error_log("Car Auction: Image ID: {$image_id}");
                // Если изображение загружено - формируем массив ACF
                $image_data = array(
                    'foto' => array(
                        'ID' => $image_id,
                        'id' => $image_id,
                        'title' => get_the_title($image_id),
                        'filename' => basename(get_attached_file($image_id)),
                        'url' => wp_get_attachment_url($image_id), // Исправлено: $image_id вместо $image_url
                        'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true),
                        'caption' => wp_get_attachment_caption($image_id),
                        'description' => get_post($image_id)->post_content,
                        'mime_type' => get_post_mime_type($image_id),
                        'sizes' => array()
                    )
                );
            } else {
                error_log("Car Auction: Set URL for pending download: {$image_url}");
                // Если лимит превышен - сохраняем как URL и помечаем для последующей загрузки
                $image_data = array(
                    'foto' => array(
                        'url' => $image_url,
                        'pending_download' => true, // Маркер для крона
                        'title' => 'Image from API',
                        'alt' => 'Car image',
                        'caption' => '',
                        'description' => '',
                        'mime_type' => 'image/jpeg'
                    )
                );
                $tamozhennyj_list_pending_images[] = $image_url;
            }

            $tamozhennyj_list[] = $image_data;

            update_field('tamozhennyj_list', $tamozhennyj_list, $post_id);

            // Если есть изображения в ожидании загрузки, сохраняем их в мета-поле
            if (!empty($tamozhennyj_list_pending_images)) {
                update_post_meta($post_id, '_car_auction_tamozhennyj_list_pending_images', $tamozhennyj_list_pending_images);
                update_post_meta($post_id, '_car_auction_tamozhennyj_list_images_limit_reached', current_time('mysql'));
                error_log("Car Auction: Saved {count} tamozhennyj list pending images for post {$post_id}: " . implode(', ', $tamozhennyj_list_pending_images));
            }
        }

        // Also process equipment/options if available
        if (!empty($formatted_car['info'])) {
            $opcii = array();

            $equipment = $formatted_car['info'] ?? '';
            $equipment_items = array();
            if (!empty($equipment)) {
                if (is_array($equipment)) {
                    $equipment_items = $equipment;
                } else {
                    $equipment_items = array_filter(array_map('trim', explode(';', $equipment)));
                }
                foreach ($equipment_items as $item) {
                    $item = trim($item);
                    if (!empty($item)) {
                        $opcii[] = array('tekst' => $item);
                    }
                }
            }

            // $equipment_items = is_array($formatted_car['info']) ? $formatted_car['info'] : explode(';', $formatted_car['info']);
            // foreach ($equipment_items as $item) {
            //     $item = trim($item);
            //     if (!empty($item)) {
            //         $opcii[] = array('tekst' => $item);
            //     }
            // }
            update_field('opcii', $opcii, $post_id);
        }
        
        // Store raw data for debugging
        update_post_meta($post_id, '_car_auction_raw_data', wp_json_encode($raw_car_data));
    }
    
    /**
     * Set car taxonomies
     */
    private function set_car_taxonomies($post_id, $formatted_car, $market): void
    {
        // Set brand taxonomy
        if (!empty($formatted_car['brand'])) {
            wp_set_object_terms($post_id, $formatted_car['brand'], 'brand');
        }
        
        // Set country taxonomy based on market
        $country_map = array(
            'main' => 'japan',
            'korea' => 'korea', 
            'china' => 'china',
            'bike' => 'bike',
            'che_available' => 'che_available'
        );
        $country = $country_map[$market] ?? 'japan';
        wp_set_object_terms($post_id, $country, 'country');
    }
    
    /**
     * Set featured image with download limit management
     */
    private function set_car_featured_image($post_id, $car): void
    {
        if (empty($car['images']) || !is_array($car['images'])) {
            return;
        }

        $main_image_url = $car['images'][0];
        if (empty($main_image_url)) {
            return;
        }

        // Try to download with limit check
        $today = date('Y-m-d');
        $daily_count_key = 'car_auction_daily_downloads_' . $today;
        $daily_count = get_transient($daily_count_key);

        if ($daily_count === false) {
            $daily_count = 0;
        }

        // Only try to download if under limit
        if ($daily_count < 2000) {
            $image_id = $this->download_and_attach_image($main_image_url, $post_id, $car['brand'] . ' ' . $car['model']);

            if ($image_id) {
                set_post_thumbnail($post_id, $image_id);
                // Increment counter (this download was already counted in process_image_with_limit, but featured image is separate)
                set_transient($daily_count_key, $daily_count + 1, DAY_IN_SECONDS);
            }
        }
        // If limit reached or download failed, we skip setting featured image
        // The image URLs will still be available in the ACF fields
    }
    
    /**
     * Download and attach image
     */
    private function download_and_attach_image($image_url, $post_id, $alt_text = ''): \WP_Error|bool|int
    {
        require_once(ABSPATH . 'wp-admin/includes/file.php');
        require_once(ABSPATH . 'wp-admin/includes/media.php');
        require_once(ABSPATH . 'wp-admin/includes/image.php');
        
        // Download file to temp location
        error_log("Car Auction: Start download for: {$image_url}");

        $tmp = download_url($image_url);
        if (is_wp_error($tmp)) {
            error_log("Car Auction: Have error whille download_url: " . json_encode($tmp));
            return false;
        }

        error_log("Car Auction: Download TMP: " . json_encode($tmp));
        
        // Get file name
        $filename = 'car-' . $post_id . '-' . md5($image_url) . '.jpg'; // Генерируем понятное имя
        
        // Upload
        $file_array = array(
            'name' => $filename, // Генерируем понятное имя
            'tmp_name' => $tmp,
            'error'    => 0,
	        'size'     => filesize($tmp),
        );

        $desc = '';
        
        $id = media_handle_sideload($file_array, $post_id, $alt_text);
        
        if (is_wp_error($id)) {
            $error_message = sprintf(
                "Car Auction: Failed to attach image - URL: %s | Error: %s | Post ID: %d",
                $image_url,
                $id->get_error_message(),
                $post_id
            );
            error_log($error_message);
            
            // Дополнительная информация о файле
            if (file_exists($tmp)) {
                error_log("Temp file info: " . print_r([
                    'size' => filesize($tmp),
                    'type' => mime_content_type($tmp)
                ], true));
            }
            
            @unlink($tmp);
            return false;
        }
        
        // Set alt text
        if (!empty($alt_text)) {
            update_post_meta($id, '_wp_attachment_image_alt', $alt_text);
        }
        
        return $id;
    }
    
    /**
     * Generate car content
     */
    private function generate_car_content($car): string
    {
        $content = '';
        
        // Main characteristics
        $content .= '<h2>Основные характеристики</h2>';
        $content .= '<ul>';
        
        if (!empty($car['brand'])) $content .= '<li><strong>Марка:</strong> ' . $car['brand'] . '</li>';
        if (!empty($car['model'])) $content .= '<li><strong>Модель:</strong> ' . $car['model'] . '</li>';
        if (!empty($car['year'])) $content .= '<li><strong>Год:</strong> ' . $car['year'] . '</li>';
        if (!empty($car['mileage_numeric'])) $content .= '<li><strong>Пробег:</strong> ' . number_format($car['mileage_numeric']) . ' км</li>';
        if (!empty($car['engine_volume'])) $content .= '<li><strong>Объем двигателя:</strong> ' . $car['engine_volume'] . '</li>';
        if (!empty($car['fuel_type'])) $content .= '<li><strong>Тип топлива:</strong> ' . $car['fuel_type'] . '</li>';
        if (!empty($car['grade'])) $content .= '<li><strong>Оценка:</strong> ' . $car['grade'] . '</li>';
        
        $content .= '</ul>';
        
        // Price info
        if (!empty($car['price'])) {
            $content .= '<h3>Цена</h3>';
            $content .= '<p><strong>Стоимость:</strong> ' . number_format($car['price']) . ' ' . ($car['currency'] ?? 'JPY') . '</p>';
        }
        
        return $content;
    }
    
    /**
     * Handle template for auto posts with car auction data
     */
    public function auto_template($template) {
        // Check if this is a single auto post with car auction data
        if (is_singular('auto')) {
            global $post;
            $car_auction_id = get_post_meta($post->ID, '_car_auction_id', true);
            
            if ($car_auction_id) {
                // This is a car auction auto post, try to use single-auto.php from theme
                $theme_template = locate_template('single-auto.php');
                if ($theme_template) {
                    return $theme_template;
                }
            }
        }
        
        // Check for URL-based car detail page
        if (get_query_var('car_auction_id')) {
            $theme_template = locate_template('single-auto.php');
            if ($theme_template) {
                return $theme_template;
            }
        }
        
        return $template;
    }

    /**
     * Map fuel type code to Russian name
     */
    private function map_fuel_type($fuel_code): string
    {
        $fuel_map = array(
            'H' => 'Гибрид (H)',
            'G' => 'Бензин',
            'D' => 'Дизель',
            'E' => 'Электро',
            'L' => 'Газ',
            'P' => 'Гибрид (P)',
            '&' => 'Гибрид (&)',
            '' => ''
        );
        return $fuel_map[$fuel_code] ?? $fuel_code;
    }

    /**
     * Map transmission code to Russian name
     */
    private function map_transmission($transmission_code): string
    {
        $transmission_map = array(
            'AT' => 'Автомат',
            'MT' => 'Механика',
            'CVT' => 'Вариатор',
            'FA' => 'FA',
            'IA' => 'IA',
            '' => ''
        );
        return $transmission_map[$transmission_code] ?? $transmission_code;
    }

    /**
     * Map drive type code to Russian name
     */
    private function map_drive_type($drive_code): string
    {
        $drive_map = array(
            'FF' => 'Передний',
            'FR' => 'Задний',
            'AWD' => 'Полный',
            '4WD' => 'Полный',
            '' => ''
        );
        return $drive_map[$drive_code] ?? $drive_code;
    }

    /**
     * Process image with daily download limit management
     */
    private function process_image_with_limit($image_url, $post_id): \WP_Error|bool|int
    {
        // Check daily download count
        $today = date('Y-m-d');
        $daily_count_key = 'car_auction_daily_downloads_' . $today;
        $daily_count = get_transient($daily_count_key);
        
        if ($daily_count === false) {
            $daily_count = 0;
        }

        // If under limit, try to download
        if ($daily_count < 2000) {
            error_log("Car Auction: Dayly Count: {$daily_count}");
            $downloaded_id = $this->download_and_attach_image($image_url, $post_id);

            error_log("Car Auction: Downloaded ID: {$downloaded_id}");
            
            if ($downloaded_id) {
                // Success - increment counter and return ID
                set_transient($daily_count_key, $daily_count + 1, DAY_IN_SECONDS);
                return $downloaded_id; // Возвращаем ID вложения
            }
        }
        
        // If limit reached or download failed - return false
        return false;
    }

    /**
     * Get current daily download count (for admin display)
     */
    public function get_daily_download_count(): int
    {
        $today = date('Y-m-d');
        $daily_count_key = 'car_auction_daily_downloads_' . $today;
        $daily_count = get_transient($daily_count_key);
        return $daily_count === false ? 0 : intval($daily_count);
    }

    /**
     * Atomic increment of daily download count
     * Uses WordPress cache for thread safety
     */
    public function increment_daily_download_count(): bool|int
    {
        $today = date('Y-m-d');
        $daily_count_key = 'car_auction_daily_downloads_' . $today;

        // Используем wp_cache для атомарного инкремента
        $daily_count = wp_cache_incr($daily_count_key, 1, 'car_auction_downloads');

        if ($daily_count === false) {
            // Первый инкремент сегодня
            $daily_count = 1;
            wp_cache_set($daily_count_key, $daily_count, 'car_auction_downloads', DAY_IN_SECONDS);
            set_transient($daily_count_key, $daily_count, DAY_IN_SECONDS);
        } else {
            // Обновляем transient для долговременного хранения
            set_transient($daily_count_key, $daily_count, DAY_IN_SECONDS);
        }

        return $daily_count;
    }

    /**
     * AJAX handler for manual post creation
     */
    public function ajax_create_post(): void
    {
        check_ajax_referer('car_auction_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_die('Insufficient permissions');
        }

        $car_id = sanitize_text_field($_POST['car_id'] ?? '');
        $market = sanitize_text_field($_POST['market'] ?? 'main');

        if (empty($car_id)) {
            wp_send_json_error('Car ID is required');
        }

        $post_id = $this->create_car_post($car_id, $market);

        if ($post_id) {
            wp_send_json_success(array(
                'post_id' => $post_id,
                'edit_link' => get_edit_post_link($post_id),
                'view_link' => get_permalink($post_id),
                'daily_downloads' => $this->get_daily_download_count()
            ));
        } else {
            wp_send_json_error('Failed to create post');
        }
    }

    /**
     * Process pending image downloads (called by cron)
     */
    /*
    public function process_pending_images() {
        // Получаем список постов с отложенными изображениями
        $posts_with_pending = get_posts(array(
            'post_type' => 'auto',
            'meta_key' => '_car_auction_pending_images',
            'posts_per_page' => 20, // Обрабатываем по 20 постов за раз
            'post_status' => 'publish'
        ));

        if (empty($posts_with_pending)) {
            error_log('Car Auction: No posts with pending images found');
            return;
        }

        $processed_count = 0;
        $images_downloaded = 0;

        foreach ($posts_with_pending as $post) {
            $pending_images = get_post_meta($post->ID, '_car_auction_pending_images', true);
            if (empty($pending_images)) {
                continue;
            }

            $tamozhennyj_list_pending_images = get_post_meta($post->ID, '_car_auction_tamozhennyj_list_pending_images', true);
            if (empty($tamozhennyj_list_pending_images)) {
                continue;
            }

            error_log("Car Auction: Processing post {$post->ID} with " . count($pending_images) . " pending images");

            // Получаем текущие фотографии
            $fotografii = get_field('fotografii', $post->ID);
            if (!$fotografii) {
                $fotografii = array();
            }

            $updated = false;
            $remaining_pending = array();

            // Обрабатываем каждое отложенное изображение
            foreach ($pending_images as $pending_url) {
                // Проверяем лимит на загрузку
                $today = date('Y-m-d');
                $daily_count_key = 'car_auction_daily_downloads_' . $today;
                $daily_count = get_transient($daily_count_key);

                if ($daily_count === false) {
                    // Если нет данных о счетчике - возможно новый день, начинаем с 0
                    $daily_count = 0;
                    set_transient($daily_count_key, 0, DAY_IN_SECONDS);
                }

                if ($daily_count >= 2000) {
                    // Лимит превышен, оставляем изображение в очереди
                    $remaining_pending[] = $pending_url;
                    continue;
                }

                // Пытаемся загрузить изображение
                $image_id = $this->download_and_attach_image($pending_url, $post->ID);

                if ($image_id) {
                    // Успешно загружено - обновляем запись в fotografii
                    foreach ($fotografii as &$foto_item) {
                        if (isset($foto_item['foto']['url']) &&
                            $foto_item['foto']['url'] === $pending_url &&
                            isset($foto_item['foto']['pending_download'])) {

                            // Заменяем URL на полную структуру изображения
                            $foto_item['foto'] = array(
                                'ID' => $image_id,
                                'id' => $image_id,
                                'title' => get_the_title($image_id),
                                'filename' => basename(get_attached_file($image_id)),
                                'url' => wp_get_attachment_url($image_id),
                                'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true),
                                'caption' => wp_get_attachment_caption($image_id),
                                'description' => get_post($image_id)->post_content,
                                'mime_type' => get_post_mime_type($image_id),
                                'sizes' => array()
                            );
                            unset($foto_item['foto']['pending_download']);
                            $updated = true;
                            break;
                        }
                    }

                    // Обновляем счетчик
                    set_transient($daily_count_key, $daily_count + 1, DAY_IN_SECONDS);
                    $images_downloaded++;

                    error_log("Car Auction: Successfully downloaded pending image for post {$post->ID}: $pending_url");
                } else {
                    // Ошибка загрузки - оставляем в очереди
                    $remaining_pending[] = $pending_url;
                    error_log("Car Auction: Failed to download pending image for post {$post->ID}: $pending_url");
                }
            }

            // Обновляем поля
            if ($updated) {
                update_field('fotografii', $fotografii, $post->ID);
            }

            // Обновляем список отложенных изображений
            if (empty($remaining_pending)) {
                // Все изображения загружены
                delete_post_meta($post->ID, '_car_auction_pending_images');
                delete_post_meta($post->ID, '_car_auction_images_limit_reached');
                error_log("Car Auction: All pending images processed for post {$post->ID}");
            } else {
                // Остались незагруженные изображения
                update_post_meta($post->ID, '_car_auction_pending_images', $remaining_pending);
            }

            $processed_count++;

            // Если достигли лимита - прекращаем обработку
            if ($daily_count >= 2000) {
                break;
            }
        }

        error_log("Car Auction: Processed {$processed_count} posts, downloaded {$images_downloaded} images");
    }
    */

        /**
     * Process pending image downloads (called by cron)
     */
    public function process_pending_images(): void
    {
        // Получаем список постов с отложенными изображениями
        $posts_with_pending = get_posts(array(
            'post_type' => 'auto',
            'meta_query' => array(
                'relation' => 'OR',
                array(
                    'key' => '_car_auction_pending_images',
                    'compare' => 'EXISTS'
                ),
                array(
                    'key' => '_car_auction_tamozhennyj_list_pending_images',
                    'compare' => 'EXISTS'
                )
            ),
            'posts_per_page' => 20, // Обрабатываем по 20 постов за раз
            'post_status' => 'publish'
        ));
        
        if (empty($posts_with_pending)) {
            error_log('Car Auction: No posts with pending images found');
            return;
        }
        
        $processed_count = 0;
        $images_downloaded = 0;
        $tamozhennyj_images_downloaded = 0;
        
        foreach ($posts_with_pending as $post) {
            $pending_images = get_post_meta($post->ID, '_car_auction_pending_images', true);
            $tamozhennyj_list_pending_images = get_post_meta($post->ID, '_car_auction_tamozhennyj_list_pending_images', true);
            
            if (empty($pending_images) && empty($tamozhennyj_list_pending_images)) {
                continue;
            }
            
            error_log("Car Auction: Processing post {$post->ID} with " . 
                     count($pending_images ?: []) . " pending images and " . 
                     count($tamozhennyj_list_pending_images ?: []) . " pending tamozhennyj list images");
            
            $updated_fotografii = false;
            $updated_tamozhennyj_list = false;
            
            // Обрабатываем основные фотографии
            if (!empty($pending_images)) {
                $result = $this->process_pending_images_batch($post, $pending_images, 'fotografii');
                $images_downloaded += $result['downloaded'];
                $updated_fotografii = $result['updated'];
                $pending_images = $result['remaining'];
            }
            
            // Обрабатываем таможенный лист
            if (!empty($tamozhennyj_list_pending_images)) {
                $result = $this->process_tamozhennyj_list_images($post, $tamozhennyj_list_pending_images);
                $tamozhennyj_images_downloaded += $result['downloaded'];
                $updated_tamozhennyj_list = $result['updated'];
                $tamozhennyj_list_pending_images = $result['remaining'];
            }
            
            // Обновляем метаданные
            $this->update_pending_images_metadata($post->ID, $pending_images, $tamozhennyj_list_pending_images);
            
            $processed_count++;
            
            // Проверяем дневной лимит
            $today = date('Y-m-d');
            $daily_count_key = 'car_auction_daily_downloads_' . $today;
            $daily_count = get_transient($daily_count_key) ?: 0;
            
            if ($daily_count >= 2000) {
                error_log("Car Auction: Daily download limit reached, stopping processing");
                break;
            }
        }
        
        error_log("Car Auction: Processed {$processed_count} posts, " .
                 "downloaded {$images_downloaded} main images and " .
                 "{$tamozhennyj_images_downloaded} tamozhennyj list images");
    }

        /**
     * Process tamozhennyj list images
     */
    private function process_tamozhennyj_list_images($post, $pending_images): array
    {
        $downloaded = 0;
        $updated = false;
        $remaining = array();
        
        // Получаем текущий таможенный лист
        $tamozhennyj_list = get_field('tamozhennyj_list', $post->ID);
        if (!$tamozhennyj_list) {
            $tamozhennyj_list = array();
        }
        
        foreach ($pending_images as $pending_url) {
            // Проверяем лими�� на загрузку
            $today = date('Y-m-d');
            $daily_count_key = 'car_auction_daily_downloads_' . $today;
            $daily_count = get_transient($daily_count_key) ?: 0;
            
            if ($daily_count >= 2000) {
                $remaining[] = $pending_url;
                continue;
            }
            
            // Пытаемся загрузить изображение
            $image_id = $this->download_and_attach_image($pending_url, $post->ID, 'Таможенный лист');
            
            if ($image_id) {
                // Успешно загружено - обновляем таможенный лист
                foreach ($tamozhennyj_list as &$tamozhennyj_item) {
                    if (isset($tamozhennyj_item['foto']['url']) &&
                        $tamozhennyj_item['foto']['url'] === $pending_url &&
                        isset($tamozhennyj_item['foto']['pending_download'])) {
                        
                        // Заменяем URL на полную структуру изображения
                        $tamozhennyj_item['foto'] = array(
                            'ID' => $image_id,
                            'id' => $image_id,
                            'title' => get_the_title($image_id),
                            'filename' => basename(get_attached_file($image_id)),
                            'url' => wp_get_attachment_url($image_id),
                            'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true),
                            'caption' => wp_get_attachment_caption($image_id),
                            'description' => get_post($image_id)->post_content,
                            'mime_type' => get_post_mime_type($image_id),
                            'sizes' => array()
                        );
                        unset($tamozhennyj_item['foto']['pending_download']);
                        $updated = true;
                        break;
                    }
                }
                
                // Обновляем счетчик
                set_transient($daily_count_key, $daily_count + 1, DAY_IN_SECONDS);
                $downloaded++;
                error_log("Car Auction: Successfully downloaded tamozhennyj list image for post {$post->ID}: $pending_url");
            } else {
                // Ошибка загрузки - оставляем в очереди
                $remaining[] = $pending_url;
                error_log("Car Auction: Failed to download tamozhennyj list image for post {$post->ID}: $pending_url");
            }
        }
        
        // Обновляем поле таможенного листа
        if ($updated) {
            update_field('tamozhennyj_list', $tamozhennyj_list, $post->ID);
        }
        
        return array(
            'downloaded' => $downloaded,
            'updated' => $updated,
            'remaining' => $remaining
        );
    }

        /**
     * Update pending images metadata
     */
    private function update_pending_images_metadata($post_id, $pending_images, $tamozhennyj_list_pending_images): void
    {
        // Обновляем основные изображения
        if (empty($pending_images)) {
            delete_post_meta($post_id, '_car_auction_pending_images');
        } else {
            update_post_meta($post_id, '_car_auction_pending_images', $pending_images);
        }
        
        // Обновляем таможенный лист
        if (empty($tamozhennyj_list_pending_images)) {
            delete_post_meta($post_id, '_car_auction_tamozhennyj_list_pending_images');
        } else {
            update_post_meta($post_id, '_car_auction_tamozhennyj_list_pending_images', $tamozhennyj_list_pending_images);
        }
        
        // Удаляем флаг лимита, если все изображения обработаны
        if (empty($pending_images) && empty($tamozhennyj_list_pending_images)) {
            delete_post_meta($post_id, '_car_auction_images_limit_reached');
            error_log("Car Auction: All pending images processed for post {$post_id}");
        }
    }
    
    /**
     * Process pending images batch (общая функция для обработки)
     */
    private function process_pending_images_batch($post, $pending_images, $field_name): array
    {
        $downloaded = 0;
        $updated = false;
        $remaining = array();
        
        $current_field = get_field($field_name, $post->ID);
        if (!$current_field) {
            $current_field = array();
        }
        
        foreach ($pending_images as $pending_url) {
            $today = date('Y-m-d');
            $daily_count_key = 'car_auction_daily_downloads_' . $today;
            $daily_count = get_transient($daily_count_key) ?: 0;
            
            if ($daily_count >= 2000) {
                $remaining[] = $pending_url;
                continue;
            }
            
            $image_id = $this->download_and_attach_image($pending_url, $post->ID);
            
            if ($image_id) {
                foreach ($current_field as &$field_item) {
                    if (isset($field_item['foto']['url']) &&
                        $field_item['foto']['url'] === $pending_url &&
                        isset($field_item['foto']['pending_download'])) {
                        
                        $field_item['foto'] = array(
                            'ID' => $image_id,
                            'id' => $image_id,
                            'title' => get_the_title($image_id),
                            'filename' => basename(get_attached_file($image_id)),
                            'url' => wp_get_attachment_url($image_id),
                            'alt' => get_post_meta($image_id, '_wp_attachment_image_alt', true),
                            'caption' => wp_get_attachment_caption($image_id),
                            'description' => get_post($image_id)->post_content,
                            'mime_type' => get_post_mime_type($image_id),
                            'sizes' => array()
                        );
                        unset($field_item['foto']['pending_download']);
                        $updated = true;
                        break;
                    }
                }
                
                set_transient($daily_count_key, $daily_count + 1, DAY_IN_SECONDS);
                $downloaded++;
                error_log("Car Auction: Successfully downloaded {$field_name} image for post {$post->ID}: $pending_url");
            } else {
                $remaining[] = $pending_url;
                error_log("Car Auction: Failed to download {$field_name} image for post {$post->ID}: $pending_url");
            }
        }
        
        if ($updated) {
            update_field($field_name, $current_field, $post->ID);
        }
        
        return array(
            'downloaded' => $downloaded,
            'updated' => $updated,
            'remaining' => $remaining
        );
    }

    /**
     * Get posts with pending images for admin display
     */
    public function get_posts_with_pending_images(): array
    {
        return get_posts(array(
            'post_type' => 'auto',
            'meta_key' => '_car_auction_pending_images',
            'posts_per_page' => -1,
            'post_status' => 'publish',
            'fields' => 'ids'
        ));
    }

    /**
     * Get count of pending images across all posts
     */
    public function get_pending_images_count(): int
    {
        global $wpdb;

        $result = $wpdb->get_var("
            SELECT SUM(CHAR_LENGTH(meta_value) - CHAR_LENGTH(REPLACE(meta_value, 'http', ''))) / 4
            FROM {$wpdb->postmeta}
            WHERE meta_key = '_car_auction_pending_images'
        ");

        return intval($result);
    }

    /**
     * Download and attach image with improved error handling and fallback
     */
    private function download_and_attach_image_with_fallback($image_url, $post_id) {
        $result = array(
            'image_id' => false,
            'error' => '',
            'fallback_used' => false
        );

        if (empty($image_url)) {
            $result['error'] = 'Empty image URL';
            return $result;
        }

        // Try primary download method
        try {
            $image_id = $this->download_and_attach_image($image_url, $post_id);

            if ($image_id) {
                $result['image_id'] = $image_id;
                return $result;
            }
        } catch (Exception $e) {
            $result['error'] = 'Primary download failed: ' . $e->getMessage();
        }

        // Try fallback method with different headers
        try {
            $image_id = $this->download_and_attach_image_fallback($image_url, $post_id);

            if ($image_id) {
                $result['image_id'] = $image_id;
                $result['fallback_used'] = true;
                return $result;
            }
        } catch (Exception $e) {
            $result['error'] .= '; Fallback failed: ' . $e->getMessage();
        }

        return $result;
    }

    /**
     * Fallback method for downloading images with different headers and retry logic
     */
    private function download_and_attach_image_fallback($image_url, $post_id) {
        // Add different user agents and headers for problematic servers
        $contexts = array(
            array(
                'user-agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'referer' => 'https://www.google.com/',
                'accept' => 'image/webp,image/apng,image/*,*/*;q=0.8'
            ),
            array(
                'user-agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
                'referer' => 'https://avto.jp/',
                'accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            )
        );

        foreach ($contexts as $context) {
            try {
                // Use wp_remote_get with custom headers
                $response = wp_remote_get($image_url, array(
                    'timeout' => 30,
                    'headers' => $context,
                    'user-agent' => $context['user-agent']
                ));

                if (is_wp_error($response)) {
                    continue;
                }

                $response_code = wp_remote_retrieve_response_code($response);
                if ($response_code !== 200) {
                    continue;
                }

                $image_data = wp_remote_retrieve_body($response);
                if (empty($image_data)) {
                    continue;
                }

                // Validate image data
                $image_info = getimagesizefromstring($image_data);
                if ($image_info === false) {
                    continue;
                }

                // Generate filename
                $filename = basename(parse_url($image_url, PHP_URL_PATH));
                if (empty($filename) || strpos($filename, '.') === false) {
                    $ext = $this->get_extension_from_mime($image_info['mime']);
                    $filename = 'car_image_' . time() . '_' . uniqid() . '.' . $ext;
                }

                // Upload the file
                $upload = wp_upload_bits($filename, null, $image_data);

                if ($upload['error']) {
                    continue;
                }

                // Create attachment
                $attachment_data = array(
                    'post_title' => sanitize_file_name(pathinfo($filename, PATHINFO_FILENAME)),
                    'post_content' => '',
                    'post_status' => 'inherit',
                    'post_parent' => $post_id,
                    'post_mime_type' => $image_info['mime']
                );

                $attachment_id = wp_insert_attachment($attachment_data, $upload['file'], $post_id);

                if (!is_wp_error($attachment_id)) {
                    // Generate metadata
                    require_once(ABSPATH . 'wp-admin/includes/image.php');
                    $attachment_metadata = wp_generate_attachment_metadata($attachment_id, $upload['file']);
                    wp_update_attachment_metadata($attachment_id, $attachment_metadata);

                    return $attachment_id;
                }

            } catch (Exception $e) {
                error_log('Car Auction Fallback Download Error: ' . $e->getMessage());
                continue;
            }
        }

        return false;
    }

    /**
     * Get file extension from MIME type
     */
    private function get_extension_from_mime($mime_type) {
        $mime_to_ext = array(
            'image/jpeg' => 'jpg',
            'image/jpg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'image/bmp' => 'bmp'
        );

        return $mime_to_ext[$mime_type] ?? 'jpg';
    }

    /**
     * Enhanced pending image processing with better error handling and retry logic
     */
    public function process_pending_images_enhanced() {
        // Получаем список постов с отложенными изображениями
        $posts_with_pending = get_posts(array(
            'post_type' => 'auto',
            'meta_key' => '_car_auction_pending_images',
            'posts_per_page' => 10, // Уменьшаем batch для лучшей производительности
            'post_status' => 'publish'
        ));

        if (empty($posts_with_pending)) {
            return array('processed' => 0, 'downloaded' => 0, 'errors' => array());
        }

        $processed_count = 0;
        $images_downloaded = 0;
        $errors = array();
        $max_daily_limit = intval(get_option('car_auction_max_images_per_day', 2000));

        foreach ($posts_with_pending as $post) {
            // Проверяем дневной лимит
            $daily_count = $this->get_daily_download_count();
            if ($daily_count >= $max_daily_limit) {
                break;
            }

            $pending_images = get_post_meta($post->ID, '_car_auction_pending_images', true);
            if (empty($pending_images)) {
                continue;
            }

            $fotografii = get_field('fotografii', $post->ID);
            if (!$fotografii) {
                $fotografii = array();
            }

            $updated = false;
            $remaining_pending = array();

            foreach ($pending_images as $pending_item) {
                // Проверяем лимит еще раз
                $daily_count = $this->get_daily_download_count();
                if ($daily_count >= $max_daily_limit) {
                    $remaining_pending[] = $pending_item;
                    continue;
                }

                $pending_url = is_array($pending_item) ? $pending_item['url'] : $pending_item;
                $retry_count = is_array($pending_item) ? ($pending_item['retry_count'] ?? 0) : 0;

                // Максимум 3 попытки загрузки
                if ($retry_count >= 3) {
                    $errors[] = "Max retries exceeded for {$pending_url} in post {$post->ID}";
                    continue; // Удаляем из очереди
                }

                $download_result = $this->download_and_attach_image_with_fallback($pending_url, $post->ID);

                if ($download_result['image_id']) {
                    // Успешно загружено - обновляем fotografii
                    foreach ($fotografii as &$foto_item) {
                        if (isset($foto_item['foto']['url']) &&
                            $foto_item['foto']['url'] === $pending_url &&
                            isset($foto_item['foto']['pending_download'])) {

                            $foto_item['foto'] = array(
                                'ID' => $download_result['image_id'],
                                'id' => $download_result['image_id'],
                                'title' => get_the_title($download_result['image_id']),
                                'filename' => basename(get_attached_file($download_result['image_id'])),
                                'url' => wp_get_attachment_url($download_result['image_id']),
                                'alt' => get_post_meta($download_result['image_id'], '_wp_attachment_image_alt', true),
                                'caption' => wp_get_attachment_caption($download_result['image_id']),
                                'description' => get_post($download_result['image_id'])->post_content,
                                'mime_type' => get_post_mime_type($download_result['image_id']),
                                'sizes' => array()
                            );
                            unset($foto_item['foto']['pending_download']);
                            $updated = true;
                            break;
                        }
                    }

                    $this->increment_daily_download_count();
                    $images_downloaded++;

                    if ($download_result['fallback_used']) {
                        error_log("Car Auction: Downloaded pending image using fallback for post {$post->ID}: {$pending_url}");
                    }

                } else {
                    // Неудача - увеличиваем счетчик попыток и оставляем в очереди
                    $remaining_pending[] = array(
                        'url' => $pending_url,
                        'retry_count' => $retry_count + 1,
                        'last_error' => $download_result['error'],
                        'last_attempt' => current_time('mysql')
                    );

                    $errors[] = "Failed to download {$pending_url} for post {$post->ID}: {$download_result['error']}";
                }
            }

            // Обновляем поля
            if ($updated) {
                update_field('fotografii', $fotografii, $post->ID);
            }

            // Обновляем список отложенных изображений
            if (empty($remaining_pending)) {
                delete_post_meta($post->ID, '_car_auction_pending_images');
                delete_post_meta($post->ID, '_car_auction_images_limit_reached');
            } else {
                update_post_meta($post->ID, '_car_auction_pending_images', $remaining_pending);
            }

            $processed_count++;
        }

        return array(
            'processed' => $processed_count,
            'downloaded' => $images_downloaded,
            'errors' => $errors
        );
    }

    /**
     * Update queue status
     */
    private function update_queue_status($car_id, $market, $status, $error_message = null, $wp_post_id = null) {
        global $wpdb;
        $queue_table = $wpdb->prefix . 'car_auction_post_queue';

        $update_data = array(
            'status' => $status,
            'processed_at' => current_time('mysql')
        );

        if ($error_message) {
            $update_data['error_message'] = $error_message;
            // Increment attempts manually
            $wpdb->query($wpdb->prepare(
                "UPDATE $queue_table SET attempts = attempts + 1 WHERE car_id = %s AND market = %s",
                $car_id, $market
            ));
        }

        if ($wp_post_id) {
            $update_data['wp_post_id'] = $wp_post_id;
        }

        $wpdb->update(
            $queue_table,
            $update_data,
            array('car_id' => $car_id, 'market' => $market),
            array('%s', '%s', '%s', '%d'),
            array('%s', '%s')
        );
    }
}
