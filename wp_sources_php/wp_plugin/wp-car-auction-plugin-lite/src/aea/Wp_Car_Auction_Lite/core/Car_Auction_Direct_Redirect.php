<?php
/**
 * Car Auction Direct Redirect Class
 * 
 * Handles direct redirects without AJAX for better reliability
 */

namespace aea\Wp_Car_Auction_Lite\core;

use aea\Wp_Car_Auction_Lite\api\Car_Auction_API;
use Exception;


if (!defined('ABSPATH')) {
    exit;
}

class Car_Auction_Direct_Redirect {
    
    private Car_Auction_API $api;
    private Car_Auction_Auto_Creator $auto_creator;
    private Car_Auction_Indexer $indexer;

    public function __construct(Car_Auction_API $api, Car_Auction_Auto_Creator $auto_creator, Car_Auction_Indexer $indexer) {
        $this->api = $api;
        $this->auto_creator = $auto_creator;
        $this->indexer = $indexer;


        // Handle redirect requests
        add_action('template_redirect', array($this, 'handle_car_redirect'));

        // Register AJAX for async navigation
        add_action('wp_ajax_car_auction_check_and_create', array($this, 'ajax_aea_car_detail_page_renger'));
        add_action('wp_ajax_nopriv_car_auction_check_and_create', array($this, 'ajax_aea_car_detail_page_renger'));

        // Register AJAX for background creation trigger
        add_action('wp_ajax_car_auction_trigger_background_creation', array($this, 'ajax_trigger_background_creation'));
        add_action('wp_ajax_nopriv_car_auction_trigger_background_creation', array($this, 'ajax_trigger_background_creation'));

        // Register async post creation hook
        add_action('car_auction_create_wp_post_async', array($this, 'handle_async_post_creation'), 10, 2);
    }
    
    /**
     * Handle car redirect requests
     */
    public function handle_car_redirect(): void
    {
        // Check if this is a car redirect request
        if (!isset($_GET['car_redirect']) || !isset($_GET['car_id'])) {
            return;
        }
        
        $car_id = sanitize_text_field($_GET['car_id']);
        $market = sanitize_text_field($_GET['market'] ?? 'main');
        
        if (empty($car_id)) {
            wp_die('Invalid car ID');
        }
        
        // Check nonce for security
        if (!wp_verify_nonce($_GET['nonce'] ?? '', 'car_auction_nonce')) {
            wp_die('Security check failed');
        }
        
        error_log("Car Auction Direct: Redirect request for car $car_id, market $market");
        
        // Post doesn't exist, try to create it
        $auto_post_id = $this->create_auto_post_sync($car_id, $market);
        
        if ($auto_post_id) {
            $permalink = get_permalink($auto_post_id);
            error_log("Car Auction Direct: Created new auto post ID $auto_post_id, redirecting to $permalink");
            wp_redirect($permalink);
            exit;
        } else {
            // Creation failed, show error page
            error_log("Car Auction Direct: Failed to create auto post for car $car_id");
            wp_die('Unable to load car details. Please try again later.');
        }
    }
    
    /**
     * Find existing auto post by car_auction_id
     */
    private function find_existing_auto_post($car_id): ?array
    {
        $existing_id = get_posts(array(
            'post_type'      => 'auto',
            'meta_key'       => '_car_auction_id',
            'meta_value'     => $car_id,
            'posts_per_page' => 1,
            'fields'         => 'ids',           // Только ID!
            'no_found_rows'  => true,            // Не считать общее количество
            'cache_results'  => false,           // Не кэшировать запрос
            'update_post_meta_cache' => false,
            'update_post_term_cache' => false,
        ));
        
        return !empty($existing_id) ? $existing_id : null;
    }
    
