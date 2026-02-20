<?php
/**
 * Car Auction Auto Cleanup Class
 * 
 * Handles automatic deletion of cancelled/removed car posts
 */

namespace aea\Wp_Car_Auction_Lite\core;

use aea\Wp_Car_Auction_Lite\api\Car_Auction_API;

use Exception;
use function __ as translate;
use function esc_attr as translate_esc_attr;
use function _e as translate_echo;
use function _n as translate_n;
use function _x as translate_x;


if (!defined('ABSPATH')) {
    exit;
}

class Car_Auction_Auto_Cleanup {
    
    private Car_Auction_API $api;
    
    public function __construct(Car_Auction_API $api) {
        $this->api = $api;
        
        // Hook into WordPress init to schedule cron
        add_action('init', array($this, 'schedule_cleanup'));
        
        // Register the cleanup action
        add_action('car_auction_auto_cleanup', array($this, 'perform_cleanup'));
        
        // Admin settings
        add_action('admin_init', array($this, 'register_settings'));
    }
    
    /**
     * Schedule the cleanup cron job
     */
    public function schedule_cleanup(): void
    {
        if (!wp_next_scheduled('car_auction_auto_cleanup')) {
            // Schedule to run daily at 3 AM
            wp_schedule_event(strtotime('tomorrow 03:00:00'), 'daily', 'car_auction_auto_cleanup');
        }
    }
    
    /**
     * Register admin settings for auto cleanup
     */
    public function register_settings(): void
    {
        register_setting('car_auction_settings', 'car_auction_auto_cleanup_enabled');
        register_setting('car_auction_settings', 'car_auction_cleanup_batch_size');
        register_setting('car_auction_settings', 'car_auction_cleanup_older_than_days');
        
        add_settings_field(
            'car_auction_auto_cleanup_enabled',
            translate('Auto Cleanup Cancelled Cars', 'car-auction'),
            array($this, 'auto_cleanup_enabled_callback'),
            'car_auction_settings',
            'car_auction_images_section'
        );
        
        add_settings_field(
            'car_auction_cleanup_batch_size',
            translate('Cleanup Batch Size', 'car-auction'),
            array($this, 'cleanup_batch_size_callback'),
            'car_auction_settings',
            'car_auction_images_section'
        );
        
        add_settings_field(
            'car_auction_cleanup_older_than_days',
            translate('Cleanup Posts Older Than (Days)', 'car-auction'),
            array($this, 'cleanup_older_than_days_callback'),
            'car_auction_settings',
            'car_auction_images_section'
        );
    }
    
    /**
     * Perform the actual cleanup
     */
    public function perform_cleanup(): void
    {
        $enabled = get_option('car_auction_auto_cleanup_enabled', 'no');
        
        if ($enabled !== 'yes') {
            error_log('Car Auction Auto Cleanup: Disabled, skipping cleanup');
            return;
        }
        
        $batch_size = intval(get_option('car_auction_cleanup_batch_size', 50));
        $older_than_days = intval(get_option('car_auction_cleanup_older_than_days', 7));
        
        error_log("Car Auction Auto Cleanup: Starting cleanup process (batch: {$batch_size}, older than: {$older_than_days} days)");
        
        // Get posts to check (limit by batch size and age)
        $posts_to_check = $this->get_posts_to_check($batch_size, $older_than_days);
        
        if (empty($posts_to_check)) {
            error_log('Car Auction Auto Cleanup: No posts found to check');
            return;
        }
        
        $deleted_count = 0;
        $checked_count = 0;
        $errors = array();
        
        foreach ($posts_to_check as $post) {
            $checked_count++;
            
            try {
                $car_id = get_post_meta($post->ID, '_car_auction_id', true);
                $market = get_post_meta($post->ID, '_car_auction_market', true);
                
                if (empty($car_id) || empty($market)) {
                    error_log("Car Auction Auto Cleanup: Missing car_id or market for post {$post->ID}");
                    continue;
                }
                
                // Check car status in API
                $car_data = $this->api->get_car_details($car_id, $market);
                
                if (!$car_data) {
                    // Car not found in API - consider it as removed
                    $this->delete_car_post($post, $car_id, 'not_found_in_api');
                    $deleted_count++;
                    continue;
                }
                
                $status = strtolower($car_data['status'] ?? $car_data['STATUS'] ?? '');
                
                // Check if status indicates car should be removed
                if ($this->should_delete_car($status)) {
                    $this->delete_car_post($post, $car_id, $status);
                    $deleted_count++;
                }
                
            } catch (Exception $e) {
                $errors[] = "Error checking post {$post->ID}: " . $e->getMessage();
                error_log("Car Auction Auto Cleanup Error: " . $e->getMessage());
            }
        }
        
        // Log results
        $message = "Car Auction Auto Cleanup: Checked {$checked_count} posts, deleted {$deleted_count} posts";
        if (!empty($errors)) {
            $message .= '. Errors: ' . implode(', ', $errors);
        }
        
        error_log($message);
        
        // Update cleanup statistics
        update_option('car_auction_last_cleanup', array(
            'timestamp' => current_time('timestamp'),
            'checked' => $checked_count,
            'deleted' => $deleted_count,
            'errors' => $errors
        ));
    }
    
    /**
     * Get posts that need to be checked for cleanup
     */
    private function get_posts_to_check($batch_size, $older_than_days): array
    {
        $date_threshold = date('Y-m-d H:i:s', strtotime("-{$older_than_days} days"));
        
        $posts = get_posts(array(
            'post_type' => 'auto',
            'post_status' => 'publish',
            'numberposts' => $batch_size,
            'meta_query' => array(
                array(
                    'key' => '_car_auction_id',
                    'compare' => 'EXISTS'
                )
            ),
            'date_query' => array(
                array(
                    'before' => $date_threshold,
                    'inclusive' => true
                )
            ),
            'orderby' => 'date',
            'order' => 'ASC'
        ));
        
        return $posts;
    }
    
