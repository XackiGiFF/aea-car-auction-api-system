## Что изменилось

- Исправлена загрузка блока "Похожие авто" для неавторизованных пользователей (`wp_ajax_nopriv_load_similar_cars_ajax`).
- На детальной странице авто добавлена AJAX-подгрузка цены вместо статичного текста "по запросу".
- Добавлен новый AJAX-обработчик `load_car_price_ajax` для получения расчетной стоимости автомобиля.
- Улучшена стабильность загрузки блоков на DetailPage через единый `admin-ajax.php` URL.

## Технические детали

- Обновлен `Car_Auction_AJAX_Indexer`:
  - регистрация публичных AJAX-хуков для похожих авто и цены;
  - новый handler `load_car_price_ajax_handler()`.
- Обновлен `Render_Detail_Page`:
  - placeholder цены `#car-price-value`;
  - AJAX-запрос на `load_car_price_ajax`;
  - корректные fallback-сценарии при ошибках.
