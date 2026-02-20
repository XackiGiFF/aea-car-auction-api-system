# API Gateway

Основной HTTP API сервис системы.

## Роль

- Принимает запросы от frontend/WordPress
- Работает с БД `api_mariadb`
- Отдает данные по машинам и связанным сущностям

## Запуск

Локально через общий orchestration:
- `make dev-up` из `backend_nodejs/aea-car-auction-api-system`

## Конфигурация

- `.env` (локально/на сервере)
- шаблон: `.env.example`

## Смежные документы

- Система в целом: `backend_nodejs/aea-car-auction-api-system/README.md`
- Docker orchestration: `backend_nodejs/aea-car-auction-api-system/infra/docker/README.md`
