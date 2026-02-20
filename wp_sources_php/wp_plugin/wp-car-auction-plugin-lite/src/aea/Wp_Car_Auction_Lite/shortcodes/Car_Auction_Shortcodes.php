<?php
/**
 * Car Auction Shortcodes Class - Fixed Version
 *
 * Handles shortcodes for displaying search forms and results
 */

namespace aea\Wp_Car_Auction_Lite\shortcodes;


use aea\Wp_Car_Auction_Lite\api\Car_Auction_API;
use aea\Wp_Car_Auction_Lite\core\Car_Auction_Search;
use aea\Wp_Car_Auction_Lite\Wp_Car_Auction_Plugin_Lite;

use aea\Wp_Car_Auction_Lite\shortcodes\renders\Render_Search_Form_Filters;
use aea\Wp_Car_Auction_Lite\shortcodes\renders\Render_Search_Result;
use aea\Wp_Car_Auction_Lite\shortcodes\renders\Render_Detail_Page;

use function esc_attr as translate_esc_attr;

if (!defined('ABSPATH')) {
    exit;
}

class Car_Auction_Shortcodes {

    private Car_Auction_Search $search;
    private Car_Auction_API $api;
    private Render_Search_Form_Filters $render_filters;
    private Render_Search_Result $render_result;
    private Render_Detail_Page $render_detail_page;

    public function __construct(Car_Auction_API $api, Car_Auction_Search $search) {
        $this->search = $search;
        $this->api = $api;
        add_shortcode('car_auction_search', array($this, 'search_shortcode'));

        add_shortcode('car_auction_detail', array($this, 'detail_shortcode'));
        add_shortcode('car_auction_indexing', array($this, 'indexing_shortcode'));

        $this->render_filters = Wp_Car_Auction_Plugin_Lite::getRenderSearchFormFilters();
        $this->render_result = Wp_Car_Auction_Plugin_Lite::getRenderSearchResult();
        $this->render_detail_page = Wp_Car_Auction_Plugin_Lite::getRenderDetailPage();
    }

