/**
 * Car Auction Lite Admin JavaScript
 */

jQuery(document).ready(function($) {
    
    // Тест соединения с API
    $('#test-api-connection').on('click', function() {
        const button = $(this);
        const resultDiv = $('#api-connection-result');
        
        button.prop('disabled', true).text('Пр��веряю...');
        resultDiv.removeClass('success error').addClass('loading').text('Выполняется проверка соединения...');
        
        $.ajax({
            url: carAuctionLiteAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'car_auction_test_api_connection',
                nonce: carAuctionLiteAdmin.nonce
            },
            success: function(response) {
                if (response.success) {
                    resultDiv.removeClass('loading error').addClass('success').html(
                        '<strong>✅ Успешно:</strong> ' + response.data.message +
                        (response.data.details ? '<br><em>' + response.data.details + '</em>' : '')
                    );
                } else {
                    resultDiv.removeClass('loading success').addClass('error').html(
                        '<strong>❌ Ошибка:</strong> ' + response.data
                    );
                }
            },
            error: function() {
                resultDiv.removeClass('loading success').addClass('error').html(
                    '<strong>❌ Ошибка:</strong> Не удалось выполнить запрос'
                );
            },
            complete: function() {
                button.prop('disabled', false).text('Проверить соединение с API');
            }
        });
    });
    
    // Обновление статуса очереди
    function updateQueueStats() {
        const statsDiv = $('#queue-stats');
        
        statsDiv.addClass('loading').text('Загрузка...');
        
        $.ajax({
            url: carAuctionLiteAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'car_auction_get_queue_status',
                nonce: carAuctionLiteAdmin.nonce
            },
            success: function(response) {
                if (response.success) {
                    const stats = response.data;
                    let html = '<div class="queue-stats">';
                    html += '<div><strong>Всего:</strong> ' + (stats.total || 0) + '</div>';
                    html += '<div><strong>В ожидании:</strong> ' + (stats.pending || 0) + '</div>';
                    html += '<div><strong>Обрабатывается:</strong> ' + (stats.processing || 0) + '</div>';
                    html += '<div><strong>Завершено:</strong> ' + (stats.completed || 0) + '</div>';
                    html += '<div><strong>Ошибки:</strong> ' + (stats.failed || 0) + '</div>';
                    html += '</div>';
                    
                    statsDiv.removeClass('loading').html(html);
                } else {
                    statsDiv.removeClass('loading').addClass('error').text('Ошибка загрузки статистики');
                }
            },
            error: function() {
                statsDiv.removeClass('loading').addClass('error').text('Ошибка AJAX запроса');
            }
        });
    }
    
    // Кнопка обновления статуса очереди
    $('#refresh-queue-stats').on('click', updateQueueStats);
    
    // Ручная обработка очереди
    $('#process-queue-manually').on('click', function() {
        const button = $(this);
        
        if (!confirm('Запустить ручную обработку очереди создания страниц?')) {
            return;
        }
        
        button.prop('disabled', true).text('Обрабатываю...');
        
        $.ajax({
            url: carAuctionLiteAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'car_auction_process_queue_manually',
                nonce: carAuctionLiteAdmin.nonce
            },
            success: function(response) {
                if (response.success) {
                    alert('✅ ' + response.data.message);
                    updateQueueStats(); // Обновляем статистику
                } else {
                    alert('❌ Ошибка: ' + response.data);
                }
            },
            error: function() {
                alert('❌ Ошибка AJAX запроса');
            },
            complete: function() {
                button.prop('disabled', false).text('Обработать очередь');
            }
        });
    });
    
    // Обновление статуса CRON
    function updateCronStatus() {
        const cronDiv = $('#cron-status');
        
        cronDiv.addClass('loading').text('Загрузка...');
        
        $.ajax({
            url: carAuctionLiteAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'car_auction_get_cron_status',
                nonce: carAuctionLiteAdmin.nonce
            },
            success: function(response) {
                if (response.success) {
                    const cron = response.data;
                    let html = '<div class="cron-stats">';
                    html += '<div><strong>Следующий запуск:</strong> ' + cron.next_run + '</div>';
                    html += '<div><strong>Через:</strong> ' + cron.next_run_relative + '</div>';
                    html += '<div><strong>Время сервера:</strong> ' + cron.server_time + '</div>';
                    html += '<div><strong>WP Cron:</strong> ' + (cron.wp_cron_enabled ? '✅ Включен' : '❌ Отключен') + '</div>';
                    html += '</div>';
                    
                    cronDiv.removeClass('loading').html(html);
                } else {
                    cronDiv.removeClass('loading').addClass('error').text('Ошибка загрузки CRON статуса');
                }
            },
            error: function() {
                cronDiv.removeClass('loading').addClass('error').text('Ошибка AJAX запроса');
            }
        });
    }
    
    // Кнопка обновления CRON статуса
    $('#refresh-cron-status').on('click', updateCronStatus);
    
    // Ручной запуск CRON
    $('#run-cron-manually').on('click', function() {
        const button = $(this);
        
        if (!confirm('Запустить CRON задачи вручную?')) {
            return;
        }
        
        button.prop('disabled', true).text('Запускаю...');
        
        $.ajax({
            url: carAuctionLiteAdmin.ajax_url,
            type: 'POST',
            data: {
                action: 'car_auction_run_cron_manually',
                nonce: carAuctionLiteAdmin.nonce
            },
            success: function(response) {
                if (response.success) {
                    alert('✅ ' + response.data.message);
                    updateCronStatus(); // Обновляем статус
                } else {
                    alert('❌ Ошибка: ' + response.data);
                }
            },
            error: function() {
                alert('❌ Ошибка AJAX запроса');
            },
            complete: function() {
                button.prop('disabled', false).text('Запустить CRON вручную');
            }
        });
    });
    
    // Автоматическое обновление статистики при загрузке страницы
    updateQueueStats();
    updateCronStatus();
    
    // Автообновление каждые 30 секунд
    setInterval(function() {
        updateQueueStats();
        updateCronStatus();
    }, 30000);
});
