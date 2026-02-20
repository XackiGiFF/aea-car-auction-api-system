<?php

add_action('wp_enqueue_scripts', 'wtw_custom_code');

function wtw_custom_code()
{
  wp_enqueue_style('custom-css', get_stylesheet_directory_uri() . '/css/custom.css', array('main'), null);
  wp_enqueue_script('custom-js', get_stylesheet_directory_uri() . '/js/custom.js', array('jquery'), null, true);
}

function hide_taxonomy_ui_for_custom_post_type($args, $taxonomy)
{
    // Укажите название таксономии и типа записи
    $taxonomy_name = 'brand';
    $post_type = 'auto';

    // Проверяем, что это нужная таксономия и тип записи
    if ($taxonomy === $taxonomy_name) {
        global $pagenow;
        if (($pagenow === 'edit.php' || $pagenow === 'post-new.php' || $pagenow === 'post.php') && isset($_GET['post_type']) && $_GET['post_type'] === $post_type) {
            $args['show_ui'] = false;
        }
    }

    return $args;
}

add_filter('register_taxonomy_args', 'hide_taxonomy_ui_for_custom_post_type', 10, 2);

/*
function breadcrumbs()
{
    $breadcrumbs = array();

    // Главная страница
    $breadcrumbs[] = '<a href="' . home_url('/') . '">Главная</a>';

    // Если это страница поста
    if (is_single()) {
        global $post;

        // Получаем терм таксономии country
        $country_terms = get_the_terms($post->ID, 'country');
        if ($country_terms && !is_wp_error($country_terms)) {
            $country_term = array_shift($country_terms);
            $breadcrumbs[] = '<a href="/' . $country_term->slug . '">' . $country_term->name . '</a>';
        }

        // Получаем терм таксономии brand
        $brand_terms = get_the_terms($post->ID, 'brand');
        if ($brand_terms && !is_wp_error($brand_terms)) {
            $brand_term = array_shift($brand_terms);
            $country_slug = ($country_term && isset($country_term->slug)) ? $country_term->slug : 'japan';
            $brand_url = home_url($country_slug . '/?_brand=' . $brand_term->slug);
            $breadcrumbs[] = '<a href="' . $brand_url . '">' . $brand_term->name . '</a>';
        }

        // Получаем произвольное поле model
        $model = get_post_meta($post->ID, 'model', true);
        if ($model) {
            $breadcrumbs[] = '<span>' . $model . '</span>';
        }
    }

    // Возвращаем хлебные крошки
    return implode(' > ', $breadcrumbs);
}
*/
function breadcrumbs(): string
{
    $breadcrumbs = array();
    // Главная страница
    $breadcrumbs[] = '<a href="' . home_url('/') . '">Главная</a>';

    // Если это страница поста
    if (is_single()) {
        global $post;
        $country_slug = 'japan'; // значение по умолчанию

        // Получаем терм таксономии country
        $country_terms = get_the_terms($post->ID, 'country');
        if ($country_terms && !is_wp_error($country_terms)) {
            $country_term = array_shift($country_terms);
            $country_slug = $country_term->slug;
            $breadcrumbs[] = '<a href="/' . $country_slug . '">' . $country_term->name . '</a>';
        }

        // Получаем терм таксономии brand
        $brand_terms = get_the_terms($post->ID, 'brand');
        if ($brand_terms && !is_wp_error($brand_terms)) {
            $brand_term = array_shift($brand_terms);
            $brand_url = home_url($country_slug . '/?_brand=' . $brand_term->slug);
            $breadcrumbs[] = '<a href="' . $brand_url . '">' . $brand_term->name . '</a>';

            // Получаем произвольное поле model
            $model = get_post_meta($post->ID, 'model', true);
            if ($model) {
                $brand_meta_url = "/?_brand=" . $brand_term->slug;
                $model_url = home_url($country_slug . $brand_meta_url . '&_model=' . urlencode($model));
                $breadcrumbs[] = '<a href="' . $model_url . '">' . esc_html($model) . '</a>';
            }
            
            // Текущая страница (название поста)
            $breadcrumbs[] = '<span>' . $brand_term->name . ' ' . esc_html($model) . '</span>';
        }

    }

    // Возвращаем хлебные крошки
    return implode(' > ', $breadcrumbs);
}

