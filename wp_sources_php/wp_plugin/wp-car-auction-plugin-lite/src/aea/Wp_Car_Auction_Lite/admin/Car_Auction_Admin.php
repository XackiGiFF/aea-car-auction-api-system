<?php
/**
 * Car Auction Admin Class - Lite Version
 * 
 * Упрощенный админ интерфейс для Lite версии плагина
 * Содержит только настройки подключения к API, код подключения
 * и отслеживание CRON очередей
 */

namespace aea\Wp_Car_Auction_Lite\admin;

use aea\Wp_Car_Auction_Lite\api\Car_Auction_API;
use aea\Wp_Car_Auction_Lite\core\Car_Auction_Auto_Creator;

if (!defined('ABSPATH')) {
    exit;
}

class Car_Auction_Admin {
    
    private Car_Auction_API $api;
    private Car_Auction_Auto_Creator $auto_creator;
    private Car_Auction_Queue_Processor $queue_processor;
    
    public function __construct(Car_Auction_API $api, Car_Auction_Auto_Creator $auto_creator, Car_Auction_Queue_Processor $queue_processor) {
        $this->api = $api;
        $this->auto_creator = $auto_creator;
        $this->queue_processor = $queue_processor;
        
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'admin_init'));
        add_action('admin_enqueue_scripts', array($this, 'admin_scripts'));
        
        // AJAX обработчики
        add_action('wp_ajax_car_auction_test_api_connection', array($this, 'ajax_test_api_connection'));
        add_action('wp_ajax_car_auction_get_queue_status', array($this, 'ajax_get_queue_status'));
        add_action('wp_ajax_car_auction_get_cron_status', array($this, 'ajax_get_cron_status'));
    }
    
    /**
     * Добавление админ меню
     */
    public function add_admin_menu() {
        add_menu_page(
            'Car Auction Lite',
            'Car Auction Lite',
            'manage_options',
            'car-auction-lite',
            array($this, 'main_admin_page'),
            'dashicons-car',
            30
        );
    }
    
    /**
     * Инициализация админ настроек
     */
    public function admin_init() {
        // API настройки
        register_setting('car_auction_lite_settings', 'car_auction_api_server');
        register_setting('car_auction_lite_settings', 'car_auction_api_code');
        register_setting('car_auction_lite_settings', 'car_auction_debug_mode');
        register_setting('car_auction_lite_settings', 'car_auction_max_images_per_day');
        register_setting('car_auction_lite_settings', 'car_auction_auto_create_posts');
    }
    
    /**
     * Подключение админ скриптов
     */
    public function admin_scripts($hook) {
        if (strpos($hook, 'car-auction-lite') === false) {
            return;
        }
        
        wp_enqueue_script('car-auction-lite-admin', CAR_AUCTION_PLUGIN_URL . 'assets/js/admin-lite.js', array('jquery'), '1.0.0', true);
        wp_enqueue_style('car-auction-lite-admin', CAR_AUCTION_PLUGIN_URL . 'assets/css/admin-lite.css', array(), '1.0.0');
        
        wp_localize_script('car-auction-lite-admin', 'carAuctionLiteAdmin', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('car_auction_nonce'),
        ));
    }
    
    /**
     * Главная страница админки
     */
    public function main_admin_page() {
        ?>
        <div class="wrap">
            <h1>Car Auction Lite - Настройки</h1>
            
            <div class="car-auction-admin-content">
                
                <!-- API Connection Settings -->
                <div class="car-auction-admin-section">
                    <h2>Настройки API подключения</h2>
                    
                    <form method="post" action="options.php">
                        <?php settings_fields('car_auction_lite_settings'); ?>
                        
                        <table class="form-table">
                            <tr>
                                <th scope="row">API Сервер</th>
                                <td>
                                    <input type="url" name="car_auction_api_server" 
                                           value="<?php echo esc_attr(get_option('car_auction_api_server', 'https://api.avtovozauto.ru')); ?>" 
                                           class="regular-text" />
                                    <p class="description">URL API сервера</p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">API Код</th>
                                <td>
                                    <input type="text" name="car_auction_api_code" 
                                           value="<?php echo esc_attr(get_option('car_auction_api_code', '')); ?>" 
                                           class="regular-text" />
                                    <p class="description">Код доступа к API</p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">Режим отладки</th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="car_auction_debug_mode" value="1" 
                                               <?php checked(get_option('car_auction_debug_mode'), 1); ?> />
                                        Включить подробное логирование API запросов
                                    </label>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">Автосоздание постов</th>
                                <td>
                                    <label>
                                        <input type="checkbox" name="car_auction_auto_create_posts" value="1" 
                                               <?php checked(get_option('car_auction_auto_create_posts', 1), 1); ?> />
                                        Автоматически создавать страницы для авто с рассчитанной ценой
                                    </label>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">Лимит загрузки изображений</th>
                                <td>
                                    <input type="number" name="car_auction_max_images_per_day" 
                                           value="<?php echo esc_attr(get_option('car_auction_max_images_per_day', 2000)); ?>" 
                                           class="small-text" min="0" max="10000" />
                                    <p class="description">Максимальное количество изображений для загрузки в день</p>
                                </td>
                            </tr>
                        </table>
                        
                        <?php submit_button('Сохранить настройки'); ?>
                    </form>
                    
                    <hr>
                    
                    <!-- Test API Connection -->
                    <h3>Проверка подключения к API</h3>
                    <button type="button" class="button" id="test-api-connection">Проверить соединение с API</button>
                    <div id="api-connection-result" style="margin-top: 10px;"></div>
                </div>
                
                <!-- Queue Status -->
                <div class="car-auction-admin-section">
                    <h2>Статус очередей</h2>
                    
                    <div class="car-auction-stats-grid">
                        <div class="stat-item">
                            <h4>Очередь создания страниц</h4>
                            <div id="queue-stats" class="loading">Загрузка...</div>
                            <button type="button" class="button" id="refresh-queue-stats">Обновить</button>
                            <button type="button" class="button button-primary" id="process-queue-manually">Обработать очередь</button>
                        </div>
                        
                        <div class="stat-item">
                            <h4>Загруженные изображения сегодня</h4>
                            <div class="stat-number">
                                <?php echo $this->auto_creator->get_daily_download_count(); ?> / <?php echo get_option('car_auction_max_images_per_day', 2000); ?>
                            </div>
                        </div>
                        
                        <div class="stat-item">
                            <h4>Посты с отложенными изображениями</h4>
                            <div class="stat-number">
                                <?php echo count($this->auto_creator->get_posts_with_pending_images()); ?>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- CRON Status -->
                <div class="car-auction-admin-section">
                    <h2>Статус CRON задач</h2>
                    
                    <div id="cron-status" class="loading">Загрузка...</div>
                    <br>
                    <button type="button" class="button" id="refresh-cron-status">Обновить статус CRON</button>
                    <button type="button" class="button button-primary" id="run-cron-manually">Запустить CRON вручную</button>
                </div>
                
                <!-- System Info -->
                <div class="car-auction-admin-section">
                    <h2>Системная информация</h2>
                    
                    <table class="widefat">
                        <tr>
                            <td><strong>Версия плагина:</strong></td>
                            <td><?php echo defined('CAR_AUCTION_LITE_VERSION') ? CAR_AUCTION_VERSION : '1.0.0'; ?></td>
                        </tr>
                        <tr>
                            <td><strong>PHP версия:</strong></td>
                            <td><?php echo PHP_VERSION; ?></td>
                        </tr>
                        <tr>
                            <td><strong>WordPress версия:</strong></td>
                            <td><?php echo get_bloginfo('version'); ?></td>
                        </tr>
                        <tr>
                            <td><strong>WP Cron включен:</strong></td>
                            <td><?php echo defined('DISABLE_WP_CRON') && DISABLE_WP_CRON ? 'Отключен' : 'Включен'; ?></td>
                        </tr>
                        <tr>
                            <td><strong>Время сервера:</strong></td>
                            <td><?php echo current_time('mysql'); ?></td>
                        </tr>
                    </table>
                </div>
                
            </div>
        </div>
        
        <style>
        .car-auction-admin-content {
            max-width: 1200px;
        }
        
        .car-auction-admin-section {
            background: #fff;
            border: 1px solid #c3c4c7;
            border-radius: 4px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .car-auction-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 15px;
        }
        
        .stat-item {
            background: #f6f7f7;
            padding: 15px;
            border-radius: 4px;
            border: 1px solid #dcdcde;
        }
        
        .stat-item h4 {
            margin: 0 0 10px 0;
            color: #1d2327;
        }
        
        .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #2271b1;
            margin-bottom: 10px;
        }
        
        .loading::before {
            content: "⏳ ";
        }
        
        .success {
            color: #00a32a;
            font-weight: bold;
        }
        
        .error {
            color: #d63638;
            font-weight: bold;
        }
        
        .warning {
            color: #dba617;
            font-weight: bold;
        }
        
        .button + .button {
            margin-left: 5px;
        }
        </style>
        <?php
    }
    
    /**
     * AJAX: Тест соединения с API
     */
    public function ajax_test_api_connection() {
        check_ajax_referer('car_auction_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }
        
        try {
            // Пробуем получить базовую информацию через API
            $result = $this->api->get_vendors('main');
            
            if (!empty($result)) {
                wp_send_json_success(array(
                    'message' => 'Соединение с API успешно установлено!',
                    'details' => 'Получено ' . count($result) . ' брендов для рынка Japan'
                ));
            } else {
                wp_send_json_error('API вернул пустой результат');
            }
        } catch (Exception $e) {
            wp_send_json_error('Ошибка подключения к API: ' . $e->getMessage());
        }
    }
    
    /**
     * AJAX: Получить статус очереди
     */
    public function ajax_get_queue_status() {
        check_ajax_referer('car_auction_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }
        
        $stats = $this->queue_processor->get_queue_stats();
        
        wp_send_json_success($stats);
    }
    
    /**
     * AJAX: Получить статус CRON
     */
    public function ajax_get_cron_status() {
        check_ajax_referer('car_auction_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Недостаточно прав');
        }
        
        $next_cron_time = $this->queue_processor->get_next_cron_time();
        
        $cron_info = array(
            'next_run' => $next_cron_time ? date('Y-m-d H:i:s', $next_cron_time) : 'Не запланирован',
            'next_run_relative' => $next_cron_time ? human_time_diff($next_cron_time, time()) : 'N/A',
            'server_time' => current_time('mysql'),
            'wp_cron_enabled' => !defined('DISABLE_WP_CRON') || !DISABLE_WP_CRON
        );
        
        wp_send_json_success($cron_info);
    }
}
