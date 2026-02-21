<?php
/**
* Plugin Name: Car Auction Integration Lite
* Description: Integration with car auctions from Japan, Korea and China via avto.jp API (Use local api)
* Version: 1.0.14
* Author: АЕА | XackiGiFF
*/

if (!defined('ABSPATH')) {
    exit;
}

define('CAR_AUCTION_PLUGIN_URL', plugin_dir_url(__FILE__));
define('CAR_AUCTION_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('CAR_AUCTION_PLUGIN_DIR', plugin_dir_path(__FILE__));
const CAR_AUCTION_VERSION = '1.0.14';


update_option('car_auction_debug_mode', false);

function car_auction_activate(): void
{
    require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/Wp_Car_Auction_Plugin_Lite.php';
    aea\Wp_Car_Auction_Lite\Wp_Car_Auction_Plugin_Lite::get_instance()->handle_activation();
}

function car_auction_deactivate(): void
{
    require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/Wp_Car_Auction_Plugin_Lite.php';
    aea\Wp_Car_Auction_Lite\Wp_Car_Auction_Plugin_Lite::get_instance()->handle_deactivation();
}

register_activation_hook(__FILE__, 'car_auction_activate');
register_deactivation_hook(__FILE__, 'car_auction_deactivate');

require_once CAR_AUCTION_PLUGIN_PATH . 'src/aea/Wp_Car_Auction_Lite/Wp_Car_Auction_Plugin_Lite.php';

aea\Wp_Car_Auction_Lite\Wp_Car_Auction_Plugin_Lite::get_instance();