// Настройка кастомных URL для записей типа auto
add_action('init', 'custom_auto_rewrite_rules');
add_filter('query_vars', 'custom_auto_query_vars');
add_filter('post_type_link', 'custom_auto_permalink', 10, 2);

// Сброс правил перезаписи при активации темы
add_action('after_switch_theme', 'flush_rewrite_rules');

// Принудительный сброс правил перезаписи после изменений URL (закомментировано после применения)
// add_action('init', 'force_flush_rewrite_rules_once');

// function force_flush_rewrite_rules_once()
// {
//     // Проверяем, нужно ли сбросить правила (используем опцию как флаг)
//     if (get_option('auto_url_rules_updated') !== '1') {
//         flush_rewrite_rules();
//         update_option('auto_url_rules_updated', '1');
//     }
// }

function custom_auto_rewrite_rules()
{
    // Добавляем правило для записей auto: /country/brand/model/post-slug/
    add_rewrite_rule(
            '^([^/]+)/([^/]+)/([^/]+)/([^/]+)/?$',
            'index.php?post_type=auto&country_slug=$matches[1]&brand_slug=$matches[2]&model_slug=$matches[3]&name=$matches[4]',
            'top'
    );
}

function custom_auto_query_vars($vars)
{
    $vars[] = 'country_slug';
    $vars[] = 'brand_slug';
    $vars[] = 'model_slug';
    return $vars;
}

function custom_auto_permalink($permalink, $post)
{
    if ($post->post_type != 'auto') {
        return $permalink;
    }

    // Получаем термы таксономий
    $country_terms = get_the_terms($post->ID, 'country');
    $brand_terms = get_the_terms($post->ID, 'brand');
    $model = get_post_meta($post->ID, 'model', true);

    if (
            $country_terms && !is_wp_error($country_terms) &&
            $brand_terms && !is_wp_error($brand_terms) &&
            $model
    ) {

        $country_slug = $country_terms[0]->slug;
        $brand_slug = $brand_terms[0]->slug;
        $post_slug = $post->post_name;

        // Преобразуем model в slug формат для URL
        $model_slug = sanitize_title($model);

        return home_url("/$country_slug/$brand_slug/$model_slug/$post_slug/");
    }

    return $permalink;
}

// Обработка запросов с кастомными URL
add_action('pre_get_posts', 'handle_custom_auto_query');

function handle_custom_auto_query($query)
{
    if (!$query->is_main_query() || is_admin()) {
        return;
    }

    // Проверяем, что это наш тип записи и что все нужные переменные существуют
    if ($query->get('post_type') === 'auto' && $query->get('name') && $query->get('country_slug') && $query->get('brand_slug') && $query->get('model_slug')) {

        // Добавляем фильтрацию по таксономиям
        $query->set('tax_query', array(
                'relation' => 'AND',
                array(
                        'taxonomy' => 'country',
                        'field' => 'slug',
                        'terms' => $query->get('country_slug'),
                ),
                array(
                        'taxonomy' => 'brand',
                        'field' => 'slug',
                        'terms' => $query->get('brand_slug'),
                ),
        ));

        // Получаем model_slug из URL и ищем записи с соответствующим значением model
        $model_slug = $query->get('model_slug');

        // Ищем все записи типа auto с нужными таксономиями, затем найдем подходящую по model
        $posts = get_posts(array(
                'post_type' => 'auto',
                'posts_per_page' => -1,
                'tax_query' => array(
                        'relation' => 'AND',
                        array(
                                'taxonomy' => 'country',
                                'field' => 'slug',
                                'terms' => $query->get('country_slug'),
                        ),
                        array(
                                'taxonomy' => 'brand',
                                'field' => 'slug',
                                'terms' => $query->get('brand_slug'),
                        ),
                ),
        ));

        $matching_post_ids = array();
        foreach ($posts as $post) {
            $model = get_post_meta($post->ID, 'model', true);
            if ($model && sanitize_title($model) === $model_slug) {
                $matching_post_ids[] = $post->ID;
            }
        }

        if (!empty($matching_post_ids)) {
            $query->set('post__in', $matching_post_ids);
        } else {
            // Если не найдено подходящих записей, устанавливаем невозможное условие
            $query->set('post__in', array(0));
        }
    }
}

