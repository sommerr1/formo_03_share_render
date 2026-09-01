# formo_03_share_render

Удалённый GLB-viewer для Formo с TTL на [Netlify](https://www.netlify.com/).

## API

### Chunked upload (Formo, GLB до 150 MB)

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| POST | `/api/upload/chunked/init` | Bearer | `{ expiresAt, totalChunks, fileSizeBytes }` → `{ token, url, … }` |
| PUT | `/api/upload/chunked/:token/:index` | Bearer | binary chunk (max 4 MB) |
| POST | `/api/upload/chunked/:token/complete` | Bearer | собрать GLB из частей |

Части: **4 MB**. Сервер склеивает в `{token}.glb` при `complete`.

### Legacy / small files

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| POST | `/api/upload` | Bearer | multipart ≤ ~5 MB |
| GET | `/api/models/:token` | — | meta `{ createdAt, expiresAt }` |
| PATCH | `/api/models/:token` | Bearer | `{ expiresAt }` |
| DELETE | `/api/models/:token` | Bearer | удалить модель |
| GET | `/api/models/:token/file` | — | GLB binary |
| GET | `/api/models/:token/overlay` | — | dims + anim JSON (404 если нет) |
| PUT | `/api/models/:token/overlay` | Bearer | sidecar v1 после upload |

Viewer: `/v/:token` — **32-символьный** код в URL, доступен всем, у кого есть ссылка.

Пример: `https://your-site.netlify.app/v/aB3xK9mN2pQ7rT5vW8yZ1cD4fG6hJ0kL`

## ADMIN_SECRET (не путать с кодом ссылки)

Это **твой личный API-ключ** для upload/patch/delete из Formo. Система его не выдаёт — **генерируешь один раз сам**:

```bash
openssl rand -hex 32
```

Или любой password generator (64+ символов ок).

1. Netlify → Site → Environment variables → `ADMIN_SECRET`
2. Formo → `.env.local` → `VITE_REMOTE_RENDER_SECRET` (тот же текст)
   или в модалке «Поделиться» → Admin secret

Без этого секрета заливка из Formo вернёт 401. Зрителям секрет **не нужен** — только ссылка `/v/{token}`.

## Env (Netlify)

- `ADMIN_SECRET` — см. выше
- `ALLOWED_ORIGIN` — CORS (default `*`)
- `URL` — Netlify подставляет сам; из него собирается итоговый viewer-URL

## Local dev

```bash
npm install
cp .env.example .env
npm run dev
```

## Deploy

1. Push в [formo_03_share_render](https://github.com/sommerr1/formo_03_share_render)
2. Netlify → Import repo → Build `npm run build`, publish `dist`
3. Env: `ADMIN_SECRET`
4. Тот же secret в Formo (`VITE_REMOTE_RENDER_SECRET`)

## Formo

См. epic KB-254 / KB-258 в `formo_03`.
