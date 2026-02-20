const AJESProvider = require('./ajes/AJESProvider');
const Che168Provider = require('./che-168/Che168Provider');

class ProviderFactory {
    constructor() {
        this.providers = {
            'ajes': new AJESProvider(),
            'che-168': new Che168Provider()
        };
    }

    getProvider(providerName) {
        const provider = this.providers[providerName];
        if (!provider) {
            throw new Error(`Provider ${providerName} not found`);
        }
        return provider;
    }

    getAvailableProviders() {
        return Object.keys(this.providers);
    }
}

module.exports = new ProviderFactory();