# Docker Orchestration (AEA)

Docker orchestration для сервисов `aea-car-auction-api-system`.

## Файлы

- `compose.base.yml` базовая сеть/volumes/имя проекта
- `compose.aea.dev.yml` dev-режим (build + bind-mount)
- `compose.aea.prod.yml` prod-режим (images из GHCR)
- `.env.example` шаблон orchestrator-переменных
- `docker-compose.prod.yml` legacy-файл для совместимости
- `nginx/cdn-media.conf.example` пример проксирования `/cdn/media/` на `cdn-media-bot-v2`

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
- Прод-стек запускается как `v2`-сервисы (`api-gateway-v2`, `calc-bot-v2`, `che-parser-bot-v2`, `cdn-media-bot-v2`, `api-mariadb-v2`) для безопасного параллельного запуска со старым продом.
- Прод `api-gateway` не публикует порт на хост; доступ к нему из `nginx` через Docker DNS `api-gateway-v2:3000`.
- Для связки со старым сайтом используется внешняя сеть `LEGACY_SITE_NETWORK_NAME` (по умолчанию `simpleweb_aea_network`).
- Для `api-mariadb-v2` добавлены алиасы `api_mariadb_v2` и `api-mariadb-v2` в общей сети со старым сайтом (совместимость старых и новых конфигов).
- Для `cdn-media-bot-v2` выделен volume `cdn_media_data` под локально скачанные изображения (`/app/media`).
- В `che-parser-bot-v2` по умолчанию включен внутренний вызов `MEDIA_SERVICE_URL=http://cdn-media-bot-v2:3010`.
- `cdn-media-bot-v2` подключен к `legacy_site_network`, чтобы старый `nginx` мог проксировать `/cdn/media/*` на новый сервис.
- Для prod использовать image tags вместо `latest`.
- Файлы `.env` сервисов хранятся вне git.

## Смежные документы

- Backend docs: `backend_nodejs/aea-car-auction-api-system/README.md`
- API gateway docs: `backend_nodejs/aea-car-auction-api-system/api-gateway/README.md`
