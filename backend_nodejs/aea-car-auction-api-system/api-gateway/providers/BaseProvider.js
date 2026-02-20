class BaseProvider {
    constructor() {
        this.name = 'base';
    }

    async getCars(filters = {}, table = 'main', clientIP) {
        throw new Error('Method not implemented');
    }

    async getCarById(carId, table = 'main', clientIP) {
        throw new Error('Method not implemented');
    }

    async getCarPrice(carId, table = 'main') {
        throw new Error('Method not implemented');
    }

    async getDynamicFilters(currentFilters = {}, table = 'main', clientIP) {
        throw new Error('Method not implemented');
    }

    async getTotalCount(filters = {}, table = 'main', clientIP) {
        throw new Error('Method not implemented');
    }

    async getVendors(table = 'main', clientIP) {
        throw new Error('Method not implemented');
    }

    async getModelsByVendor(vendorName, table = 'main', clientIP) {
        throw new Error('Method not implemented');
    }
}

module.exports = BaseProvider;