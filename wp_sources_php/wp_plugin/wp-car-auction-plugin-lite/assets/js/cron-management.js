/**
 * Cron Management JavaScript
 * Handles AJAX requests for cron job management
 */

jQuery(document).ready(function($) {
    // Ensure ajaxurl is available
    if (typeof ajaxurl === 'undefined') {
        window.ajaxurl = carAuctionCron.ajaxUrl;
    }

    // Global function for running cron jobs
    window.runCronJob = function(hook) {
        console.log('runCronJob called with hook:', hook);
        
        if (!confirm('Запустить задачу "' + hook + '" прямо сейчас?')) {
            return;
        }

        var button = event.target;
        var originalText = button.textContent;
        button.disabled = true;
        button.textContent = '⏳ Выполняется...';

        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'car_auction_run_cron_job',
                hook: hook,
                nonce: carAuctionCron.nonce
            },
            success: function(response) {
                console.log('AJAX response:', response);
                if (response.success) {
                    alert('✅ Задача выполнена: ' + response.data.message);
                    location.reload();
                } else {
                    alert('❌ Ошибка: ' + response.data);
                }
            },
            error: function(xhr, status, error) {
                console.error('AJAX Error:', xhr.responseText);
                alert('❌ Ошибка AJAX запроса: ' + error);
            },
            complete: function() {
                button.disabled = false;
                button.textContent = originalText;
            }
        });
    };

    // Global function for toggling cron jobs
    window.toggleCronJob = function(hook) {
        console.log('toggleCronJob called with hook:', hook);
        
        var button = event.target;
        var originalText = button.textContent;
        button.disabled = true;
        button.textContent = '⏳ Переключается...';

        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'car_auction_toggle_cron_job',
                hook: hook,
                nonce: carAuctionCron.nonce
            },
            success: function(response) {
                if (response.success) {
                    alert('✅ ' + response.data.message);
                    location.reload();
                } else {
                    alert('❌ Ошибка: ' + response.data);
                }
            },
            error: function(xhr, status, error) {
                console.error('AJAX Error:', xhr.responseText);
                alert('❌ Ошибка AJAX запроса: ' + error);
            },
            complete: function() {
                button.disabled = false;
                button.textContent = originalText;
            }
        });
    };

    // Global function for resetting all cron jobs
    window.resetAllCronJobs = function() {
        if (!confirm('Переназначить все Cron-задачи? Это очистит текущие расписания и создаст новые.')) {
            return;
        }

        var button = event.target;
        var originalText = button.textContent;
        var resultDiv = document.getElementById('cron-reset-result');
        
        button.disabled = true;
        button.textContent = '⏳ Переназначаем...';
        if (resultDiv) {
            resultDiv.innerHTML = '<p>Переназначение cron-задач...</p>';
        }

        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'car_auction_reset_all_crons',
                nonce: carAuctionCron.nonce
            },
            success: function(response) {
                if (response.success) {
                    if (resultDiv) {
                        resultDiv.innerHTML = '<div style="color: green;">✅ ' + response.data.message + '</div>';
                    }
                    setTimeout(function() { location.reload(); }, 2000);
                } else {
                    if (resultDiv) {
                        resultDiv.innerHTML = '<div style="color: red;">❌ Ошибка: ' + response.data + '</div>';
                    }
                }
            },
            error: function(xhr, status, error) {
                if (resultDiv) {
                    resultDiv.innerHTML = '<div style="color: red;">❌ Ошибка AJAX запроса: ' + error + '</div>';
                }
            },
            complete: function() {
                button.disabled = false;
                button.textContent = originalText;
            }
        });
    };
});
