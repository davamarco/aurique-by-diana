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

1. Оригиналы кладём в `photos-src/` (эта папка не попадает в git):
   - `photos-src/hero/`, `photos-src/about/`, `photos-src/services/`
   - `photos-src/gallery/manicure/`, `…/pedicure/`, `…/extensions/`
   - `photos-src/logo.jpg`
2. Запускаем `npm install` (один раз), затем `npm run images`.
3. Скрипт создаёт WebP нескольких размеров в `assets/img/` и обновляет `js/gallery-data.js`.
   Галерея и пункт меню «Work» появляются сами, как только в ней есть хотя бы одно фото.

## Локальный просмотр

`npm run serve`, затем открыть http://localhost:8080

## Деплой

GitHub → Settings → Pages → Deploy from branch → `main` / root.
Домен задан в файле `CNAME`; у регистратора нужно прописать DNS-записи для GitHub Pages.
