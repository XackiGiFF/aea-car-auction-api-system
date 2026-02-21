<?php
/**
 * Main Car Auction Plugin Class
 */
namespace aea\Wp_Car_Auction_Lite;

use aea\Wp_Car_Auction_Lite\admin\Car_Auction_Queue_Processor;
use aea\Wp_Car_Auction_Lite\admin\Car_Auction_Admin;
use aea\Wp_Car_Auction_Lite\api\Car_Auction_API;
use aea\Wp_Car_Auction_Lite\core\Car_Auction_AJAX_Indexer;
use aea\Wp_Car_Auction_Lite\core\Car_Auction_Auto_Cleanup;
use aea\Wp_Car_Auction_Lite\core\Car_Auction_Auto_Creator;

use aea\Wp_Car_Auction_Lite\core\Car_Auction_Direct_Redirect;
use aea\Wp_Car_Auction_Lite\core\Car_Auction_Indexer;
use aea\Wp_Car_Auction_Lite\core\Car_Auction_Search;
use aea\Wp_Car_Auction_Lite\shortcodes\Car_Auction_Shortcodes;
use aea\Wp_Car_Auction_Lite\shortcodes\renders\Render_Search_Form_Filters;
use aea\Wp_Car_Auction_Lite\shortcodes\renders\Render_Search_Result;
use aea\Wp_Car_Auction_Lite\shortcodes\renders\Render_Detail_Page;

use JetBrains\PhpStorm\NoReturn;

class Wp_Car_Auction_Plugin_Lite {

    private static ?Wp_Car_Auction_Plugin_Lite $instance = null;
    private static Car_Auction_Auto_Creator $Car_Auction_Auto_Creator;
    private static Car_Auction_API $Car_Auction_API;
    private static Car_Auction_Auto_Cleanup $Car_Auction_Auto_Cleanup;
    private static Car_Auction_Search $Car_Auction_Search;
    private static Car_Auction_Indexer $Car_Auction_Indexer;
    private static Render_Search_Form_Filters $Render_Search_Form_Filters;
    private static Render_Search_Result $Render_Search_Result;
    private static Render_Detail_Page  $Render_Detail_Page;
    private static Car_Auction_AJAX_Indexer $Car_Auction_AJAX_Indexer;
    private static Car_Auction_Direct_Redirect $Car_Auction_Direct_Redirect;
    private static Car_Auction_Shortcodes $Car_Auction_Shortcodes;
    private static Car_Auction_Queue_Processor $Car_Auction_Queue_Processor;
    private static Car_Auction_Admin $Car_Auction_Admin;

    public function handle_activation(): void
    {
        // Create database tables
        $this->create_tables();

        // Create default options - only if they don't exist
        add_option('car_auction_api_code', 'pass'); // Default from example, user can change
        add_option('car_auction_api_server', '78.46.90.228');
        add_option('car_auction_cache_enabled', 'yes');
        add_option('car_auction_cache_duration', 30);
        add_option('car_auction_items_per_page', 20);
        add_option('car_auction_debug_mode', true);
        add_option('car_auction_auto_index', 'yes');

        // Force rewrite rules flush for new URL structure
        update_option('car_auction_rewrite_version', '2.5');
        flush_rewrite_rules();

        // Schedule all cron jobs on activation
        $this->schedule_all_cron_jobs();

        // Log activation
        error_log('Car Auction Plugin: Activated successfully');
    }

    private function create_tables(): void
    {
        global $wpdb;

        $charset_collate = $wpdb->get_charset_collate();

        // Table for indexed cars
        $table_name = $wpdb->prefix . 'car_auction_indexed';

        $sql = "CREATE TABLE $table_name (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            car_id varchar(20) NOT NULL,
            market varchar(10) NOT NULL,
            lot_number int(6) DEFAULT NULL,
            brand varchar(50) DEFAULT NULL,
            model varchar(100) DEFAULT NULL,
            year int(4) DEFAULT NULL,
            engine_volume int(11) DEFAULT NULL,
            mileage int(6) DEFAULT NULL,
            price_start int(8) DEFAULT NULL,
            price_finish int(8) DEFAULT NULL,
            currency varchar(3) DEFAULT NULL,
            images text DEFAULT NULL,
            data longtext DEFAULT NULL,
            indexed_at datetime DEFAULT CURRENT_TIMESTAMP,
            viewed_count int(10) DEFAULT 0,
            PRIMARY KEY (id),
            UNIQUE KEY car_id (car_id),
            KEY market (market),
            KEY brand (brand),
            KEY model (model),
            KEY year (year),
            KEY indexed_at (indexed_at),
            KEY market_indexed_at (market, indexed_at)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);

