# GitHub Automation

Документация по GitHub Actions и автоматизации репозитория.

## Workflows

- Общий CI backend: `.github/workflows/ci.yml`
- CD сборка/push backend images: `.github/workflows/cd.yml`
- CI сборка ZIP WordPress plugin: `.github/workflows/wp-plugin-ci.yml`
- Release WordPress plugin: `.github/workflows/wp-plugin-release.yml`

## Ключевые сценарии

1. Backend CI
- Проверяет Node.js сервисы
- Проверяет docker build

2. Backend CD
- На git-тегах `v*` собирает и пушит backend-образы в GHCR
- Автодеплой в prod отключен

3. WP Plugin CI/Release
- Отслеживает изменения в `wp_sources_php/wp_plugin/wp-car-auction-plugin-lite/**`
- Собирает ZIP
- Выпускает релиз с приложенным архивом

## Смежные документы

- WP plugin docs: `wp_sources_php/wp_plugin/README.md`
- Backend docs: `backend_nodejs/aea-car-auction-api-system/README.md`
