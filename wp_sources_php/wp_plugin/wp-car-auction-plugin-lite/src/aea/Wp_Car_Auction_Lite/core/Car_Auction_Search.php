<?php
/**
 * Car Auction Search Class
 * 
 * Handles search functionality and frontend display
 */

namespace aea\Wp_Car_Auction_Lite\core;

use aea\Wp_Car_Auction_Lite\api\Car_Auction_API;
use aea\Wp_Car_Auction_Lite\core\Car_Auction_Indexer;
use aea\Wp_Car_Auction_Lite\Wp_Car_Auction_Plugin_Lite;
use aea\Wp_Car_Auction_Lite\shortcodes\renders\Render_Search_Result;
use Exception;

use function __ as translate;
use function esc_attr as translate_esc_attr;
use function _e as translate_echo;
use function _n as translate_n;
use function _x as translate_x;


if (!defined('ABSPATH')) {
    exit;
}

class Car_Auction_Search {
    
    private Car_Auction_API $api;
    private Car_Auction_Indexer $indexer;
    private Car_Auction_Auto_Creator $creator;
    private Render_Search_Result $render_result;

    public function __construct(Car_Auction_API $api, Car_Auction_Indexer $indexer, Car_Auction_Auto_Creator $creator) {
        $this->api = $api;
        $this->indexer = $indexer;
        $this->creator = $creator;
        $this->render_result = Wp_Car_Auction_Plugin_Lite::getRenderSearchResult();
        
        add_action('wp_ajax_car_auction_search', array($this, 'ajax_search'));
        add_action('wp_ajax_nopriv_car_auction_search', array($this, 'ajax_search'));

        add_action('wp_ajax_car_auction_get_models', array($this, 'ajax_get_models'));
        add_action('wp_ajax_nopriv_car_auction_get_models', array($this, 'ajax_get_models'));

        add_action('wp_ajax_car_auction_get_car_details', array($this, 'ajax_get_car_details'));
        add_action('wp_ajax_nopriv_car_auction_get_car_details', array($this, 'ajax_get_car_details'));

        // AJAX handler for HTML search results with calculated prices
        add_action('wp_ajax_car_auction_html_search', array($this, 'ajax_html_search'));
        add_action('wp_ajax_nopriv_car_auction_html_search', array($this, 'ajax_html_search'));

        // AJAX handler for theme search (legacy compatibility)
        add_action('wp_ajax_car_auction_theme_search', array($this, 'ajax_html_search'));
        add_action('wp_ajax_nopriv_car_auction_theme_search', array($this, 'ajax_html_search'));

        // AJAX handler for auto-results pagination
        add_action('wp_ajax_car_auction_load_auto_results', array($this, 'ajax_load_auto_results'));
        add_action('wp_ajax_nopriv_car_auction_load_auto_results', array($this, 'ajax_load_auto_results'));

        // AJAX handler for dynamic filters
        add_action('wp_ajax_car_auction_get_dynamic_filters', array($this, 'ajax_get_dynamic_filters'));
        add_action('wp_ajax_nopriv_car_auction_get_dynamic_filters', array($this, 'ajax_get_dynamic_filters'));

        // AJAX handlers for car indexing and redirection are handled by Car_Auction_AJAX_Indexer class

        // Add rewrite rules for car detail pages (high priority)
        add_action('init', array($this, 'add_rewrite_rules'), 5);
        add_filter('query_vars', array($this, 'add_query_vars'), 5);
        add_action('template_redirect', array($this, 'handle_car_detail_page'), 5);
        add_filter('template_include', array($this, 'template_include_car_detail'), 1);

        // Alternative mechanism for handling requests (highest priority)
        add_action('parse_request', array($this, 'parse_car_detail_request'), 1);
    }
    
    /**
     * Add rewrite rules for SEO-friendly URLs
     * Format: /cars/{market_name}/{brand_slug}-{model_slug}/{car_id}/
     */
    public function add_rewrite_rules() {
        // Only log when debug mode is enabled
        if (get_option('car_auction_debug_mode', false)) {
            error_log('Car Auction: add_rewrite_rules called');
        }

        // Main cars detail page: /cars/{market_name}/{brand}-{model}/{car_id}/
        add_rewrite_rule(
            '^cars/([^/]+)/([^/]+)/([^/]+)/?$',
            'index.php?car_auction_indexing=1&car_auction_market=$matches[1]&car_auction_brand_model=$matches[2]&car_auction_id=$matches[3]',
            'top'
        );

        // Force immediate flush
        global $wp_rewrite;
        $rules_version = 'v4.0-fixed-urls';
        if (!get_option('car_auction_rules_flushed_' . $rules_version, false)) {
            flush_rewrite_rules(false); // Use WordPress function instead
            update_option('car_auction_rules_flushed_' . $rules_version, true);
            error_log('Car Auction: Forced rewrite rules flush for version ' . $rules_version);
        }

        // Debug: log rewrite rules addition
        if (get_option('car_auction_debug_mode', false)) {
            error_log('Car Auction: Added rewrite rules for detail pages');
        }
    }
    