// Подключение шаблона single-auto для кастомных URL
add_filter('template_include', 'custom_auto_template');

function custom_auto_template($template)
{
    // Проверяем, что это одиночная запись нашего типа 'auto'
    if (is_singular('auto')) {
        // Проверяем наличие наших кастомных переменных, чтобы убедиться, что это наш URL
        $country_slug = get_query_var('country_slug');
        $brand_slug = get_query_var('brand_slug');
        $model_slug = get_query_var('model_slug');

        if ($country_slug && $brand_slug && $model_slug) {
            // Пытаемся найти шаблон single-auto.php
            $auto_template = locate_template(array('single-auto.php'));
            if ($auto_template) {
                return $auto_template;
            }

            // Если single-auto.php не найден, используем single.php
            $single_template = locate_template(array('single.php'));
            if ($single_template) {
                return $single_template;
            }
        }
    }

    return $template;
}

// Блокировка фасета model пока не выбран brand
add_action('wp_footer', 'add_facet_dependency_script');

function add_facet_dependency_script()
{
    ?>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            var previousBrandState = null;
            var isResetting = false;

            function toggleModelFacet() {
                if (isResetting) return;

                var brandFacet = document.querySelector('.facetwp-facet-brand');
                var modelFacet = document.querySelector('.facetwp-facet-model');

                if (brandFacet && modelFacet) {
                    var brandSelected = brandFacet.querySelectorAll(
                        '.facetwp-checkbox:checked, .facetwp-dropdown option:checked:not([value=""]), .facetwp-link.selected'
                    );

                    var currentBrandState = brandSelected.length > 0;

                    // Если brand был выбран, а теперь сброшен - сбрасываем model
                    if (previousBrandState === true && currentBrandState === false) {
                        if (typeof FWP !== 'undefined') {
                            isResetting = true;
                            FWP.reset('model');
                            setTimeout(function() {
                                isResetting = false;
                            }, 100);
                        }
                    }

                    previousBrandState = currentBrandState;

                    if (brandSelected.length === 0) {
                        modelFacet.style.opacity = '0.5';
                        modelFacet.style.pointerEvents = 'none';
                    } else {
                        modelFacet.style.opacity = '1';
                        modelFacet.style.pointerEvents = 'auto';
                    }
                }
            }

            // Проверяем при загрузке страницы
            toggleModelFacet();

            // Проверяем при изменении фасетов
            document.addEventListener('facetwp-loaded', toggleModelFacet);
            document.addEventListener('facetwp-refresh', toggleModelFacet);
        });
    </script>
    <?php
}

/**
 * Получить данные из повторителей ACF для фильтров FacetWP
 */
