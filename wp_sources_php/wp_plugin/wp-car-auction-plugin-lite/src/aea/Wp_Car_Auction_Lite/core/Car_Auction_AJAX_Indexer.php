<?php
/**
 * Car Auction AJAX Indexer Class
 * 
 * Handles AJAX requests for car indexing and redirection
 */

namespace aea\Wp_Car_Auction_Lite\core;

use aea\Wp_Car_Auction_Lite\api\Car_Auction_API;
use aea\Wp_Car_Auction_Lite\Wp_Car_Auction_Plugin_Lite;
use Error;
use Exception;

use function __ as translate;

if (!defined('ABSPATH')) {
    exit;
}

class Car_Auction_AJAX_Indexer {
    
    private Car_Auction_API $api;
    private Car_Auction_Indexer $indexer;
    private Car_Auction_Auto_Creator $creator;
    private Wp_Car_Auction_Plugin_Lite $main_plugin;

    public function __construct(Car_Auction_API $api, Car_Auction_Indexer $indexer, Car_Auction_Auto_Creator $creator, Wp_Car_Auction_Plugin_Lite $main_plugin) {
        // Initialize API

        $this->api = $api;
        $this->indexer = $indexer;
        $this->creator = $creator;
        $this->main_plugin = $main_plugin;
        
        // Register AJAX handlers
        add_action('wp_ajax_car_auction_index_and_redirect', array($this, 'ajax_index_and_redirect'));
        add_action('wp_ajax_nopriv_car_auction_index_and_redirect', array($this, 'ajax_index_and_redirect'));
        add_action('wp_ajax_load_similar_cars_ajax', array($this, 'load_similar_cars_ajax_handler'));
        add_action('wp_ajax_nopriv_load_similar_cars_ajax', array($this, 'load_similar_cars_ajax_handler'));
        add_action('wp_ajax_load_car_price_ajax', array($this, 'load_car_price_ajax_handler'));
        add_action('wp_ajax_nopriv_load_car_price_ajax', array($this, 'load_car_price_ajax_handler'));
        add_action('wp_ajax_load_cars_prices_ajax', array($this, 'load_cars_prices_ajax_handler'));
        add_action('wp_ajax_nopriv_load_cars_prices_ajax', array($this, 'load_cars_prices_ajax_handler'));
        
    }
    
    public function load_similar_cars_ajax_handler():void {
        check_ajax_referer('car_auction_similar_ajax', 'nonce');
        
        $car_id = sanitize_text_field($_POST['car_id'] ?? '');
        $market = sanitize_text_field($_POST['market'] ?? 'main');
        $brand  = sanitize_text_field($_POST['brand'] ?? '');
        $model  = sanitize_text_field($_POST['model'] ?? '');
    
        if (empty($car_id)) {
            wp_send_json_error(['message' => 'Нет ID автомобиля']);
        }
    
        $html = '';
    
        $search = $this->main_plugin::getCarAuctionSearchSync();
    
        $cache_key = 'similar_cars_' . md5($car_id . $market . $brand . $model);
        $html = get_transient($cache_key);
    
        if ($html === false) {
            $html = $search->render_similar_cars_section($market, $brand, $model, 'grid');
            set_transient($cache_key, $html, 15 * MINUTE_IN_SECONDS);
        }
    
        if (empty($html)) {
            $html = '<p>Похожие автомобили не найдены</p>';
        }
    
        wp_send_json_success(['html' => $html]);
    }

    public function load_car_price_ajax_handler(): void
    {
        check_ajax_referer('car_auction_price_ajax', 'nonce');

        $car_id = sanitize_text_field($_POST['car_id'] ?? '');
        $market = sanitize_text_field($_POST['market'] ?? 'main');

        if (empty($car_id)) {
            wp_send_json_error(['message' => 'Нет ID автомобиля']);
        }

        $price = $this->api->get_car_price($car_id, $market, true);
        $has_price = !empty($price['has_price']);

        wp_send_json_success([
            'car_id' => $car_id,
            'market' => $market,
            'has_price' => $has_price,
            'calc_rub' => $has_price ? ($price['calc_rub'] ?? null) : null,
            'formatted_price' => $has_price ? (($price['formatted_value'] ?? '') . ' ₽') : 'по запросу',
        ]);
    }

