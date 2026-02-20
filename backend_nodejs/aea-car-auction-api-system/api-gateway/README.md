# API Gateway

Основной HTTP API сервис системы.

## Роль

- Принимает запросы от frontend/WordPress
- Работает с БД `api_mariadb`
- Отдает данные по машинам и связанным сущностям
- Триггерит on-demand пересчет цены через `calc-bot` при запросе карточки авто

## Запуск

Локально через общий orchestration:
- `make dev-up` из `backend_nodejs/aea-car-auction-api-system`

## Конфигурация

- `.env` (локально/на сервере)
- шаблон: `.env.example`
- Важные переменные для on-demand расчета:
  - `ON_DEMAND_CALC_ENABLED`
  - `ON_DEMAND_CALC_TIMEOUT_MS`
  - `CALC_BOT_URL`
  - `CALC_BOT_INTERNAL_TOKEN`

## Смежные документы

- Система в целом: `backend_nodejs/aea-car-auction-api-system/README.md`
- Docker orchestration: `backend_nodejs/aea-car-auction-api-system/infra/docker/README.md`