function get_acf_repeater_data_for_facets($repeater_name)
{
    $data = array();

    if (function_exists('have_rows') && have_rows($repeater_name, 'option')) {
        while (have_rows($repeater_name, 'option')) {
            the_row();

            switch ($repeater_name) {
                case 'prices':
                    $price1 = get_sub_field('price1');
                    $price2 = get_sub_field('price2');

                    if (!empty($price1)) {
                        $clean_price1 = preg_replace('/[^\d]/', '', $price1);
                        $processed_price1 = intval($clean_price1);
                        if ($processed_price1 > 0) {
                            $data['min'][] = array('value' => $processed_price1, 'label' => number_format($processed_price1, 0, '', ' ') . ' ₽');
                        }
                    }

                    if (!empty($price2)) {
                        $clean_price2 = preg_replace('/[^\d]/', '', $price2);
                        $processed_price2 = intval($clean_price2);
                        if ($processed_price2 > 0) {
                            $data['max'][] = array('value' => $processed_price2, 'label' => number_format($processed_price2, 0, '', ' ') . ' ₽');
                        }
                    }
                    break;

                case 'year':
                    $year1 = get_sub_field('year1');
                    $year2 = get_sub_field('year2');

                    if ($year1) {
                        $data['min'][] = array('value' => intval($year1), 'label' => $year1 . ' год');
                    }
                    if ($year2) {
                        $data['max'][] = array('value' => intval($year2), 'label' => $year2 . ' год');
                    }
                    break;

                case 'probeg':
                    $probeg1 = get_sub_field('probeg1');
                    $probeg2 = get_sub_field('probeg2');

                    if ($probeg1) {
                        $data['min'][] = array('value' => intval($probeg1), 'label' => number_format($probeg1, 0, '', ' ') . ' км');
                    }
                    if ($probeg2) {
                        $data['max'][] = array('value' => intval($probeg2), 'label' => number_format($probeg2, 0, '', ' ') . ' км');
                    }
                    break;
            }
        }
    }

    $result = array();

    foreach (['min', 'max'] as $type) {
        if (isset($data[$type])) {
            $unique_data = array();
            $seen_values = array();

            foreach ($data[$type] as $item) {
                if (!in_array($item['value'], $seen_values)) {
                    $unique_data[] = $item;
                    $seen_values[] = $item['value'];
                }
            }

            usort($unique_data, function ($a, $b) {
                return $a['value'] <=> $b['value'];
            });

            $result[$type] = $unique_data;
        }
    }

    return $result;
}

/**
 * AJAX обработчик для получения данных повторителей
 */
function ajax_get_repeater_data()
{
    if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'facet_repeater_nonce')) {
        wp_send_json_error('Security check failed');
        return;
    }

    $repeater_name = sanitize_text_field($_POST['repeater_name']);
    $allowed_repeaters = array('prices', 'year', 'probeg');

    if (!in_array($repeater_name, $allowed_repeaters)) {
        wp_send_json_error('Invalid repeater name: ' . $repeater_name);
        return;
    }

    if (!function_exists('have_rows')) {
        wp_send_json_error('ACF plugin not active');
        return;
    }

    if (!have_rows($repeater_name, 'option')) {
        wp_send_json_error('No data found in repeater: ' . $repeater_name);
        return;
    }

    $data = get_acf_repeater_data_for_facets($repeater_name);
    wp_send_json_success($data);
}
add_action('wp_ajax_get_repeater_data', 'ajax_get_repeater_data');
add_action('wp_ajax_nopriv_get_repeater_data', 'ajax_get_repeater_data');

/**
 * Добавляем JavaScript для работы с фасетами
 */
// function enqueue_facet_repeater_scripts()
// {
//     wp_enqueue_script('facet-repeater-js', get_template_directory_uri() . '/js/facet-repeater.js', array('jquery'), '1.0.3', true); // new version

//     wp_localize_script('facet-repeater-js', 'facet_repeater_ajax', array(
//             'ajax_url' => admin_url('admin-ajax.php'),
//             'nonce' => wp_create_nonce('facet_repeater_nonce')
//     ));
// }
// add_action('wp_enqueue_scripts', 'enqueue_facet_repeater_scripts');

/**
 * Добавляем стили для выпадающих блоков фасетов
 */
