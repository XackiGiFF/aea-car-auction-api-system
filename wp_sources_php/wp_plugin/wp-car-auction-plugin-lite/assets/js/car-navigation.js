/**
 * Car Navigation - Secure Unified Navigation Handler
 * Production-ready with security enhancements
 */
class CarNavigation extends CarAuctionCore {
    constructor() {
        super();
        this.redirectTimeout = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupErrorHandling();
    }

    bindEvents() {
        // Single event delegation for all navigation buttons
        $(document).on('click', '.car-details-btn, .car-auction-index-btn', this.handleNavigation.bind(this));

        // Card clicks with event delegation optimization
        $(document).on('click', '.one-car-wrapper', this.handleCardClick.bind(this));

        // Reset button handler
        $(document).on('click', '#reset, .car-auction-reset-btn', this.handleReset.bind(this));
    }

    setupErrorHandling() {
        $(document).on('ajaxError', this.handleGlobalAjaxError.bind(this));
    }
    
    /*

    handleNavigation(e) {
        e.preventDefault();
        e.stopPropagation();

        const $button = $(e.currentTarget);
        const carId = this.sanitizeInput($button.data('car-id'));
        const market = this.sanitizeInput($button.data('market') || 'main');
        const brand = this.sanitizeInput($button.data('brand') || '');
        const model = this.sanitizeInput($button.data('model') || '');

        // Validate required parameters
        if (!this.validateNavigationParams(carId, market)) {
            this.handleNavigationError($button, carId, market, brand, model, 'Invalid parameters');
            return;
        }

        this.updateButtonState($button, 'loading');

        this.request('car_auction_check_and_create', {
            car_id: carId,
            market: market
        }, (response, error) => {
            if (error) {
                this.handleNavigationError($button, carId, market, brand, model, error);
                return;
            }

            if (response && response.success && response.data && response.data.redirect_url) {
                this.handleSuccessRedirect($button, response.data);
            } else {
                const errorMsg = (response && response.data) ? response.data : 'Redirect failed';
                this.handleNavigationError($button, carId, market, brand, model, errorMsg);
            }
        });
    }
*/
    handleNavigation(e) {
        e.preventDefault();
        e.stopPropagation();

        const $button = $(e.currentTarget);

        // Получаем raw данные без санитизации (особенно важно для числовых ID)
        const rawCarId = $button.data('car-id');
        const rawMarket = $button.data('market') || 'main';
        const rawBrand = $button.data('brand') || '';
        const rawModel = $button.data('model') || '';

        // Валидируем СЫРЫЕ данные
        if (!this.validateNavigationParams(rawCarId, rawMarket)) {
            this.handleNavigationError($button, rawCarId, rawMarket, rawBrand, rawModel, 'Invalid parameters');
            return;
        }

        // Только после валидации санитизируем для отправки
        const carId = this.sanitizeInput(rawCarId);
        const market = this.sanitizeInput(rawMarket);
        const brand = this.sanitizeInput(rawBrand);
        const model = this.sanitizeInput(rawModel);

        this.updateButtonState($button, 'loading');

        this.request('car_auction_check_and_create', {
            car_id: carId,
            market: market
        }, (response, error) => {
            if (error) {
                this.handleNavigationError($button, carId, market, brand, model, error);
                return;
            }

            if (response && response.success && response.data && response.data.redirect_url) {
                this.handleSuccessRedirect($button, response.data);
            } else {
                const errorMsg = (response && response.data) ? response.data : 'Redirect failed';
                this.handleNavigationError($button, carId, market, brand, model, errorMsg);
            }
        });
    }
    validateNavigationParams(carId, market) {
        // Validate car ID format - allow pure numbers (for bikes) and alphanumeric with underscores/dashes
        if (!carId || !carId.toString().match(/^[a-zA-Z0-9_-]+$/)) {
            this.debugLog('Invalid car ID format', { carId: carId });
            return false;
        }
        // Validate market value
        const validMarkets = ['main', 'korea', 'china', 'bike', 'che_available'];
        if (!validMarkets.includes(market)) {
            this.debugLog('Invalid market', { market: market });
            return false;
        }
        return true;
    }

    updateButtonState($button, state) {
        $button.prop('disabled', state === 'loading');
        const originalHtml = $button.data('original-html') || $button.html();
        $button.data('original-html', originalHtml);

        const stateTexts = {
            loading: '<div class="m-14-600 white">⏳ Загрузка...</div>',
            success: '<div class="m-14-600 white">✅ Готово</div>',
            error: '<div class="m-14-600 white">❌ Ошибка</div>',
        };

        if (stateTexts[state]) {
            $button.html(stateTexts[state]);

            // Restore original text after delay for non-loading states
            if (state !== 'loading') {
                setTimeout(() => {
                    if ($button.data('original-html') === stateTexts[state]) {
                        $button.html(originalHtml).prop('disabled', false);
                    }
                }, 3000);
            }
        }
    }

    handleSuccessRedirect($button, data) {
        if (!data.redirect_url || typeof data.redirect_url !== 'string') {
            this.handleNavigationError($button, '', '', '', '', 'Invalid redirect URL');
            return;
        }

        // Validate redirect URL
        if (!this.isValidUrl(data.redirect_url)) {
            this.handleNavigationError($button, '', '', '', '', 'Invalid redirect URL format');
            return;
        }

        this.updateButtonState($button, 'success');

        // Clear any previous timeout
        if (this.redirectTimeout) {
            clearTimeout(this.redirectTimeout);
        }

        this.redirectTimeout = setTimeout(() => {
            window.location.href = data.redirect_url;
        }, 300);
    }

