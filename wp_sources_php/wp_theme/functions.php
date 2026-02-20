<?php

defined('ABSPATH') || exit;

$theme_version = '1759315945';

load_theme_textdomain('wtw-translate', get_template_directory() . '/languages');

add_action('init', 'get_theme_path');
function get_theme_path()
{
    if (isset($_GET['theme_path'])) {
        echo get_bloginfo('template_url');
        exit;
    }
}

add_action('init', 'wtw_save_theme_path');
add_action('after_switch_theme', 'wtw_save_theme_path');

add_theme_support('title-tag');

function wtw_save_theme_path()
{
    $theme_folder = basename(get_bloginfo('template_directory'));
    $theme_config_file = WP_CONTENT_DIR . '/theme-config.php';
    if (!file_exists($theme_config_file) || current_action() === 'after_switch_theme') {
        file_put_contents($theme_config_file, 'theme_folder: ' . $theme_folder);
    }
}

require_once ABSPATH . 'wp-admin/includes/plugin.php';

// extend_functions_top //

add_action('admin_head', 'editor_full_width_taxonomy');
if (!function_exists('editor_full_width_taxonomy')) {
    function editor_full_width_taxonomy()
    {
        echo '<style>#edittag{max-width: none !important;}</style>';
    }
}

if (file_exists(dirname(__FILE__) . '/dynamic_functions.php')) {
    include_once __DIR__ . '/dynamic_functions.php';
}
if (file_exists(dirname(__FILE__) . '/shop_functions.php')) {
    include_once __DIR__ . '/shop_functions.php';
}
if (file_exists(dirname(__FILE__) . '/configurator.php')) {
    include_once __DIR__ . '/configurator.php';
}

if (file_exists(dirname(__FILE__) . '/custom_functions.php')) {
    include_once __DIR__ . '/custom_functions.php';
}

if (file_exists(dirname(__FILE__) . '/vendor/mobile-detect') && version_compare(PHP_VERSION, '7.4', '>=')) {
    require_once 'vendor/mobile-detect/MobileDetect.php';
}

if (file_exists(dirname(__FILE__) . '/vendor/ajax-simply') && !is_plugin_active('ajax-simply/ajax-simply.php')) {
    include_once 'vendor/ajax-simply/ajax-simply.php';
}

if (file_exists(dirname(__FILE__) . '/vendor/classic-editor') && !is_plugin_active('classic-editor/classic-editor.php')) {
    include_once 'vendor/classic-editor/classic-editor.php';
}

if (
    file_exists(dirname(__FILE__) . '/vendor/acf-code-field')
    && !is_plugin_active('acf-code-field/acf-code-field.php')
    && !is_plugin_active('nice_configurator/wtw_adv.php')
) {
    include_once 'vendor/acf-code-field/acf-code-field.php';
}

add_theme_support('menus');
add_theme_support('woocommerce');
add_theme_support('post-thumbnails');
add_filter('widget_text', 'do_shortcode');
add_theme_support('title-tag');

add_action('admin_head', 'admin_custom_styles');
add_action('wp_head', 'admin_custom_styles');
function admin_custom_styles()
{
    if (is_user_logged_in()) {
?>
        <style>
            #wp-admin-bar-wp-admin-bar-options>.ab-item:before {
                content: "\f100";
                top: 2px;
            }

            .wpide-editor-infobar {
                display: none !important;
            }
        </style>
        <?php
    }
}

add_action('admin_enqueue_scripts', 'add_admin_scripts');
function add_admin_scripts()
{
    wp_register_script('admin_script', get_template_directory_uri() . '/js/admin.js', ['jquery'], false, true);
    wp_enqueue_script('admin_script');
}

add_action('wp_enqueue_scripts', 'add_site_scripts');
function add_site_scripts()
{
    global $theme_version;
    wp_deregister_script('jquery-core');
    wp_register_script('jquery-core', '//ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js', false, false, true);
    wp_enqueue_script('jquery');
    wp_enqueue_style('main', get_stylesheet_directory_uri() . '/css/main.css', [], $theme_version);
}

add_filter('wp_default_scripts', 'remove_jquery_migrate');
function remove_jquery_migrate(&$scripts)
{
    if (!is_admin()) {
        $scripts->remove('jquery');
        $scripts->add('jquery', false, ['jquery-core'], '1.12.4');
    }
}

if (!is_admin()) {
    wp_enqueue_script('jquery-ui-core', ['jquery']);
    wp_enqueue_script(
        'jquery-ui-slider',
        ['jquery', 'jquery-ui-core']
    );
}

if (!function_exists('slugify')) {
    function slugify($text)
    {
        $translation = [
            'а' => 'a',
            'б' => 'b',
            'в' => 'v',
            'г' => 'g',
            'д' => 'd',
            'ж' => 'zh',
            'з' => 'z',
            'и' => 'i',
            'й' => 'j',
            'к' => 'k',
            'л' => 'l',
            'м' => 'm',
            'н' => 'n',
            'о' => 'o',
            'п' => 'p',
            'р' => 'r',
            'с' => 's',
            'т' => 't',
            'у' => 'u',
            'ф' => 'f',
            'х' => 'h',
            'ц' => 'c',
            'ч' => 'ch',
            'ш' => 'sh',
            'щ' => 'sch',
            'ы' => 'y',
            'э' => 'e',
            'ю' => 'yu',
            'я' => 'ya',
            'і' => 'i',
            'ї' => 'yi',
            'є' => 'ye',
            'ґ' => 'g',
            'е' => 'e',
            'ё' => 'e',
            '\'' => '',
            '"' => '',
            '`' => '',
            'ь' => '',
            'ъ' => '',
        ];
        $text = trim($text);
        $text = mb_convert_case($text, MB_CASE_LOWER, 'UTF-8');
        $text = strtr($text, $translation);
        $text = preg_replace('~(\W+)~', '_', $text);
        $text = trim($text, '_');
        $text = strtolower($text);
        return $text;
    }
}

function get_layout_var($layout_field, $layout_name, $sub_field, $post_id = '')
{
    if ($post_id === '') {
        $post_id = get_the_ID();
    }
    foreach (get_field($layout_field, $post_id) as $layout) {
        if ($layout['acf_fc_layout'] === $layout_name) {
            return $layout[$sub_field];
        }
    }
    return '';
}

function get_range_meta_value($post_type, $meta_field, $range)
{
    global $wpdb;
    $value = $wpdb->get_var("SELECT $range(CAST(meta_value AS UNSIGNED)) FROM `{$wpdb->prefix}postmeta` WHERE meta_key = '$meta_field'");
    if ($value == '') {
        $value = 0;
    }
    return $value;
}

function wtw_get_meta_range_on_term($post_type, $term_id, $meta_field)
{
    global $wpdb;
    $sql = "
    SELECT  MIN( convert(meta_value, DECIMAL)  ) as min_price , MAX( convert(meta_value, DECIMAL)  ) as max_price
    FROM {$wpdb->posts}
    INNER JOIN {$wpdb->term_relationships} ON ({$wpdb->posts}.ID = {$wpdb->term_relationships}.object_id)
    INNER JOIN {$wpdb->postmeta} ON ({$wpdb->posts}.ID = {$wpdb->postmeta}.post_id)
    WHERE
    ( {$wpdb->term_relationships}.term_taxonomy_id IN (%d) )
    AND {$wpdb->posts}.post_type = '$post_type'
    AND {$wpdb->posts}.post_status = 'publish'
    AND {$wpdb->postmeta}.meta_key = '$meta_field'
    ";

    $result = $wpdb->get_results($wpdb->prepare($sql, $term_id));

    return $result[0];
}

function wtw_get_meta_range_on_archive($post_type, $meta_field)
{
    global $wpdb;
    $sql = "
    SELECT  MIN( convert(meta_value, DECIMAL)  ) as min_price , MAX( convert(meta_value, DECIMAL)  ) as max_price
    FROM {$wpdb->posts}
    INNER JOIN {$wpdb->postmeta} ON ({$wpdb->posts}.ID = {$wpdb->postmeta}.post_id)
    WHERE
    {$wpdb->posts}.post_type = '$post_type'
    AND {$wpdb->posts}.post_status = 'publish'
    AND {$wpdb->postmeta}.meta_key = '$meta_field'
    ";

    $result = $wpdb->get_results($wpdb->prepare($sql));

    return $result[0];
}