function add_facet_repeater_styles()
{
    ?>
    <style>
        .facet-dropdown-container {
            position: relative;
            display: inline-block;
            width: 100%;
        }

        .facet-dropdown-list {
            position: absolute;
            top: calc(100% + 4px);
            /* Небольшой отступ сверху */
            left: 0;
            right: 0;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 8px;
            /* Скругление как у инпутов */
            max-height: 220px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            padding: 4px;
            /* Внутренний отступ */
        }

        .facet-dropdown-list.show {
            display: block;
        }

        .facet-dropdown-item {
            padding: 10px 12px;
            cursor: pointer;
            border-bottom: none;
            /* Убираем разделители */
            transition: background-color 0.2s ease;
            text-align: left;
            border-radius: 6px;
            /* Скругление для самих элементов */
            margin-bottom: 2px;
        }

        .facet-dropdown-item:hover {
            background-color: #f0f3f5;
        }

        .facet-dropdown-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }

        .facet-dropdown-item.selected {
            background-color: #f0f3f5;
        }

        .facet-input-wrapper {
            position: relative;
        }

        .facet-input-wrapper .facetwp-number {
            position: relative;
            z-index: 1;
        }

        .loading-spinner {
            display: none;
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            width: 16px;
            height: 16px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% {
                transform: translateY(-50%) rotate(0deg);
            }

            100% {
                transform: translateY(-50%) rotate(360deg);
            }
        }

        /* Общие стили для инпутов и селектов */
        .facet-input-wrapper .facetwp-number,
        .custom-select-trigger {
            height: 3.75em;
            border-radius: 8px;
            border: 1px solid #ddd;
            background: #fff;
            padding: 0 20px;
            font-size: 1em;
            width: 100%;
            box-sizing: border-box;
        }

        /* Стили для кастомных селектов */
        .custom-select-trigger {
            cursor: pointer;
            position: relative;
            user-select: none;
            line-height: 3.75em;
            /* Вертикальное выравнивание текста */
            text-align: left;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            padding-right: 40px;
            /* Место для стрелки */
        }

        .custom-select-trigger::after {
            content: '';
            position: absolute;
            right: 20px;
            top: 50%;
            margin-top: -3px;
            /* Центрирование стрелки */
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 5px solid #888;
        }

        @media (max-width: 469px) {
            .facet-input-wrapper .facetwp-number,
            .custom-select-trigger {
                font-size: 4vw!important;
                height: 50px!important;
            }
            .custom-select-trigger {
                line-height: 50px;
            }

            .facet-dropdown-item {
                font-size: 3.5vw;
            }


        }
    </style>
    <?php
}
add_action('wp_head', 'add_facet_repeater_styles');
/**
 * Автоматическое обновление slug для записей типа "auto" при сохранении (марка-модель)
 */
add_action('save_post', function ($post_id, $post, $update) {
    // Не выполнять для автосохранений и ревизий
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($post_id)) return;
    if ($post->post_status === 'auto-draft') return;
    if ($post->post_type !== 'auto') return;

    // Защита от зацикливания
    if (get_post_meta($post_id, '_auto_slug_updated', true)) {
        delete_post_meta($post_id, '_auto_slug_updated');
        return;
    }

    // Получаем терм таксономии brand
    $brand_terms = get_the_terms($post_id, 'brand');
    $brand_name = '';
    if ($brand_terms && !is_wp_error($brand_terms)) {
        $brand_name = $brand_terms[0]->name;
    }

    // Получаем модель из метаполя
    $model = get_post_meta($post_id, 'model', true);

    if ($brand_name && $model) {
        // Создаем базовый slug без ID - только brand-model
        if (function_exists('slugify')) {
            $base_slug = slugify($brand_name . '-' . $model);
        } else {
            $base_slug = sanitize_title($brand_name . '-' . $model);
        }

        // Проверяем уникальность slug и добавляем суффикс при необходимости
        $new_slug = $base_slug;
        $suffix = 1;
        while (get_page_by_path($new_slug, OBJECT, 'auto') && get_page_by_path($new_slug, OBJECT, 'auto')->ID !== $post_id) {
            $new_slug = $base_slug . '-' . $suffix;
            $suffix++;
        }

        // Если slug отличается — обновляем
        if ($post->post_name !== $new_slug) {
            update_post_meta($post_id, '_auto_slug_updated', 1);
            wp_update_post([
                    'ID' => $post_id,
                    'post_name' => $new_slug,
            ]);
        }
    }
}, 10, 3);

