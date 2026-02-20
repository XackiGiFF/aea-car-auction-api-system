<?php
/**
 * Manual Queue Processor
 * Allows manual processing of car auction queues when WP-Cron fails
 */

namespace aea\Wp_Car_Auction_Lite\admin;

use aea\Wp_Car_Auction_Lite\core\Car_Auction_Auto_Creator;
use Exception;

if (!defined('ABSPATH')) {
    exit;
}

class Car_Auction_Queue_Processor {
    private Car_Auction_Auto_Creator $creator;
    public function __construct(Car_Auction_Auto_Creator $creator) {
        $this->creator = $creator;
        add_action('wp_ajax_car_auction_process_queue_manually', array($this, 'process_queue_manually'));
        add_action('wp_ajax_car_auction_run_cron_manually', array($this, 'run_cron_manually'));
    }
    
    /**
     * Manually process delayed posts queue
     */
    public function process_queue_manually(): void
    {
        check_ajax_referer('car_auction_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }
        
        global $wpdb;
        $queue_table = $wpdb->prefix . 'car_auction_post_queue';
        
        // Get pending queue items
        $pending_items = $wpdb->get_results(
            "SELECT * FROM {$queue_table} 
             WHERE status = 'pending' 
             AND scheduled_at <= NOW() 
             ORDER BY scheduled_at ASC 
             LIMIT 10"
        );
        
        if (empty($pending_items)) {
            wp_send_json_success(array(
                'message' => 'Нет задач в очереди для обработки',
                'processed' => 0
            ));
        }
        
        $processed = 0;
        $errors = array();
        
        if (class_exists('aea\Wp_Car_Auction_Lite\core\Car_Auction_Auto_Creator')) {
            
            foreach ($pending_items as $item) {
                try {
                    // Update status to processing
                    $wpdb->update(
                        $queue_table,
                        array('status' => 'processing', 'processed_at' => current_time('mysql')),
                        array('id' => $item->id),
                        array('%s', '%s'),
                        array('%d')
                    );
                    
                    // Create the post
                    $post_id = $this->creator->create_car_post($item->car_id, $item->market);
                    
                    if ($post_id) {
                        $processed++;
                        error_log("Car Auction: Manually processed queue item {$item->id} -> Post {$post_id}");
                    } else {
                        $errors[] = "Failed to create post for car {$item->car_id}";
                        
                        // Update status back to pending for retry
                        $wpdb->update(
                            $queue_table,
                            array(
                                'status' => 'failed',
                                'error_message' => 'Post creation failed',
                                'attempts' => $item->attempts + 1
                            ),
                            array('id' => $item->id),
                            array('%s', '%s', '%d'),
                            array('%d')
                        );
                    }
                } catch (Exception $e) {
                    $errors[] = "Exception for car {$item->car_id}: " . $e->getMessage();
                    error_log("Car Auction: Exception processing queue item {$item->id}: " . $e->getMessage());
                    
                    // Update with error
                    $wpdb->update(
                        $queue_table,
                        array(
                            'status' => 'failed',
                            'error_message' => $e->getMessage(),
                            'attempts' => $item->attempts + 1
                        ),
                        array('id' => $item->id),
                        array('%s', '%s', '%d'),
                        array('%d')
                    );
                }
            }
        } else {
            wp_send_json_error('Car_Auction_Auto_Creator class not found');
        }
        
        wp_send_json_success(array(
            'message' => "Обработано задач: {$processed}",
            'processed' => $processed,
            'errors' => $errors
        ));
    }
    
    /**
     * Manually run WP-Cron jobs
     */
    public function run_cron_manually(): void
    {
        check_ajax_referer('car_auction_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }
        
        // Get all car auction related cron jobs
        $cron_array = get_option('cron');
        $current_time = time();
        $executed_jobs = 0;
        $results = array();
        
        foreach ($cron_array as $timestamp => $hooks) {
            if ($timestamp <= $current_time) {
                foreach ($hooks as $hook => $events) {
                    // Only process car auction related hooks
                    if (strpos($hook, 'car_auction') !== false) {
                        foreach ($events as $event) {
                            try {
                                // Execute the hook
                                do_action_ref_array($hook, $event['args']);
                                $executed_jobs++;
                                $results[] = "Executed: {$hook}";
                                
                                error_log("Car Auction: Manually executed cron job: {$hook}");
                            } catch (Exception $e) {
                                $results[] = "Error executing {$hook}: " . $e->getMessage();
                                error_log("Car Auction: Error executing cron job {$hook}: " . $e->getMessage());
                            }
                        }
                    }
                }
            }
        }
        
        if ($executed_jobs === 0) {
            wp_send_json_success(array(
                'message' => 'Нет просроченных задач для выполнения',
                'executed' => 0,
                'results' => array('Нет задач cron для Car Auction')
            ));
        } else {
            wp_send_json_success(array(
                'message' => "Выполнено задач cron: {$executed_jobs}",
                'executed' => $executed_jobs,
                'results' => $results
            ));
        }
    }
    
    /**
     * Get queue statistics
     */
    public function get_queue_stats() {
        global $wpdb;
        $queue_table = $wpdb->prefix . 'car_auction_post_queue';
        
        $stats = $wpdb->get_row("
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM {$queue_table}
        ", ARRAY_A);
        
        return $stats;
    }
    
    /**
     * Get next scheduled cron time for car auction jobs
     */
    public function get_next_cron_time(): int|string|null
    {
        $cron_array = get_option('cron');
        $next_car_auction_cron = null;
        
        foreach ($cron_array as $timestamp => $hooks) {
            if(!is_array($hooks)) continue;
            foreach ($hooks as $hook => $events) {
                if (strpos($hook, 'car_auction') !== false) {
                    if ($next_car_auction_cron === null || $timestamp < $next_car_auction_cron) {
                        $next_car_auction_cron = $timestamp;
                    }
                }
            }
        }
        
        return $next_car_auction_cron;
    }
}
