<?php
/**
 * Car Auction Shortcodes Class - Fixed Version
 *
 * Handles shortcodes for displaying search forms and results
 */

namespace aea\Wp_Car_Auction_Lite\shortcodes\renders;

use aea\Wp_Car_Auction_Lite\api\Car_Auction_API;
use aea\Wp_Car_Auction_Lite\Wp_Car_Auction_Plugin_Lite;

if (!defined('ABSPATH')) {
    exit;
}

class Render_Detail_Page {

    private Car_Auction_API $api;

    public function __construct(Car_Auction_API $api)
    {
        $this->api = $api;
    }

    /**
     * Render preload car detail content with images directly from API
     */
    public function render_preload_car_detail_content($car): bool|string
    {
        ob_start();
        ?>
        <!DOCTYPE html>
        <html data-wf-page="683ea4aeb9508770dbce63b7" data-wf-site="683ea4aeb9508770dbce633f">
        <?php get_template_part("header_block", ""); ?>
        <body>
        <?php if(function_exists('get_field')) { echo get_field('body_code', 'option'); } ?>

        <div class="navbar-wrapper">
            <div class="container">
                <div class="navbar"><a href="<?php echo get_home_url() ?>" class="logo-wrapper w-inline-block"><img loading="lazy" alt="<?php echo !empty($field['alt']) ? esc_attr($field['alt']) : ''; ?>" src="<?php $field = get_field('logo', 'options'); if(isset($field['url'])){ echo($field['url']); }elseif(is_numeric($field)){ echo(wp_get_attachment_image_url($field, 'full')); }else{ echo($field); } ?>" class="image"></a>
                    <div class="navbar-inner">
                        <div class="nav-links-wrapper">
                            <div class="nav-links"><a href="/" class="nav-link">Главная</a>
                                <div data-delay="0" data-hover="true" class="dropdown w-dropdown">
                                    <div class="dropdown-toggle w-dropdown-toggle">
                                        <div>Каталог</div><img loading="lazy" src="<?php echo get_template_directory_uri() ?>/images/683eaa470902760dca70893b_down.png" alt class="image-2"></div>
                                    <nav class="dropdown-list w-dropdown-list"><a href="/japan/" class="dropdown-link w-dropdown-link">Авто из Японии</a><a href="/korea/" class="dropdown-link w-dropdown-link">Авто из Кореи</a><a href="/china/" class="dropdown-link w-dropdown-link">Авто из Китая</a><a href="/bike/" class="dropdown-link w-dropdown-link">Мотоциклы</a><a href="https://auc.asiaexpressauto.ru/" target="_blank" class="dropdown-link w-dropdown-link">Аукционы Японии</a></nav>
                                </div><a href="/about/" class="nav-link">О нас</a><a href="/blog/" class="nav-link">Статьи</a><a href="/review/" class="nav-link">Отзывы</a><a href="/contact/" class="nav-link">Контакты</a>
                                <div data-delay="0" data-hover="true" class="dropdown w-dropdown">
                                    <div class="dropdown-toggle w-dropdown-toggle">
                                        <div>Где мы находимся</div><img loading="lazy" src="<?php echo get_template_directory_uri() ?>/images/683eaa470902760dca70893b_down.png" alt class="image-2"></div>
                                    <nav class="dropdown-list-where w-dropdown-list">
                                        <?php /* <?php if( have_rows('filialy', 'options') ){ ?><div class="drop-inner"><?php global $parent_id; if(isset($loop_id)) $parent_id = $loop_id; $loop_index = 0; $loop_title="Филиалы"; $loop_field = "filialy"; while( have_rows('filialy', 'options') ){ global $loop_id; $loop_index++; $loop_id++; the_row(); ?><a href="<?php echo get_sub_field('ssylka_telefona') ?>" class="link-block w-inline-block"><div class="m-16-600"><?php echo get_sub_field('gorod') ?></div><div class="m-14-400"><?php echo get_sub_field('adres') ?></div><div class="m-14-400"><?php echo get_sub_field('nomer_telefona') ?></div><?php if(get_sub_field('is_head_filial')) { echo '<span style="color: rgb(226, 34, 54);">Головной офис</span>';}?></a><?php } ?></div><?php } ?> */ ?>
                                        <?php if( have_rows('filialy', 'options') ){ ?><div class="drop-inner"><?php global $parent_id; if(isset($loop_id)) $parent_id = $loop_id; $loop_index = 0; $loop_title="Филиалы"; $loop_field = "filialy"; while( have_rows('filialy', 'options') ){ global $loop_id; $loop_index++; $loop_id++; the_row(); ?><div class="link-block w-inline-block"><div class="m-16-600"><?php echo get_sub_field('gorod') ?></div><a href="<?php echo get_sub_field('adres_yandexkarty') ?>" target="_blank" class="m-14-400" style="display:block; color:inherit; text-decoration:none;"><?php echo get_sub_field('adres') ?></a><a href="<?php echo get_sub_field('ssylka_telefona') ?>" class="m-14-400" style="display:block; color:inherit; text-decoration:none;"><?php echo get_sub_field('nomer_telefona') ?></a><?php if(get_sub_field('is_head_filial')) { echo '<span style="color: rgb(226, 34, 54);">Головной офис</span>';}?></div><?php } ?></div><?php } ?>
                                    </nav>
                                </div></div>
                        </div>
                        <div class="mess-phone-wrapper mob-hide">
                            <?php if( have_rows('messendzhery', 'options') ){ ?><div class="mess-wrapper"><?php global $parent_id; if(isset($loop_id)) $parent_id = $loop_id; $loop_index = 0; $loop_title="Мессенджеры"; $loop_field = "messendzhery"; while( have_rows('messendzhery', 'options') ){ global $loop_id; $loop_index++; $loop_id++; the_row(); ?><a href="<?php echo get_sub_field('ssylka') ?>" target="_blank" class="one-mess w-inline-block"><img loading="lazy" alt="<?php echo !empty($field['alt']) ? esc_attr($field['alt']) : ''; ?>" src="<?php $field = get_sub_field('ikonka'); if(isset($field['url'])){ echo($field['url']); }elseif(is_numeric($field)){ echo(wp_get_attachment_image_url($field, 'full')); }else{ echo($field); } ?>" class="img-mess"></a><?php } ?></div><?php } ?>
                            <div class="two-phones"><a href="<?php echo get_field('ssylka_telefona', 'options') ?>" target="_blank" class="phone-wrapper w-inline-block"><div class="text-block-2"><?php echo get_field('nomer_telefona', 'options') ?></div></a><a href="<?php echo get_field('ssylka_telefona_2', 'options') ?>" target="_blank" class="phone-wrapper w-inline-block"><div class="text-block-2"><?php echo get_field('nomer_telefona_2', 'options') ?></div></a></div>
                        </div>
                    </div>
                    <div class="nav-mess-mob">
                        <div class="mess-phone-wrapper">
                            <?php if( have_rows('messendzhery', 'options') ){ ?><div class="mess-wrapper"><?php global $parent_id; if(isset($loop_id)) $parent_id = $loop_id; $loop_index = 0; $loop_title="Мессенджеры"; $loop_field = "messendzhery"; while( have_rows('messendzhery', 'options') ){ global $loop_id; $loop_index++; $loop_id++; the_row(); ?><a href="<?php echo get_sub_field('ssylka') ?>" target="_blank" class="one-mess w-inline-block"><img loading="lazy" alt="<?php echo !empty($field['alt']) ? esc_attr($field['alt']) : ''; ?>" src="<?php $field = get_sub_field('ikonka'); if(isset($field['url'])){ echo($field['url']); }elseif(is_numeric($field)){ echo(wp_get_attachment_image_url($field, 'full')); }else{ echo($field); } ?>" class="img-mess"></a><?php } ?></div><?php } ?><a href="<?php echo get_field('ssylka_telefona', 'options') ?>" target="_blank" class="phone-wrapper w-inline-block"><div class="text-block-2"><?php echo get_field('nomer_telefona', 'options') ?></div></a></div>
                        <div class="burger-wrapper"><img src="<?php echo get_template_directory_uri() ?>/images/685524f88bbba1d619603a9a_menu20(3).png" loading="lazy" data-w-id="90648415-56b6-e798-0386-e789320e2a1e" alt class="burger"><img src="<?php echo get_template_directory_uri() ?>/images/6855257cec3a608bc6b1a834_close20(17).png" loading="lazy" data-w-id="1e13c1bc-e79c-5240-0430-5c6f15709f05" alt class="close"></div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Car Auction Preload Detail Content -->
        <section class="section hero-car">
            <div class="container">
                <div class="car-hero-wrapper">
                    <div class="car-main-wrapper">
                        <div class="car-main-left">
                            <div class="bc-wrapper">

                                <div class="breadcrumbs w-richtext">
                                    <?php
                                    $breadcrumbs = array();
                                    // Главная страница
                                    $home = home_url('/');
                                    $breadcrumbs[] = '<a href="' . $home . '">Главная</a>';

                                    // Если это страница поста
                                    $country_slug = 'japan'; // значение по умолчанию
                                    $country_term_name = 'Япония';

                                    if($car['market'] == 'main') {
                                        $country_slug = 'japan';
                                        $country_term_name = "Япония";
                                    } elseif($car['market'] == 'china') {
                                        $country_slug = $car['market'];
                                        $country_term_name = "Китай";
                                    }elseif($car['market'] == 'korea') {
                                        $country_slug = $car['market'];
                                        $country_term_name = "Корея";
                                    }elseif($car['market'] == 'bike') {
                                        $country_slug = $car['market'];
                                        $country_term_name = "Мотоциклы";
                                    }elseif($car['market'] == 'che_available') {
                                        $country_slug = $car['market'];
                                        $country_term_name = "В наличии";
                                    }
                                    $breadcrumbs[] = '<a href="/' . home_url( $country_slug ) . '">' . $country_term_name . '</a>';

                                    // Create post slug with unique suffix to handle duplicates
                                    $brand_slug = sanitize_title($car['brand']);
                                    $breadcrumbs[] = '<a href="' . home_url( $country_slug . '?_brand=' . $brand_slug ) . '">' . $car['brand'] . '</a>';

                                    // Получаем произвольное поле model
                                    $model_slug = $car['model'];
                                    $model_encoded = str_replace(' ', '+', $model_slug);
                                    $brand_meta_url = "/?_brand=" . $brand_slug;
                                    
                                    $model_spec = urlencode(str_replace(' ', '_', $model_slug));
                                    $model_url = $brand_meta_url . '&_model=' . $model_slug;
                                    $breadcrumbs[] = '<a href="' . home_url( $country_slug . $model_url ) . '">' . $car['model'] . '</a>';

                                    // Текущая страница (название поста)
                                    $breadcrumbs[] = '<span>' . esc_html($car['brand']) . ' ' . esc_html($car['model']) . '</span>';
                                    ?>
                                    <p id="breacrumbs"><?php echo implode(' > ', $breadcrumbs) ?></p>
                                </div>


                            </div>
                            <div class="swiper swiper_main">
                                <?php if (!empty($car['images'])): ?>
                                    <div class="swiper-wrapper">
                                        <?php foreach ($car['images'] as $image): ?>
                                            <div class="swiper-slide prod">
                                                <a href="#" class="lightbox-link w-inline-block w-lightbox">
                                                    <img src="<?php echo esc_url($image); ?>" loading="lazy" alt="<?php echo esc_attr($car['brand'] . ' ' . $car['model']); ?>" class="image">
                                                    <script type="application/json" class="w-json">
                                                        {
                                                            "group": "car_images",
                                                            "items": [
                                                                {
                                                                    "url": "<?php echo esc_js($image); ?>",
                                                                "type": "image",
                                                                "caption": ""
                                                            }
                                                        ]
                                                    }
                                                    </script>
                                                </a>
                                            </div>
                                        <?php endforeach; ?>
                                    </div>
                                <?php else: ?>
                                    <div class="swiper-wrapper">
                                        <div class="swiper-slide prod">
                                            <div class="car-auction-no-image">изображения отсутствуют</div>
                                        </div>
                                    </div>
                                <?php endif; ?>
                                <div class="s-prev-big"><img loading="lazy" src="<?php echo get_template_directory_uri() ?>/images/68402b16460a8ced44ae3013_arrow-left.svg" alt class="arr-big"></div>
                                <div class="s-next-big"><img loading="lazy" src="<?php echo get_template_directory_uri() ?>/images/68402b16460a8ced44ae3012_arrow-right.svg" alt class="arr-big"></div>
                            </div>
                            <div class="sw-thumbs-wrapper">
                                <div class="swiper swiper_thumbnail">
                                    <?php if (!empty($car['images'])): ?>
                                        <div class="swiper-wrapper thumbs">
                                            <?php foreach ($car['images'] as $image): ?>
                                                <div class="swiper-slide thumb">
                                                    <img src="<?php echo esc_url($image); ?>" loading="lazy" alt="<?php echo esc_attr($car['brand'] . ' ' . $car['model']); ?>" class="image">
                                                </div>
                                            <?php endforeach; ?>
                                        </div>
                                    <?php endif; ?>
                                </div>
                                <div class="s-prev"><img loading="lazy" src="<?php echo get_template_directory_uri() ?>/images/68402b16460a8ced44ae3012_arrow-right.svg" alt class="arr-small"></div>
                                <div class="s-next"><img loading="lazy" src="<?php echo get_template_directory_uri() ?>/images/68402b16460a8ced44ae3013_arrow-left.svg" alt class="arr-small"></div>
                            </div>
                        </div>
                        <div class="car-main-right">
                            <h1 class="h1 left">
                                <span><?php echo esc_html($car['brand'] ?? 'N/A'); ?></span>
                                <span class="model"><?php echo esc_html($car['model'] ?? 'N/A'); ?></span>
                                <span class="body-part"><?php echo esc_html($car['grade'] ?? ''); ?></span>
                            </h1>
                            <div class="car-main-top">
                                <div class="m-16-600 gray">Основные характеристики:</div>
                                <div class="car-chars">
                                    <?php if($car['kuzov']): ?>
                                        <div class="one-char">
                                            <div class="one-char-left">
                                                <div class="m-16-400">Кузов</div>
                                            </div>
                                            <div class="one-char-right">
                                                <div class="m-16-600"><?php echo esc_html($car['kuzov'] ?? 'N/A'); ?></div>
                                            </div>
                                        </div>
                                    <?php endif; ?>

                                    <?php if($car['year']): ?>
                                        <div class="one-char">
                                            <div class="one-char-left">
                                                <div class="m-16-400">Год:</div>
                                            </div>
                                            <div class="one-char-right">
                                                <div class="m-16-600"><?php echo esc_html($car['year'] ?? 0); ?></div>
                                            </div>
                                        </div>
                                    <?php endif; ?>

                                    <?php if($car['year']): ?>
                                        <div class="one-char">
                                            <div class="one-char-left">
                                                <div class="m-16-400">Пробег</div>
                                            </div>
                                            <div class="one-char-right">
                                                <div class="m-16-600"><?php echo esc_html(number_format($car['mileage_numeric'] ?? 0)); ?> км</div>
                                            </div>
                                        </div>
                                    <?php endif; ?>
                                    <!--
                                    <div class="one-char">
                                        <div class="one-char-left">
                                            <div class="m-16-400">Комплектация</div>
                                        </div>
                                        <div class="one-char-right">
                                            <div class="m-16-600"><?php //echo esc_html($car['info'] ?? 'N/A'); ?></div>
                                        </div>
                                    </div>
                                    -->
                                    <?php if($car['engine_volume']): ?>
                                        <div class="one-char">
                                            <div class="one-char-left">
                                                <div class="m-16-400">Объем Двигателя</div>
                                            </div>
                                            <div class="one-char-right">
                                                <div class="m-16-600"><?php echo esc_html($car['engine_volume'] ?? 0); ?> см³</div>
                                            </div>
                                        </div>
                                    <?php endif; ?>

                                    <?php if($car['transmission']): ?>
                                        <div class="one-char">
                                            <div class="one-char-left">
                                                <div class="m-16-400">Трансмиссия</div>
                                            </div>
                                            <div class="one-char-right">
                                                <div class="m-16-600"><?php echo esc_html($car['transmission'] ?: 'N/A'); ?></div>
                                            </div>
                                        </div>
                                    <?php endif; ?>

                                    <?php if($car['fuel']): ?>
                                        <div class="one-char">
                                            <div class="one-char-left">
                                                <div class="m-16-400">Топливо</div>
                                            </div>
                                            <div class="one-char-right">
                                                <div class="m-16-600"><?php echo esc_html($this->api->get_fuel_name($car['fuel'])); ?></div>
                                            </div>
                                        </div>
                                    <?php endif; ?>

                                    <?php if($car['drive']): ?>
                                        <div class="one-char">
                                            <div class="one-char-left">
                                                <div class="m-16-400">Привод</div>
                                            </div>
                                            <div class="one-char-right">
                                                <div class="m-16-600"><?php echo esc_html($car['drive'] ?: 'N/A'); ?></div>
                                            </div>
                                        </div>
                                    <?php endif; ?>

                                    <?php if($car['auction_grade']): ?>
                                        <div class="one-char">
                                            <div class="one-char-left">
                                                <div class="m-16-400">Оценка аукциона</div>
                                            </div>
                                            <div class="one-char-right">
                                                <div class="m-16-600"><?php echo esc_html($car['auction_grade'] ?? 'N/A'); ?></div>
                                            </div>
                                        </div>
                                    <?php endif; ?>
                                </div>
                                <div class="price-car-wrapper">
                                    <div class="one-char-left m-16-400 gray">Стоимость</div>
                                    <div class="one-char-right m-16-400">
                                        <?php
                                        $initial_calc_price = '';
                                        if (isset($car['calc_rub']) && is_numeric($car['calc_rub']) && (float)$car['calc_rub'] > 0) {
                                            $initial_calc_price = number_format((float)$car['calc_rub'], 0, '.', ' ') . ' ₽';
                                        }
                                        ?>
                                        <span
                                            id="car-price-value"
                                            class="car-price-loading"
                                            data-initial-price="<?php echo esc_attr($initial_calc_price); ?>"
                                        ><?php echo esc_html($initial_calc_price !== '' ? $initial_calc_price : 'Расчет стоимости...'); ?></span>
                                    </div>
                                </div>
                                <div class="price-desc-text">Стоимость является ориентировочной. Точную стоимость конкретного автомобиля уточняйте у наших менеджеров.</div>
                            </div>
                            <div class="car-buttons-wrapper">
                                <a data-w-id="834630e3-7369-7641-8907-b2afa64b82d0" href="#" class="button-red w-button">Заказать этот автомобиль</a>
                                <a data-w-id="2aeff7e9-ef9d-123f-ae35-eda71b29fa04" href="#" class="button-light-gray w-button">Получить консультацию</a>
                            </div>
                            <?php
                            // Используем helper function для детального блока стоимости
                            //echo render_car_cost_breakdown_block($car);
                            ?>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <?php

        if($car['market'] == 'bike'): ?>

            <?php // У BIKE нестандартный формат информации! Временно скрыто ?>

        <?php else: ?>
            <?php if (!empty($car['tamozhennyj_list'])): ?>
                <section class="section stdrt gray-new">
                    <div class="container">
                        <div class="h2-wrapper">
                            <h2 class="h2"><?php echo !empty($car['tamozhennyj_list']) ? 'Аукционный лист' : 'Комплектация'; ?></h2>
                        </div>

                        <div class="auc_list_section">
                            <div class="auc_img">
                                <img src="<?php echo esc_url($car['tamozhennyj_list']); ?>" alt="Таможенный лист">
                            </div>
                            <div class="auc_desc">
                                <div class="h">Обозначения на схеме</div>
                                <div class="params_table">
                                    <div class="params_table__section">
                                        <div class="r m-16-600"><div>A1</div><div>Маленькая царапина</div></div>
                                        <div class="r m-16-600"><div>A2</div><div>Царапина</div></div>
                                        <div class="r m-16-600"><div>A3</div><div>Большая царапина</div></div>
                                    </div>
                                    <div class="params_table__section">
                                        <div class="r m-16-600"><div>B1</div><div>Маленькая вмятина с царапиной</div></div>
                                    </div>
                                    <div class="params_table__section">
                                        <div class="r m-16-600"><div>E1</div><div>Небольшая вмятина</div></div>
                                        <div class="r m-16-600"><div>E2</div><div>Несколько небольших вмятин</div></div>
                                        <div class="r m-16-600"><div>E3</div><div>Много небольших вмятин</div></div>
                                    </div>
                                    <div class="params_table__section">
                                        <div class="r m-16-600"><div>U1</div><div>Маленькая вмятина</div></div>
                                        <div class="r m-16-600"><div>U2</div><div>Вмятина</div></div>
                                        <div class="r m-16-600"><div>U3</div><div>Большая вмятина</div></div>
                                    </div>
                                    <div class="params_table__section">
                                        <div class="r m-16-600"><div>W1</div><div>Ремонт/Покраска</div></div>
                                        <div class="r m-16-600"><div>W2</div><div>Ремонт/Покраска (заметные)</div></div>
                                        <div class="r m-16-600"><div>W3</div><div>Ремонт/Покраска (очень заметные, должно быть перекрашено)</div></div>
                                    </div>
                                    <div class="params_table__section">
                                        <div class="r m-16-600"><div>S1</div><div>Малозаметная ржавчина</div></div>
                                        <div class="r m-16-600"><div>S2</div><div>Ржавчина</div></div>
                                    </div>
                                    <div class="params_table__section">
                                        <div class="r m-16-600"><div>C1</div><div>Коррозия</div></div>
                                        <div class="r m-16-600"><div>C2</div><div>Заметная коррозия</div></div>
                                    </div>
                                    <div class="params_table__section">
                                        <div class="r m-16-600"><div>P</div><div>Краска отличается от оригинала</div></div>
                                    </div>
                                    <div class="params_table__section">
                                        <div class="r m-16-600"><div>H</div><div>Краска ухудшилась</div></div>
                                    </div>
                                    <div class="params_table__section">
                                        <div class="r m-16-600"><div>X</div><div>Элемент требует замены</div></div>
                                        <div class="r m-16-600"><div>XX</div><div>Замененный элемент</div></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            <?php elseif ( !empty($car['info']) ): ?>
                <section class="section stdrt gray-new">
                    <div class="container">
                        <div class="h2-wrapper">
                            <h2 class="h2">Комплектация</h2>
                        </div>
                        <div class="options-wrapper">

                            <?php
                            $equipment = $car['info'] ?? '';

                            $equipment_items = array();
                            if (!empty($equipment)) {
                                if (is_array($equipment)) {
                                    $equipment_items = $equipment;
                                } else {
                                    if($car['market'] == 'china') {
                                        $equipment_items = array_filter(array_map('trim', explode('<br>', $equipment)));
                                    } else {
                                        $equipment_items = array_filter(array_map('trim', explode(';', $equipment)));
                                    }
                                }
                            }
                            if (!empty($equipment_items)): ?>
                                <?php foreach ($equipment_items as $option): ?>
                                    <div class="one-option-wrapper">
                                        <img src="<?php echo get_template_directory_uri() ?>/images/68404a149175aa2898cf265b_rounded-black-square-shape.png" loading="lazy" alt class="small-square">
                                        <div class="m-16-600"><?php echo esc_html($option); ?></div>
                                    </div>
                                <?php endforeach; ?>
                            <?php else: ?>
                                <div class="one-option-wrapper">
                                    <img src="<?php echo get_template_directory_uri() ?>/images/68404a149175aa2898cf265b_rounded-black-square-shape.png" loading="lazy" alt class="small-square">
                                    <div class="m-16-600">Информация о комплектации отсутствует</div>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </section>
            <?php endif; ?>

        <?php endif; ?>

        <!-- Preload notice -->
        
        <?php /*
        <div class="car-auction-preload-notice" style="position: fixed; bottom: 20px; right: 20px; background: #007cba; color: white; padding: 15px; border-radius: 5px; font-size: 14px; z-index: 9999; display: none;">
            Данные загружаются напрямую из аукциона. Создание детальной страницы...
        </div>
        */ ?>

        <?php

        //$optimized = false;
        //error_log("[DETAIL] Schortcode: Market: {$car['market']} \n Brand: {$car['brand']}, \n Model: {$car['model']}");
        
        //if(!$optimized):
        //    echo Wp_Car_Auction_Plugin_Lite::getCarAuctionSearchSync()->render_similar_cars_section($car['market'], $car['brand'], $car['model'], 'grid');
        //endif;

        ?>
        <div id="similar-cars-placeholder" class="car-auction-loading">
            <div class="loading-spinner"></div>
            <p>Загружаем похожие автомобили...</p>
        </div>
        
        <script>
            jQuery(document).ready(function($) {
                var $placeholder = $('#similar-cars-placeholder');
                var $priceValue = $('#car-price-value');
                var initialPrice = $priceValue.data('initial-price') || '';
                var ajaxUrl = '<?php echo admin_url('admin-ajax.php'); ?>';

                if ($priceValue.length) {
                    $.ajax({
                        url: ajaxUrl,
                        type: 'POST',
                        timeout: 20000,
                        data: {
                            action: 'load_car_price_ajax',
                            car_id: '<?php echo esc_js($car['id']); ?>',
                            market: '<?php echo esc_js($car['market']); ?>',
                            nonce: '<?php echo wp_create_nonce('car_auction_price_ajax'); ?>'
                        },
                        success: function(response) {
                            if (response && response.success && response.data && response.data.formatted_price) {
                                $priceValue.text(response.data.formatted_price).removeClass('car-price-loading');
                            } else {
                                $priceValue.text(initialPrice || 'по запросу').removeClass('car-price-loading');
                            }
                        },
                        error: function() {
                            $priceValue.text(initialPrice || 'по запросу').removeClass('car-price-loading');
                        }
                    });
                }

                if ($placeholder.length) {
                    $.ajax({
                        url: ajaxUrl,
                        type: 'POST',
                        timeout: 10000,
                        data: {
                            action: 'load_similar_cars_ajax',
                            car_id: '<?php echo esc_js($car['id']); ?>',
                            market: '<?php echo esc_js($car['market']); ?>',
                            brand:  '<?php echo esc_js($car['brand']); ?>',
                            model:  '<?php echo esc_js($car['model']); ?>',
                            nonce: '<?php echo wp_create_nonce('car_auction_similar_ajax'); ?>'
                        },
                        success: function(response) {
                            if (response.success && response.data.html) {
                                // Полная замена содержимого контейнера
                                $placeholder.replaceWith(response.data.html);
                            } else {
                                $placeholder.html('<p>Похожие автомобили не найдены</p>').removeClass('car-auction-loading');
                            }
                        },
                        error: function(xhr, status, error) {
                            console.log('Ошибка AJAX похожих авто:', status, error, xhr.responseText);
                            $placeholder.html('<p>Не удалось загрузить похожие авто</p>').removeClass('car-auction-loading');
                        }
                    });
                }
            });
            </script>
            <style>
            .car-auction-loading {
                min-height: 300px;          /* чтобы не было скачка высоты */
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f8f9fa;
                border-radius: 8px;
                margin: 2rem 0;
            }
            
            .car-auction-loading .loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 15px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .car-price-loading {
                opacity: 0.85;
            }
            </style>
        <!-- End Car Auction Preload Detail Content -->
        <section class="section stdrt footer">
            <div class="container">
                <div class="footer-wrapper">
                    <div class="footer-col"><img src="<?php echo get_template_directory_uri() ?>/images/6851a7fcfab571d5568fab7c_aea-white.png" loading="lazy" alt class="logo-footer">
                        <div class="m-14-400 white">Подбор и доставка автомобилей <br>из Китая, Кореи и Японии в Россию!</div>
                    </div>
                    <div class="footer-col">
                        <div class="m-16-600 white">Навигация:</div>
                        <div class="footer-links-wrapper"><a href="/" class="m-14-400 white">Главная</a><a href="/japan/" class="m-14-400 white">Авто из Японии</a><a href="/korea/" class="m-14-400 white">Авто из Кореи</a><a href="/china/" class="m-14-400 white">Авто из Китая</a><a href="/bike/" class="m-14-400 white">Мотоциклы</a><a href="https://auc.asiaexpressauto.ru/" class="m-14-400 white">Аукционы Японии</a><a href="/about/" class="m-14-400 white">О нас</a><a href="/blog/" class="m-14-400 white">Статьи</a><a href="/contact/" class="m-14-400 white">Контакты</a></div>
                    </div>
                    <div class="footer-col">
                        <div class="m-16-600 white">Контакты:</div>
                        <div class="footer-contacts-wrapper">
                            <div class="team-phone-wrapper"><img src="<?php echo get_template_directory_uri() ?>/images/684aa13ecb3c5af991d079ef_phone-call20(3).png" loading="lazy" alt class="phone-img"><a href="<?php echo get_field('ssylka_telefona_1', 'options') ?>" class="link white"><?php echo get_field('nomer_telefona_1', 'options') ?></a><a href="#" class="one-mess-team w-inline-block"></a><a href="#" class="one-mess-team w-inline-block"></a></div>
                            <div class="team-phone-wrapper"><img src="<?php echo get_template_directory_uri() ?>/images/684aa13ecb3c5af991d079ef_phone-call20(3).png" loading="lazy" alt class="phone-img"><a href="<?php echo get_field('ssylka_telefona_2', 'options') ?>" class="link white"><?php echo get_field('nomer_telefona_2', 'options') ?></a><a href="#" class="one-mess-team w-inline-block"></a><a href="#" class="one-mess-team w-inline-block"></a></div>
                            <div class="team-phone-wrapper"><img src="<?php echo get_template_directory_uri() ?>/images/6852368fa1db44eaf02f21b9_whatsapp20(9).png" loading="lazy" alt class="phone-img"><a href="<?php echo get_field('ssylka_votsap', 'options') ?>" class="link white"><?php echo get_field('nomer_votsap', 'options') ?></a><a href="#" class="one-mess-team w-inline-block"></a><a href="#" class="one-mess-team w-inline-block"></a></div>
                        </div>
                        <div class="m-16-600 white">Соцсети:</div>
                        <div class="footer-social"><a href="<?php echo get_field('ssylka_telegram', 'options') ?>" class="soc-link-footer w-inline-block"><img src="<?php echo get_template_directory_uri() ?>/images/685237d489ad251ad859bbea_communication20(1).png" loading="lazy" alt class="soc-img tg"></a><a href="<?php echo get_field('ssylka_instagram', 'options') ?>" class="soc-link-footer w-inline-block"><img src="<?php echo get_template_directory_uri() ?>/images/6852388e1605d036cc077bbc_instagram20(4).png" loading="lazy" alt class="soc-img"></a><a href="<?php echo get_field('ssylka_yutub', 'options') ?>" class="soc-link-footer w-inline-block"><img src="<?php echo get_template_directory_uri() ?>/images/685238dfa5a22944c4c072a9_youtube20(4).png" loading="lazy" alt class="soc-img"></a><a href="<?php echo get_field('ssylka_vk', 'options') ?>" class="soc-link-footer w-inline-block"><img src="<?php echo get_template_directory_uri() ?>/images/685239673990a1d1e304a9da_vk20(2).png" loading="lazy" alt class="soc-img"></a><a href="<?php echo get_field('ssylka_rutub', 'options') ?>" class="soc-link-footer w-inline-block"><img src="<?php echo get_template_directory_uri() ?>/images/68523a42584a7ad3fa6ce063_Minilogo_RUTUBE.png" loading="lazy" alt class="soc-img"></a></div>
                    </div>
                    <div class="footer-col">
                        <div class="m-16-600 white">Информация:</div>
                        <div class="team-phone-wrapper"><img src="<?php echo get_template_directory_uri() ?>/images/68523af9cb88a20df9ae6eff_email20(3).png" loading="lazy" alt class="phone-img"><a href="<?php echo get_field('ssylka_mejl', 'options') ?>" class="link white m-sm"><?php echo get_field('adres_mejl', 'options') ?></a><a href="#" class="one-mess-team w-inline-block"></a><a href="#" class="one-mess-team w-inline-block"></a></div>
                        <div class="team-phone-wrapper"><img src="<?php echo get_template_directory_uri() ?>/images/68523b775b3994ae8cc2f391_location-pin20(1).png" loading="lazy" alt class="phone-img">
                            <div class="link white m-sm"><?php echo get_field('adres', 'options') ?></div>
                        </div>
                        <div class="politics-wrpper"><a href="<?php echo get_field('', 'options') ?>" class="m-14-400 white">Политика конфиденциальности</a><a href="<?php echo get_field('', 'options') ?>" class="m-14-400 white">Реквизиты</a></div>
                    </div>
                </div>
            </div>
        </section>
        <div class="lbox">
            <div data-w-id="5800576e-2d64-59e3-7076-29c906a59491" class="lbox-bg"></div>
            <div class="form-lbox-wrapper">
                <h3 class="h3 big mid b-10">Оставить заявку на</h3>
                <div class="h-24-700 mid"><span><?php echo esc_html($car['brand'] ?? ''); ?></span><span class="model"><?php echo esc_html($car['model'] ?? ''); ?></span></div>
                <div class="w-form">
                    <form id="email-form-2" name="email-form-2" data-name="Email Form 2" method="get" class="form-2" data-wf-page-id="683ea4aeb9508770dbce63b7" data-wf-element-id="5800576e-2d64-59e3-7076-29c906a59496"><input class="text-field-3 w-input" maxlength="256" name="name-3" data-name="Name 3" placeholder="Ваше имя" type="text" id="name-3"><input class="text-field-3 w-input" maxlength="256" name="Phone-3" data-name="Phone 3" placeholder="Ваш телефон" type="tel" id="Phone-4"><input type="submit" data-wait="Please wait..." class="submit-button-2 w-button" value="Отправить"></form>
                    <div class="success-message w-form-done">
                        <div>Thank you! Your submission has been received!</div>
                    </div>
                    <div class="error-message w-form-fail">
                        <div>Oops! Something went wrong while submitting the form.</div>
                    </div>
                </div>
                <div data-w-id="5800576e-2d64-59e3-7076-29c906a594a0" class="close-wrapper"><img loading="lazy" src="<?php echo get_template_directory_uri() ?>/images/6853a038b0b5dfbf2d0fd851_close20(12).png" alt class="img-close"></div>
            </div>
        </div>

        <script>
            // Show preload notice briefly
            jQuery(document).ready(function($) {
                $('.car-auction-preload-notice').fadeIn(500).delay(3000).fadeOut(500);
            });
        </script>

        <!-- FOOTER CODE --><?php get_template_part("footer_block", ""); ?>
        <script type="text/javascript" src="<?php bloginfo('template_url'); ?>/js/single-auto.js?ver=1756963813"></script></body>
        </html>

        <?php
        return ob_get_clean();
    }
}