function getTerm($term_name)
{
    $terms = get_the_terms(get_the_ID(), $term_name);
    return $terms[0]->name;
}

function getCatID()
{
    global $wp_query;
    if (is_category() || is_single()) {
        $cat_ID = get_query_var('cat');
    }
    return $cat_ID;
}

add_shortcode('show_file', 'show_file_func');
function show_file_func($atts)
{
    extract(shortcode_atts([
        'file' => '',
    ], $atts));
    if ($file != '') {
        return @file_get_contents($file);
    }
}

if (is_admin()) {
    foreach (get_taxonomies() as $taxonomy) {
        add_action("manage_edit-{$taxonomy}_columns", 'tax_add_col');
        add_filter("manage_edit-{$taxonomy}_sortable_columns", 'tax_add_col');
        add_filter("manage_{$taxonomy}_custom_column", 'tax_show_id', 10, 3);
    }
    add_action('admin_print_styles-edit-tags.php', 'tax_id_style');
    function tax_add_col($columns)
    {
        return $columns + ['tax_id' => 'ID'];
    }
    function tax_show_id($v, $name, $id)
    {
        return 'tax_id' === $name ? $id : $v;
    }
    function tax_id_style()
    {
        print '<style>#tax_id{width:4em}</style>';
    }

    add_filter('manage_posts_columns', 'posts_add_col', 5);
    add_action('manage_posts_custom_column', 'posts_show_id', 5, 2);
    add_filter('manage_pages_columns', 'posts_add_col', 5);
    add_action('manage_pages_custom_column', 'posts_show_id', 5, 2);
    add_action('admin_print_styles-edit.php', 'posts_id_style');
    function posts_add_col($defaults)
    {
        $defaults['wps_post_id'] = __('ID');
        return $defaults;
    }
    function posts_show_id($column_name, $id)
    {
        if ($column_name === 'wps_post_id') {
            echo $id;
        }
    }
    function posts_id_style()
    {
        print '<style>#wps_post_id{width:4em}</style>';
    }
}

function isCurrentLink($test_link)
{
    if ($test_link == 'http://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'] || ($test_link == site_url() . '/' && substr_count(get_permalink(), 'p=') != 0)) {
        $current_class = ' w--current';
    } else {
        $current_class = '';
    }
    return $current_class;
}

