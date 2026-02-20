<?php
/**
 * Car Auction Shortcodes Class - Fixed Version
 *
 * Handles shortcodes for displaying search forms and results
 */

namespace aea\Wp_Car_Auction_Lite\shortcodes\renders;

use aea\Wp_Car_Auction_Lite\api\Car_Auction_API;

if (!defined('ABSPATH')) {
    exit;
}

class Render_Search_Form_Filters {

    private Car_Auction_API $api;

    public function __construct(Car_Auction_API $api)
    {
        $this->api = $api;
    }

    /**
     * Generate search form HTML
     */
    public function render_search_form($market = 'main', $filters = array()): bool|string {
        // Получаем ВСЕ данные фильтров одним запросом к API
        $filters_data = $this->api->get_dynamic_filters($market, $filters);
        $vendors = $filters_data['vendors'] ?? [];
        $models = $filters_data['models'] ?? [];
        $fuel_types = $filters_data['fuel_types'] ?? [];
        $transmissions = $filters_data['transmissions'] ?? [];
        $drives = $filters_data['drives'] ?? [];
        $market_labels = array(
                'main' => 'Подбор автомобиля из Японии',
                'korea' => 'Подбор автомобиля из Кореи',
                'china' => 'Подбор автомобиля из Китая (Под заказ)',
                'bike' => 'Подбор мотоцикла',
                'che_available' => 'Подбор автомобиля из Китая (В наличии)'
        );
        ob_start();
        ?>
        <div class="fliter-wrapper">
            <div class="h2-wrapper">
                <h1 class="h2 mid"><?php echo esc_html($market_labels[$market] ?? __('Car Search', 'car-auction')); ?></h1>
            </div>
            <div class="all-filter">
                <div class="w-form">
                    <form id="wf-form-filter" name="filter" data-name="filter" method="post" data-wf-page-id="683ea4aeb9508770dbce63b8" data-wf-element-id="baeec6f7-7abd-14c7-3c13-f8db967f9ce4" action="/" aria-label="filter" data-market="<?php echo esc_attr($market); ?>">
                        <div class="filter-all">
                            <!-- Марка -->
                            <div class="filter-param">
                                <div class="filter-title">Марка</div>
                                <div class="filter-facet">
                                    <div class="facetwp-facet facetwp-facet-brand facetwp-type-dropdown" data-name="brand" data-type="dropdown">
                                        <select class="facetwp-dropdown filter-select car-auction-vendor-select" style="display: none;" data-market="<?php echo esc_attr($market); ?>" name="vendor">
                                            <option value="">Любая марка</option>
                                            <?php foreach ($vendors as $vendor): ?>
                                                <option value="<?php echo esc_attr($vendor); ?>"
                                                        <?php selected($filters['marka'] ?? '', $vendor); ?>>
                                                    <?php echo esc_html($vendor); ?>
                                                </option>
                                            <?php endforeach; ?>
                                        </select>
                                        <div class="custom-select-container facet-dropdown-container">
                                            <div class="custom-select-trigger">Любая марка</div>
                                            <div class="facet-dropdown-list">
                                                <div class="facet-dropdown-item selected" data-value="">Любая марка</div>
                                                <?php foreach ($vendors as $vendor): ?>
                                                    <div class="facet-dropdown-item" data-value="<?php echo esc_attr($vendor); ?>">
                                                        <?php echo esc_html($vendor) ?>
                                                    </div>
                                                <?php endforeach; ?>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- Модель -->
                            <div class="filter-param">
                                <div class="filter-title">Модель</div>
                                <div class="filter-facet">
                                    <div class="facetwp-facet facetwp-facet-model facetwp-type-dropdown" data-name="model" data-type="dropdown">
                                        <select class="facetwp-dropdown filter-select car-auction-model-select" style="display: none;" data-market="<?php echo esc_attr($market); ?>" name="model">
                                            <option value="">Любая модель</option>
                                            <?php foreach ($models as $model): ?>
                                                <option value="<?php echo esc_attr($model); ?>"
                                                        <?php selected($filters['model'] ?? '', $model); ?>>
                                                    <?php echo esc_html($model); ?>
                                                </option>
                                            <?php endforeach; ?>
                                        </select>
                                        <div class="custom-select-container facet-dropdown-container">
                                            <div class="custom-select-trigger">Любая модель</div>
                                            <div class="facet-dropdown-list">
                                                <div class="facet-dropdown-item selected" data-value="">Любая модель</div>
                                                <?php foreach ($models as $model): ?>
                                                    <div class="facet-dropdown-item" data-value="<?php echo esc_attr($model); ?>">
                                                        <?php echo esc_html($model) ?>
                                                    </div>
                                                <?php endforeach; ?>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- Тип топлива -->
                            <div class="filter-param">
                                <div class="filter-title">Тип топлива</div>
                                <div class="filter-facet">
                                    <div class="facetwp-facet facetwp-facet-fuel facetwp-type-dropdown" data-name="fuel" data-type="dropdown">
                                        <select class="facetwp-dropdown filter-select" style="display: none;" name="fuel_type">
                                            <option value="">Любой</option>
                                            <?php foreach ($fuel_types as $fuel): ?>
                                                <option value="<?php echo esc_attr($fuel['code']); ?>"
                                                        <?php selected($filters['fuel_type'] ?? '', $fuel['code']); ?>>
                                                    <?php echo esc_html($fuel['name']); ?>
                                                </option>
                                            <?php endforeach; ?>
                                        </select>
                                        <div class="custom-select-container facet-dropdown-container">
                                            <div class="custom-select-trigger">Любой</div>
                                            <div class="facet-dropdown-list">
                                                <div class="facet-dropdown-item selected" data-value="">Любой</div>
                                                <?php foreach ($fuel_types as $fuel): ?>
                                                    <div class="facet-dropdown-item" data-value="<?php echo esc_attr($fuel['code']); ?>">
                                                        <?php echo esc_html($fuel['name']); ?>
                                                    </div>
                                                <?php endforeach; ?>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- Трансмиссия -->
                            <div class="filter-param">
                                <div class="filter-title">Трансмиссия</div>
                                <div class="filter-facet">
                                    <div class="facetwp-facet facetwp-facet-transmission facetwp-type-dropdown" data-name="transmission" data-type="dropdown">
                                        <select class="facetwp-dropdown filter-select" style="display: none;" name="transmission_group">
                                            <option value="">Любая</option>
                                            <?php foreach ($transmissions as $group => $data): ?>
                                                <option value="<?php echo esc_attr($group); ?>"
                                                        <?php selected($filters['transmission_group'] ?? '', $group); ?>>
                                                    <?php echo esc_html($data['name']); ?>
                                                </option>
                                            <?php endforeach; ?>
                                        </select>
                                        <div class="custom-select-container facet-dropdown-container">
                                            <div class="custom-select-trigger">Любая</div>
                                            <div class="facet-dropdown-list">
                                                <div class="facet-dropdown-item selected" data-value="">Любая</div>
                                                <?php foreach ($transmissions as $group => $data): ?>
                                                    <div class="facet-dropdown-item" data-value="<?php echo esc_attr($group); ?>">
                                                        <?php echo esc_html($data['name']); ?>
                                                    </div>
                                                <?php endforeach; ?>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- Привод -->
                            <div class="filter-param">
                                <div class="filter-title">Привод</div>
                                <div class="filter-facet">
                                    <div class="facetwp-facet facetwp-facet-drive facetwp-type-dropdown" data-name="drive" data-type="dropdown">
                                        <select class="facetwp-dropdown filter-select" style="display: none;" name="drive">
                                            <option value="">Любой</option>
                                            <?php foreach ($drives as $drive => $data): ?>
                                                <option value="<?php echo esc_attr($drive); ?>"
                                                        <?php selected($filters['drive'] ?? '', $drive); ?>>
                                                    <?php echo esc_html($data['name']); ?>
                                                </option>
                                            <?php endforeach; ?>
                                        </select>
                                        <div class="custom-select-container facet-dropdown-container">
                                            <div class="custom-select-trigger">Любой</div>
                                            <div class="facet-dropdown-list">
                                                <div class="facet-dropdown-item selected" data-value="">Любой</div>
                                                <?php foreach ($drives as $drive => $data): ?>
                                                    <div class="facet-dropdown-item" data-value="<?php echo esc_attr($drive); ?>">
                                                        <?php echo esc_html($data['name']); ?>
                                                    </div>
                                                <?php endforeach; ?>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- Цена -->
                            <div class="filter-param">
                                <div class="filter-title">Цена, руб.</div>
                                <div class="two-filters">
                                    <div class="facetwp-facet facetwp-facet-price facetwp-type-number_range" data-name="price" data-type="number_range">
                                        <div class="facet-dropdown-container">
                                            <div class="facet-input-wrapper">
                                                <input type="number" class="facetwp-number facetwp-number-min text-field" name="price_from" value="<?php echo esc_attr($filters['price_from'] ?? ''); ?>" placeholder="Мин" disabled>
                                                <div class="loading-spinner"></div>
                                            </div>
                                            <div class="facet-dropdown-list"></div>
                                        </div>
                                        <div class="facet-dropdown-container">
                                            <div class="facet-input-wrapper">
                                                <input type="number" class="facetwp-number facetwp-number-max text-field" name="price_to" value="<?php echo esc_attr($filters['price_to'] ?? ''); ?>" placeholder="Макс" disabled>
                                                <div class="loading-spinner"></div>
                                            </div>
                                            <div class="facet-dropdown-list"></div>
                                        </div>
                                        <input type="button" class="facetwp-submit" value="Перейти">
                                    </div>
                                </div>
                            </div>
                            <!-- Год -->
                            <div class="filter-param">
                                <div class="filter-title">Год</div>
                                <div class="two-filters">
                                    <div class="facetwp-facet facetwp-facet-year facetwp-type-number_range" data-name="year" data-type="number_range">
                                        <div class="facet-dropdown-container">
                                            <div class="facet-input-wrapper">
                                                <input type="number" class="facetwp-number facetwp-number-min text-field" name="year_from" value="<?php echo esc_attr($filters['year_from'] ?? ''); ?>" placeholder="Мин">
                                                <div class="loading-spinner"></div>
                                            </div>
                                            <div class="facet-dropdown-list"></div>
                                        </div>
                                        <div class="facet-dropdown-container">
                                            <div class="facet-input-wrapper">
                                                <input type="number" class="facetwp-number facetwp-number-max text-field" name="year_to" value="<?php echo esc_attr($filters['year_to'] ?? ''); ?>" placeholder="Макс">
                                                <div class="loading-spinner"></div>
                                            </div>
                                            <div class="facet-dropdown-list"></div>
                                        </div>
                                        <input type="button" class="facetwp-submit" value="Перейти">
                                    </div>
                                </div>
                            </div>
                            <!-- Пробег -->
                            <div class="filter-param">
                                <div class="filter-title">Пробег, км</div>
                                <div class="two-filters">
                                    <div class="facetwp-facet facetwp-facet-probeg facetwp-type-number_range" data-name="probeg" data-type="number_range">
                                        <div class="facet-dropdown-container">
                                            <div class="facet-input-wrapper">
                                                <input type="number" class="facetwp-number facetwp-number-min text-field" name="mileage_from" value="<?php echo esc_attr($filters['mileage_from'] ?? ''); ?>" placeholder="Мин">
                                                <div class="loading-spinner"></div>
                                            </div>
                                            <div class="facet-dropdown-list"></div>
                                        </div>
                                        <div class="facet-dropdown-container">
                                            <div class="facet-input-wrapper">
                                                <input type="number" class="facetwp-number facetwp-number-max text-field" name="mileage_to" value="<?php echo esc_attr($filters['mileage_to'] ?? ''); ?>" placeholder="Макс">
                                                <div class="loading-spinner"></div>
                                            </div>
                                            <div class="facet-dropdown-list"></div>
                                        </div>
                                        <input type="button" class="facetwp-submit" value="Перейти">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="filter-buttons-wrapper">
                            <a id="reset" href="#" class="button-light-gray w-button car-auction-reset-btn">Сбросить</a>
                            <a id="show" href="#" class="button-red long m-100 h-60 w-button car-auction-search-btn">Показать</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}