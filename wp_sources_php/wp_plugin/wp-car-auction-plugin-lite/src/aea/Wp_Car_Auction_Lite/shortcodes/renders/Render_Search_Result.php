<?php
/**
 * Car Auction Shortcodes Class - Fixed Version
 *
 * Handles shortcodes for displaying search forms and results
 */

namespace aea\Wp_Car_Auction_Lite\shortcodes\renders;

use aea\Wp_Car_Auction_Lite\api\Car_Auction_API;
use aea\Wp_Car_Auction_Lite\core\Car_Auction_Auto_Creator;
use aea\Wp_Car_Auction_Lite\core\Car_Auction_Indexer;

if (!defined('ABSPATH')) {
    exit;
}

class Render_Search_Result {

    private Car_Auction_API $api;

    public function __construct(Car_Auction_API $api)
    {
        $this->api = $api;
    }

    /**
     * Render auto search results (for initial page load)
     */
    /**
     * Render auto search results (for initial page load)
     */
    public function prepare_render_search_results($market, $filters, $view): bool|string {
        // If no filters, show first 20 cars from the freshest/newest
        if (empty($filters)) {
            $filters = array('page' => 1);
        }

        // Используем новый API для поиска
        $results = $this->api->search_cars($market, $filters);

        //error_log('[API] RESULT: ' . print_r($results, true) );

        // Форматируем данные автомобилей
        $formatted_cars = array();
        if (!empty($results['cars']) && is_array($results['cars'])) {
            foreach ($results['cars'] as $car) {
                $formatted_cars[] = $this->api->format_car_data($car, $market);
            }
        }

        $results['cars'] = $formatted_cars;
        return $this->render_search_results($results, $view);
    }

    /**
     * Render search results
     */
    public function render_search_results($results, $view_type = 'grid'): bool|string {
        if (empty($results['cars'])) {
            return '<div class="no-results">Ничего не найдено</div>';
        }

        ob_start();

        if ($view_type === 'grid') {
            echo '<div class="all-catalogue mob-grid">';
            foreach ($results['cars'] as $car) {
                echo $this->render_car_card($car);
            }
            echo '</div>';

            // Добавляем пагинацию
            //if (!empty($results['pagination'])) {
            //    echo $this->render_pagination($results['pagination']);
            //}
        } else {
            echo $this->render_car_table($results['cars']);
        }
        
        // Очистка памяти
        do_action('car_auction_after_pagination');

        return ob_get_clean();
    }