function wtw_current_url($get_params = false)
{
    if ($get_params) {
        $url = ((!empty($_SERVER['HTTPS'])) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        echo $url;
    } else {
        $url = ((!empty($_SERVER['HTTPS'])) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        $url = explode('?', $url);
        $url = $url[0];
    }
    return $url;
}

function wtw_is_current_url($test_url, $get_params = false)
{
    if ($get_params) {
        $url = ((!empty($_SERVER['HTTPS'])) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        echo $url;
    } else {
        $url = ((!empty($_SERVER['HTTPS'])) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        $url = explode('?', $url);
        $url = $url[0];
    }
    return $test_url === $url;
}

function get_id_by_slug($page_slug)
{
    $page = get_page_by_path($page_slug);
    if ($page) {
        return $page->ID;
    } else {
        return null;
    }
}

function posts_schet_class()
{
    global $post_num;
    if (++$post_num % 2) {
        $class = 'nechet';
    } else {
        $class = 'chet';
    }
    return $class;
}

function post_parity()
{
    global $post_num;
    if (++$post_num % 2) {
        return 'odd';
    } else {
        return 'even';
    }
}

add_filter('upload_mimes', 'my_myme_types', 1, 1);
function my_myme_types($mime_types)
{
    $mime_types['svg'] = 'image/svg+xml'; // поддержка SVG
    return $mime_types;
}

add_filter('post_thumbnail_html', 'remove_width_attribute', 10);
add_filter('image_send_to_editor', 'remove_width_attribute', 10);
function remove_width_attribute($html)
{
    $html = preg_replace('/(width|height)="\d*"\s/', '', $html);
    return $html;
}

add_action('init', 'remheadlink');
function remheadlink()
{
    remove_action('wp_head', 'rsd_link');
    remove_action('wp_head', 'wlwmanifest_link');
    remove_action('wp_head', 'wp_generator');
    remove_action('wp_head', 'wp_shortlink_wp_head');
    remove_action('wp_head', 'adjacent_posts_rel_link_wp_head');
    remove_action('wp_head', 'feed_links_extra', 3);
}

function wtw_change_settings($option, $old_value, $value)
{
    if (
        substr($option, 0, 25) === 'options_custom_post_types'
        || substr($option, 0, 25) === 'options_custom_taxonomies'
    ) {
        update_option('wtw_settings_changed', true);
    }
}
add_action('updated_option', 'wtw_change_settings', 10, 3);

function wtw_flush_rewrite()
{
    if (get_option('wtw_settings_changed') == true) {
        flush_rewrite_rules();
        update_option('wtw_settings_changed', false);
    }
}
add_action('admin_init', 'wtw_flush_rewrite');

add_filter('template_include', 'set_custom_templates');
function set_custom_templates($original_template)
{
    global $wp_query;
    if (is_tax() && get_queried_object()->parent) {
        $child_template = str_replace('.php', '-child.php', $original_template);
        if (file_exists($child_template)) {
            return $child_template;
        } else {
            return $original_template;
        }
    } elseif ($wp_query->is_posts_page) {
        if (file_exists(TEMPLATEPATH . '/archive-post.php')) {
            return TEMPLATEPATH . '/archive-post.php';
        } else {
            return TEMPLATEPATH . '/archive.php';
        }
    } else {
        return $original_template;
    }
}
/*
add_filter('search_template', 'change_search_template');
function change_search_template($template)
{
    $post_type = isset($post['post_type']) ? $post['post_type'] : get_post_type();
    
    if ($_GET['post_type'] != '' && $_GET['post_type'] != 'post' && $_GET['post_type'] != 'page') {
        return locate_template('archive-' . $_GET['post_type'] . '.php');
    } else {
        return locate_template('search.php');
    }
}
*/

add_filter('search_template', 'change_search_template_safe', 20);
function change_search_template_safe($template) {
    // Проверяем, что это действительно страница поиска
    if (!is_search()) {
        return $template; // не трогаем, если не поиск
    }

    $post_type = isset($_GET['post_type']) ? sanitize_key($_GET['post_type']) : '';

    if ($post_type && $post_type !== 'post' && $post_type !== 'page') {
        $archive_template = locate_template('archive-' . $post_type . '.php');
        if ($archive_template) {
            return $archive_template;
        }
    }

    // Если ничего не нашли — возвращаем стандартный поиск
    $search_template = locate_template('search.php');
    return $search_template ?: $template;
}

function wp_admin_bar_options()
{
    global $wp_admin_bar;
    $wp_admin_bar->add_menu([
        'id' => 'wp-admin-bar-options',
        'title' => __('Site options', 'wtw-translate'),
        'href' => get_site_url() . '/wp-admin/themes.php?page=options',
    ]);
}
add_action('wp_before_admin_bar_render', 'wp_admin_bar_options');

if (function_exists('acf_add_options_page') && current_user_can('manage_options')) {
    acf_add_options_page([
        'page_title' => __('Options', 'wtw-translate'),
        'menu_title' => __('Options', 'wtw-translate'),
        'menu_slug' => 'options',
        'parent_slug' => 'themes.php',
        'update_button' => __('Update'),
        'updated_message' => __('Item updated.'),
        'autoload' => true,
    ]);
}

if (function_exists('acf_add_options_page') && current_user_can('manage_options')) {
    acf_add_options_page([
        'page_title' => __('Site configurator', 'wtw-translate'),
        'menu_title' => __('Configurator', 'wtw-translate'),
        'menu_slug' => 'config',
        'icon_url' => 'dashicons-screenoptions',
        'parent_slug' => 'tools.php',
        'update_button' => __('Update'),
        'updated_message' => __('Item updated.'),
        'autoload' => true,
    ]);
}

add_filter('acf/load_field/name=taxonomy_for_query', 'get_taxonomies_for_query');
function get_taxonomies_for_query($field)
{
    $taxonomies = get_taxonomies();
    unset($taxonomies['category'], $taxonomies['post_tag']);

    foreach ($taxonomies as $key => $value) {
        $tax = get_taxonomy($key);
        $taxonomies[$key] = get_taxonomy_labels($tax)->singular_name . ' (' . $key . ')';
    }
    $field['choices']['category_name'] = 'Рубрика (category)';
    $field['choices']['tag'] = 'Метка (post_tag)';
    $field['choices'] = array_merge($field['choices'], $taxonomies);
    return $field;
}

add_filter('acf/load_field/name=taxonomy_select', 'get_taxonomies_select');
function get_taxonomies_select($field)
{
    $taxonomies = get_taxonomies();
    foreach ($taxonomies as $key => $value) {
        $tax = get_taxonomy($key);
        $taxonomies[$key] = get_taxonomy_labels($tax)->singular_name . ' (' . $key . ')';
    }
    $field['choices'] = array_merge($field['choices'], $taxonomies);
    return $field;
}

add_filter('acf/load_field/name=post_type_select', 'get_post_type_select');
function get_post_type_select($field)
{
    $post_types = get_post_types();
    foreach ($post_types as $key => $value) {
        $post_type = get_post_type_object($key);
        $post_types[$key] = get_post_type_labels($post_type)->singular_name . ' (' . $key . ')';
    }
    $field['choices'] = $post_types;
    return $field;
}

function select_query_by_name($query_name)
{
    $args = [];
    if (function_exists('have_rows')) {
        if (have_rows('custom_query', 'option')) :
            while (have_rows('custom_query', 'option')) : the_row();
                if (get_sub_field('name') === $query_name) {
                    $args['post_type'] = get_sub_field('post_type_select');
                    $args['posts_per_page'] = get_sub_field('posts_per_page') === '' ? -1 : get_sub_field('posts_per_page');
                    if (get_sub_field('paged')) {
                        $args['paged'] = get_query_var('paged');
                    }
                    while (have_rows('taxonomy')) : the_row();
                        $args[get_sub_field('taxonomy_for_query')] = get_sub_field('terms');
                    endwhile;
                }
            endwhile;
        endif;
    }
    return $args;
}

function select_term_query_by_name($query_name)
{
    $args = [];
    if (function_exists('have_rows')) {
        if (have_rows('custom_term_query', 'option')) :
            while (have_rows('custom_term_query', 'option')) : the_row();
                if (get_sub_field('name') === $query_name) {
                    $args['taxonomy'] = get_sub_field('taxonomy_select');
                    $args['hide_empty'] = get_sub_field('hide_empty');
                    $args['orderby'] = get_sub_field('orderby');
                    $args['order'] = get_sub_field('order');
                }
            endwhile;
        endif;
    }
    return $args;
}

add_action('init', 'register_cpts');
function register_cpts()
{
    if (function_exists('have_rows')) :
        while (have_rows('custom_post_types', 'option')) : the_row();
            register_post_type(
                get_sub_field('name'),
                [
                    'labels' => [
                        'name' => get_sub_field('many_name'),
                        'menu_name' => get_sub_field('menu_name') != '' ? get_sub_field('menu_name') : get_sub_field('many_name'),
                        'singular_name' => get_sub_field('single_name'),
                        'add_new' => __('Add new', 'wtw-translate'),
                        'add_new_item' => __('Add new', 'wtw-translate'),
                        'edit_item' => __('Edit', 'wtw-translate'),
                        'new_item' => get_sub_field('single_name'),
                        'all_items' => __('All', 'wtw-translate') . ' ' . mb_strtolower(get_sub_field('many_name')),
                        'view_item' => __('View', 'wtw-translate'),
                        'search_items' => __('Search', 'wtw-translate'),
                        'not_found' => __('Nothing found', 'wtw-translate'),
                        'not_found_in_trash' => __('Cart is empty', 'wtw-translate'),
                    ],
                    'public' => true,
                    'menu_icon' => get_sub_field('icon'),
                    'menu_position' => 20,
                    'has_archive' => true,
                    'supports' => get_sub_field('support'),
                    'taxonomies' => [''],
                    'show_in_rest' => get_sub_field('show_in_rest'),
                    'publicly_queryable' => get_sub_field('publicly_queryable') !== '' ? get_sub_field('publicly_queryable') : true,
                    'rewrite' => [
                        'slug' => get_sub_field('slug'),
                    ],
                ]
            );
        endwhile;
    endif;
}

add_action('init', 'register_taxs');
function register_taxs()
{
    if (function_exists('have_rows')) :
        while (have_rows('custom_taxonomies', 'option')) : the_row();
            register_taxonomy(
                get_sub_field('name'),
                get_sub_field('post_type_select'),
                [
                    'labels' => [
                        'name' => get_sub_field('many_name'),
                        'singular_name' => get_sub_field('single_name'),
                        'search_items' => __('Search', 'wtw-translate'),
                        'popular_items' => __('Popular', 'wtw-translate') . ' ' . mb_strtolower(get_sub_field('many_name')),
                        'all_items' => __('All', 'wtw-translate') . ' ' . mb_strtolower(get_sub_field('many_name')),
                        'parent_item' => null,
                        'parent_item_colon' => null,
                        'edit_item' => __('Edit', 'wtw-translate'),
                        'update_item' => __('Update', 'wtw-translate'),
                        'add_new_item' => __('Add new', 'wtw-translate'),
                        'new_item_name' => __('Input name', 'wtw-translate'),
                        'separate_items_with_commas' => __('Separate', 'wtw-translate') . ' ' . mb_strtolower(get_sub_field('many_name')) . ' ' . __('with commas', 'wtw-translate'),
                        'add_or_remove_items' => __('Add or delete', 'wtw-translate') . ' ' . mb_strtolower(get_sub_field('many_name')),
                        'choose_from_most_used' => __('Choose from the most commonly used', 'wtw-translate'),
                        'menu_name' => get_sub_field('menu_name') != '' ? get_sub_field('menu_name') : get_sub_field('many_name'),
                    ],
                    'hierarchical' => get_sub_field('type') === 'true' ? true : false,
                    'public' => true,
                    'publicly_queryable' => get_sub_field('publicly_queryable') !== '' ? get_sub_field('publicly_queryable') : true,
                    'show_in_nav_menus' => true,
                    'show_admin_column' => true,
                    'show_in_quick_edit' => true,
                    'show_in_rest' => get_sub_field('show_in_rest'),
                    'rest_base' => get_sub_field('slug'),
                    'rest_controller_class' => 'WP_REST_Terms_Controller',
                    'show_ui' => true,
                    'show_tagcloud' => true,
                    'update_count_callback' => '_update_post_term_count',
                    'query_var' => true,
                    'rewrite' => [
                        'slug' => get_sub_field('slug'),
                        'hierarchical' => false,
                    ],
                ]
            );
        endwhile;
    endif;
}

function query_filter()
{
    if ((isset($_GET['post_type']) || isset($_GET['sort']) || isset($_GET['posts_per_page']))
        && !isset($_GET['min_price']) && !isset($_GET['max_price'])
        && !strpos($_SERVER['QUERY_STRING'], 'filter_')
    ) {
        global $wp_query;

        $args = [];
        $args['meta_query'] = ['relation' => 'AND'];
        $args['tax_query'] = ['relation' => 'AND'];

        foreach ($_GET as $key => $value) {
            if (is_array($value)) {
                if (substr($key, 0, 6) === 'in_pm_') {
                    $args['meta_query'][] = [
                        'key' => substr($key, 6),
                        'value' => $value,
                        'compare' => 'IN',
                    ];
                } else {
                    $args['tax_query'][] = [
                        'taxonomy' => $key,
                        'field' => 'slug',
                        'terms' => $value,
                        'operator' => 'IN',
                    ];
                }
            }

            if (substr($key, 0, 7) === 'min_pm_' && $value != '') {
                $args['meta_query'][] = [
                    'key' => substr($key, 7),
                    'value' => $value,
                    'type' => 'numeric',
                    'compare' => '>=',
                ];
            }

            if (substr($key, 0, 7) === 'max_pm_' && $value != '') {
                $args['meta_query'][] = [
                    'key' => substr($key, 7),
                    'value' => $value,
                    'type' => 'numeric',
                    'compare' => '<=',
                ];
            }

            if (substr($key, 0, 8) === 'min_pmf_' && $value != '') {
                $args['meta_query'][] = [
                    'key' => substr($key, 8),
                    'value' => $value,
                    'type' => 'decimal',
                    'compare' => '>=',
                ];
            }

            if (substr($key, 0, 8) === 'max_pmf_' && $value != '') {
                $args['meta_query'][] = [
                    'key' => substr($key, 8),
                    'value' => $value,
                    'type' => 'decimal',
                    'compare' => '<=',
                ];
            }

            if (substr($key, 0, 8) === 'min_pmd_' && $value != '') {
                $args['meta_query'][] = [
                    'key' => substr($key, 8),
                    'value' => date('Ymd', strtotime($value)),
                    'type' => 'date',
                    'compare' => '>=',
                ];
            }

            if (substr($key, 0, 8) === 'max_pmd_' && $value != '') {
                $args['meta_query'][] = [
                    'key' => substr($key, 8),
                    'value' => date('Ymd', strtotime($value)),
                    'type' => 'date',
                    'compare' => '<=',
                ];
            }

            if (substr($key, 0, 3) === 'pm_' & $value !== '') {
                $args['meta_query'][] = [
                    'key' => substr($key, 3),
                    'value' => $value,
                ];
            }

            if ($key === 'post_types') {
                $args['post_type'] = explode(',', $value);
            }

            if ($key === 'posts_per_page') {
                $args['posts_per_page'] = $value;
            }

            if ($key === 'sort') {
                $v = explode('.', $value);
                if (count($v) === 3) {
                    $args['orderby'] = $v[0];
                    $args['meta_key'] = $v[1];
                    $args['order'] = $v[2];
                } else {
                    $args['orderby'] = $v[0];
                    $args['order'] = $v[1];
                }
            }
        }
        $result_query = array_merge($args, $wp_query->query);
        $result_query = apply_filters('wtw_query_filter_result_query', $result_query, $_GET);
        query_posts($result_query);
    }
}

add_action('wp', 'query_filter');

function ajaxs_load_posts($jx)
{
    $args = [];
    $args = unserialize(stripslashes($jx->data['query']));
    $args['post_status'] = 'publish';
    $args['paged'] = $jx->data['page'] + 1;
    if (isset($args['ID']) || $jx->data['archive']) {
        $post = get_post($args['ID']);
        query_posts($args);
    }
    ob_start();
    require locate_template('template-parts/' . $jx->data['part'] . '.php');
    return ob_get_clean();
};

function posts_per_page_change($query)
{
    if (isset($_GET['perpage']) && $query->is_main_query() && !$query->is_admin) {
        $query->set('posts_per_page', $_GET['perpage']);
    }
}
add_action('pre_get_posts', 'posts_per_page_change');

add_action('after_setup_theme', 'add_editor_css');
function add_editor_css()
{
    add_theme_support('editor-styles');
    //add_editor_style( 'css/main.css' );
}

function get_term_option_html($taxonomy, $term)
{
    global $wp_query;
    return '<option value="' . $term->slug . '" ' . selected(!isset($_GET['post_type']) ? $wp_query->query_vars['term'] : $_GET[$taxonomy], $term->slug, false) . '>' . $term->name . '</option>';
}

function get_option_html($value, $title, $selected = false)
{
    return '<option value="' . $value . '" ' . selected($selected, $value, false) . '>' . $title . '</option>';
}

if (!function_exists('d')) {
    function d()
    {
        if (!headers_sent()) {
            header('Content-Type: text/html; charset=utf-8');
        }

        echo '<pre style="text-align: left; font-size: 12px;">';
        foreach (func_get_args() as $var) {
            print_r($var);
            echo '<br><br>';
        }
        echo '</pre>';
    }
}

if (!function_exists('dc')) {
    function dc()
    {
        if (!headers_sent()) {
            header('Content-Type: text/html; charset=utf-8');
        }

        echo "<!--\n";
        foreach (func_get_args() as $var) {
            print_r($var) . "\n";
        }
        echo "\n-->";
    }
}

if (!function_exists('dd')) {
    function dd()
    {
        if (!headers_sent()) {
            header('Content-Type: text/html; charset=utf-8');
        }

        echo '<pre style="text-align: left; font-size: 12px;">';
        foreach (func_get_args() as $var) {
            print_r($var);
            echo '<br><br>';
        }
        echo '</pre>';
        die();
    }
}

add_filter('get_the_archive_title', function ($title) {
    return preg_replace('~^[^:]+: ~', '', $title);
});

function ajaxs_filter($jx)
{
    $args = unserialize(stripslashes($jx->data['query']));

    $args['meta_query'] = ['relation' => 'AND'];
    $args['tax_query'] = ['relation' => 'AND'];
    $args['post_status'] = 'publish';

    foreach ($jx->data as $key => $value) {
        if ($value !== '') {
            if ($key === 's') {
                $args['s'] = $value;
            } elseif (substr($key, 0, 6) === 'in_pm_') {
                $args['meta_query'][] = [
                    'key' => substr($key, 6),
                    'value' => $value,
                    'compare' => 'IN',
                ];
            } elseif (substr($key, 0, 7) === 'min_pm_') {
                $args['meta_query'][] = [
                    'key' => substr($key, 7),
                    'value' => $value,
                    'type' => 'numeric',
                    'compare' => '>=',
                ];
            } elseif (substr($key, 0, 7) === 'max_pm_') {
                $args['meta_query'][] = [
                    'key' => substr($key, 7),
                    'value' => $value,
                    'type' => 'numeric',
                    'compare' => '<=',
                ];
            } elseif (substr($key, 0, 8) === 'min_pmf_') {
                $args['meta_query'][] = [
                    'key' => substr($key, 8),
                    'value' => $value,
                    'type' => 'decimal',
                    'compare' => '>=',
                ];
            } elseif (substr($key, 0, 8) === 'max_pmf_') {
                $args['meta_query'][] = [
                    'key' => substr($key, 8),
                    'value' => $value,
                    'type' => 'decimal',
                    'compare' => '<=',
                ];
            } elseif (substr($key, 0, 8) === 'min_pmd_') {
                $args['meta_query'][] = [
                    'key' => substr($key, 8),
                    'value' => date('Ymd', strtotime($value)),
                    'type' => 'date',
                    'compare' => '>=',
                ];
            } elseif (substr($key, 0, 8) === 'max_pmd_') {
                $args['meta_query'][] = [
                    'key' => substr($key, 8),
                    'value' => date('Ymd', strtotime($value)),
                    'type' => 'date',
                    'compare' => '<=',
                ];
            } elseif (substr($key, 0, 3) === 'pm_') {
                $args['meta_query'][] = [
                    'key' => substr($key, 3),
                    'value' => $value,
                ];
            } elseif ($key === 'post_type') {
                $args['post_type'] = explode(',', $value);
            } elseif ($key === 'posts_per_page') {
                $args['posts_per_page'] = $value;
            } elseif ($key === 'sort') {
                $v = explode('.', $value);
                if (count($v) === 3) {
                    $args['orderby'] = $v[0];
                    $args['meta_key'] = $v[1];
                    $args['order'] = $v[2];
                } else {
                    $args['orderby'] = $v[0];
                    $args['order'] = $v[1];
                }
            } elseif ($key === 'ajaxs_nonce') {
            } elseif ($key === 'query') {
            } else {
                $operator = 'IN';
                $field = 'slug';

                if (!is_array($value) && strpos($value, ':') !== false) {
                    $value_arr = explode(':', $value);

                    if (count($value_arr) === 2) {
                        $operator = $value_arr[0];
                        $value = $value_arr[1];
                    } elseif (count($value_arr) === 3) {
                        $field = $value_arr[0];
                        $operator = $value_arr[1];
                        $value = $value_arr[2];
                    }

                    if (strpos($value, ',') !== false) {
                        $value = explode(',', $value);
                    }
                }
                if (trim(implode('', $value)) !== '') {
                    $args['tax_query'][] = [
                        'taxonomy' => $key,
                        'field' => $field,
                        'operator' => $operator,
                        'terms' => $value,
                    ];
                } else {
                    if ($value !== '' && !is_array($value)) {
                        $args['tax_query'][] = [
                            'taxonomy' => $key,
                            'field' => $field,
                            'terms' => [$value],
                        ];
                    }
                }
            }
        }
    }

    // $jx->log($jx->data);
    // $jx->log($args);

    $query_vars = serialize($args);

    $jx->call('set_query_vars', $query_vars);

    ob_start();
    include locate_template('template-parts/' . $jx->data['post_type'] . '.php');
    return ob_get_clean();
}

function wtw_sort_terms_hierarchicaly(&$cats, &$into, $parentId = 0)
{
    foreach ($cats as $i => $cat) {
        if ($cat->parent == $parentId) {
            $into[$cat->term_id] = $cat;
            unset($cats[$i]);
        }
    }

    foreach ($into as $top_cat) {
        $top_cat->children = [];
        wtw_sort_terms_hierarchicaly($cats, $top_cat->children, $top_cat->term_id);
    }
}

function wtw_sort_menu_hierarchicaly(&$menu_items, &$into, $parentId = 0)
{
    foreach ($menu_items as $i => $item) {
        if ($item->parent == $parentId) {
            $into[$item->id] = $item;
            unset($menu_items[$i]);
        }
    }

    foreach ($into as $top_menu) {
        $top_menu->children = [];
        wtw_sort_menu_hierarchicaly($menu_items, $top_menu->children, $top_menu->id);
    }
}

function wtw_get_menu_posts($menu_id)
{
    $args = [
        'post_type' => 'nav_menu_item',
        'posts_per_page' => -1,
        'orderby' => 'menu_order',
        'order' => 'ASC',
        'tax_query' => [
            [
                'taxonomy' => 'nav_menu',
                'field' => 'slug',
                'terms' => $menu_id,
            ],
        ],
    ];

    $menu_posts = new WP_Query;
    $menu_posts->query($args);
    $menu = [];

    foreach ($menu_posts->posts as $p) {
        $m = get_post_meta($p->ID);

        if ($m['_menu_item_type'][0] === 'taxonomy') {
            $term = get_term($m['_menu_item_object_id'][0], $m['_menu_item_object'][0]);
            $post_title = $term->name;
            $page_url = get_term_link((int) $m['_menu_item_object_id'][0], $m['_menu_item_object'][0]);
        } elseif ($m['_menu_item_object'][0] !== 'custom' && $p->post_title === '') {
            $page = get_post($m['_menu_item_object_id'][0]);
            $post_title = $page->post_title;
            $page_url = '/' . get_page_uri($page->ID);
        } else {
            $post_title = $p->post_title;
            $page_url = $m['_menu_item_url'][0];
        }

        $parent = (int) $m['_menu_item_menu_item_parent'][0];
        $menu_item = new stdClass;
        $menu_item->id = $p->ID;
        $menu_item->title = $post_title;
        $menu_item->url = $page_url;
        $menu_item->parent = $parent;
        $menu_item->object = $m['_menu_item_object'][0];
        $menu_item->object_id = $m['_menu_item_object_id'][0];
        $menu_item->item_type = $m['_menu_item_type'][0];
        $menu[] = $menu_item;
    }
    return $menu;
}

function wtw_get_menu_tree($menu_name)
{
    $menu_object = wp_get_nav_menu_object($menu_name);
    if ($menu_object) {
        $menu_tree = [];
        $menu_posts = wtw_get_menu_posts($menu_object->slug);

        wtw_sort_menu_hierarchicaly($menu_posts, $menu_tree);

        return $menu_tree;
    }
}

if (!function_exists('num_decline')) {
    function num_decline($number, $titles, $show_number = true)
    {

        global $term;

        if (is_string($titles)) {
            $titles = preg_split('/, */', $titles);
        }

        if (empty($titles[2])) {
            $titles[2] = $titles[1];
        }

        $cases = [2, 0, 1, 1, 1, 2];
        $intnum = abs((int) strip_tags($number));
        $title_index = ($intnum % 100 > 4 && $intnum % 100 < 20)

            ? 2

            : $cases[min($intnum % 10, 5)];

        return ($show_number ? "$number " : '') . $titles[$title_index];
    }
}

$site_logo = '';
$billing_country = 'RU';

function check_settings()
{
    if (!function_exists('have_rows')) return;

    if (have_rows('wtw_site_settings', 'options')) {
        while (have_rows('wtw_site_settings', 'options')) {
            the_row();

            if (get_sub_field('custom_adminbar', 'options')) {
                final class Kama_Collapse_Toolbar
                {
                    public static function init()
                    {
                        add_action('admin_bar_init', [__CLASS__, 'hooks']);
                    }

                    public static function hooks()
                    {
                        remove_action('wp_head', '_admin_bar_bump_cb');
                        add_action('wp_head', [__CLASS__, 'collapse_styles']);
                    }

                    public static function collapse_styles()
                    {

                        if (is_admin()) {
                            return;
                        }

                        ob_start();
        ?>
                        <style id="kama_collapse_admin_bar">
                            #wpadminbar {
                                background: none;
                                float: left;
                                width: auto;
                                height: auto;
                                bottom: 0;
                                min-width: 0 !important;
                            }

                            #wpadminbar>* {
                                float: left !important;
                                clear: both !important;
                            }

                            #wpadminbar .ab-top-menu li {
                                float: none !important;
                            }

                            #wpadminbar .ab-top-secondary {
                                float: none !important;
                            }

                            #wpadminbar .ab-top-menu>.menupop>.ab-sub-wrapper {
                                top: 0;
                                left: 100%;
                                white-space: nowrap;
                            }

                            #wpadminbar .quicklinks>ul>li>a {
                                padding-right: 17px;
                            }

                            #wpadminbar .ab-top-secondary .menupop .ab-sub-wrapper {
                                left: 100%;
                                right: auto;
                            }

                            html {
                                margin-top: 0 !important;
                            }

                            #wpadminbar {
                                overflow: hidden;
                                width: 33px;
                                height: 30px;
                            }

                            #wpadminbar:hover {
                                overflow: visible;
                                width: auto;
                                height: auto;
                                background: rgba(102, 102, 102, .7);
                            }

                            #wp-admin-bar-<?= is_multisite() ? 'my-sites' : 'site-name' ?>.ab-item:before {
                                color: #797c7d;
                            }

                            #wp-admin-bar-wp-logo {
                                display: none;
                            }

                            body.admin-bar:before {
                                display: none;
                            }

                            @media screen and (min-width: 782px) {
                                html.wp-toolbar {
                                    padding-top: 0 !important;
                                }

                                #wpadminbar:hover {
                                    background: rgba(34, 34, 34, 0.95);
                                }

                                #adminmenu {
                                    margin-top: 48px !important;
                                }
                            }

                            #wpwrap .edit-post-header {
                                top: 0;
                            }

                            #wpwrap .edit-post-sidebar {
                                top: 56px;
                            }
                        </style>
    <?php
                        $styles = ob_get_clean();

                        echo preg_replace('/[\n\t]/', '', $styles) . "\n";
                    }
                }

                Kama_Collapse_Toolbar::init();

                add_action('admin_bar_menu', 'my_admin_bar_menu', 40);
                function my_admin_bar_menu($wp_admin_bar)
                {
                    global $template;

                    $wp_admin_bar->add_menu(array(
                        'id'    => 'menu_id',
                        'title' => basename($template),
                    ));
                }
            }

            if (get_sub_field('admin_panel_disable', 'options')) {
                function adminbar_disable()
                {
                    if (!current_user_can('manage_options')) {
                        show_admin_bar(false);
                    }
                };
                adminbar_disable();
            }


            if (get_sub_field('post_thumbnail_show', 'options')) {
                if (1) {
                    add_action('init', 'add_post_thumbs_in_post_list_table', 20);
                    function add_post_thumbs_in_post_list_table()
                    {
                        $supports = get_theme_support('post-thumbnails');
                        if (!isset($ptype_names)) {
                            if ($supports === true) {
                                $ptype_names = get_post_types(array('public' => true), 'names');
                                $ptype_names = array_diff($ptype_names, array('attachment'));
                            } elseif (is_array($supports)) {
                                $ptype_names = $supports[0];
                            }
                        }

                        foreach ($ptype_names as $ptype) {
                            add_filter("manage_{$ptype}_posts_columns", 'add_thumb_column');
                            add_action("manage_{$ptype}_posts_custom_column", 'add_thumb_value', 10, 2);
                        }
                    }

                    function add_thumb_column($columns)
                    {
                        add_action('admin_notices', function () {
                            echo '
                			<style>
                				.column-thumbnail{ width:80px; text-align:center; }
                			</style>';
                        });
                        $num = 1;
                        $new_columns = array('thumbnail' => __('Thumbnail'));

                        return array_slice($columns, 0, $num) + $new_columns + array_slice($columns, $num);
                    }
                    function add_thumb_value($colname, $post_id)
                    {
                        if ('thumbnail' == $colname) {
                            $width  = $height = 45;
                            if ($thumbnail_id = get_post_meta($post_id, '_thumbnail_id', true)) {
                                $thumb = wp_get_attachment_image($thumbnail_id, array($width, $height), true);
                            } elseif ($attachments = get_children(array(
                                'post_parent'    => $post_id,
                                'post_mime_type' => 'image',
                                'post_type'      => 'attachment',
                                'numberposts'    => 1,
                                'order'          => 'DESC',
                            ))) {
                                $attach = array_shift($attachments);
                                $thumb = wp_get_attachment_image($attach->ID, array($width, $height), true);
                            }

                            echo empty($thumb) ? ' ' : $thumb;
                        }
                    }
                }
            }

            if ((get_sub_field('guttenberg_disable', 'options')) && !is_plugin_active('classic-editor/classic-editor.php')) {
                add_filter('use_block_editor_for_post', '__return_false', 10);
            }

            if (get_sub_field('comments_disable', 'options')) {
                add_action('admin_menu', 'my_remove_admin_menus');
                function my_remove_admin_menus()
                {
                    remove_menu_page('edit-comments.php');
                }
                add_action('init', 'remove_comment_support', 100);
                function remove_comment_support()
                {
                    remove_post_type_support('post', 'comments');
                    remove_post_type_support('page', 'comments');
                }
                function mytheme_admin_bar_render()
                {
                    global $wp_admin_bar;
                    $wp_admin_bar->remove_menu('comments');
                }
                add_action('wp_before_admin_bar_render', 'mytheme_admin_bar_render');
            }

            if (get_sub_field('plugin_update_disable', 'options')) {
                remove_action('load-update-core.php', 'wp_update_plugins');
                add_filter('pre_site_transient_update_plugins', create_function('$a', "return null;"));
                wp_clear_scheduled_hook('wp_update_plugins');
            }

            if (get_sub_field('wp_update_disable', 'options')) {
                add_filter('pre_site_transient_update_core', create_function('$a', "return null;"));
                wp_clear_scheduled_hook('wp_version_check');
            }

            if (get_sub_field('wp_update_disable', 'options')) {
                add_filter('pre_site_transient_update_core', create_function('$a', "return null;"));
                wp_clear_scheduled_hook('wp_version_check');
            }

            if (get_sub_field('post_duplicate', 'options')) {

                add_action('admin_action_duplicate_post_as_draft', 'duplicate_post_as_draft');

                function duplicate_post_as_draft()
                {
                    global $wpdb;
                    if (!(isset($_GET['post']) || isset($_POST['post']) || (isset($_REQUEST['action']) && 'duplicate_post_as_draft' == $_REQUEST['action']))) {
                        wp_die('No post to duplicate!');
                    }

                    $post_id = (isset($_GET['post']) ? $_GET['post'] : $_POST['post']);
                    $post = get_post($post_id);
                    $current_user = wp_get_current_user();
                    $new_post_author = $current_user->ID;

                    if (isset($post) && $post != null) {
                        $args = array(
                            'comment_status' => $post->comment_status,
                            'ping_status' => $post->ping_status,
                            'post_author' => $new_post_author,
                            'post_content' => $post->post_content,
                            'post_excerpt' => $post->post_excerpt,
                            'post_name' => $post->post_name,
                            'post_parent' => $post->post_parent,
                            'post_password' => $post->post_password,
                            'post_status' => 'draft',
                            'post_title' => $post->post_title . ' (Copy)',
                            'post_type' => $post->post_type,
                            'to_ping' => $post->to_ping,
                            'menu_order' => $post->menu_order
                        );

                        $new_post_id = wp_insert_post($args);

                        $taxonomies = get_object_taxonomies($post->post_type);
                        foreach ($taxonomies as $taxonomy) {
                            $post_terms = wp_get_object_terms($post_id, $taxonomy, array('fields' => 'slugs'));
                            wp_set_object_terms($new_post_id, $post_terms, $taxonomy, false);
                        }

                        $post_meta_infos = $wpdb->get_results("SELECT meta_key, meta_value FROM $wpdb->postmeta WHERE post_id=$post_id");
                        if (count($post_meta_infos) != 0) {
                            $sql_query = "INSERT INTO $wpdb->postmeta (post_id, meta_key, meta_value) ";
                            foreach ($post_meta_infos as $meta_info) {
                                $meta_key = $meta_info->meta_key;
                                if ($meta_key == '_wp_old_slug') continue;
                                $meta_value = addslashes($meta_info->meta_value);
                                $sql_query_sel[] = "SELECT $new_post_id, '$meta_key', '$meta_value'";
                            }
                            $sql_query .= implode(" UNION ALL ", $sql_query_sel);
                            $wpdb->query($sql_query);
                        }

                        wp_redirect(admin_url('post.php?action=edit&post=' . $new_post_id));
                        exit;
                    } else {
                        wp_die('Post creation failed, could not find original post: ' . $post_id);
                    }
                }

                add_filter('post_row_actions', 'add_duplicate_link', 10, 2);
                add_filter('page_row_actions', 'add_duplicate_link', 10, 2);
                function add_duplicate_link($actions, $post)
                {
                    if (current_user_can('edit_posts') || current_user_can('edit_pages')) {
                        $actions['duplicate'] = '<a href="' . wp_nonce_url('admin.php?action=duplicate_post_as_draft&post=' . $post->ID, basename(__FILE__), 'duplicate_nonce') . '" title="' . esc_html__('Copy', 'default') . '" rel="permalink">' . esc_html__('Copy', 'default') . '</a>';
                    }
                    return $actions;
                }
            }


            if (get_sub_field('site_logo', 'options')) {


                function new_logo()
                {
                    global $site_logo;
                    $site_logo = get_field('wtw_site_settings', 'options')['site_logo']; // get_sub_field( 'site_logo', 'options');
                }

                new_logo();

                // Свой логотип
                add_action('add_admin_bar_menus', 'reset_admin_wplogo');
                function reset_admin_wplogo()
                {
                    remove_action('admin_bar_menu', 'wp_admin_bar_wp_menu', 10);
                    add_action('admin_bar_menu', 'my_admin_bar_wp_menu', 10);
                }
                function my_admin_bar_wp_menu($wp_admin_bar)
                {
                    global $site_logo;
                    $wp_admin_bar->add_menu(array(
                        'id'    => 'wp-logo',
                        'title' => '<img style="max-width:100%;height:auto;max-height:32px;" src="' . $site_logo . '" alt="site logo" >',
                        'href'  => home_url('/'),
                        'meta'  => array(
                            'title' => 'На сайт',
                        ),
                    ));
                }
            }

            if (get_sub_field('wp_version_disable', 'options')) {
                remove_action('wp_head', 'wp_generator');
                add_filter('the_generator', '__return_empty_string');
                function remove_version_scripts_styles($src)
                {
                    if (strpos($src, 'ver=')) {
                        $src = remove_query_arg('ver', $src);
                    }
                    return $src;
                }

                add_filter('style_loader_src', 'remove_version_scripts_styles', 10, 2);
                add_filter('script_loader_src', 'remove_version_scripts_styles', 10, 2);
            }

            if (get_sub_field('svg_support', 'options')) {
                add_filter('wp_check_filetype_and_ext', function ($data, $file, $filename, $mimes) {
                    $filetype = wp_check_filetype($filename, $mimes);
                    return [
                        'ext'             => $filetype['ext'],
                        'type'            => $filetype['type'],
                        'proper_filename' => $data['proper_filename']
                    ];
                }, 10, 4);

                function cc_mime_types($mimes)
                {
                    $mimes['svg'] = 'image/svg+xml';
                    return $mimes;
                }
                add_filter('upload_mimes', 'cc_mime_types');

                function fix_svg()
                {
                    echo '<style type="text/css">
                        .attachment-266x266, .thumbnail img {
                             width: 100% !important;
                             height: auto !important;
                        }
                        </style>';
                }
                add_action('admin_head', 'fix_svg');
            }

            if (get_sub_field('json_support', 'options')) {
                function custom_mime_types($mimes)
                {
                    $mimes['json'] = 'application/json';
                    return $mimes;
                }
                add_filter('upload_mimes', 'custom_mime_types');
            }

            if (in_array('woocommerce/woocommerce.php', apply_filters('active_plugins', get_option('active_plugins')))) {

                if (get_sub_field('wc_style_disable', 'options')) {
                    add_filter('woocommerce_enqueue_styles', '__return_empty_array');
                }

                if (get_sub_field('wc_add_novelty', 'options')) {

                    add_filter('manage_product_posts_columns', function ($columns) {
                        return array_merge($columns, ['novelty' => __('Новинка', 'textdomain')]);
                    });


                    add_filter('manage_edit-product_columns', function ($columns) {
                        $new_columns = array();
                        foreach ($columns as $key => $value) {
                            $new_columns[$key] = $value;
                            if ($key === 'featured') {
                                $new_columns['novelty'] = 'Novelty'; // Добавить "novelty" в новый массив
                            }
                        }
                        return $new_columns;
                    });

                    add_action('manage_product_posts_custom_column', function ($column_key, $post_id) {
                        if ($column_key == 'novelty') {
                            $novelty = get_post_meta($post_id, '_checkbox_new', true);
                            if ($novelty) {
                                echo '<div id="new-' . $post_id . '" class="novelty-btn novelty-yes">Yes</div>';
                            } else {
                                echo '<div id="new-' . $post_id . '" class="novelty-btn">No</div>';
                            }
                        }
                    }, 100, 2);

                    // сохраняем поле NEW
                    add_action('woocommerce_product_bulk_and_quick_edit', 'save_checkbox_new_bulk_edit', 99, 2);
                    function save_checkbox_new_bulk_edit($post_id, $post)
                    {
                        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
                            return $post_id;
                        }
                        if ('product' !== $post->post_type) return $post_id;

                        if (isset($_REQUEST['_checkbox_new'])) {
                            update_post_meta($post_id, '_checkbox_new', 'yes');
                        } else {
                            delete_post_meta($post_id, '_checkbox_new');
                        }
                    }

                    add_action('admin_footer', 'show_checkbox_new_quick_edit_data');
                    function show_checkbox_new_quick_edit_data()
                    {
                        wc_enqueue_js("

                    		// передаем значение в панель БР если поле NEW включено
                    		jQuery('#the-list').on('click', '.editinline', function() {
                    			var post_id = jQuery(this).closest('tr').attr('id');
                    			post_id = post_id.replace('post-', '');
                    			var custom_field = jQuery('#new-' + post_id).text();
                    			if ( custom_field === 'Yes' ) {
                    				setTimeout(function () {  jQuery('#edit-' + post_id + ' input[name=\'_checkbox_new\']').prop('checked', true);  }, 200);
                    			}
                            });

                    		// изменяем состояние поля при нажатии на иконку
                    		jQuery('#the-list').on('click', '.novelty-btn', function() {

                    			var new_id = jQuery(this).attr('id');
                    			new_id = new_id.replace('new-', '');
                    			var new_val = jQuery(this).text();

                    			jQuery.ajax({
                    				url: '/wp-admin/admin-ajax.php',
                    				method: 'post',
                    				data: {
                    					action: 'ajax_novelty',
                    					new_id: new_id,
                    					new_val: new_val,
                    				},
                    				success: function () {
                    					jQuery('#new-' + new_id).text(new_val == 'Yes' ? 'No' : 'Yes');
                    					jQuery('#new-' + new_id).toggleClass('novelty-yes');
                    				}
                    			});

                            });
                    	");

                        // стили оформления колонки
                        echo '<style type="text/css">
                    	table.wp-list-table .column-novelty {width: 48px;}
                    	thead .column-novelty {font-size: 0;}
                    	.novelty-btn {cursor: pointer; font-size: 0; color: #ccc;}
                    	.novelty-btn.novelty-yes {color: #2271b1;}
                    	thead .column-novelty::before, table.wp-list-table .novelty-btn::before {
                    		content: "\f339";
                    		font-family: Dashicons;
                    		line-height: 1.3;
                    		font-size: initial;

                    	}
                    	</style>';
                    }

                    // Обновление поста ajax
                    function ajax_novelty_save()
                    {
                        $new_id = $_REQUEST['new_id'];
                        $new_val = $_REQUEST['new_val'];

                        if ($new_val == 'No') {
                            update_post_meta($new_id, '_checkbox_new', 'yes');
                        } else {
                            delete_post_meta($new_id, '_checkbox_new');
                        }

                        if (defined('DOING_AJAX') && DOING_AJAX) {
                            wp_die();
                        }
                    }

                    add_action('wp_ajax_ajax_novelty', 'ajax_novelty_save');



                    // Вывод лэйблов
                    function insert_novelty_product()
                    {
                        global $product;
                        $label_novelty = get_post_meta($product->get_ID(), '_checkbox_new', true);
                        if ($label_novelty == 'yes') {
                            return true;
                        } else {
                            return false;
                        }
                    }
                }

                // add_filter('woocommerce_checkout_fields', 'wtw_unset_checkout_fields', 25);
                // function wtw_unset_checkout_fields($fields)
                // {

                //     if (!get_sub_field('billing_first_name', 'options')) {
                //         unset($fields['billing']['billing_first_name']); // имя
                //     }
                //     if (!get_sub_field('billing_last_name', 'options')) {
                //         unset($fields['billing']['billing_last_name']); // фамилия
                //     }
                //     if (!get_sub_field('billing_phone', 'options')) {
                //         unset($fields['billing']['billing_phone']); // телефон
                //     }
                //     if (!get_sub_field('billing_email', 'options')) {
                //         unset($fields['billing']['billing_email']); // емайл
                //     }
                //     if (!get_sub_field('billing_company', 'options')) {
                //         unset($fields['billing']['billing_company']); // компания
                //     }
                //     if (!get_sub_field('billing_address_1', 'options')) {
                //         unset($fields['billing']['billing_address_1']); // адрес 1
                //     }
                //     if (!get_sub_field('billing_address_2', 'options')) {
                //         unset($fields['billing']['billing_address_2']); // адрес 2
                //     }
                //     if (!get_sub_field('billing_city', 'options')) {
                //         unset($fields['billing']['billing_city']); // город
                //     }
                //     if (!get_sub_field('billing_state', 'options')) {
                //         unset($fields['billing']['billing_state']); // регион, штат
                //     }
                //     if (!get_sub_field('billing_postcode', 'options')) {
                //         unset($fields['billing']['billing_postcode']); // почтовый индекс
                //     }
                //     if (!get_sub_field('order_comments', 'options')) {
                //         unset($fields['order']['order_comments']); // заметки к заказу
                //     }

                //     return $fields;
                // }

                if (get_sub_field('billing_country', 'options') || 1) {
                    function default_country()
                    {
                        global $billing_country;
                        $billing_country = get_sub_field('billing_country', 'options');
                    }
                    default_country();

                    add_filter('default_checkout_billing_country', 'default_checkout_country');
                    function default_checkout_country($country)
                    {
                        global $billing_country;
                        return $billing_country;
                    }
                }
            }
        }
    }
}
add_action('init', 'check_settings');


