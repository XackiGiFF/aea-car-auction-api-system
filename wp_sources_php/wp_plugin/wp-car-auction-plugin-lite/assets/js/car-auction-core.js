/**
 * Car Auction Core - Secure Base Functionality
 * Production-ready version with security enhancements
 */
class CarAuctionCore {
    constructor() {
        this.ajaxUrl = this.getAjaxUrl();
        this.nonce = this.getNonce();
        this.isLoading = false;

        // Safe initialization logging
        this.debugLog('Core initialized', {
            ajaxUrl: this.ajaxUrl,
            hasNonce: !!this.nonce
        });
    }

    getAjaxUrl() {
        // Secure URL retrieval with fallbacks
        if (window.carAuction && window.carAuction.ajaxUrl) {
            return window.carAuction.ajaxUrl;
        }
        if (typeof ajaxurl !== 'undefined') {
            return ajaxurl;
        }
        return '/wp-admin/admin-ajax.php';
    }

    getNonce() {
        // Secure nonce retrieval with multiple fallbacks
        if (window.carAuction && window.carAuction.nonce) {
            return this.sanitizeNonce(window.carAuction.nonce);
        }

        // Try meta tag
        const metaNonce = document.querySelector('meta[name="car-auction-nonce"]');
        if (metaNonce) {
            return this.sanitizeNonce(metaNonce.getAttribute('content'));
        }

        // Try hidden field
        const nonceField = document.querySelector('#car_auction_nonce');
        if (nonceField) {
            return this.sanitizeNonce(nonceField.value);
        }

        this.debugLog('No nonce found, AJAX requests may fail');
        return '';
    }

    sanitizeNonce(nonce) {
        if (typeof nonce !== 'string') return '';
        // Allow only alphanumeric characters for nonce
        return nonce.replace(/[^a-zA-Z0-9]/g, '');
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        // Basic XSS protection
        return input.replace(/[<>"'`]/g, '').trim();
    }

    sanitizeObject(data) {
        const sanitized = {};
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                if (typeof data[key] === 'string') {
                    sanitized[key] = this.sanitizeInput(data[key]);
                } else {
                    sanitized[key] = data[key];
                }
            }
        }
        return sanitized;
    }

    request(action, data = {}, callback = null) {
        if (this.isLoading) {
            this.debugLog('Request skipped - already loading');
            return null;
        }

        this.isLoading = true;
        const sanitizedAction = this.sanitizeInput(action);
        const sanitizedData = this.sanitizeObject(data);

        const requestData = {
            action: sanitizedAction,
            nonce: this.nonce,
            ...sanitizedData
        };

        this.debugLog('Making request', {
            action: sanitizedAction,
            hasNonce: !!this.nonce
        });

        return $.ajax({
            url: this.ajaxUrl,
            type: 'POST',
            data: requestData,
            timeout: 30000,
            dataType: 'json',
            success: (response) => {
                this.handleSuccess(sanitizedAction, response, callback);
            },
            error: (xhr, status, error) => {
                this.handleError(sanitizedAction, xhr, status, error, callback);
            },
            complete: () => {
                this.isLoading = false;
            }
        });
    }

    handleSuccess(action, response, callback) {
        this.debugLog('Request successful', {
            action: action,
            success: response?.success
        });

        if (callback && typeof callback === 'function') {
            try {
                callback(response);
            } catch (error) {
                this.debugLog('Callback error', { error: error.message });
            }
        }
    }

    handleError(action, xhr, status, error, callback) {
        const safeError = {
            status: xhr.status,
            action: action,
            isTimeout: status === 'timeout'
        };

        // Safe error logging
        this.debugLog('Request failed', safeError);

        if (callback && typeof callback === 'function') {
            try {
                callback(null, safeError);
            } catch (error) {
                this.debugLog('Error callback failed', { error: error.message });
            }
        }
    }

    debugLog(message, data = {}) {
        // Only log in debug mode
        if (window.carAuctionConfig && window.carAuctionConfig.debug) {
            const safeData = { ...data };

            // Never log nonce value
            if (safeData.nonce) safeData.nonce = '****';
            if (safeData.hasNonce !== undefined) safeData.hasNonce = !!safeData.hasNonce;

            console.log('CarAuctionCore:', message, safeData);
        }
    }

    // Secure debug functionality
    debug() {
        return {
            ajaxUrl: this.ajaxUrl,
            hasNonce: !!this.nonce,
            isLoading: this.isLoading,
            testAjax: () => {
                this.debugLog('Testing AJAX connection');
                this.request('car_auction_test', { test: 'ping' }, (response, error) => {
                    if (error) {
                        this.debugLog('AJAX test failed', { error: error.message });
                    } else {
                        this.debugLog('AJAX test successful', {
                            success: response?.success
                        });
                    }
                });
            }
        };
    }
}

// Secure global initialization
let isInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
    if (!isInitialized && !window.carAuctionCore) {
        isInitialized = true;
        window.carAuctionCore = new CarAuctionCore();

        if (window.carAuctionConfig && window.carAuctionConfig.debug) {
            console.log('CarAuctionCore: Global instance created securely');
        }
    }
});

// Fallback for immediate usage
if (!window.CarAuctionCore) {
    window.CarAuctionCore = CarAuctionCore;
}

// Default config if not set
if (typeof window.carAuctionConfig === 'undefined') {
    window.carAuctionConfig = {
        debug: false,
        ajaxTimeout: 30000
    };
}