    /**
     * Add custom query vars
     */
    public function add_query_vars($vars) {
        $vars[] = 'car_auction_indexing';
        $vars[] = 'car_auction_market';
        $vars[] = 'car_auction_brand_model';
        $vars[] = 'car_auction_id';
        return $vars;
    }
    
    /**
     * Handle car detail page - index car and redirect to proper auto post
     */
    public function handle_car_detail_page() {
        // Check if this is a car indexing request
        if (!get_query_var('car_auction_indexing')) {
            return;
        }

        $market_name = get_query_var('car_auction_market');
        $brand_model = get_query_var('car_auction_brand_model');
        $car_id = get_query_var('car_auction_id');

        // Only proceed if this is a full car detail URL: /cars/market/brand-model/car_id/
        if (!$market_name || !$brand_model || !$car_id) {
            return;
        }

        if (get_option('car_auction_debug_mode', false)) {
            error_log("Car Auction: Processing car detail request - Market: $market_name, Brand-Model: $brand_model, Car ID: $car_id");
        }

        // First, check if auto post already exists
        $existing_auto = $this->find_existing_auto_post($car_id);

        if ($existing_auto) {
            // Post exists, redirect to it
            $permalink = get_permalink($existing_auto->ID);
            error_log("Car Auction: Found existing auto post ID {$existing_auto->ID}, redirecting to: $permalink");
            wp_redirect($permalink, 301);
            exit;
        }

        // Post doesn't exist, index the car and create auto post
        $auto_post_id = $this->index_and_create_auto_post($car_id, $market_name);

        if ($auto_post_id) {
            $permalink = get_permalink($auto_post_id);
            error_log("Car Auction: Created new auto post ID $auto_post_id, redirecting to: $permalink");
            wp_redirect($permalink, 301);
            exit;
        } else {
            // Failed to create post, show 404
            error_log("Car Auction: Failed to index and create auto post for car ID: $car_id");
            global $wp_query;
            $wp_query->set_404();
            status_header(404);
        }
            $internal_market = $this->market_name_to_code($market_name);

            // Parse brand and model from the slug (brand-model). We only split on first hyphen to preserve model dashes.
            $brand = '';
            $model = '';
            if (!empty($brand_model)) {
                if (strpos($brand_model, '-') !== false) {
                    $parts = explode('-', $brand_model, 2);
                    $brand = urldecode($parts[0]);
                    $model = urldecode($parts[1]);
                } else {
                    $brand = urldecode($brand_model);
                    $model = '';
                }
            }

            // Set up global data for theme to use (include both brand/model separately for breadcrumbs)
            global $car_auction_detail_data;
            $car_auction_detail_data = array(
                'car_id' => $car_id,
                'market_name' => $market_name,
                'market' => $internal_market,
                'brand_model' => $brand_model,
                'brand' => $brand,
                'model' => $model
            );

            // Index this car view for SEO
            $this->index_car_view($car_id, $internal_market);

            // Let WordPress know this is a valid page (prevents 404)
            global $wp_query;
            $wp_query->is_404 = false;
            $wp_query->is_page = true;
            $wp_query->is_singular = true;
            $wp_query->is_home = false;
            $wp_query->is_archive = false;
            status_header(200);

            if (get_option('car_auction_debug_mode', false)) {
                error_log("Car Auction: Set query flags for car detail page");
            }
    }

    /**
     * Convert user-friendly market name to internal market code
     */
    private function market_name_to_code($market_name) {
        $mapping = array(
            'japan' => 'main',
            'korea' => 'korea',
            'china' => 'china',
            'bike' => 'bike',
            'che_available' => 'che_available'
        );
        return $mapping[$market_name] ?? 'main';
    }

    /**
     * Convert internal market code to user-friendly market name
     */
    private function market_code_to_name($market_code) {
        $mapping = array(
            'main' => 'japan',
            'korea' => 'korea',
            'china' => 'china',
            'bike' => 'bike'
        );
        return $mapping[$market_code] ?? 'japan';
    }

    /**
     * Legacy function - Convert user-friendly country name to internal market name
     */
    private function country_to_market($country) {
        return $this->market_name_to_code($country);
    }

    /**
     * Legacy function - Convert internal market name to user-friendly country name
     */
    private function market_to_country($market) {
        return $this->market_code_to_name($market);
    }

    /**
     * Include car detail template
     */
    public function template_include_car_detail($template) {
        $is_car_detail = get_query_var('car_auction_detail');

        // Only log when debug mode is enabled
        if (get_option('car_auction_debug_mode', false)) {
            error_log('Car Auction: template_include_car_detail called, is_car_detail=' . ($is_car_detail ? 'YES' : 'NO'));
        }

        if (!$is_car_detail) {
            return $template;
        }

        // Debug
        if (get_option('car_auction_debug_mode', false)) {
            error_log('Car Auction: template_include_car_detail triggered for car detail page');
        }

        // Look for single-auto.php in current theme
        $theme_template = locate_template('single-auto.php');
        if ($theme_template) {
            if (get_option('car_auction_debug_mode', false)) {
                error_log('Car Auction: Using theme template: ' . $theme_template);
            }
            return $theme_template;
        }

        // Fallback - check if we have a valid car detail request
        $market_name = get_query_var('car_auction_market');
        $car_id = get_query_var('car_auction_id');

        if ($market_name && $car_id) {
            // Force WordPress to think this is a valid page
            global $wp_query;
            $wp_query->is_404 = false;
            $wp_query->is_page = true;
            $wp_query->is_singular = true;
            status_header(200);

            if (get_option('car_auction_debug_mode', false)) {
                error_log('Car Auction: Set query flags, looking for template');
            }

            // Use index.php as fallback and let single-auto.php logic handle it
            return get_index_template();
        }

        return $template;
    }