        // Table for API cache
        $cache_table = $wpdb->prefix . 'car_auction_cache';

        $cache_sql = "CREATE TABLE $cache_table (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            cache_key varchar(191) NOT NULL,
            cache_value longtext DEFAULT NULL,
            expires_at datetime DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY cache_key (cache_key),
            KEY expires_at (expires_at)
        ) $charset_collate;";

        dbDelta($cache_sql);

        // Table for post creation queue
        $queue_table = $wpdb->prefix . 'car_auction_post_queue';

        $queue_sql = "CREATE TABLE $queue_table (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            car_id varchar(20) NOT NULL,
            market varchar(10) NOT NULL,
            brand varchar(50) DEFAULT NULL,
            model varchar(100) DEFAULT NULL,
            status varchar(20) DEFAULT 'pending',
            scheduled_at datetime DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            processed_at datetime DEFAULT NULL,
            error_message text DEFAULT NULL,
            attempts int(3) DEFAULT 0,
            wp_post_id bigint(20) DEFAULT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY car_id_market (car_id, market),
            KEY status (status),
            KEY scheduled_at (scheduled_at),
            KEY status_scheduled (status, scheduled_at),
            KEY status_attempts (status, attempts),
            KEY market (market),
            KEY wp_post_id (wp_post_id)
        ) $charset_collate;";

        dbDelta($queue_sql);

        // Таблица вендоров
        $charset_collate = $wpdb->get_charset_collate();

        $vendors_table = $wpdb->prefix . 'car_auction_vendors';
        $sql_vendors = "CREATE TABLE $vendors_table (
            id BIGINT(20) NOT NULL AUTO_INCREMENT,
            market VARCHAR(20) NOT NULL,
            vendor_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            marka_name VARCHAR(255) NOT NULL,
            car_count INT DEFAULT 0,
            model_count INT DEFAULT 0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY market_vendor (market, vendor_id),
            KEY market_name (market, name),
            KEY last_updated (last_updated)
        ) $charset_collate;";

        dbDelta($sql_vendors);

        // Таблица моделей (НОВАЯ)
        $models_table = $wpdb->prefix . 'car_auction_models';
        $sql_models = "CREATE TABLE $models_table (
            id BIGINT(20) NOT NULL AUTO_INCREMENT,
            market VARCHAR(20) NOT NULL,
            vendor_id INT NOT NULL,
            model_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            model_name VARCHAR(255) NOT NULL,
            car_count INT DEFAULT 0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY market_vendor_model (market, vendor_id, model_id),
            KEY market_vendor (market, vendor_id),
            KEY model_name (model_name),
            KEY car_count (car_count),
            KEY last_updated (last_updated)
        ) $charset_collate;";

        dbDelta($sql_models);
    }

    public function handle_deactivation(): void
    {
        // Flush rewrite rules
        flush_rewrite_rules();

        // Clear CSV sync cron jobs
        wp_clear_scheduled_hook('car_auction_sync_korea_data');
        wp_clear_scheduled_hook('car_auction_sync_china_data');
        wp_clear_scheduled_hook('car_auction_sync_bike_data');
        wp_clear_scheduled_hook('car_auction_sync_main_data');

        // Clear pending images processing cron job
        wp_clear_scheduled_hook('car_auction_process_pending_images');

        // Clear delayed post processing cron job
        wp_clear_scheduled_hook('car_auction_process_delayed_posts');

        // Clear additional cron jobs
        wp_clear_scheduled_hook('car_auction_auto_cleanup');
        wp_clear_scheduled_hook('car_auction_sync_filters');
        wp_clear_scheduled_hook('car_auction_update_currency_rates');
    }

    public static function get_instance(): ?Wp_Car_Auction_Plugin_Lite
    {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('init', array($this, 'init'));
    }

    public function init(): void
    {
        // Force correct API settings on every init
        $this->ensure_correct_api_settings();

        // Use existing 'auto' post type instead of custom 'car_page'

        // Include required files
        $this->includes();

        // Initialize other components
        $this->init_class();
        
    }

    private function ensure_correct_api_settings(): void
    {
        // Set default server only if empty
        $current_server = get_option('car_auction_api_server', '');
        if (empty($current_server)) {
            update_option('car_auction_api_server', '78.46.90.228');
            error_log('Car Auction Plugin: Set default API server');
        }

        // Set default API code only if empty
        $current_api_code = get_option('car_auction_api_code', '');
        if (empty($current_api_code)) {
            update_option('car_auction_api_code', 'DvemR43s');
            error_log('Car Auction Plugin: Set default API code');
        }
    }

    private function includes(): void
    {
        // Admin
        require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/admin/Car_Auction_Admin.php';
        require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/admin/Car_Auction_Queue_Processor.php';
//        if (is_admin()) {
//            require_once CAR_AUCTION_PLUGIN_PATH . 'include/admin/admin-filter-test.php';
//            require_once CAR_AUCTION_PLUGIN_PATH . 'include/admin/admin-filter-monitor.php';
//            //require_once CAR_AUCTION_PLUGIN_PATH . 'include/admin/admin-debug-callback.php';
//            require_once CAR_AUCTION_PLUGIN_PATH . 'include/admin/admin-ajax-handlers.php';
//            require_once CAR_AUCTION_PLUGIN_PATH . 'include/admin/cron-ajax-handlers.php';
//        }

        // API
        // Import API NEW
        require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/api/Car_Auction_API.php';

        // Core
        require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/core/Car_Auction_AJAX_Indexer.php';
        require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/core/Car_Auction_Auto_Cleanup.php';
        require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/core/Car_Auction_Auto_Creator.php';
        require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/core/Car_Auction_Direct_Redirect.php';
        require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/core/Car_Auction_Indexer.php';
        require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/core/Car_Auction_Search.php';

        require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/shortcodes/renders/Render_Search_Form_Filters.php';
        require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/shortcodes/renders/Render_Search_Result.php';
        require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/shortcodes/renders/Render_Detail_Page.php';

        // Shortcodes
        require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/shortcodes/Car_Auction_Shortcodes.php';

    }

    /**
     * Initialize hooks
     */
    private function init_class(): void
    {

        self::$Car_Auction_API = new Car_Auction_API("http://api-gateway:3000", "********");

        self::$Render_Search_Form_Filters = new Render_Search_Form_Filters(self::$Car_Auction_API);
        self::$Render_Search_Result = new Render_Search_Result(self::$Car_Auction_API);
        self::$Render_Detail_Page = new Render_Detail_Page(self::$Car_Auction_API);

        // Background indexing
        self::$Car_Auction_Indexer = $Car_Auction_Indexer = new Car_Auction_Indexer(self::$Car_Auction_API);

        // Initialize auto creator for working with existing 'auto' post type
        self::$Car_Auction_Auto_Creator = $Car_Auction_Auto_Creator = new Car_Auction_Auto_Creator(self::$Car_Auction_API);

        // Initialize AJAX indexer for handling AJAX car indexing requests
        self::$Car_Auction_AJAX_Indexer = new Car_Auction_AJAX_Indexer(self::$Car_Auction_API, self::$Car_Auction_Indexer, self::$Car_Auction_Auto_Creator, $this);

        // Initialize direct redirect handler for better reliability
        self::$Car_Auction_Direct_Redirect = new Car_Auction_Direct_Redirect(self::$Car_Auction_API, self::$Car_Auction_Auto_Creator, self::$Car_Auction_Indexer);

        // Initialize auto cleanup for cancelled/removed cars
        self::$Car_Auction_Auto_Cleanup = $Car_Auction_Auto_Cleanup = new Car_Auction_Auto_Cleanup(self::$Car_Auction_API);


//        if (is_admin()) {
//            $Car_Auction_Admin = new Car_Auction_Admin($Car_Auction_CSV_Sync, $Car_Auction_Auto_Cleanup, $Car_Auction_Auto_Creator, $Car_Auction_TKS_API);
//        }

        // Frontend functionality
        self::$Car_Auction_Search = new Car_Auction_Search(self::$Car_Auction_API, self::$Car_Auction_Indexer, self::$Car_Auction_Auto_Creator);
        self::$Car_Auction_Shortcodes = new Car_Auction_Shortcodes(self::$Car_Auction_API, self::$Car_Auction_Search);


        self::$Car_Auction_Queue_Processor = new Car_Auction_Queue_Processor(self::$Car_Auction_Auto_Creator);

        // Initialize admin interface
        if (is_admin()) {
            self::$Car_Auction_Admin = new Car_Auction_Admin(self::$Car_Auction_API, self::$Car_Auction_Auto_Creator, self::$Car_Auction_Queue_Processor);
        }

        // Enqueue scripts and styles
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));

        // Add custom cron schedules
        add_filter('cron_schedules', array($this, 'add_cron_schedules'));

        // Schedule pending images processing
        add_action('car_auction_process_pending_images', array($this, 'process_pending_images'));
        if (!wp_next_scheduled('car_auction_process_pending_images')) {
            wp_schedule_event(time(), 'car_auction_thirty_minutes', 'car_auction_process_pending_images');
        }

        // Schedule delayed post processing
        add_action('car_auction_process_delayed_posts', array($this, 'process_delayed_posts'));
        if (!wp_next_scheduled('car_auction_process_delayed_posts')) {
            wp_schedule_event(time(), 'car_auction_fifteen_minutes', 'car_auction_process_delayed_posts');
        }

        // Initialize all other cron jobs
        $this->schedule_all_cron_jobs();

        // Ensure schedules are always fresh - check once per day
        $last_check = get_option('car_auction_cron_last_check', 0);
        if (time() - $last_check > DAY_IN_SECONDS) {
            add_action('init', array($this, 'ensure_cron_schedules'), 15);
            update_option('car_auction_cron_last_check', time());
        }

        // Check if rewrite rules need to be flushed
        add_action('init', array($this, 'maybe_flush_rewrite_rules'), 20);

        // Force flush on admin init for debugging
        if (is_admin() && isset($_GET['car_auction_flush_rules'])) {
            add_action('admin_init', array($this, 'force_flush_rewrite_rules'));
        }
    }

    public static function getCarAuctionAutoCreator(): Car_Auction_Auto_Creator
    {
        return self::$Car_Auction_Auto_Creator;
    }

    public static function getCarAuctionApi(): Car_Auction_API
    {
        return self::$Car_Auction_API;
    }

    public static function getCarAuctionAutoCleanup(): Car_Auction_Auto_Cleanup
    {
        return self::$Car_Auction_Auto_Cleanup;
    }

    public static function getRenderSearchFormFilters() : Render_Search_Form_Filters {
        return self::$Render_Search_Form_Filters;
    }

    public static function getRenderSearchResult() : Render_Search_Result {
        return self::$Render_Search_Result;
    }

    public static function getCarAuctionSearchSync(): Car_Auction_Search
    {
        return self::$Car_Auction_Search;
    }

    public static function getRenderDetailPage() : Render_Detail_Page {
        return self::$Render_Detail_Page;
    }

    /**
     * Enqueue scripts and styles
     */
    public function enqueue_scripts(): void
    {
        // Always enqueue styles
        wp_enqueue_style('car-auction-style', CAR_AUCTION_PLUGIN_URL . 'assets/css/car-auction.css', array(), CAR_AUCTION_VERSION);
        // wp_enqueue_style('car-auction-form-style', CAR_AUCTION_PLUGIN_URL . 'assets/css/car-auction-form.css', array('car-auction-style'), CAR_AUCTION_VERSION); // Файл отключен
        wp_enqueue_style('car-auction-indexing-style', CAR_AUCTION_PLUGIN_URL . 'assets/css/car-indexing.css', array(), CAR_AUCTION_VERSION);
        wp_enqueue_style('car-price-calculator-style', CAR_AUCTION_PLUGIN_URL . 'assets/css/car-price-calculator.css', array(), CAR_AUCTION_VERSION);

        // Only enqueue scripts if jQuery is available
        if (wp_script_is('jquery', 'enqueued') || wp_script_is('jquery', 'registered')) {

            // ВКЛЮЧЕНЫ - используем модульную а��хитектуру с рабочим функционалом
            // Основные скрипты
            wp_enqueue_script('car-auction-core', CAR_AUCTION_PLUGIN_URL . 'assets/js/car-auction-core.js', array('jquery'), CAR_AUCTION_VERSION, true);
            wp_enqueue_script('car-auction-init', CAR_AUCTION_PLUGIN_URL . 'assets/js/car-auction-init.js', array('car-auction-core'), CAR_AUCTION_VERSION, true);
            wp_enqueue_script('car-auction-navigation', CAR_AUCTION_PLUGIN_URL . 'assets/js/car-navigation.js', array('car-auction-core'), CAR_AUCTION_VERSION, true);
            wp_enqueue_script('car-auction-search', CAR_AUCTION_PLUGIN_URL . 'assets/js/car-search-unified.js', array('car-auction-core'), CAR_AUCTION_VERSION, true);

            // Локализация
            wp_localize_script('car-auction-core', 'carAuction', array(
                'ajaxUrl' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('car_auction_nonce'),
                'loading' => translate('Loading...', 'car-auction'),
                'noResults' => translate('No results found', 'car-auction')
            ));

            // Also add nonce to page meta for fallback
            add_action('wp_head', function() {
                echo '<meta name="car-auction-nonce" content="' . wp_create_nonce('car_auction_nonce') . '">' . "\n";
            });
        } else {
            // Log error if jQuery is not available
            error_log('Car Auction: jQuery is not available when trying to enqueue scripts');
        }
    }

    /**
     * Add custom cron schedules - centralized for all cron jobs
     */
    public function add_cron_schedules($schedules) {
        // Core schedules
        $schedules['car_auction_fifteen_minutes'] = array(
            'interval' => 15 * MINUTE_IN_SECONDS,
            'display'  => translate('Every 15 Minutes', 'car-auction')
        );
        $schedules['car_auction_thirty_minutes'] = array(
            'interval' => 30 * MINUTE_IN_SECONDS,
            'display'  => translate('Every 30 Minutes', 'car-auction')
        );
        $schedules['car_auction_twelve_hours'] = array(
            'interval' => 12 * 60 * MINUTE_IN_SECONDS,
            'display'  => translate('Every 12 Hours', 'car-auction')
        );

        // Additional schedules for sync tasks
        $schedules['car_auction_30min'] = array(
            'interval' => 30 * MINUTE_IN_SECONDS,
            'display' => translate('Every 30 minutes', 'car-auction')
        );
        $schedules['car_auction_12hours'] = array(
            'interval' => 12 * HOUR_IN_SECONDS,
            'display' => translate('Every 12 hours', 'car-auction')
        );

        return $schedules;
    }

    /**
     * Schedule all cron jobs - centralized management
     */
    public function schedule_all_cron_jobs(): void
    {
        // Auto cleanup - disabled by default, can be enabled in settings
        add_action('car_auction_auto_cleanup', array($this, 'auto_cleanup_posts'));
        $cleanup_enabled = get_option('car_auction_auto_cleanup_enabled', 'no');
        if ($cleanup_enabled === 'yes' && !wp_next_scheduled('car_auction_auto_cleanup')) {
            wp_schedule_event(strtotime('tomorrow 03:00:00'), 'daily', 'car_auction_auto_cleanup');
        }
    }

    /**
     * Ensure cron schedules are properly set up
     */
    public function ensure_cron_schedules(): void
    {
        $missing_schedules = 0;

        // Check all required cron jobs
        $required_jobs = [
            'car_auction_process_delayed_posts' => 'car_auction_fifteen_minutes',
            'car_auction_process_pending_images' => 'car_auction_thirty_minutes',
        ];

        foreach ($required_jobs as $hook => $schedule) {
            if (!wp_next_scheduled($hook)) {
                $missing_schedules++;
            }
        }

        // If more than 2 schedules are missing, reschedule all
        if ($missing_schedules > 2) {
            error_log("Car Auction: Found {$missing_schedules} missing cron schedules, rescheduling all");
            $this->schedule_all_cron_jobs();
        }
    }

    /**
     * Maybe flush rewrite rules if version changed
     */
    public function maybe_flush_rewrite_rules(): void
    {
        $current_version = get_option('car_auction_rewrite_version', '1.0');
        if (version_compare($current_version, '4.0', '<')) {
            flush_rewrite_rules();
            update_option('car_auction_rewrite_version', '4.0');
            error_log('Car Auction Plugin: Flushed rewrite rules for version 4.0 - Fixed URL format (removed simple format support)');
        }
    }

    /**
     * Force flush rewrite rules for debugging
     */
    #[NoReturn]
    public function force_flush_rewrite_rules(): void
    {
        flush_rewrite_rules();
        error_log('Car Auction Plugin: Manually flushed rewrite rules');
        wp_redirect(admin_url('admin.php?page=car_auction_admin&rules_flushed=1'));
        exit;
    }

    /**
     * Process pending images for cars (called by cron)
     */
    public function process_pending_images(): void
    {
        if (class_exists('aea\Wp_Car_Auction_Lite\core\Car_Auction_Auto_Creator')) {
            $auto_creator = $this::getCarAuctionAutoCreator();

            // Try enhanced processing first, fallback to regular if method doesn't exist
            if (method_exists($auto_creator, 'process_pending_images_enhanced')) {
                $result = $auto_creator->process_pending_images_enhanced();
                error_log("Car Auction Plugin: Enhanced pending images processing completed - Processed: {$result['processed']}, Downloaded: {$result['downloaded']}, Errors: " . count($result['errors']));

                if (!empty($result['errors'])) {
                    error_log("Car Auction Plugin: Pending images errors: " . implode('; ', array_slice($result['errors'], 0, 5)));
                }
            } else {
                $auto_creator->process_pending_images();
                error_log('Car Auction Plugin: Standard pending images processing completed');
            }
        }
    }

    /**
     * Process delayed post creation (called by cron)
     */
    public function process_delayed_posts(): void
    {
        $lock_key = 'car_auction_process_delayed_posts_lock';
        if (!$this->acquire_cron_lock($lock_key, 10 * MINUTE_IN_SECONDS)) {
            error_log('Car Auction: Skipped delayed posts run - worker is already running');
            return;
        }

        // Process only queue items to avoid expensive joins with wp_postmeta
        global $wpdb;
        $queue_table = $wpdb->prefix . 'car_auction_post_queue';

        try {
            if (!class_exists('aea\Wp_Car_Auction_Lite\core\Car_Auction_Auto_Creator')) {
                return;
            }

            $batch_size = intval(get_option('car_auction_delayed_posts_batch_size', 10));
            $batch_size = max(1, min(50, $batch_size));
            $max_attempts = intval(get_option('car_auction_delayed_posts_max_attempts', 5));
            $max_attempts = max(1, min(20, $max_attempts));

            $queue_items = $wpdb->get_results($wpdb->prepare(
                "SELECT id, car_id, market, attempts
                 FROM {$queue_table}
                 WHERE status IN ('pending', 'failed')
                   AND scheduled_at <= NOW()
                   AND attempts < %d
                 ORDER BY scheduled_at ASC
                 LIMIT %d",
                $max_attempts,
                $batch_size
            ));

            if (empty($queue_items)) {
                return;
            }

            $auto_creator = $this::getCarAuctionAutoCreator();
            $processed = 0;
            $skipped = 0;
            $failed = 0;
            $rescheduled = 0;

            foreach ($queue_items as $item) {
                $wpdb->update(
                    $queue_table,
                    array(
                        'status' => 'processing',
                        'processed_at' => current_time('mysql')
                    ),
                    array('id' => intval($item->id)),
                    array('%s', '%s'),
                    array('%d')
                );

                $post_id = $auto_creator->create_car_post($item->car_id, $item->market);
                if ($post_id) {
                    $processed++;
                    continue;
                }

                $queue_row = $wpdb->get_row($wpdb->prepare(
                    "SELECT status, attempts FROM {$queue_table} WHERE id = %d",
                    intval($item->id)
                ));

                if (!$queue_row) {
                    $failed++;
                    continue;
                }

                if ($queue_row->status === 'skipped') {
                    $skipped++;
                    continue;
                }

                if ($queue_row->status === 'completed') {
                    $processed++;
                    continue;
                }

                $attempts = intval($queue_row->attempts);
                if ($attempts >= $max_attempts) {
                    $failed++;
                    continue;
                }

                // Exponential backoff for retries: 5, 10, 20, 40, 80 min (max 120)
                $retry_minutes = min(120, 5 * (2 ** max(0, $attempts - 1)));
                $next_run = date('Y-m-d H:i:s', current_time('timestamp') + ($retry_minutes * MINUTE_IN_SECONDS));

                $wpdb->update(
                    $queue_table,
                    array(
                        'status' => 'pending',
                        'scheduled_at' => $next_run
                    ),
                    array('id' => intval($item->id)),
                    array('%s', '%s'),
                    array('%d')
                );
                $rescheduled++;
            }

            error_log(
                "Car Auction: Delayed posts run completed - processed={$processed}, skipped={$skipped}, failed={$failed}, rescheduled={$rescheduled}"
            );
        } finally {
            $this->release_cron_lock($lock_key);
        }
    }

    private function acquire_cron_lock(string $key, int $ttl_seconds): bool
    {
        if (get_transient($key)) {
            return false;
        }
        set_transient($key, strval(time()), $ttl_seconds);
        return true;
    }

    private function release_cron_lock(string $key): void
    {
        delete_transient($key);
    }

    /**
     * Auto cleanup old posts (cron job)
     */
    public function auto_cleanup_posts(): void
    {
        if (class_exists('aea\Wp_Car_Auction_Lite\core\Car_Auction_Auto_Cleanup')) {
            $cleanup = $this::getCarAuctionAutoCleanup();
            $cleanup->perform_cleanup();
            error_log('Car Auction Plugin: Auto cleanup completed');
        }
    }
}