    /**
     * Main search shortcode
     * Usage: [car_auction_search market="main" view="grid"]
     */
    public function search_shortcode($atts): bool|string
    {
        $atts = shortcode_atts(array(
            'market' => 'main',
            'view' => 'grid',
            'show_filters' => 'yes',
            'items_per_page' => get_option('car_auction_items_per_page', 20),
            'auto_search' => 'yes'
        ), $atts);

        // Validate market
        $valid_markets = array('main', 'korea', 'china', 'stats', 'bike', 'che_available');
        if (!in_array($atts['market'], $valid_markets)) {
            $atts['market'] = 'main';
        }

        ob_start();

        // Используем новый API
        $api = Wp_Car_Auction_Plugin_Lite::getCarAuctionApi();

        // Получаем доступные фильтры
        $filters = $api->get_dynamic_filters($atts['market']);

        // Get current filters from URL
        $current_filters = array();
        $filter_params = array('vendor', 'marka', 'model', 'year_from', 'year_to', 'engine_from', 'engine_to', 'mileage_from', 'mileage_to', 'kuzov', 'lot_number');

        foreach ($filter_params as $param) {
            if (isset($_GET[$param]) && $_GET[$param] !== '') {
                $current_filters[$param] = sanitize_text_field($_GET[$param]);
            }
        }

        // Handle _brand parameter as an alias for vendor (for breadcrumb compatibility)
        if (isset($_GET['_marka']) && $_GET['_marka'] !== '' && !isset($current_filters['vendor'])) {
            $brand_slug = sanitize_text_field($_GET['_marka']);
            // Convert brand slug to actual brand name used in API format "NAME VENDOR"
            $brand_name = $this->convert_brand_slug_to_name($brand_slug, $atts['market']);
            
            // Only set filter if we got a valid brand name
            if ($brand_name) {
                $current_filters['vendor'] = $brand_name;
            }
        }

        // Handle _model parameter as an alias for model (NEW)
        if (isset($_GET['_model']) && $_GET['_model'] !== '' && !isset($current_filters['model'])) {
            $model_slug = sanitize_text_field($_GET['_model']);
            // Convert model slug to actual model name
            $model_name = $this->convert_model_slug_to_name($model_slug, $atts['market'], $current_filters['vendor'] ?? '');

            // Only set filter if we got a valid model name
            if ($model_name) {
                $current_filters['model'] = $model_name;
            }
        }

        // Add pagination
        if (isset($_GET['car_page']) && $_GET['car_page'] > 1) {
            $current_filters['page'] = intval($_GET['car_page']);
        }

        ?>
        <div class="car-auction-shortcode-wrapper" data-market="<?php echo translate_esc_attr($atts['market']); ?>">
            <?php if ($atts['show_filters'] === 'yes'): ?>
                <div class="catalogue-wrapper">
                    <?php echo $this->render_filters->render_search_form($atts['market'], $current_filters); ?>
                    <div class="posts-list">
                        <div class="car-auction-results">
                            <div class="car-auction-loading" style="display: none;">
                                Загрузка...
                            </div>
                            <div class="car-auction-results-content"></div>
                        </div>
                        

                        <?php if ($atts['auto_search'] === 'yes'): ?>
                            <div class="car-auction-auto-results" style="display:none">
                                <?php echo $this->render_result->prepare_render_search_results($atts['market'], $current_filters, $atts['view']); ?>
                            </div>
                        <?php endif; ?>

                        <!-- Единая пагинация управляемая JS -->
                        <div class="car-auction-pagination"></div>
                    </div>
                </div>

            <?php else: ?>
                <?php if ($atts['auto_search'] === 'yes'): ?>
                    <div class="car-auction-auto-results">
                        <div class="all-catalogue mob-grid">
                        <?php //echo $this->render_result->prepare_render_search_results($atts['market'], $current_filters, $atts['view']); ?>
                        </div>
                    </div>
                <?php endif; ?>
            <?php endif; ?>
        </div>

        <script>
        jQuery(document).ready(function($) {
            // Ensure car auction scripts are initialized for this market
            if (typeof carAuction !== 'undefined') {
                console.log('Car Auction Shortcode: Initializing for market <?php echo esc_js($atts['market']); ?>');
            } else {
                console.warn('Car Auction Shortcode: carAuction object not found');
            }
        });
        </script>
        <?php

        return ob_get_clean();
    }