    /**
     * Alternative method to parse car detail requests
     */
    public function parse_car_detail_request($wp) {
        $request_uri = $_SERVER['REQUEST_URI'] ?? '';

        // Remove query string and leading/trailing slashes
        $request_uri = strtok($request_uri, '?');
        $request_uri = trim($request_uri, '/');

        // Only log when there is an actual car URL to avoid spam
        if (!empty($request_uri) && strpos($request_uri, 'cars/') !== false && get_option('car_auction_debug_mode', false)) {
            error_log("Car Auction: parse_car_detail_request called with URI: $request_uri");
        }

        if (get_option('car_auction_debug_mode', false)) {
            //error_log("Car Auction: REQUEST_URI before processing: " . ($_SERVER['REQUEST_URI'] ?? 'not set'));
            //error_log("Car Auction: REQUEST_URI after trim: $request_uri");
        }

        // Check if this is a car detail request: cars/market_name/brand-model/car_id
        // ONLY support full format for SEO compliance: /cars/{market_name}/{brand_slug}-{model_slug}/{car_id}/
        if (preg_match('#^cars/([^/]+)/([^/]+)/([A-Za-z0-9]+)/?$#', $request_uri, $matches)) {
            $market_name = $matches[1];
            $brand_model = $matches[2];
            $car_id = $matches[3]; // Preserve exact case for car ID

            if (get_option('car_auction_debug_mode', false)) {
                error_log("Car Auction: Full format match found - Market: $market_name, Brand-Model: $brand_model, Car ID: $car_id");
            }

            // Set query vars manually
            $wp->query_vars['car_auction_detail'] = '1';
            $wp->query_vars['car_auction_market'] = $market_name;
            $wp->query_vars['car_auction_brand_model'] = $brand_model;
            $wp->query_vars['car_auction_id'] = $car_id;

            // Prevent WordPress from trying to find a post
            $wp->did_permalink = true;

            if (get_option('car_auction_debug_mode', false)) {
                error_log("Car Auction: Set query vars for full format URL");
            }
        } else {
            if (get_option('car_auction_debug_mode', false)) {
                //error_log("Car Auction: No URL pattern match for: $request_uri (only full format /cars/market/brand-model/car_id/ is supported)");
            }
        }
    }


    
    /**
     * Get car data for theme - public function
     */
    public function get_car_data_for_theme($car_id, $market): bool|array
    {
        $car_data = $this->api->get_car_details($car_id, $market);

        if (!$car_data) {
            return false;
        }

        return $car_data;
    }

