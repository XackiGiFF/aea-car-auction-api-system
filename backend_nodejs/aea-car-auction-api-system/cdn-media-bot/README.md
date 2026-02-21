# CDN Media Bot

Внутренний сервис для скачивания изображений с доноров и сохранения в локальное хранилище.

## Зачем

- Донор блокирует hotlink по `Referer` (403 в браузере)
- Нужно хранить локальные копии изображений и отдавать свои URL
- Нужна внутренняя защита вызовов токеном

## API

- `GET /health`
- `POST /internal/media/fetch`
- `GET /cdn/media/*` (статическая раздача сохраненных файлов)
- `GET /cdn/media/*?w=320` (ресайз до ширины 320 с кешированием)
- Legacy поддержка: `GET /cdn/media/.../01.webp&w=320`

Требования к `POST /internal/media/fetch`:
- Header `x-media-token: <MEDIA_ACCESS_TOKEN>`
- Body JSON:
  - `source_url` (обязательно)
  - `provider` (например `che168`)
  - `brand`, `model`, `car_id`
  - `image_index` (по умолчанию `1`)

Ответ:
- `ok`, `url`, `cached`

## Хранилище

Путь: `MEDIA_ROOT/<provider>/<brand>/<model>/<car_id>/<NN>.<ext>`

Ресайз `w=320` сохраняется в подпапку кеша: `MEDIA_ROOT/_resized/...`

## Nginx (prod) пример

```nginx
location /cdn/media/ {
    proxy_pass http://cdn-media-bot-v2:3010/cdn/media/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Смежные документы

- Система: `backend_nodejs/aea-car-auction-api-system/README.md`
- Docker orchestration: `backend_nodejs/aea-car-auction-api-system/infra/docker/README.md`
