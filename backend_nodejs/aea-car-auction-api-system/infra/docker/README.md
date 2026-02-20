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
- `./scripts/compose.sh prod up -d --remove-orphans`

## Важно

- Все сервисы живут в общей сети `aea_network`.
- Для prod использовать image tags вместо `latest`.
- Файлы `.env` сервисов хранятся вне git.

## Смежные документы

- Backend docs: `backend_nodejs/aea-car-auction-api-system/README.md`
- API gateway docs: `backend_nodejs/aea-car-auction-api-system/api-gateway/README.md`
