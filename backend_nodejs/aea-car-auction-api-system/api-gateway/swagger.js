const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Car Auction API',
            version: '2.0.0',
            description: 'API для работы с аукционными автомобилями',
            contact: {
                name: 'API Support',
                email: 'support@mc-mpe.ru'
            }
        },
        servers: [
            {
                url: 'https://asiaexpressauto.ru',
                description: 'Server'
            }
        ],
        components: {
            securitySchemes: {
                ApiKeyAuth: {
                    type: 'apiKey',
                    in: 'query',
                    name: 'code'
                }
            }
        }
    },
    apis: ['./api/*.js', './models/*.js'], // пути к файлам с JSDoc комментариями
};

const specs = swaggerJsdoc(options);

module.exports = { specs, swaggerUi };