    /**
     * Create auto post synchronously
     */
    private function create_auto_post_sync($car_id, $market): \WP_Error|bool|int
    {
        try {
            return $this->auto_creator->create_car_post($car_id, $market);
        } catch (Exception $e) {
            error_log("Car Auction Direct: Exception creating auto post: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * AJAX handler for async navigation - immediately return preview URL
     */
    public function ajax_aea_car_detail_page_renger(): void
    {
        try {
            // Check nonce
            if (!wp_verify_nonce($_POST['nonce'] ?? '', 'car_auction_nonce')) {
                wp_send_json_error('Invalid nonce');
                return;
            }

            $car_id = sanitize_text_field($_POST['car_id']);

            if (!preg_match('/^[a-zA-Z0-9_-]+$/', $car_id)) {
                wp_send_json_error('Invalid car ID');
            }

            $market = sanitize_text_field($_POST['market']);

            $allowed_markets = ['main', 'korea', 'china', 'bike', 'che_available'];
            if (!in_array($market, $allowed_markets)) {
                wp_send_json_error('Invalid market');
            }

            if (empty($car_id)) {
                wp_send_json_error('Car ID required');
                return;
            }
            
            $preview_url = $this->get_preview_url($car_id, $market);
            
            wp_send_json_success(array(
                'exists' => false,
                'redirect_url' => $preview_url,
                'type' => 'preview',
                'message' => 'Переходим к предпросмотру, создание страницы в фоне...'
            ));

        } catch (Exception $e) {
            error_log('Car Auction Direct AJAX Exception: ' . $e->getMessage());
            wp_send_json_error('Server error: ' . $e->getMessage());
        }
    }

    /**
     * AJAX handler for async navigation - immediately return preview URL
     */
    public function ajax_aea_car_create(): void
    {
        if (!wp_verify_nonce($_POST['nonce'] ?? '', 'car_auction_nonce')) {
            wp_send_json_error('Invalid nonce');
            return;
        }

        $car_id = sanitize_text_field($_POST['car_id']);

        if (!preg_match('/^[a-zA-Z0-9_-]+$/', $car_id)) {
            wp_send_json_error('Invalid car ID');
        }

        $market = sanitize_text_field($_POST['market']);

        $allowed_markets = ['main', 'korea', 'china', 'bike', 'che_available'];
        if (!in_array($market, $allowed_markets)) {
            wp_send_json_error('Invalid market');
        }

        if (empty($car_id)) {
            wp_send_json_error('Car ID required');
            return;
        }

        // First, check if auto post already exists
        $existing_id = $this->find_existing_auto_post($car_id);

        if ($existing_id) {
            // Post exists, redirect immediately
            $redirect_url = get_permalink($existing_id[0]);
            error_log("Car Auction Direct: Found existing auto post ID {$existing_id[0]}, redirecting to $redirect_url");
            wp_redirect($redirect_url);
            exit;
        }

        $this->schedule_async_post_creation($car_id, $market);
        
    }
    

    /**
     * Get preview URL for car detail page (using shortcode approach)
     */
    private function get_preview_url($car_id, $market): ?string
    {
        // Generate SEO-friendly URL structure for preview
        $brand_slug = '';
        $model_slug = '';

        // Try to get brand/model from API for better URL

        $car_data = $this->api->get_car_details($car_id, $market);

        if ($car_data) {
            $brand_slug = sanitize_title($car_data['brand'] ?? '');
            $model_slug = sanitize_title($car_data['model'] ?? '');
        }

        $market_name = $market === 'main' ? 'japan' : $market;

        if (!empty($brand_slug) && !empty($model_slug)) {
            return home_url("/cars/{$market_name}/{$brand_slug}-{$model_slug}/{$car_id}/");
        } else {
            return home_url("/cars/{$market_name}/{$car_id}/");
        }
    }

    /**
     * Schedule async post creation (non-blocking)
     */
    private function schedule_async_post_creation($car_id, $market): void
    {
        # Check if WordPress post exists
        $existing_auto = $this->find_existing_auto_post($car_id);

        if ($existing_auto) {
            // WordPress post exists, redirect to it
            wp_send_json_success(array(
                'exists' => true,
                'redirect_url' => get_permalink($existing_auto->ID),
                'type' => 'post'
            ));
            return;
        }

        // Add to post creation queue
        $this->add_to_post_queue($car_id, $market);

        // Schedule WordPress post creation for 5 seconds later (gives user time to view preview)
        wp_schedule_single_event(time() + 5, 'car_auction_create_wp_post_async', array($car_id, $market));

        error_log("Car Auction: Scheduled async post creation for car $car_id in market $market");
    }

    /**
     * Add car to post creation queue
     */
    private function add_to_post_queue($car_id, $market) {
        global $wpdb;
        $queue_table = $wpdb->prefix . 'car_auction_post_queue';

        // Get brand and model if available
        $brand = '';
        $model = '';
        if ($this->api) {
            $car_data = $this->api->get_car_details($car_id, $market);
            if ($car_data) {
                $brand = $car_data['MARKA_NAME'] ?? '';
                $model = $car_data['MODEL_NAME'] ?? '';
            }
        }

        // Insert or update queue entry
        $wpdb->replace(
            $queue_table,
            array(
                'car_id' => $car_id,
                'market' => $market,
                'brand' => $brand,
                'model' => $model,
                'status' => 'pending',
                'scheduled_at' => date('Y-m-d H:i:s', time() + 5),
                'created_at' => current_time('mysql')
            ),
            array('%s', '%s', '%s', '%s', '%s', '%s', '%s')
        );

        error_log("Car Auction: Added car $car_id to post creation queue");
    }

    /**
     * AJAX handler for triggering background creation (fire-and-forget)
     */
    public function ajax_trigger_background_creation() {
        try {
            // Check nonce
            if (!wp_verify_nonce($_POST['nonce'] ?? '', 'car_auction_nonce')) {
                wp_send_json_error('Invalid nonce');
                return;
            }

            $car_id = sanitize_text_field($_POST['car_id'] ?? '');
            $market = sanitize_text_field($_POST['market'] ?? 'main');

            if (empty($car_id)) {
                wp_send_json_error('Car ID required');
                return;
            }

            // Schedule background creation immediately (no delay)
            $this->schedule_async_post_creation($car_id, $market);

            wp_send_json_success(array(
                'message' => 'Background creation scheduled',
                'car_id' => $car_id,
                'market' => $market
            ));

        } catch (Exception $e) {
            error_log('Car Auction Background Trigger Exception: ' . $e->getMessage());
            wp_send_json_error('Server error: ' . $e->getMessage());
        }
    }
    
    /**
     * Handle async post creation (background job)
     */
    public function handle_async_post_creation($car_id, $market) {
        error_log("Car Auction: Starting async post creation for car $car_id in market $market");

        // Update queue status to 'processing'
        $this->update_queue_status($car_id, $market, 'processing');

        try {
            // Check if post was already created by another process
            $existing_auto = $this->find_existing_auto_post($car_id);
            if ($existing_auto) {
                error_log("Car Auction: Post already exists for car $car_id, skipping creation");
                $this->update_queue_status($car_id, $market, 'completed', null, $existing_auto->ID);
                return;
            }

            // Create the WordPress post in background
            $auto_post_id = $this->create_auto_post_sync($car_id, $market);

            if ($auto_post_id) {
                error_log("Car Auction: Successfully created async WordPress post $auto_post_id for car $car_id");

                // Index this car view for SEO if needed
                $this->index_car_view_async($car_id, $market);

                // Mark as completed in queue
                $this->update_queue_status($car_id, $market, 'completed', null, $auto_post_id);
            } else {
                error_log("Car Auction: Failed to create async WordPress post for car $car_id");
                $this->update_queue_status($car_id, $market, 'failed', 'Failed to create WordPress post');
            }
        } catch (Exception $e) {
            error_log("Car Auction: Exception during async post creation for car $car_id: " . $e->getMessage());
            $this->update_queue_status($car_id, $market, 'failed', $e->getMessage());
        }
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

    /**
     * Index car view asynchronously for SEO
     */
    private function index_car_view_async($car_id, $market) {
        if (get_option('car_auction_auto_index', 'yes') !== 'yes') {
            return;
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
        } else {
            // Get car data and index it
            $car_data = $this->api ? $this->api->get_car_details($car_id, $market) : null;
            if ($car_data) {
                $this->indexer->index_single_car($car_data, $market);
            }
        }
    }

    /**
     * Generate redirect URL for car (legacy method)
     */
    public static function get_car_redirect_url($car_id, $market = 'main') {
        return add_query_arg(array(
            'car_redirect' => '1',
            'car_id' => $car_id,
            'market' => $market,
            'nonce' => wp_create_nonce('car_auction_nonce')
        ), home_url());
    }
}