function add_custom_menu_page()
{
    add_submenu_page(
        'tools.php', // родительская страница
        'Редактор .htaccess и wp-config.php', // заголовок страницы
        'Редактор .htaccess и wp-config.php', // название страницы в меню
        'manage_options', // права пользователя
        'custom-menu-page', // идентификатор страницы
        'custom_menu_page_callback' // функция обработчика
    );
}
add_action('admin_menu', 'add_custom_menu_page');

function custom_menu_page_callback()
{
    ?>
    <div class="wrap">
        <h1>Редактор .htaccess и wp-config.php</h1>
        <p>Здесь вы можете редактировать файлы .htaccess и wp-config.php</p>
        <h2>.htaccess</h2>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="edit_htaccess">
            <textarea name="htaccess" rows="10" cols="100"><?php echo file_get_contents(ABSPATH . '.htaccess'); ?></textarea>
            <br>
            <input type="submit" value="Сохранить" class="button-primary">
        </form>
        <h2>wp-config.php</h2>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="edit_wpconfig">
            <textarea name="wpconfig" rows="10" cols="100"><?php echo file_get_contents(ABSPATH . 'wp-config.php'); ?></textarea>
            <br>
            <input type="submit" value="Сохранить" class="button-primary">
        </form>
    </div>
<?php
}

