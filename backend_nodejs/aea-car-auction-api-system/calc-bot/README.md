# Calc Bot

Фоновый сервис расчета цен и обновления связанных данных.

## Роль

- Периодические вычисления
- Запись результатов в `api_mariadb`
- On-demand пересчет одной машины через внутренний endpoint `POST /internal/recalculate`

## Запуск

Через общий compose:
- `make dev-up` или `make prod-up`

## Конфигурация

- `.env` файл
- шаблон: `.env.example`
- Для внутреннего API:
  - `PORT`
  - `CALC_BOT_INTERNAL_TOKEN`

## Смежные документы

- Система в целом: `backend_nodejs/aea-car-auction-api-system/README.md`
- Docker orchestration: `backend_nodejs/aea-car-auction-api-system/infra/docker/README.md`
