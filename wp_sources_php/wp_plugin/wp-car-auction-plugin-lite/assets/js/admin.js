jQuery(document).ready(function($) {
    // Check if carAuctionAdmin is available
    if (typeof carAuctionAdmin === 'undefined') {
        return;
    }

    // Security utilities
    const Security = {
        escapeHtml: function(text) {
            if (typeof text !== 'string') return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        sanitizeId: function(input) {
            if (typeof input !== 'string') return '';
            return input.replace(/[^a-zA-Z0-9_-]/g, '');
        },

        extractAction: function(requestData) {
            if (!requestData) return 'unknown';
            try {
                const params = new URLSearchParams(requestData);
                return params.get('action') || 'unknown';
            } catch (e) {
                return 'parse_error';
            }
        }
    };

    // Safe AJAX error handler
    $(document).ajaxError(function(event, xhr, settings, thrownError) {
        if (settings.url === ajaxurl) {
            const safeError = {
                status: xhr.status,
                action: Security.extractAction(settings.data),
                isTimeout: xhr.status === 0
            };

            if (window.carAuctionConfig && window.carAuctionConfig.debug) {
                console.error('AJAX Error:', safeError);
            }
        }
    });

    // Safe alert function
    function safeAlert(message) {
        alert(Security.escapeHtml(message));
    }

    // Generic safe AJAX function
    function safeAjaxRequest(button, action, successCallback, errorMessage) {
        try {
            button.prop('disabled', true).text('Обработка...');

            $.post(ajaxurl, {
                action: action,
                nonce: carAuctionAdmin.nonce
            }, function(response) {
                if (response.success) {
                    successCallback(response);
                } else {
                    safeAlert(errorMessage + ': ' + (response.data || 'Неизвестная ошибка'));
                }
            }).fail(function() {
                safeAlert('Ошибка соединения');
            }).always(function() {
                button.prop('disabled', false).text(button.data('original-text'));
            });
        } catch (error) {
            if (window.carAuctionConfig && window.carAuctionConfig.debug) {
                console.error('Error in AJAX request:', error);
            }
            button.prop('disabled', false).text(button.data('original-text'));
        }
    }

    // Clear cache button (пример переписанной функции)
    $('#clear-cache').on('click', function() {
        const button = $(this);
        button.data('original-text', button.text());

        safeAjaxRequest(
            button,
            'car_auction_clear_cache',
            function(response) {
                safeAlert('Кэш успешно очищен! Удалено записей: ' + response.data.deleted);
            },
            'Ошибка очистки кэша'
        );
    });

    // Остальные кнопки переписать аналогично с использованием safeAjaxRequest

    // Safe view car function
    $('.view-car').on('click', function(e) {
        e.preventDefault();
        const button = $(this);
        const carId = Security.sanitizeId(button.data('car-id'));
        const market = Security.sanitizeId(button.data('market'));

        if (!carId || !market) {
            safeAlert('Неверные параметры автомобиля');
            return;
        }

        button.prop('disabled', true).text('Загрузка...');

        $.post(ajaxurl, {
            action: 'car_auction_get_car_url',
            nonce: carAuctionAdmin.nonce,
            car_id: carId,
            market: market
        }, function(response) {
            if (response.success && response.data.url) {
                window.open(response.data.url, '_blank');
            } else {
                safeAlert('Ошибка получения URL автомобиля: ' + (response.data || 'Неизвестная ошибка'));
            }
        }).fail(function() {
            safeAlert('Ошибка соединения');
        }).always(function() {
            button.prop('disabled', false).text('Посмотреть');
        });
    });

    // Safe delete function
    $(document).on('click', '.delete-single-car', function() {
        if (confirm('Вы уверены, что хотите удалить этот автомобиль из индекса?')) {
            const button = $(this);
            const carId = Security.sanitizeId(button.data('id'));

            if (!carId) {
                safeAlert('Неверный ID автомобиля');
                return;
            }

            $.post(ajaxurl, {
                action: 'car_auction_delete_car',
                nonce: carAuctionAdmin.nonce,
                car_id: carId
            }, function(response) {
                if (response.success) {
                    button.closest('tr').fadeOut(function() {
                        $(this).remove();
                    });
                } else {
                    safeAlert('Ошибка удаления: ' + (response.data || 'Неизвестная ошибка'));
                }
            });
        }
    });
});

// Global function with security
function resetAllCronJobs() {
    if (!confirm('Переназначить все cron-задачи плагина? Это пересоздаст все расписания задач.')) {
        return;
    }

    const resultDiv = jQuery('#cron-reset-result');
    const nonce = (typeof carAuctionAdmin !== 'undefined') ? carAuctionAdmin.nonce : jQuery('#car_auction_admin_nonce').val();

    resultDiv.html('<p style="color: #0073aa;">⏳ Переназначение cron-задач...</p>');

    jQuery.post(ajaxurl, {
        action: 'car_auction_reset_all_cron_jobs',
        nonce: nonce
    }, function(response) {
        if (response.success) {
            resultDiv.html('<p style="color: #007cba; font-weight: bold;">✅ ' +
                Security.escapeHtml(response.data.message) + '</p>');
        } else {
            resultDiv.html('<p style="color: #d63638; font-weight: bold;">❌ Ошибка: ' +
                Security.escapeHtml(response.data || 'Неизвестная ошибка') + '</p>');
        }
    }).fail(function() {
        resultDiv.html('<p style="color: #d63638; font-weight: bold;">❌ Ошибка соединения</p>');
    });
}