    /**
     * Check if car should be deleted based on status
     */
    private function should_delete_car($status): bool
    {
        $delete_statuses = array(
            'cancelled',
            'canceled',
            'removed',
            'deleted',
            'sold',
            'finished',
            'end',
            'ended',
            'closed'
        );
        
        return in_array($status, $delete_statuses);
    }
    
    /**
     * Delete car post and related data
     */
    private function delete_car_post($post, $car_id, $reason): void
    {
        global $wpdb;
        
        error_log("Car Auction Auto Cleanup: Deleting post {$post->ID} (car_id: {$car_id}) - reason: {$reason}");
        
        // Delete from indexed table
        $indexed_table = $wpdb->prefix . 'car_auction_indexed';
        $wpdb->delete($indexed_table, array('car_id' => $car_id), array('%s'));
        
        // Delete WordPress post
        wp_delete_post($post->ID, true); // Force delete, bypass trash
        
        // Delete related attachments (images)
        $attachments = get_posts(array(
            'post_type' => 'attachment',
            'posts_per_page' => -1,
            'post_parent' => $post->ID
        ));
        
        foreach ($attachments as $attachment) {
            wp_delete_attachment($attachment->ID, true);
        }
        
        error_log("Car Auction Auto Cleanup: Successfully deleted post {$post->ID} and related data");
    }
    
    /**
     * Get cleanup statistics for admin display
     */
    public function get_cleanup_stats(): array
    {
        $last_cleanup = get_option('car_auction_last_cleanup', array());
        
        $stats = array(
            'last_run' => isset($last_cleanup['timestamp']) ? 
                         date('Y-m-d H:i:s', $last_cleanup['timestamp']) : 'Never',
            'last_checked' => $last_cleanup['checked'] ?? 0,
            'last_deleted' => $last_cleanup['deleted'] ?? 0,
            'last_errors' => $last_cleanup['errors'] ?? array(),
            'next_run' => wp_next_scheduled('car_auction_auto_cleanup') ? 
                         date('Y-m-d H:i:s', wp_next_scheduled('car_auction_auto_cleanup')) : 'Not scheduled'
        );
        
        return $stats;
    }
    
    /**
     * Admin callback for auto cleanup enabled setting
     */
    public function auto_cleanup_enabled_callback(): void
    {
        $value = get_option('car_auction_auto_cleanup_enabled', 'no');
        echo '<input type="checkbox" id="car_auction_auto_cleanup_enabled" name="car_auction_auto_cleanup_enabled" value="yes" ' . checked($value, 'yes', false) . ' />';
        echo '<label for="car_auction_auto_cleanup_enabled">Автоматически удалять посты отмененных/проданных автомобилей</label>';
        echo '<p class="description">Включает ежедневную проверку статуса автомобилей в API и удаление постов для автомобилей со статусом "cancelled", "removed", "sold" и другими завершающими статусами.</p>';
    }
    
    /**
     * Admin callback for batch size setting
     */
    public function cleanup_batch_size_callback(): void
    {
        $value = get_option('car_auction_cleanup_batch_size', 50);
        echo '<input type="number" id="car_auction_cleanup_batch_size" name="car_auction_cleanup_batch_size" value="' . translate_esc_attr($value) . '" min="10" max="500" />';
        echo '<p class="description">Количество постов для проверки за один раз (10-500). Меньшие значения снижают нагрузку на сервер.</p>';
    }
    
    /**
     * Admin callback for older than days setting
     */
    public function cleanup_older_than_days_callback(): void
    {
        $value = get_option('car_auction_cleanup_older_than_days', 7);
        echo '<input type="number" id="car_auction_cleanup_older_than_days" name="car_auction_cleanup_older_than_days" value="' . translate_esc_attr($value) . '" min="1" max="365" />';
        echo '<p class="description">Проверять только посты старше указанного количества дней (1-365). Защищает от случайного удаления новых постов.</p>';
        
        // Display cleanup statistics
        $stats = $this->get_cleanup_stats();
        echo '<div style="margin-top: 15px; padding: 10px; background: #f0f8ff; border: 1px solid #b0d4f1; border-radius: 5px;">';
        echo '<h4 style="margin: 0 0 10px 0;">Статистика автоочистки:</h4>';
        echo '<div><strong>Последний запуск:</strong> ' . esc_html($stats['last_run']) . '</div>';
        echo '<div><strong>Проверено постов:</strong> ' . esc_html($stats['last_checked']) . '</div>';
        echo '<div><strong>Удалено постов:</strong> ' . esc_html($stats['last_deleted']) . '</div>';
        echo '<div><strong>Следующий запуск:</strong> ' . esc_html($stats['next_run']) . '</div>';
        
        if (!empty($stats['last_errors'])) {
            echo '<div style="color: #d32f2f;"><strong>Последние ошибки:</strong> ' . esc_html(implode(', ', array_slice($stats['last_errors'], 0, 3))) . '</div>';
        }
        echo '</div>';
    }
    
    /**
     * Manual cleanup trigger for admin
     */
    public function trigger_manual_cleanup(): bool
    {
        if (!current_user_can('manage_options')) {
            return false;
        }
        
        // Run cleanup immediately
        $this->perform_cleanup();
        return true;
    }
}