    /**
     * Car detail page shortcode - Fixed version without HTML document
     * Usage: [car_auction_detail car_id="123" market="main"]
     */
    /**
     * Car detail page shortcode - Fixed version without HTML document
     * Usage: [car_auction_detail car_id="123" market="main"]
     */
    public function detail_shortcode($atts): bool|string
    {
        $atts = shortcode_atts(array(
                'car_id' => '',
                'market' => 'main'
        ), $atts);

        if (empty($atts['car_id'])) {
            return '<div class="car-auction-error">Не указан ID автомобиля</div>';
            show_404(); 
            exit();
        }
        
        if (empty($atts['market'])) {
            return '<div class="car-auction-error">Не указан маркет</div>';
            show_404(); 
            exit();
        }
        
        // Validate market
        $valid_markets = array('main', 'korea', 'china', 'stats', 'bike', 'che_available');
        if (!in_array($atts['market'], $valid_markets)) {
            return '<div class="car-auction-error">Запрещенный маркет!</div>';
            show_403(); 
            exit();
        }

        // Получаем данные автомобиля из нового API
        $car_data = $this->api->get_car_details($atts['car_id'], $atts['market']);
        
        if (!$car_data['success']) {
            return '<div class="car-auction-error">Автомобиль не найден!</div>';
            show_404(); 
            exit();
        }

        // Для Китая скрываем комплектацию
        if ($atts['market'] == 'china') {
            $car_data['info'] = null;
        }

        // Создаем заголовок страницы
        $post_title = 'Заказать ' . $car_data['brand'] . ' ' . $car_data['model'] . ' ';

        if (!empty($car_data['year'])) {
            $post_title .= $car_data['year'] . ' года ';
        }

        // Используем рассчитанную цену из API вместо TKS
        if (!empty($car_data['calc_rub']) && $car_data['calc_rub'] > 0 && is_numeric($car_data['calc_rub'])) {
            $post_title .= 'за ' . number_format($car_data['calc_rub'], 0, '', ' ') . ' ₽ ';
        }

        // Определяем страну происхождения
        $market_names = [
                'main' => 'Японии',
                'korea' => 'Кореи',
                'china' => 'Китая',
                'bike' => 'Японии',
                'che_available' => 'Китая (Авто в наличии)'
        ];

        $market_name = $market_names[$atts['market']] ?? 'аукциона';
        $post_title .= ' из ' . $market_name;

        error_log("[AutoCreator]: Pre-detail NEW Formatted Title - " . $post_title);

        // Устанавливаем правильный HTTP статус для предзагрузочной страницы
        global $wp_query;
        if ($wp_query) {
            $wp_query->is_404 = false;
            $wp_query->is_page = true;
            $wp_query->is_singular = true;
            status_header(200);
        }

        // Устанавливаем динамический заголовок страницы
        add_filter('pre_get_document_title', function() use ($post_title) {
            return $post_title;
        });

        // Добавляем meta description для SEO
        add_action('wp_head', function() use ($car_data) {
            $description = $car_data['brand'] . ' ' . $car_data['model'] . ' ' . $car_data['year'];
            $description .= '. Пробег: ' . number_format($car_data['mileage_numeric'], 0, '', ' ') . ' км';
            $description .= '. Цена: ' . ($car_data['calc_rub'] > 0 && is_numeric($car_data['calc_rub']) ? number_format($car_data['calc_rub'], 0, '', ' ') . ' руб.' : 'по запросу');

            echo '<meta name="description" content="' . esc_attr($description) . '">';
        });

        // Показываем предзагрузочную страницу с данными из API
        return $this->render_detail_page->render_preload_car_detail_content($car_data);
    }

    /**
     * Convert brand slug to actual brand name used in API format "NAME VENDOR"
     * Returns false if brand is not valid
     */
    private function convert_brand_slug_to_name($brand_slug, $market) {
        // Convert slug to uppercase with spaces: "name-vendor" -> "NAME VENDOR"
        $brand_name = strtoupper(str_replace('-', ' ', $brand_slug));
        
        // Verify this brand exists in API vendors list
        $vendors = $this->api->get_vendors($market);
        
        if (!empty($vendors)) {
            foreach ($vendors as $vendor) {
                if ($vendor['marka_name'] === $brand_name) {
                    return $brand_name; // Valid brand found
                }
            }
        }
        
        // Brand not found in API vendors list
        error_log("Car Auction: Invalid brand slug '{$brand_slug}' for market '{$market}'");
        return false; // Skip setting the filter
    }

    /**
     * Convert model slug to actual model name
     */
    private function convert_model_slug_to_name($model_slug, $market, $vendor = '') {
        // Если есть вендор, пытаемся получить модели для него
        if (!empty($vendor)) {
            $models = $this->api->get_models($market, $vendor);
            foreach ($models as $model) {
                // Сравниваем по slug (убираем спецсимволы и приводим к нижнему регистру)
                $clean_slug = sanitize_title($model['model_name']);
                if ($clean_slug === $model_slug) {
                    return $model['model_name'];
                }
            }
        }

        // Fallback: возвращаем оригинальное значение с заменой дефисов на пробелы
        return str_replace('-', ' ', $model_slug);
    }
}