function custom_menu_page_save_htaccess()
{
    if (isset($_POST['htaccess'])) {
        file_put_contents(ABSPATH . '.htaccess', stripslashes($_POST['htaccess']));
    }
    wp_redirect(admin_url('tools.php?page=custom-menu-page'));
    exit;
}
add_action('admin_post_edit_htaccess', 'custom_menu_page_save_htaccess');

function custom_menu_page_save_wpconfig()
{
    if (isset($_POST['wpconfig'])) {
        file_put_contents(ABSPATH . 'wp-config.php', stripslashes($_POST['wpconfig']));
    }
    wp_redirect(admin_url('tools.php?page=custom-menu-page'));
    exit;
}
add_action('admin_post_edit_wpconfig', 'custom_menu_page_save_wpconfig');

function search_context($value)
{
    $content = get_the_content();
    $search_query = get_search_query();
    $position = mb_stripos($content, $search_query);

    if ($position !== false) {
        $start = max(0, $position - $value);
        $end = min(mb_strlen($content), $position + $value + mb_strlen($search_query));
        $context = mb_substr($content, $start, $end - $start);
        $context = strip_tags($context);
        $context = str_replace($search_query, '<span class="search-word">' . $search_query . '</span>', $context);
        echo '...' . $context . '...';
    } else {
        the_excerpt();
    }
}

