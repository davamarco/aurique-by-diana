# auriquebydiana.com

Сайт студии Aurique by Diana. Статический сайт на чистых HTML/CSS/JS без сборки, хостинг на GitHub Pages.

## Структура

- `index.html`: вся страница; английские тексты лежат прямо в разметке
- `js/i18n.js`: испанские тексты (ключи совпадают с `data-i18n` в разметке)
- `js/config.js`: ссылка на Square, WhatsApp, почта, ключ формы, ID ленты Instagram
- `js/reviews-data.js`: отзывы (только реальные, из Google)
- `js/gallery-data.js`: генерируется автоматически, руками не редактировать
- `css/styles.css`: все стили; палитра и шрифты заданы токенами в `:root`

## Фото

Оригиналы лежат в `photos-src/` (в git не попадают):

- `photos-src/hero/`, `photos-src/about/`, `photos-src/decor/`, `photos-src/logo.jpg`
- `photos-src/gallery/<manicure|pedicure|extensions>/<услуга>__<описание>.jpg`.
  Часть имени до `__` привязывает фото к строке прайса с тем же `data-service`:
  `builder-gel`, `builder-gel-long`, `extensions`, `gel-pedicure`.
  Например: `photos-src/gallery/manicure/builder-gel__nude-glazed.jpg`.
- `photos-src/_ai-generated-not-used/`: сгенерированные картинки, на сайте не используются.

После добавления фото запусти `npm run images`: скрипт создаёт WebP в `assets/img/` и обновляет `js/gallery-data.js`.
Порядок показа, фото-обложку каждой услуги и подписи (EN/ES) задаёт `js/gallery-meta.js`.
Новому фото без подписи достаётся общая подпись по категории, а в сетке оно встаёт в конец.

## Локальный просмотр

`npm run serve`, затем открыть http://localhost:8080

## Деплой

GitHub → Settings → Pages → Deploy from branch → `main` / root.
Домен задан в файле `CNAME`; у регистратора нужно прописать DNS-записи для GitHub Pages.
