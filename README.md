# ASIAEXPRESSAUTO.RU Monorepo

Единый репозиторий проекта с двумя основными зонами:
- Node.js backend-система аукционов (`aea-car-auction-api-system`)
- WordPress-часть (тема и плагин)

## Быстрая навигация

- Backend: `backend_nodejs/README.md`
- AEA система: `backend_nodejs/aea-car-auction-api-system/README.md`
- CI/CD pipelines: `.github/README.md`
- WordPress зона: `wp_sources_php/README.md`
- WordPress plugin delivery: `wp_sources_php/wp_plugin/README.md`

## Структура репозитория

- `backend_nodejs/`
  - `aea-car-auction-api-system/` сервисы API/ботов + Docker orchestration
- `wp_sources_php/`
  - `wp_plugin/` WordPress plugin исходники
  - `wp_theme/` PHP-тема
- `.github/workflows/`
  - CI/CD workflows для backend и plugin release
- `scripts/`
  - служебные скрипты верхнего уровня

## Принципы разработки

- Сервисы разделены логически, но работают в общей Docker-сети.
- В проде backend должен запускаться из immutable image (GHCR), без bind-mount кода.
- WordPress plugin собирается в ZIP через GitHub Actions и публикуется в релиз.
- Секреты (`.env`) не коммитятся, в git хранятся только `*.env.example`.

## Документация по продуктам

- API gateway: `backend_nodejs/aea-car-auction-api-system/api-gateway/README.md`
- Calc bot: `backend_nodejs/aea-car-auction-api-system/calc-bot/README.md`
- Che parser bot: `backend_nodejs/aea-car-auction-api-system/che-parser-bot/README.md`
- Docker orchestration: `backend_nodejs/aea-car-auction-api-system/infra/docker/README.md`
- WordPress theme: `wp_sources_php/wp_theme/README.md`