    public function load_cars_prices_ajax_handler(): void
    {
        $nonce = sanitize_text_field($_POST['nonce'] ?? '');
        if (!wp_verify_nonce($nonce, 'car_auction_nonce') && !wp_verify_nonce($nonce, 'car_auction_price_ajax')) {
            wp_send_json_error(['message' => 'Недействительный nonce']);
        }

        $market = sanitize_text_field($_POST['market'] ?? 'main');
        $ids = $_POST['ids'] ?? [];
        if (!is_array($ids)) {
            $ids = $this->extract_ids_from_request_body();
        }

        // Поддерживаем все варианты:
        // - ids[]=a&ids[]=b
        // - ids=a&ids=b (php обычно оставляет последнее значение строкой)
        // - ids="a,b,c" (fallback)
        if (!is_array($ids)) {
            if (is_string($ids) && strpos($ids, ',') !== false) {
                $ids = explode(',', $ids);
            } elseif (is_string($ids) && $ids !== '') {
                $ids = [$ids];
            } else {
                wp_send_json_error(['message' => 'Неверный формат IDs']);
            }
        }

        $ids = array_values(array_unique(array_filter(array_map('sanitize_text_field', $ids))));
        if (empty($ids)) {
            wp_send_json_success(['prices' => []]);
        }

        // Ограничение на размер batch, чтобы не перегружать внешний API.
        $ids = array_slice($ids, 0, 20);
        $prices = [];

        foreach ($ids as $id) {
            $price = $this->api->get_car_price($id, $market, true);
            $prices[$id] = [
                'has_price' => !empty($price['has_price']),
                'calc_rub' => $price['calc_rub'] ?? null,
                'formatted_value' => $price['formatted_value'] ?? null
            ];
        }

        wp_send_json_success([
            'market' => $market,
            'prices' => $prices
        ]);
    }

    private function extract_ids_from_request_body(): array
    {
        $raw = file_get_contents('php://input');
        if (!$raw) {
            return [];
        }

        $result = [];
        if (preg_match_all('/(?:^|&)(?:ids|ids%5B%5D)=([^&]+)/i', $raw, $matches)) {
            foreach ($matches[1] as $encoded) {
                $decoded = urldecode($encoded);
                if ($decoded !== '') {
                    $result[] = $decoded;
                }
            }
        }

        return $result;
    }
        