// Функция для поддержки плагина Car Auction
add_action('init', 'ensure_car_auction_rewrite_rules');
function ensure_car_auction_rewrite_rules() {
    // Проверяем, что плагин активен
    if (class_exists('CarAuctionPlugin')) {
        $current_version = get_option('car_auction_rewrite_version', '1.0');
        if (version_compare($current_version, '2.3', '<')) {
            // Принудительно обновляем rewrite rules
            flush_rewrite_rules();
            update_option('car_auction_rewrite_version', '2.3');
            error_log('Theme: Flushed rewrite rules for Car Auction plugin');
        }
    }
}

// Ограничение постов для типа auto в админке
add_action('pre_get_posts', function($query) {
    // Только для админки и типа записи auto
    if (is_admin() && 
        $query->is_main_query() && 
        $query->get('post_type') == 'auto') {
        $query->set('posts_per_page', 1);
    }
});

// Обработка форм -> Отправка в TG бота

add_action('init', 'process_secure_webflow_forms');

function process_secure_webflow_forms() : void {
    // 1. Не запускаем на админке и AJAX
    if (is_admin() && (!defined('DOING_AJAX') || !DOING_AJAX)) {
        return;
    }

    try {
        // ==========================================
        // 1. НАСТРОЙКИ (ACF -> Хардкод)
        // ==========================================

        $tg_token = '5505130039:AAHR81oA8bKaiSyCxubvqGkVw1Gzz3Zz8Wc';
        $client_ids = ['525620068'];

        if ( function_exists('get_field') ) {
            $acf_token = get_field('tg_token', 'options');
            if ( !empty($acf_token) ) $tg_token = trim($acf_token);

            $acf_ids = get_field('client_ids', 'options');
            if ( !empty($acf_ids) ) {
                if (is_string($acf_ids)) {
                    $client_ids = preg_split('/[\s|]+/', $acf_ids, -1, PREG_SPLIT_NO_EMPTY);
                } elseif (is_array($acf_ids)) {
                    $client_ids = $acf_ids;
                }
            }
        }

        if (empty($tg_token)) return;

        // ==========================================
        // 2. ОПРЕДЕЛЕНИЕ ТИПА ЗАПРОСА
        // ==========================================

        $is_submission = false;
        $data = [];
        $form_type = '';

        // ФОРМА 1 (ГЛАВНАЯ) - Исправлено на POST
        // Ищем уникальное поле 'Auto'.
        // В HTML: name="Auto", name="Phone", name="Name" (с большой буквы!)
        if ( isset($_POST['Auto']) && isset($_POST['Phone']) ) {
            $data = $_POST;
            $form_type = 'main';
            $is_submission = true;
        }

        // ФОРМА 2 (БЫСТРАЯ)
        elseif ( isset($_POST['Phone_3']) && !empty($_POST['Phone_3']) ) {
            $data = $_POST;
            $form_type = 'short';
            $is_submission = true;
        }

        if (!$is_submission) return;

        // ==========================================
        // 3. БЕЗОПАСНОСТЬ
        // ==========================================

        // Referer check
        $referer = wp_get_referer();
        if ($referer && strpos($referer, parse_url(site_url(), PHP_URL_HOST)) === false) {
            //return; // Раскомментировать для строгой защиты
        }

        // Rate Limit (3 заявки за 10 минут с IP)
        $ip_address = preg_replace('/[^0-9a-fA-F:., ]/', '', $_SERVER['REMOTE_ADDR']);
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $ip_address = trim($parts[0]);
        }

        $transient_name = 'tg_spam_' . md5($ip_address);
        if (get_transient($transient_name) >= 3) return;

        // ==========================================
        // 4. СБОР ДАННЫХ
        // ==========================================

        // Хелпер: ищет ключ с большой или маленькой буквы
        $get_safe = function($key, $arr) {
            // Сначала ищем как передали (например Name), если нет - ищем name
            if (isset($arr[$key])) return htmlspecialchars(trim($arr[$key]));
            $lower_key = strtolower($key);
            if (isset($arr[$lower_key])) return htmlspecialchars(trim($arr[$lower_key]));
            return '-';
        };

        $message = '';
        $page_url_from_field = '';

        // --- ЛОГИКА ДЛЯ ГЛАВНОЙ ФОРМЫ ---
        if ($form_type === 'main') {
            $message .= "🚗 <b>Новая заявка (Подбор авто)</b>\n\n";
            // В HTML у вас name="Name", но мы используем умный хелпер выше
            $message .= "👤 Имя: " . $get_safe('Name', $data) . "\n";
            $message .= "📱 Телефон: " . $get_safe('Phone', $data) . "\n";
            $message .= "🚘 Авто: " . $get_safe('Auto', $data) . "\n";
            $message .= "🏙 Город: " . $get_safe('City', $data) . "\n";
        }

        // --- ЛОГИКА ДЛЯ БЫСТРОЙ ФОРМЫ ---
        elseif ($form_type === 'short') {

            $page_title = isset($data['Заголовок']) ? htmlspecialchars(trim($data['Заголовок'])) : '';
            $page_url_from_field = isset($data['Страница']) ? htmlspecialchars(trim($data['Страница'])) : '';

            if (!empty($page_title)) {
                $message .= "🚙 <b>Заказ авто: " . $page_title . "</b>\n\n";
            } else {
                $message .= "⚡️ <b>Новая заявка (Быстрая форма)</b>\n\n";
            }

            $message .= "👤 Имя: " . $get_safe('Name_3', $data) . "\n";
            $message .= "📱 Телефон: " . $get_safe('Phone_3', $data) . "\n";
        }

        // ==========================================
        // 5. ТЕХНИЧЕСКИЕ ДАННЫЕ
        // ==========================================

        if (!empty($page_url_from_field)) {
            $current_url = $page_url_from_field;
        } else {
            // Пытаемся взять Referer, если он есть (это надежнее при action="/")
            if (isset($_SERVER['HTTP_REFERER']) && !empty($_SERVER['HTTP_REFERER'])) {
                $current_url = htmlspecialchars($_SERVER['HTTP_REFERER']);
            } else {
                $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
                $current_url = htmlspecialchars($protocol . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']);
            }
        }

        $ua = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
        $os = "💻 PC / Неизвестно";
        if (preg_match('/iphone|ipad/i', $ua)) $os = "📱 iOS (Apple)";
        elseif (preg_match('/android/i', $ua)) $os = "📱 Android";
        elseif (preg_match('/windows/i', $ua)) $os = "💻 Windows";
        elseif (preg_match('/mac/i', $ua))     $os = "💻 MacOS";
        elseif (preg_match('/linux/i', $ua))     $os = "💻 Linux";

        $message .= "\n--------\n";
        $message .= "🔗 Ссылка: " . $current_url . "\n";
        $message .= "⚙️ Девайс: " . $os . "\n";
        $message .= "🌍 IP: " . $ip_address;

        // ==========================================
        // 6. ОТПРАВКА
        // ==========================================

        $sent_ok = false;

        foreach ($client_ids as $chat_id) {
            $chat_id = trim($chat_id);
            if(empty($chat_id)) continue;

            $url = "https://api.telegram.org/bot" . $tg_token . "/sendMessage";

            $response = wp_remote_post($url, [
                    'body' => [
                            'chat_id' => $chat_id,
                            'text' => $message,
                            'parse_mode' => 'HTML',
                            'disable_web_page_preview' => true
                    ],
                    'sslverify' => true,
                    'timeout' => 5
            ]);

            if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) == 200) {
                $sent_ok = true;
            }
        }

        if ($sent_ok) {
            $new_attempts = (get_transient($transient_name) ?: 0) + 1;
            set_transient($transient_name, $new_attempts, 10 * MINUTE_IN_SECONDS);
        }

    } catch (Throwable $e) {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('TG Error: ' . $e->getMessage());
        }
    }
}