    /**
     * Index car view for SEO
     */
    private function index_car_view($car_id, $market) {
        if (get_option('car_auction_debug_mode', false)) {
            error_log("Car Auction: index_car_view called for car_id: {$car_id}, market: {$market}");
        }

        if (get_option('car_auction_auto_index', 'yes') !== 'yes') {
            if (get_option('car_auction_debug_mode', false)) {
                error_log("Car Auction: Auto indexing is disabled");
            }
            return;
        }

        if (get_option('car_auction_debug_mode', false)) {
            error_log("Car Auction: Auto indexing is enabled, proceeding...");
        }

        global $wpdb;
        $table = $wpdb->prefix . 'car_auction_indexed';

        // Check if already indexed
        $exists = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $table WHERE car_id = %s",
            $car_id
        ));

        if ($exists) {
            // Update view count
            $wpdb->query($wpdb->prepare(
                "UPDATE $table SET viewed_count = viewed_count + 1 WHERE car_id = %s",
                $car_id
            ));

            // Create WordPress post if enabled and not already created
            if (get_option('car_auction_create_wp_posts', 'no') === 'yes') {
                $this->maybe_create_wordpress_post($car_id, $market);
            }
        } else {
            // Get car data and index it using the Indexer class
            $car_data = $this->api->get_car_details($car_id, $market);
            if ($car_data) {
                // Use Indexer class for proper indexing
                if (class_exists('aea\Wp_Car_Auction_Lite\core\Car_Auction_Indexer')) {
                    $index_result = $this->indexer->index_single_car($car_data, $market);

                    if ($index_result) {
                        if (get_option('car_auction_debug_mode', false)) {
                            error_log("Car Auction: Successfully indexed car {$car_id} using Indexer class");
                        }

                        // Create WordPress post if enabled
                        if (get_option('car_auction_create_wp_posts', 'no') === 'yes') {
                            // Schedule post creation
                            wp_schedule_single_event(time() + 30, 'car_auction_create_wp_post', array($car_id, $market));
                        }
                    }
                } else {
                    // Fallback to old method if Indexer class not available
                    $this->index_new_car($car_data, $market);
                }
            }
        }
    }
    
    /**
     * Maybe index car if it doesn't exist yet
     */
    private function maybe_index_car($car_id, $market, $car_data) {
        global $wpdb;
        $table = $wpdb->prefix . 'car_auction_indexed';

        // Check if already indexed
        $exists = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $table WHERE car_id = %s",
            $car_id
        ));

        if (!$exists) {
            // Use Indexer class for proper indexing
            if (class_exists('aea\Wp_Car_Auction_Lite\core\Car_Auction_Indexer')) {
                $index_result = $this->indexer->index_single_car($car_data, $market);

                if ($index_result) {
                    // Schedule WordPress post creation if enabled
                    if (get_option('car_auction_create_wp_posts', 'no') === 'yes') {
                        wp_schedule_single_event(time() + 30, 'car_auction_create_wp_post', array($car_id, $market));
                    }
                }
            } else {
                // Fallback to old method
                $this->index_new_car($car_data, $market);

                // Schedule WordPress post creation if enabled
                if (get_option('car_auction_create_wp_posts', 'no') === 'yes') {
                    wp_schedule_single_event(time() + 30, 'car_auction_create_wp_post', array($car_id, $market));
                }
            }
        }
    }

    /**
     * Maybe create WordPress post for indexed car
     */
    private function maybe_create_wordpress_post($car_id, $market) {
        // Check if post already exists
        $existing_post = get_posts(array(
            'post_type' => 'auto',
            'meta_key' => '_car_auction_id',
            'meta_value' => $car_id,
            'post_status' => 'any',
            'numberposts' => 1
        ));

        if (empty($existing_post)) {
            // Schedule post creation
            wp_schedule_single_event(time() + 30, 'car_auction_create_wp_post', array($car_id, $market));

            // Если WP-Cron отключен, попробуем создать пост немедленно (фолбэк)
            if (defined('DISABLE_WP_CRON') && DISABLE_WP_CRON === true) {
                if (isset($this->creator) && method_exists($this->creator, 'create_car_post')) {
                    try {
                        error_log("Car Auction: WP-Cron disabled — attempting immediate create_car_post for {$car_id}");
                        $created = $this->creator->create_car_post($car_id, $market);
                        if ($created) {
                            error_log("Car Auction: Immediate post creation succeeded for car {$car_id}, post ID: {$created}");
                        } else {
                            error_log("Car Auction: Immediate post creation failed for car {$car_id}");
                        }
                    } catch (\Exception $e) {
                        error_log("Car Auction: Exception in immediate post creation for car {$car_id}: " . $e->getMessage());
                    }
                }
            }
        }
    }

    /**
     * Index new car
     */
    private function index_new_car($car_data, $market) {
        global $wpdb;
        $table = $wpdb->prefix . 'car_auction_indexed';
        
        $wpdb->insert($table, array(
            'car_id' => $car_data['ID'],
            'market' => $market,
            'lot_number' => $car_data['LOT'] ?? null,
            'brand' => $car_data['MARKA_NAME'] ?? '',
            'model' => $car_data['MODEL_NAME'] ?? '',
            'year' => $car_data['YEAR'] ?? null,
            'engine_volume' => $car_data['ENG_V'] ?? null,
            'mileage_numeric' => $car_data['MILEAGE'] ?? null,
            'price_start' => $car_data['START'] ?? null,
            'price_finish' => $car_data['FINISH'] ?? null,
            'currency' => $this->get_market_currency($market),
            'images' => $car_data['IMAGES'] ?? '',
            'data' => json_encode($car_data),
            'viewed_count' => 1
        ), array(
            '%s', '%s', '%d', '%s', '%s', '%d', '%d', '%d', '%d', '%d', '%s', '%s', '%s', '%d'
        ));
        
        // Schedule image download if enabled
        $this->schedule_image_download($car_data['ID'], $car_data['IMAGES'] ?? '');
    }
    
    /**
     * Get market currency
     */
    private function get_market_currency($market) {
        $currencies = array(
            'main' => 'JPY',
            'korea' => 'KRW', 
            'china' => 'CNY',
            'che_available' => 'CNY',
            'bike' => '-',
            'stats' => 'JPY'
        );
        
        return $currencies[$market] ?? 'JPY';
    }
    
    /**
     * Schedule image download
     */
    private function schedule_image_download($car_id, $images) {
        $max_images = intval(get_option('car_auction_max_images_per_day', 2000));
        
        if ($max_images <= 0) {
            return; // Unlimited or disabled
        }
        
        // Check daily download count
        global $wpdb;
        $today_count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}car_auction_indexed 
             WHERE DATE(indexed_at) = CURDATE() AND images != ''"
        ));
        
        if ($today_count >= $max_images) {
            return; // Daily limit reached
        }
        
        // Schedule for background processing
        wp_schedule_single_event(time() + 60, 'car_auction_download_images', array($car_id, $images));
    }
    
    /**
     * Get fuel type name by code
     */
    private function get_fuel_name($fuel_code) {
        return $this->api->get_fuel_name($fuel_code);
    }

    /**
     * AJAX search handler
     */
    public function ajax_search() {
        // Enable detailed error logging for debugging
        $debug_mode = get_option('car_auction_debug_mode', false);

        try {
            // Check nonce for security
            if (!wp_verify_nonce($_POST['nonce'] ?? '', 'car_auction_nonce')) {
                wp_send_json_error('Недействительный запрос (nonce error)');
                return;
            }

            $market = sanitize_text_field($_POST['market'] ?? 'main');
            $filters = $_POST['filters'] ?? array();

            if ($debug_mode) {
                error_log('Car Auction AJAX Search: Market=' . $market . ', Filters=' . print_r($filters, true));
            }

            // Validate market
            $allowed_markets = array('main', 'korea', 'china', 'bike', 'stats', 'che_available');
            if (!in_array($market, $allowed_markets)) {
                wp_send_json_error('Недопустимый рынок: ' . $market);
                return;
            }

            // Sanitize filters
            $sanitized_filters = array();
            $allowed_filters = array(
                'vendor', 'model', 'year_from', 'year_to', 'engine_from', 'engine_to',
                'mileage_from', 'mileage_to', 'kuzov', 'lot_number', 'page',
                'fuel_type', 'transmission', 'transmission_group', 'drive', 'price_from', 'price_to'
            );

            foreach ($allowed_filters as $filter) {
                if (isset($filters[$filter]) && $filters[$filter] !== '') {
                    $sanitized_filters[$filter] = sanitize_text_field($filters[$filter]);
                }
            }

            if ($debug_mode) {
                error_log('Car Auction AJAX Search: Sanitized filters=' . print_r($sanitized_filters, true));
            }
            // Call API
            $results = $this->api->search_cars($market, $sanitized_filters);

            if ($debug_mode) {
                error_log('Car Auction AJAX Search: API results=' . print_r(array(
                    'has_error' => isset($results['error']),
                    'error' => $results['error'] ?? null,
                    'total_cars' => isset($results['cars']) ? count($results['cars']) : 0,
                    'total' => $results['pagination']['total'] ?? 0
                ), true));
            }

            if (isset($results['error'])) {
                wp_send_json_error('Ошибка API: ' . $results['error']);
                return;
            }

            if (!isset($results['cars']) || !is_array($results['cars'])) {
                wp_send_json_error('API не вернул массив автомобилей');
                return;
            }

            if ($debug_mode) {
                error_log('Car Auction AJAX Search: Formatted ' . $results['pagination']['total'] . ' cars successfully; total=' . $results['pagination']['total']);
            }

            wp_send_json_success($results);

        } catch (Exception $e) {
            error_log('Car Auction AJAX Search Exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            wp_send_json_error('Внутренняя ошибка: ' . $e->getMessage());
        }
    }

    /**
     * AJAX HTML search handler - returns formatted HTML cards
     */
    public function ajax_html_search() {
        try {
            // Check nonce for security
            if (!wp_verify_nonce($_POST['nonce'] ?? '', 'car_auction_nonce')) {
                wp_send_json_error('Недействительный запрос (nonce error)');
                return;
            }

            $market = sanitize_text_field($_POST['market'] ?? 'main');
            $filters = $_POST['filters'] ?? array();

            // Debug log for URL filters
            if (get_option('car_auction_debug_mode', false)) {
                error_log('Car Auction HTML Search: Market=' . $market . ', Raw filters=' . print_r($filters, true));
            }

            // Validate market
            $allowed_markets = array('main', 'korea', 'china', 'bike', 'stats', 'che_available');
            if (!in_array($market, $allowed_markets)) {
                wp_send_json_error('Недопустимый рынок: ' . $market);
                return;
            }

            // Sanitize filters
            $sanitized_filters = array();
            $allowed_filters = array(
                'vendor', 'model', 'year_from', 'year_to', 'engine_from', 'engine_to',
                'mileage_from', 'mileage_to', 'kuzov', 'lot_number', 'page',
                'fuel_type', 'transmission', 'transmission_group', 'drive', 'price_from', 'price_to'
            );

            foreach ($allowed_filters as $filter) {
                if (isset($filters[$filter]) && $filters[$filter] !== '') {
                    $sanitized_filters[$filter] = sanitize_text_field($filters[$filter]);
                }
            }

            // Показывает только посчитанное
            //$sanitized_filters['only_calculated'] = true;

            // Debug log for sanitized filters
            if (get_option('car_auction_debug_mode', false)) {
                error_log('Car Auction HTML Search: Sanitized filters=' . print_r($sanitized_filters, true));
            }

            // Call API
            $results = $this->api->search_cars($market, $sanitized_filters);

            // Debug log for API results
            if (get_option('car_auction_debug_mode', false)) {
                error_log('Car Auction HTML Search: API results=' . print_r(array(
                    'has_error' => isset($results['error']),
                    'error' => $results['error'] ?? null,
                    'total_cars' => isset($results['cars']) ? count($results['cars']) : 0,
                    'total' => $results['pagination']['total'] ?? 0,
                    'raw_result_keys' => array_keys($results ?? array())
                ), true));
            }

            if (isset($results['error'])) {
                wp_send_json_error('Ошибка API: ' . $results['error']);
                return;
            }

            if (!isset($results['cars']) || !is_array($results['cars'])) {
                wp_send_json_error('API не вернул массив автомобилей');
                return;
            }

            // Generate HTML cards first
            $html_cards = '';
            $car_count = 0;

            foreach ($results['cars'] as $car) {
                if (is_array($car)) {
                    $formatted_car = $this->api->format_car_data($car, $market);
                    $card_html = $this->render_result->render_car_card($formatted_car, 'grid');
                    if (!empty($card_html)) {
                        $html_cards .= $card_html;
                        $car_count++;
                    }
                }
            }

            // Check if we have any actual content or if results are truly empty
            $total = $results['pagination']['total'] ?? count($results['cars']);
            if (empty($html_cards) || $car_count === 0 || $total === 0) {
                // Return empty state with specific message
                wp_send_json_success(array(
                    'html' => '',
                    'total' => 0,
                    'page' => $sanitized_filters['page'] ?? 1,
                    'empty' => true,
                    'market' => $market
                ));
                return;
            }

            // Create pagination data for HTML response
            $current_page = $sanitized_filters['page'] ?? 1;
            $per_page = 20; // Fixed at 20 to prevent spam
            $total_pages = ceil($total / $per_page);

            $pagination_data = array(
                'page' => $current_page,
                'total_pages' => $total_pages,
                'total' => $total,
                'per_page' => $per_page
            );

            // Return only data for JavaScript to create pagination
            wp_send_json_success(array(
                'html' => $html_cards,
                'total' => $total,
                'page' => $current_page,
                'total_pages' => $total_pages,
                'per_page' => $per_page,
                'empty' => false,
                'market' => $market
            ));

        } catch (Exception $e) {
            error_log('Car Auction AJAX HTML Search Exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            wp_send_json_error('Внутренняя ошибка: ' . $e->getMessage());
        }
    }

    /**
     * AJAX get models handler
     */
    public function ajax_get_models() {
        $debug_mode = get_option('car_auction_debug_mode', false);

        try {
            // Check nonce for security
            if (!wp_verify_nonce($_POST['nonce'] ?? '', 'car_auction_nonce')) {
                wp_send_json_error('Недействительный запрос (nonce error)');
                return;
            }

            $market = sanitize_text_field($_POST['market'] ?? 'main');
            $vendor = sanitize_text_field($_POST['vendor'] ?? '');

            if ($debug_mode) {
                error_log('Car Auction AJAX Models: Market=' . $market . ', Vendor=' . $vendor);
            }

            // Validate inputs
            $allowed_markets = array('main', 'korea', 'china', 'bike', 'stats', 'che_available');
            if (!in_array($market, $allowed_markets)) {
                wp_send_json_error('Недопустимый рынок: ' . $market);
                return;
            }

            if (empty($vendor)) {
                wp_send_json_error('Требуется указать марку автомобиля');
                return;
            }

            $models = $this->api->get_models($market, $vendor);

            if ($debug_mode) {
                error_log('Car Auction AJAX Models: Found ' . (is_array($models) ? count($models) : 0) . ' models for ' . $vendor);
            }

            if (!is_array($models)) {
                wp_send_json_error('Ошибка получения моделей');
                return;
            }

            wp_send_json_success($models);

        } catch (Exception $e) {
            error_log('Car Auction AJAX Models Exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            wp_send_json_error('Внутренняя ошибка: ' . $e->getMessage());
        }
    }

    /**
     * AJAX load auto-results handler - для пагинации предзагруженных результатов
     */
    public function ajax_load_auto_results() {
        $debug_mode = get_option('car_auction_debug_mode', false);

        try {
            // Check nonce for security
            if (!wp_verify_nonce($_POST['nonce'] ?? '', 'car_auction_nonce')) {
                wp_send_json_error('Недействительный запрос (nonce error)');
                return;
            }

            $market = sanitize_text_field($_POST['market'] ?? 'main');
            $filters = $_POST['filters'] ?? array();

            if ($debug_mode) {
                error_log('Car Auction AJAX Auto Results: Market=' . $market . ', Filters=' . print_r($filters, true));
            }

            // Validate market
            $allowed_markets = array('main', 'korea', 'china', 'bike', 'stats', 'che_available');
            if (!in_array($market, $allowed_markets)) {
                wp_send_json_error('Недопустимый рынок: ' . $market);
                return;
            }

            // Определяем параметры запроса для предзагруженных результатов
            $search_filters = array();

            // Номер страницы и вычисление offset/limit

            // TODO: PAGE

            $page = max(1, intval($filters['page'] ?? 1));
            $per_page = min(20, intval(get_option('car_auction_items_per_page', 20)));
            $offset = ($page - 1) * $per_page;

            // Убираем page из search_filters, так как будем передавать limit и offset отдельно
            $search_filters = array();

            // Предфильтрация по марке (если есть в URL)
            if (!empty($filters['_brand'])) {
                $search_filters['vendor'] = sanitize_text_field($filters['_brand']);
            }

            // Добавляем остальные фильтры
            $filter_params = array(
                'vendor', 'model', 'year_from', 'year_to', 'engine_from', 'engine_to',
                'mileage_from', 'mileage_to', 'kuzov', 'lot_number', 'page',
                'fuel_type', 'transmission', 'transmission_group', 'drive', 'price_from', 'price_to'
            
            );
            foreach ($filter_params as $param) {
                if (isset($filters[$param]) && $filters[$param] !== '') {
                    $search_filters[$param] = sanitize_text_field($filters[$param]);
                }
            }

            if ($debug_mode) {
                error_log('Car Auction AJAX Auto Results: Page=' . $page . ', Offset=' . $offset . ', Limit=' . $per_page . ', Search filters=' . print_r($search_filters, true));
            }

            // Загружаем автомобили для предзагруженной страницы с пагинацией
            $results = $this->api->search_cars($market, $search_filters);

            if (isset($results['error'])) {
                wp_send_json_error('Ошибка API: ' . $results['error']);
                return;
            }

            if (!isset($results['cars']) || !is_array($results['cars'])) {
                wp_send_json_error('API не вернул массив автомобилей');
                return;
            }

            // Генерируем HTML для автомобилей
            $html_output = '';
            foreach ($results['cars'] as $car) {
                if (is_array($car)) {
                    $formatted_car = $this->api->format_car_data($car, $market);
                    $card_html = $this->render_result->render_car_card($formatted_car, 'grid');
                    if (!empty($card_html)) {
                        $html_output .= $card_html;
                    }

                    // Автоиндексация (если включена)
                    if (get_option('car_auction_auto_index', 'yes') === 'yes') {
                        $this->maybe_index_car($formatted_car['id'], $market, $car);
                    }
                }
            }

            $total = $results['pagination']['total'] ?? count($results['cars']);
            if (empty($html_output) || $total === 0) {
                // Возвращаем пустое состояние
                wp_send_json_success(array(
                    'html' => '',
                    'total' => 0,
                    'page' => $page,
                    'empty' => true,
                    'market' => $market
                ));
                return;
            }

            // Оборачиваем в контейнер для автомобилей
            $wrapped_html = '<div class="all-catalogue mob-grid">' . $html_output . '</div>';

            // Формируем ответ с пагинацией
            $current_page = $page;
            $total_pages = ceil($total / $per_page);

            wp_send_json_success(array(
                'html' => $wrapped_html,
                'total' => $total,
                'page' => $current_page,
                'total_pages' => $total_pages,
                'per_page' => $per_page,
                'empty' => false,
                'market' => $market
            ));

        } catch (Exception $e) {
            error_log('Car Auction AJAX Auto Results Exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            wp_send_json_error('Внутренняя ошибка: ' . $e->getMessage());
        }
    }
    
    /**
     * AJAX get dynamic filters handler
     */
    public function ajax_get_dynamic_filters() {
        $debug_mode = get_option('car_auction_debug_mode', false);

        try {
            // Check nonce for security
            if (!wp_verify_nonce($_POST['nonce'] ?? '', 'car_auction_nonce')) {
                wp_send_json_error('Недействительный запрос (nonce error)');
                return;
            }

            $market = sanitize_text_field($_POST['market'] ?? 'main');
            $filters = $_POST['filters'] ?? array();

            if ($debug_mode) {
                error_log('Car Auction AJAX Dynamic Filters: Market=' . $market . ', Filters=' . print_r($filters, true));
            }

            // Validate market
            $allowed_markets = array('main', 'korea', 'china', 'bike', 'stats', 'che_available');
            if (!in_array($market, $allowed_markets)) {
                wp_send_json_error('Недопустимый рынок: ' . $market);
                return;
            }

            // Sanitize filters
            $sanitized_filters = array();
            $allowed_filters = array(
                'vendor', 'model', 'year_from', 'year_to', 'engine_from', 'engine_to',
                'mileage_from', 'mileage_to', 'kuzov', 'lot_number',
                'fuel_type', 'transmission', 'transmission_group', 'drive', 'price_from', 'price_to',
                //'only_calculated'
            );

            foreach ($allowed_filters as $filter) {
                if (isset($filters[$filter]) && $filters[$filter] !== '') {
                    $sanitized_filters[$filter] = sanitize_text_field($filters[$filter]);
                }
            }

            if ($debug_mode) {
                error_log('Car Auction AJAX Dynamic Filters: Sanitized filters=' . print_r($sanitized_filters, true));
            }

            // Call API method to get dynamic filters
            $dynamic_filters = $this->api->getDynamicFilters($sanitized_filters, $market);

            if ($debug_mode) {
                error_log('Car Auction AJAX Dynamic Filters: API returned=' . print_r(array(
                    'vendors_count' => is_array($dynamic_filters['vendors'] ?? null) ? count($dynamic_filters['vendors']) : 0,
                    'models_count' => is_array($dynamic_filters['models'] ?? null) ? count($dynamic_filters['models']) : 0,
                    'fuel_types_count' => is_array($dynamic_filters['fuel_types'] ?? null) ? count($dynamic_filters['fuel_types']) : 0,
                    'transmissions_type' => gettype($dynamic_filters['transmissions'] ?? null),
                    'drives_type' => gettype($dynamic_filters['drives'] ?? null),
                    'table_support' => $dynamic_filters['table_support'] ?? null
                ), true));
            }

            if (!$dynamic_filters || !is_array($dynamic_filters)) {
                wp_send_json_error('Ошибка получения динамических фильтров');
                return;
            }

            wp_send_json_success($dynamic_filters);

        } catch (Exception $e) {
            error_log('Car Auction AJAX Dynamic Filters Exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            wp_send_json_error('Внутренняя ошибка: ' . $e->getMessage());
        }
    }

    /**
     * AJAX get car details handler
     */
    public function ajax_get_car_details() {
        check_ajax_referer('car_auction_nonce', 'nonce');
        
        $market = sanitize_text_field($_POST['market'] ?? 'main');
        $car_id = sanitize_text_field($_POST['car_id'] ?? '');
        
        if (empty($car_id)) {
            wp_send_json_error('Car ID is required');
        }
        
        // Index this view
        $this->index_car_view($car_id, $market);
        
        $car_data = $this->api->get_car_details($car_id, $market);
        
        if (!$car_data) {
            wp_send_json_error('Car not found');
        }
        
        $formatted_car = $this->api->format_car_data($car_data, $market);
        
        wp_send_json_success($formatted_car);
    }

    /**
     * Find existing auto post by car_auction_id
     */
    private function find_existing_auto_post($car_id): int|\WP_Post|null
    {
        $existing_posts = get_posts(array(
            'post_type' => 'auto',
            'meta_key' => '_car_auction_id',
            'meta_value' => $car_id,
            'post_status' => 'publish',
            'numberposts' => 1
        ));

        return !empty($existing_posts) ? $existing_posts[0] : null;
    }

    /**
     * Index car and create auto post, return post ID
     */
    private function index_and_create_auto_post($car_id, $market_name): \WP_Error|bool|int
    {
        // Convert market name to internal code
        $market = $this->market_name_to_code($market_name);

        // Get car data from API
        $car_data = $this->api->get_car_details($car_id, $market);
        if (!$car_data) {
            error_log("Car Auction: Failed to get car data for indexing - ID: $car_id, Market: $market");
            return false;
        }

        // Index the car first
        if (class_exists('aea\Wp_Car_Auction_Lite\core\Car_Auction_Indexer')) {
            $index_result = $this->indexer->index_single_car($car_data, $market);

            if (!$index_result) {
                error_log("Car Auction: Failed to index car - ID: $car_id, Market: $market");
                return false;
            }
        }

        // Create auto post
        if (class_exists('aea\Wp_Car_Auction_Lite\core\Car_Auction_Auto_Creator')) {
            $post_id = $this->creator->create_car_post($car_id, $market);

            if ($post_id) {
                error_log("Car Auction: Successfully created auto post ID $post_id for car $car_id");
                return $post_id;
            } else {
                error_log("Car Auction: Failed to create auto post for car $car_id");
                return false;
            }
        }

        return false;
    }
    
    
    /**
     * Render similar cars section with explicit brand and model parameters
     * 
     * @param string $market Маркет (main, japan, etc)
     * @param string $brand Марка автомобиля
     * @param string $model Модель автомобиля
     * @param string $view Тип отображения (grid, list)
     * @return string HTML код секции с похожими авто
     */
    public function render_similar_cars_section($market = 'main', $brand = '', $model = '', $view = 'grid'): string
    {
        // Формируем фильтры для поиска
        $filters = array();
        
        if (!empty($brand)) {
            $filters['vendor'] = $brand;
        }
        
        if (!empty($model)) {
            $filters['model'] = $model;
        }
        
        // Ограничиваем количество результатов для блока "Похожие"
        $limit = 12;
        $offset = 0; // Всегда показываем первые результаты

        // Получаем результаты с явным указанием limit и offset
        $results = $this->api->search_cars($market, $filters, $limit, $offset);
        
        if (isset($results['error']) || empty($results['cars'])) {
            return ''; // Не показываем секцию если нет результатов или ошибка
        }
        
        // Форматируем данные авто
        $formatted_cars = array();
        foreach ($results['cars'] as $car) {
            if (is_array($car)) {
                $formatted_cars[] = $this->api->format_car_data($car, $market);
            }
        }
        $results['cars'] = $formatted_cars;

        $results['pagination'] = [];
        
        // Рендерим секцию
        ob_start();
        ?>
        <section class="section stdrt">
            <div class="container">
                <div class="h2-wrapper">
                    <h2 class="h2">Похожие авто</h2>
                </div>
                <?php echo $this->render_result->render_search_results($results, $view); ?>
            </div>
        </section>
        <?php
        return ob_get_clean();
    }
}