    /**
     * Render pagination
     */
    private function render_pagination($pagination): bool|string
    {
        $current_page = ($pagination['offset'] / $pagination['limit']) + 1;
        $total_pages = ceil($pagination['total'] / $pagination['limit']);

        if ($total_pages <= 1) return '';

        ob_start();
        ?>
        <div class="car-auction-pagination">
            <?php if ($current_page > 1): ?>
                <a href="?page=<?php echo $current_page - 1; ?>" class="pagination-prev">← Назад</a>
            <?php endif; ?>

            <?php for ($i = 1; $i <= $total_pages; $i++): ?>
                <?php if ($i === $current_page): ?>
                    <span class="pagination-current"><?php echo $i; ?></span>
                <?php else: ?>
                    <a href="?page=<?php echo $i; ?>" class="pagination-link"><?php echo $i; ?></a>
                <?php endif; ?>
            <?php endfor; ?>

            <?php if ($current_page < $total_pages): ?>
                <a href="?page=<?php echo $current_page + 1; ?>" class="pagination-next">Вперед →</a>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render single car card - ОСНОВНОЙ МЕТОД, КОТОРЫЙ НУЖНО ОБНОВИТЬ
     */
    public function render_car_card($car): bool|string {
        // Генерация URL
        $brand_slug = !empty($car['brand']) ? sanitize_title($car['brand']) : 'unknown';
        $model_slug = !empty($car['model']) ? sanitize_title($car['model']) : 'unknown';
        $market_name = $this->market_code_to_name($car['market']);

        if ($brand_slug === 'unknown' || $model_slug === 'unknown') {
            $car_url = home_url("/cars/{$market_name}/{$car['id']}/");
        } else {
            $car_url = home_url("/cars/{$market_name}/{$brand_slug}-{$model_slug}/{$car['id']}/");
        }

        $main_image = $car['images'][0] ?? '';

        // Используем рассчитанную цену из API
        $has_calculated_price = is_numeric($car['calc_rub']) && (float)$car['calc_rub'] > 0;
        $final_price = $has_calculated_price ? (float)$car['calc_rub'] : '—';


        ob_start();
        ?>
        <div class="one-car-wrapper w-inline-block" data-content="query_item" data-car-url="<?php echo esc_url($car_url); ?>">
            <div class="one-car-image">
                <?php if ($main_image): ?>
                    <img src="<?php echo esc_url($main_image . '&w=320'); ?>" loading="lazy"
                         alt="<?php echo esc_attr($car['brand'] . ' ' . $car['model']); ?>" class="image">
                <?php else: ?>
                    <div class="car-auction-no-image">Нет изображения</div>
                <?php endif; ?>
            </div>

            <div class="car-title">
                <h3 class="h3">
                    <span><?php echo esc_html($car['brand']); ?></span>
                    <span><?php echo esc_html($car['model']); ?></span>
                </h3>
            </div>

            <div class="car-props">
                <!-- Год -->
                <?php if (!empty($car['year']) && $car['year'] >= 1900 && $car['year'] <= date('Y')): ?>
                    <div class="one-car-prop">
                        <div class="car-prop-img-wrapper">
                            <img src="<?php echo get_template_directory_uri(); ?>/images/684013aae4b3d097e13a00b9_settings.png" loading="lazy" alt="" class="car-prop-img">
                        </div>
                        <div class="m-20-500 m-3"><?php echo esc_html($car['year']); ?></div>
                    </div>
                <?php endif; ?>

                <!-- Пробег -->
                <?php if (!empty($car['mileage_numeric']) && $car['mileage_numeric'] > 0): ?>
                    <div class="one-car-prop">
                        <div class="car-prop-img-wrapper">
                            <img src="<?php echo get_template_directory_uri(); ?>/images/684014697f98d691d026ddf6_road.png" loading="lazy" alt="" class="car-prop-img">
                        </div>
                        <div class="m-20-500 m-3"><?php echo number_format($car['mileage_numeric'], 0, '', ' '); ?></div>
                    </div>
                <?php endif; ?>

                <!-- Трансмиссия -->
                <?php if (!empty($car['transmission']) && !in_array($car['transmission'], ['—', '-'])): ?>
                    <div class="one-car-prop">
                        <div class="car-prop-img-wrapper">
                            <img src="<?php echo get_template_directory_uri(); ?>/images/684015241d503fea2fb7d3e8_gear-shift.png" loading="lazy" alt="" class="car-prop-img">
                        </div>
                        <div class="m-20-500 m-3"><?php echo esc_html($car['transmission']); ?></div>
                    </div>
                <?php endif; ?>

                <!-- Объем двигателя -->
                <?php if (!empty($car['engine_volume'])): ?>
                    <div class="one-car-prop">
                        <div class="car-prop-img-wrapper">
                            <img src="<?php echo get_template_directory_uri(); ?>/images/68401730c9e623ec8951e644_reduced.png" loading="lazy" alt="" class="car-prop-img">
                        </div>
                        <div class="m-20-500 m-3"><?php echo esc_html($car['engine_volume']); ?> см³</div>
                    </div>
                <?php endif; ?>

                <!-- Топливо -->
                <?php if (!empty($car['fuel']) && !in_array($car['fuel'], ['—', '-', 'Не указано'])): ?>
                    <div class="one-car-prop">
                        <div class="car-prop-img-wrapper">
                            <img src="<?php echo get_template_directory_uri(); ?>/images/68401904b466605383cdb316_canister.png" loading="lazy" alt="" class="car-prop-img">
                        </div>
                        <div class="m-20-500 m-3"><?php echo esc_html($this->api->get_fuel_name($car['fuel'])); ?></div>
                    </div>
                <?php endif; ?>

                <!-- Привод -->
                <?php if (!empty($car['drive']) && !in_array($car['drive'], ['—', '-'])): ?>
                    <div class="one-car-prop">
                        <div class="car-prop-img-wrapper">
                            <img src="<?php echo get_template_directory_uri(); ?>/images/684016b2b466605383cc6f23_drivetrain.png" loading="lazy" alt="" class="car-prop-img">
                        </div>
                        <div class="m-20-500 m-3"><?php echo esc_html($car['drive']); ?></div>
                    </div>
                <?php endif; ?>
            </div>

            <div class="price-wrapper">
                <div class="car-action-buttons">
                    <div class="button-red-small m-15 car-details-btn"
                         data-car-id="<?php echo esc_attr($car['id']); ?>"
                         data-market="<?php echo esc_attr($car['market']); ?>"
                         data-brand="<?php echo esc_attr($car['brand']); ?>"
                         data-model="<?php echo esc_attr($car['model']); ?>"
                         title="Перейти на детальную страницу">
                        <div class="m-14-600 white">Подробнее</div>
                    </div>
                </div>

                <div
                    class="price-car-s js-async-price"
                    data-car-id="<?php echo esc_attr($car['id']); ?>"
                    data-market="<?php echo esc_attr($car['market']); ?>"
                    data-price-state="<?php echo $has_calculated_price ? 'ready' : 'pending'; ?>"
                    data-rub-icon="<?php echo esc_attr(get_template_directory_uri().'/images/6840196e6a5fa9ce234c237e_ruble.png'); ?>"
                >
                    <?php
                    
                    $currency_src = get_template_directory_uri().'/images/6840196e6a5fa9ce234c237e_ruble.png';
                    if (!$has_calculated_price) {
                        switch ($car['currency']) {
                            case 'USD':
                                $currency_src = CAR_AUCTION_PLUGIN_URL.'assets/images/USD.png';
                                break;
                            case 'KRW':
                                $currency_src = CAR_AUCTION_PLUGIN_URL.'assets/images/KRW.png';
                                break;
                            case 'CNY':
                                $currency_src = CAR_AUCTION_PLUGIN_URL.'assets/images/CNY.png';
                                break;
                            case 'JPY':
                                $currency_src = CAR_AUCTION_PLUGIN_URL.'assets/images/JPY.png';
                                break;
                        }
                    }
                    ?>
                    
                    <img src="<?php echo esc_url($currency_src); ?>" loading="lazy" alt="" class="rub-img js-price-currency">
                    <div class="em-1-5 js-price-value">
                        <?php if ($has_calculated_price): ?>
                            <?php echo number_format($final_price, 0, '', ' '); ?>
                        <?php else: ?>
                            <?php if (is_numeric($car['stock_price'])): ?>
                                <?php echo number_format($car['stock_price'], 0, '', ' ') ?>
                            <?php else: ?>
                                —
                            <?php endif; ?>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Convert market code to readable name
     */
    private function market_code_to_name($market) {
        $markets = [
                'main' => 'japan',
                'korea' => 'korea',
                'china' => 'china',
                'bike' => 'bike',
                'che_available' => 'che_available'
        ];
        return $markets[$market] ?? $market;
    }

    /**
     * Render car table (упрощенная версия)
     */
    private function render_car_table($cars) {
        ob_start();
        ?>
        <table class="car-auction-table">
            <thead>
            <tr>
                <th>Фото</th>
                <th>Автомобиль</th>
                <th>Год</th>
                <th>Двигатель</th>
                <th>Пробег</th>
                <th>Цена</th>
                <th>Действия</th>
            </tr>
            </thead>
            <tbody>
            <?php foreach ($cars as $car): ?>
                <tr>
                    <td>
                        <?php if (!empty($car['images'][0])): ?>
                            <img src="<?php echo esc_url($car['images'][0] . '&w=60'); ?>" alt="" width="60" height="60">
                        <?php endif; ?>
                    </td>
                    <td>
                        <strong><?php echo esc_html($car['brand'] . ' ' . $car['model']); ?></strong>
                    </td>
                    <td><?php echo esc_html($car['year']); ?></td>
                    <td><?php echo esc_html($car['engine_volume']); ?> см³</td>
                    <td><?php echo number_format($car['mileage_numeric'], 0, '', ' '); ?> км</td>
                    <td>
                        <?php if ($car['calc_rub'] > 0): ?>
                            <?php echo number_format($car['calc_rub'], 0, '', ' '); ?> руб.
                        <?php else: ?>
                            —
                        <?php endif; ?>
                    </td>
                    <td>
                        <a href="<?php echo $this->get_car_detail_url($car); ?>" class="button">
                            Подробнее
                        </a>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php
        return ob_get_clean();
    }

    /**
     * Generate car detail URL
     */
    private function get_car_detail_url($car) {
        $brand_slug = sanitize_title($car['brand']);
        $model_slug = sanitize_title($car['model']);
        $market_name = $this->market_code_to_name($car['market']);

        return home_url("/cars/{$market_name}/{$brand_slug}-{$model_slug}/{$car['id']}/");
    }
}
