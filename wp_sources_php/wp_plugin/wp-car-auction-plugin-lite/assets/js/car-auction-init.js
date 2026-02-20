/**
 * Car Auction Init - Secure Module Initialization
 * Production-ready version with security enhancements
 */
jQuery(document).ready(function($) {
    // Security configuration
    const config = window.carAuctionConfig || {
        debug: false,
        logLevel: 'error' // error, warn, info, debug
    };

    // Secure logging function
    function secureLog(level, message, data = {}) {
        if (!config.debug) return;

        const levels = { error: 1, warn: 2, info: 3, debug: 4 };
        if (levels[level] > levels[config.logLevel]) return;

        const safeData = { ...data };
        // Never log sensitive information
        if (safeData.nonce) safeData.nonce = '****';
        if (safeData.ajaxUrl) safeData.ajaxUrl = safeData.ajaxUrl.replace(/nonce=[^&]*/, 'nonce=***');

        console[level]('CarAuctionInit:', message, safeData);
    }

    // Secure alert function
    function secureAlert(message) {
        const div = document.createElement('div');
        div.textContent = message;
        alert(div.innerHTML); // XSS protection
    }

    // Safe nonce retrieval
    function getSecureNonce() {
        const sources = [
            () => window.carAuction?.nonce,
            () => document.querySelector('meta[name="car-auction-nonce"]')?.getAttribute('content'),
            () => document.querySelector('#car_auction_nonce')?.value,
            () => document.querySelector('input[name="car_auction_nonce"]')?.value
        ];

        for (const source of sources) {
            try {
                const nonce = source();
                if (nonce && typeof nonce === 'string' && nonce.match(/^[a-zA-Z0-9]+$/)) {
                    return nonce;
                }
            } catch (error) {
                secureLog('debug', 'Nonce source error', { error: error.message });
            }
        }

        secureLog('warn', 'No valid nonce found');
        return '';
    }

    // Safe URL retrieval
    function getSecureAjaxUrl() {
        const sources = [
            () => window.carAuction?.ajaxUrl,
            () => typeof ajaxurl !== 'undefined' ? ajaxurl : null,
            () => '/wp-admin/admin-ajax.php'
        ];

        for (const source of sources) {
            try {
                const url = source();
                if (url && typeof url === 'string') {
                    return url;
                }
            } catch (error) {
                secureLog('debug', 'URL source error', { error: error.message });
            }
        }

        return '/wp-admin/admin-ajax.php';
    }

    // Initialize or create carAuction object securely
    if (typeof window.carAuction === 'undefined') {
        window.carAuction = {
            ajaxUrl: getSecureAjaxUrl(),
            nonce: getSecureNonce(),
            loading: 'Загрузка...',
            noResults: 'Ничего не найдено'
        };
        secureLog('info', 'Fallback carAuction object created');
    }

    // Ensure required properties
    if (!window.carAuction.ajaxUrl) {
        window.carAuction.ajaxUrl = getSecureAjaxUrl();
        secureLog('warn', 'ajaxUrl was missing, using fallback');
    }

    if (!window.carAuction.nonce) {
        window.carAuction.nonce = getSecureNonce();
        secureLog('warn', 'nonce was missing, using fallback');
    }

    // Secure module initialization
    function initializeModule(moduleName, ClassName, globalVarName) {
        if (typeof ClassName === 'undefined') {
            secureLog('debug', `${moduleName} class not available`);
            return false;
        }

        if (window[globalVarName]) {
            secureLog('debug', `${moduleName} already initialized`);
            return true;
        }

        try {
            window[globalVarName] = new ClassName();
            secureLog('info', `${moduleName} initialized successfully`);
            return true;
        } catch (error) {
            secureLog('error', `Failed to initialize ${moduleName}`, {
                error: error.message
            });
            return false;
        }
    }

    // Initialize core modules
    initializeModule('CarAuctionCore', CarAuctionCore, 'carAuctionCore');
    initializeModule('CarSearchUnified', CarSearchUnified, 'carSearch');
    initializeModule('CarNavigation', CarNavigation, 'carNavigation');

    // Secure AJAX error handling
    $(document).ajaxError(function(event, xhr, settings, error) {
        if (settings.url && settings.url.includes('admin-ajax.php')) {
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

            secureLog('error', 'AJAX request failed', safeError);
        }
    });

    // Secure error display function
    window.showCarAuctionError = function(message) {
        if (typeof message !== 'string') {
            secureLog('error', 'Invalid error message type');
            return;
        }

        secureLog('error', 'User error displayed', { message: message });
        secureAlert('Ошибка: ' + message);
    };

    // Secure debug functionality
    window.CarAuction = {
        core: () => window.carAuctionCore,
        search: () => window.carSearch,
        navigation: () => window.carNavigation,

        debug: {
            enable: () => {
                window.carAuctionDebug = true;
                config.debug = true;
                secureLog('info', 'Debug mode enabled');
            },
            disable: () => {
                window.carAuctionDebug = false;
                config.debug = false;
                secureLog('info', 'Debug mode disabled');
            },
            testAjax: () => {
                if (window.carAuctionCore) {
                    return window.carAuctionCore.debug().testAjax();
                }
                secureLog('error', 'CarAuctionCore not available for testing');
                return null;
            },
            info: () => ({
                ajaxUrl: window.carAuction.ajaxUrl,
                hasNonce: !!window.carAuction.nonce,
                modules: {
                    core: !!window.carAuctionCore,
                    search: !!window.carSearch,
                    navigation: !!window.carNavigation
                }
            })
        }
    };

    secureLog('info', 'Initialization complete');
});

// Default safe configuration
if (typeof window.carAuctionConfig === 'undefined') {
    window.carAuctionConfig = {
        debug: false,
        logLevel: 'error',
        ajaxTimeout: 30000
    };
}