    /**
     * AJAX handler for car indexing and redirect
     */
    public function ajax_index_and_redirect(): void
    {
        try {
            // Debug incoming request only in debug mode
            if (get_option('car_auction_debug_mode', false)) {
                error_log("Car Auction AJAX: Incoming request data: " . json_encode($_POST));
                error_log("Car Auction AJAX: Request method: " . $_SERVER['REQUEST_METHOD']);
                error_log("Car Auction AJAX: Content type: " . ($_SERVER['CONTENT_TYPE'] ?? 'not set'));
            }

            // First, send a test response to verify basic connectivity
            if (isset($_POST['test_mode']) && $_POST['test_mode'] === 'true') {
                wp_send_json_success(array(
                    'message' => 'AJAX connection working',
                    'timestamp' => current_time('mysql')
                ));
                return;
            }

            // Check nonce for security
            $nonce = $_POST['nonce'] ?? '';
            if (!wp_verify_nonce($nonce, 'car_auction_nonce')) {
                if (get_option('car_auction_debug_mode', false)) {
                    error_log("Car Auction AJAX: Nonce verification failed. Received: '$nonce'");
                    error_log("Car Auction AJAX: Expected nonce action: 'car_auction_nonce'");
                }
                wp_send_json_error( translate('Invalid request - incorrect nonce', 'car-auction'));
                return;
            }

            $car_id = sanitize_text_field($_POST['car_id'] ?? '');
            $market = sanitize_text_field($_POST['market'] ?? 'main');
            $brand = sanitize_text_field($_POST['brand'] ?? '');
            $model = sanitize_text_field($_POST['model'] ?? '');

            if (empty($car_id)) {
                wp_send_json_error( translate('Car ID not specified', 'car-auction'));
                return;
            }

            if (get_option('car_auction_debug_mode', false)) {
                error_log("Car Auction AJAX: Index and redirect request - Car ID: $car_id, Market: $market");
            }

            // First, check if auto post already exists
            $existing_auto = $this->find_existing_auto_post($car_id);
            
            if ($existing_auto) {
                // Post exists, return its URL
                $permalink = get_permalink($existing_auto->ID);
                if (get_option('car_auction_debug_mode', false)) {
                    error_log("Car Auction AJAX: Found existing auto post ID {$existing_auto->ID}");
                }
                
                wp_send_json_success(array(
                    'status' => 'exists',
                    'message' => translate('Car already indexed', 'car-auction'),
                    'redirect_url' => $permalink,
                    'post_id' => $existing_auto->ID,
                    'title' => $existing_auto->post_title
                ));
                return;
            }

            // Post doesn't exist, index the car and create auto post
            $auto_post_id = $this->index_and_create_auto_post($car_id, $market);
            
            if ($auto_post_id) {
                $permalink = get_permalink($auto_post_id);
                $post_title = get_the_title($auto_post_id);
                if (get_option('car_auction_debug_mode', false)) {
                    error_log("Car Auction AJAX: Created new auto post ID $auto_post_id");
                }
                
                wp_send_json_success(array(
                    'status' => 'created',
                    'message' => translate('Car indexed and detail page created', 'car-auction'),
                    'redirect_url' => $permalink,
                    'post_id' => $auto_post_id,
                    'title' => $post_title
                ));
            } else {
                if (get_option('car_auction_debug_mode', false)) {
                    error_log("Car Auction AJAX: Failed to index and create auto post for car ID: $car_id");
                }
                wp_send_json_error( translate('Failed to index car. Car may not be found in API or connection error occurred.', 'car-auction'));
            }

        } catch (Exception $e) {
            error_log('Car Auction AJAX Index Exception: ' . $e->getMessage());
            error_log('Car Auction AJAX Index Exception Trace: ' . $e->getTraceAsString());
            wp_send_json_error( translate('Internal error:', 'car-auction') . ' ' . $e->getMessage());
        } catch (Error $e) {
            error_log('Car Auction AJAX Index Fatal Error: ' . $e->getMessage());
            error_log('Car Auction AJAX Index Error Trace: ' . $e->getTraceAsString());
            wp_send_json_error( translate('Critical error:', 'car-auction') . ' ' . $e->getMessage());
        }

        // Fallback if we reach here without sending JSON
        if (!headers_sent()) {
            if (get_option('car_auction_debug_mode', false)) {
                error_log('Car Auction AJAX: Reached end without sending response');
            }
            wp_send_json_error( translate('Unexpected error - handler did not complete', 'car-auction'));
        }
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
    private function index_and_create_auto_post($car_id, $market): \WP_Error|bool|int
    {
        if (!$this->api) {
            if (get_option('car_auction_debug_mode', false)) {
                error_log("Car Auction AJAX: API not available for indexing");
            }
            return false;
        }
        
        // Get car data from API
        $car_data = $this->api->get_car_details($car_id, $market);
        if (!$car_data) {
            if (get_option('car_auction_debug_mode', false)) {
                error_log("Car Auction AJAX: Failed to get car data for indexing - ID: $car_id, Market: $market");
            }
            return false;
        }
        
        // Index the car first using Indexer class
        if (class_exists('aea\Wp_Car_Auction_Lite\core\Car_Auction_Indexer')) {
            $index_result = $this->indexer->index_single_car($car_data, $market);
            
            if (!$index_result) {
                if (get_option('car_auction_debug_mode', false)) {
                    error_log("Car Auction AJAX: Failed to index car - ID: $car_id, Market: $market");
                }
                return false;
            }
        }
        
        // Create auto post using Auto Creator
        if (class_exists('aea\Wp_Car_Auction_Lite\core\Car_Auction_Auto_Creator')) {
            $post_id = $this->creator->create_car_post($car_id, $market);
            
            if ($post_id) {
                if (get_option('car_auction_debug_mode', false)) {
                    error_log("Car Auction AJAX: Successfully created auto post ID $post_id for car $car_id");
                }
                return $post_id;
            } else {
                if (get_option('car_auction_debug_mode', false)) {
                    error_log("Car Auction AJAX: Failed to create auto post for car $car_id");
                }
                return false;
            }
        } else {
            if (get_option('car_auction_debug_mode', false)) {
                error_log("Car Auction AJAX: Car_Auction_Auto_Creator class not available");
            }
            return false;
        }
    }
}
