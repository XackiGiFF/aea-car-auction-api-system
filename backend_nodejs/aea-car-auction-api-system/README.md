# aea-car-auction-api-system

Набор сервисов для аукционного API:
- `api-gateway`
- `calc-bot`
- `che-parser-bot`
- `sync-bot` (временно отключен)

## Принцип запуска

Сервисы остаются раздельными, но запускаются как один Compose-проект:
- общая сеть
- единый lifecycle (`up/down/logs`)
- отдельные профили для dev/prod через разные `-f` файлы

## Навигация по подсистемам

- API gateway: `backend_nodejs/aea-car-auction-api-system/api-gateway/README.md`
- Calc bot: `backend_nodejs/aea-car-auction-api-system/calc-bot/README.md`
- Che parser bot: `backend_nodejs/aea-car-auction-api-system/che-parser-bot/README.md`
- Infrastructure: `backend_nodejs/aea-car-auction-api-system/infra/README.md`
- Docker orchestration: `backend_nodejs/aea-car-auction-api-system/infra/docker/README.md`
- Scripts: `backend_nodejs/aea-car-auction-api-system/scripts/README.md`
- Shared package plan: `backend_nodejs/aea-car-auction-api-system/packages/shared/README.md`

Файлы:
- `infra/docker/compose.base.yml`
- `infra/docker/compose.aea.dev.yml`
- `infra/docker/compose.aea.prod.yml`
- `scripts/compose.sh`
- `packages/shared/` (каркас под общий код)

## Быстрый старт

1. Создать env для orchestration:
```bash
cp infra/docker/.env.example infra/docker/.env
```
2. Подготовить сервисные env:
- `api-gateway/.env`
- `calc-bot/.env`
- `che-parser-bot/.env`
3. Запуск dev:
```bash
make dev-up
```

## Команды

- `make dev-up` / `make dev-down` / `make dev-logs`
- `make prod-pull` / `make prod-up` / `make prod-down` / `make prod-logs`
- `make config` для проверки итогового compose-конфига

Эквивалент вручную:
```bash
./scripts/compose.sh prod up -d --remove-orphans
```

## CI/CD

`CI` (`.github/workflows/ci.yml`):
- проверяет сервисы отдельно (`npm install`, `lint/test/build --if-present`)
- проверяет сборку Docker-образов

`CD` (`.github/workflows/cd.yml`):
- на тегах `v*` собирает и пушит образы в GHCR
- при наличии deploy secrets выполняет на сервере:
  - `compose pull`
  - `compose up -d`

## Плавная миграция с текущего прода

1. Оставить текущую сеть `aea_network`.
2. На сервере добавить новые compose-файлы и `infra/docker/.env`.
3. Запустить `make config` и проверить итоговую конфигурацию.
4. Выполнить `make prod-pull`, затем `make prod-up`.
5. После успешного переключения убрать legacy `build + volumes` для Node в проде.

## Общий код (next step)

Следующий безопасный этап:
1. создать `packages/shared`
2. вынести общий DB-клиент из `config/database.js`
3. подключать shared поэтапно, сервис за сервисом
