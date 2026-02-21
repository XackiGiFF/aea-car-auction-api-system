# Docker Orchestration (AEA)

Docker orchestration для сервисов `aea-car-auction-api-system`.

## Файлы

- `compose.base.yml` базовая сеть/volumes/имя проекта
- `compose.aea.dev.yml` dev-режим (build + bind-mount)
- `compose.aea.prod.yml` prod-режим (images из GHCR)
- `.env.example` шаблон orchestrator-переменных
- `docker-compose.prod.yml` legacy-файл для совместимости

## Команды

Рабочая директория: `backend_nodejs/aea-car-auction-api-system`

- `make dev-up`
- `make dev-down`
- `make prod-pull`
- `make prod-up`
- `make config`

Или напрямую:
- `./scripts/compose.sh dev up -d --build`
- `./scripts/compose.sh prod up -d`

## Важно

- Все сервисы живут в общей сети `aea_network`.
- Прод-стек запускается как `v2`-сервисы (`api-gateway-v2`, `calc-bot-v2`, `che-parser-bot-v2`, `api-mariadb-v2`) для безопасного параллельного запуска со старым продом.
- Прод `api-gateway` не публикует порт на хост; доступ к нему из `nginx` через Docker DNS `api-gateway-v2:3000`.
- Для связки со старым сайтом используется внешняя сеть `LEGACY_SITE_NETWORK_NAME` (по умолчанию `simpleweb_aea_network`).
- Для `api-mariadb-v2` добавлены алиасы `api_mariadb_v2` и `api-mariadb-v2` в общей сети со старым сайтом (совместимость старых и новых конфигов).
- Для `che-parser-bot-v2` выделен volume `che_media_data` под локально скачанные изображения (`/app/media`).
- Для prod использовать image tags вместо `latest`.
- Файлы `.env` сервисов хранятся вне git.

## Смежные документы

- Backend docs: `backend_nodejs/aea-car-auction-api-system/README.md`
- API gateway docs: `backend_nodejs/aea-car-auction-api-system/api-gateway/README.md`