if (!function_exists('get_cart_volume')) {
    function get_cart_volume()
    {
        $volume = $rate = 0;
        $dimension_unit = get_option('woocommerce_dimension_unit');
        if ($dimension_unit == 'mm') {
            $rate = pow(10, 9);
        } elseif ($dimension_unit == 'cm') {
            $rate = pow(10, 6);
        } elseif ($dimension_unit == 'm') {
            $rate = 1;
        }
        if ($rate == 0) return false;
        foreach (WC()->cart->get_cart() as $cart_item) {
            $product = $cart_item['data'];
            $qty     = $cart_item['quantity'];
            $length = $product->get_length();
            $width  = $product->get_width();
            $height = $product->get_height();
            $volume += $length * $width * $height * $qty;
        }
        return $volume / $rate;
    }
}

if (!function_exists('wtw_device_is')) {
    function wtw_device_is($device)
    {
        if (version_compare(PHP_VERSION, '7.4', '<=')) return true;

        $detect = new \Detection\MobileDetect;

        switch ($device) {
            case 'phone':
                return $detect->isMobile() && !$detect->isTablet();
            case 'tablet':
                return $detect->isTablet();
            case 'mobile':
                return $detect->isMobile();
            case 'desktop':
                return !$detect->isMobile() && !$detect->isTablet();
            case 'ios':
                return $detect->isiOS();
            case 'not_ios':
                return !$detect->isiOS();
            case 'android':
                return $detect->isAndroidOS();
            case 'not_phone':
                return !$detect->isMobile() && !$detect->isTablet();
        }

        return false;
    }
}

