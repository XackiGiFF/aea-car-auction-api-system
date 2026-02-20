# WordPress Plugin Delivery

Плагин: `wp-car-auction-plugin-lite`

## Навигация

- WordPress area: `wp_sources_php/README.md`
- Root docs: `README.md`
- CI/CD docs: `.github/README.md`

## CI (сборка)

Workflow: `.github/workflows/wp-plugin-ci.yml`

Триггеры:
- `pull_request` при изменениях в `wp_sources_php/wp_plugin/wp-car-auction-plugin-lite/**`
- `push` в `main` при изменениях в плагине

Что делает:
1. читает текущую версию из `wp-car-auction-plugin-lite.php`
2. собирает ZIP плагина
3. публикует ZIP как artifact

## Release (версионирование + релиз)

Workflow: `.github/workflows/wp-plugin-release.yml`

Триггеры:
- автоматически на `push` в `main` при изменениях плагина (bump `patch`)
- вручную (`workflow_dispatch`) с выбором `patch|minor|major`

Что делает:
1. увеличивает версию в `wp-car-auction-plugin-lite.php`
2. коммитит новый номер версии
3. собирает ZIP
4. создает GitHub Release с тегом `wp-plugin-vX.Y.Z`
5. прикладывает ZIP к релизу

Скрипт bump: `scripts/bump_wp_plugin_version.sh`
