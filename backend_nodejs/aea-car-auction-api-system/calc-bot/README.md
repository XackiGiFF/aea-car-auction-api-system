# Calc Bot

Фоновый сервис расчета цен и обновления связанных данных.

## Роль

- Периодические вычисления
- Запись результатов в `api_mariadb`

## Запуск

Через общий compose:
- `make dev-up` или `make prod-up`

## Конфигурация

- `.env` файл
- шаблон: `.env.example`

## Смежные документы

- Система в целом: `backend_nodejs/aea-car-auction-api-system/README.md`
- Docker orchestration: `backend_nodejs/aea-car-auction-api-system/infra/docker/README.md`