    isValidUrl(url) {
        try {
            const parsedUrl = new URL(url, window.location.origin);
            // Allow only same-origin URLs or trusted domains
            return parsedUrl.origin === window.location.origin ||
                parsedUrl.hostname.endsWith('aea.kubik.site') ||
                parsedUrl.hostname.endsWith('asiaexpressauto.ru'); // Add your trusted domains
        } catch (error) {
            return false;
        }
    }

    handleNavigationError($button, carId, market, brand, model, error) {
        this.debugLog('Navigation error', {
            carId: carId,
            market: market,
            error: error instanceof Error ? error.message : error
        });

        // Restore button state with delay
        setTimeout(() => {
            const originalHtml = $button.data('original-html');
            if (originalHtml) {
                $button.html(originalHtml).prop('disabled', false);
            }

            // Fallback redirect only if we have valid parameters
            if (carId && market && this.validateNavigationParams(carId, market)) {
                this.fallbackRedirect(carId, market);
            }
        }, 2000);
    }

    fallbackRedirect(carId, market) {
        const marketName = market === 'main' ? 'japan' : market;
        const previewUrl = `${window.location.origin}/cars/${marketName}/${encodeURIComponent(carId)}/`;

        // Additional validation for fallback URL
        if (this.isValidUrl(previewUrl)) {
            window.location.href = previewUrl;
        } else {
            this.debugLog('Invalid fallback URL', { url: previewUrl });
        }
    }

    handleCardClick(e) {
        // Prevent event handling if clicking on interactive elements
        if ($(e.target).closest('.car-details-btn, .button, a, input, select, textarea').length) {
            return;
        }

        const $card = $(e.currentTarget);
        const carUrl = $card.data('car-url');

        // Validate URL before redirecting
        if (carUrl && this.isValidUrl(carUrl)) {
            window.location.href = carUrl;
        } else if ($card.find('.car-details-btn').length) {
            // Trigger click on the first valid button
            const $button = $card.find('.car-details-btn').first();
            if ($button.length) {
                $button.trigger('click');
            }
        }
    }

    handleGlobalAjaxError(event, xhr, settings) {
        if (xhr.status === 401 || xhr.status === 403) {
            // Возможно, nonce устарел - попробуем обновить
            this.nonce = this.getNonce();
            this.debugLog('Nonce refreshed due to auth error');
        }
        if (settings.url.includes('admin-ajax.php')) {
            const safeError = {
                status: xhr.status,
                action: 'unknown',
                isTimeout: xhr.status === 0
            };

            // Safely extract action from request data
            if (settings.data) {
                try {
                    const params = new URLSearchParams(settings.data);
                    safeError.action = params.get('action') || 'unknown';
                } catch (e) {
                    safeError.action = 'parse_error';
                }
            }

            this.debugLog('Global AJAX error', safeError);
        }
    }

    // NEW: Reset button handler
    handleReset(e) {
        e.preventDefault();
        e.stopPropagation();

        console.log('Reset button clicked');

        // Clear URL parameters
        this.clearUrlParameters();

        // Reset form fields
        this.resetFormFields();

        // Reload page to show default results
        setTimeout(() => {
            window.location.href = window.location.origin + window.location.pathname;
        }, 300);
    }

    // NEW: Clear URL parameters
    clearUrlParameters() {
        if (window.history && window.history.replaceState) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            console.log('URL cleaned:', cleanUrl);
        }
    }

    // NEW: Reset form fields
    resetFormFields() {
        // Reset all form inputs
        $('form[data-market], #wf-form-filter').trigger('reset');

        // Reset custom selects
        $('.custom-select-trigger').each(function() {
            const $trigger = $(this);
            const defaultText = $trigger.closest('.facetwp-facet').find('.facet-dropdown-item').first().text();
            $trigger.text(defaultText);
        });

        // Reset dropdown selections
        $('.facet-dropdown-item').removeClass('selected').first().addClass('selected');

        // Reset model field if exists
        $('select[name="model"], .car-auction-model-select')
            .html('<option value="">Все модели</option>')
            .prop('disabled', true);
    }

    debugLog(message, data = {}) {
        // Only log in debug mode
        if (window.carAuctionConfig && window.carAuctionConfig.debug) {
            const safeData = { ...data };
            // Never log sensitive information
            if (safeData.carId) safeData.carId = '***';
            if (safeData.nonce) safeData.nonce = '****';

            console.log('CarNavigation:', message, safeData);
        }
    }
}

// Secure initialization
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Check if CarAuctionCore is available
        if (typeof CarAuctionCore === 'undefined') {
            console.error('CarNavigation: CarAuctionCore is not defined');
            return;
        }

        // Initialize only once
        if (!window.carNavigation) {
            window.carNavigation = new CarNavigation();

            if (window.carAuctionConfig && window.carAuctionConfig.debug) {
                console.log('CarNavigation: Initialized successfully');
            }
        }
    } catch (error) {
        console.error('CarNavigation: Initialization failed', error.message);
    }
});

// Fallback for immediate usage
if (typeof window.CarNavigation === 'undefined') {
    window.CarNavigation = CarNavigation;
}