function show_errors()
{
    ini_set('display_errors', 1);
    error_reporting(E_ERROR | E_PARSE);
}

if (!function_exists('custom_wp_mail_from_name')) {
    function custom_wp_mail_from_name($from_name)
    {
        $site_name = get_bloginfo('name');
        $from_name = $site_name;
        return $from_name;
    }
}

add_filter('wp_mail_from_name', 'custom_wp_mail_from_name');

function getAttachmentIDByFilename($filename)
{
    global $wpdb;

    $attachments = $wpdb->get_results("SELECT post_id FROM $wpdb->postmeta WHERE meta_key = '_wp_attached_file' AND meta_value like'%$filename'", OBJECT);

    $id = $attachments[0]->post_id;

    if (!empty($id)) {
        return (int) $id;
    } else {
        return false;
    }
}

function fix_acf_field_keys()
{
    // Проверяем, был ли запрошен запуск
    if (!isset($_GET['update_acf_keys']) || $_GET['update_acf_keys'] !== 'true') {
        return;
    }

    // Проверяем права пользователя
    if (!current_user_can('manage_options')) {
        wp_die('У вас недостаточно прав для выполнения этой операции');
    }

    // Получаем все группы полей ACF
    $field_groups = acf_get_field_groups();

    // Собираем все поля ACF в массив [ 'имя_поля' => 'field_ключ' ]
    $acf_fields = [];

    foreach ($field_groups as $group) {
        $fields = acf_get_fields($group['key']);
        if ($fields) {
            foreach ($fields as $field) {
                $acf_fields[$field['name']] = $field['key'];
            }
        }
    }

    if (empty($acf_fields)) {
        wp_redirect(admin_url('tools.php?page=config&message=no_acf_fields'));
        exit;
    }

    // Находим все записи, у которых есть мета-поля ACF
    $args = [
        'post_type' => 'any',
        'posts_per_page' => -1,
        'fields' => 'ids', // Получаем только ID для оптимизации
    ];

    $query = new WP_Query($args);
    $updated_posts = 0;
    $options_updated = 0;

    foreach ($query->posts as $post_id) {
        $updated = false;
        $meta_values = get_post_meta($post_id);

        foreach ($meta_values as $meta_key => $meta_value) {
            // Пропускаем служебные поля
            if (strpos($meta_key, '_') === 0) {
                continue;
            }

            // Если это поле ACF
            if (array_key_exists($meta_key, $acf_fields)) {
                $field_key = $acf_fields[$meta_key];
                $hidden_meta_key = '_' . $meta_key;

                // Проверяем и обновляем при необходимости
                if (get_post_meta($post_id, $hidden_meta_key, true) !== $field_key) {
                    update_post_meta($post_id, $hidden_meta_key, $field_key);
                    $updated = true;
                }
            }
        }

        if ($updated) {
            $updated_posts++;
        }
    }

    // Обновление ключей ACF для опций
    foreach ($acf_fields as $field_name => $field_key) {
        $hidden_option_name = '_options_' . $field_name;
        if (get_option($hidden_option_name) !== $field_key) {
            update_option($hidden_option_name, $field_key);
            $options_updated++;
        }
    }

    // Перенаправляем с сообщением о результате
    wp_redirect(admin_url('tools.php?page=config&message=acf_keys_updated&updated_posts=' . $updated_posts . '&updated_options=' . $options_updated));
    exit;
}

// Добавляем обработчик для admin_init
add_action('admin_init', 'fix_acf_field_keys');

// Функция для вывода сообщения об успехе/ошибке
function show_acf_update_notice()
{
    if (!isset($_GET['message'])) {
        return;
    }

    $messages = [
        'no_acf_fields' => [
            'class' => 'error',
            'text' => 'Не найдено ни одного поля ACF.'
        ],
        'acf_keys_updated' => [
            'class' => 'success',
            'text' => 'Ключи ACF успешно обновлены. Обновлено записей: ' . (isset($_GET['updated_posts']) ? intval($_GET['updated_posts']) : 0) . '. Обновлено опций: ' . (isset($_GET['updated_options']) ? intval($_GET['updated_options']) : 0)
        ]
    ];

    if (isset($messages[$_GET['message']])) {
        $message = $messages[$_GET['message']];
        echo '<div class="notice notice-' . esc_attr($message['class']) . ' is-dismissible"><p>' . esc_html($message['text']) . '</p></div>';
    }
}

// Добавляем уведомления в админку
add_action('admin_notices', 'show_acf_update_notice');
