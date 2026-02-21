# Che Parser Bot

Сервис парсинга данных из источников по китайским авто.

## Роль

- Сбор и нормализация данных
- Запись в `api_mariadb`

## Запуск

Через общий compose:
- `make dev-up` или `make prod-up`

## Конфигурация

- `.env` файл
- шаблон: `.env.example`
- Локальный CDN для изображений (опционально):
  - `CHE_MEDIA_DOWNLOAD_ENABLED=true`
  - `CHE_MEDIA_ROOT=/app/media`
  - `CHE_MEDIA_BASE_URL=https://asiaexpressauto.ru/cdn/media`

## Что делает воркер

- Нормализует `MARKA_NAME`/`MODEL_NAME` в ASCII (без иероглифов, где это возможно)
- Заполняет `PRIV` (привод), `KPP`/`KPP_TYPE`, `TIME` (топливо), `ENG_V`
- Может скачивать фото локально и сохранять в БД уже URL вашего CDN

## Смежные документы

- Система в целом: `backend_nodejs/aea-car-auction-api-system/README.md`
- Docker orchestration: `backend_nodejs/aea-car-auction-api-system/infra/docker/README.md`
