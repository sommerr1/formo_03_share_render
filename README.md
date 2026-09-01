# formo_03_share_render

Удалённый GLB-viewer для Formo с TTL на [Netlify](https://www.netlify.com/).

## API

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| POST | `/api/upload` | Bearer | multipart: `file`, optional `expiresAt` (ISO) |
| GET | `/api/models/:token` | — | meta `{ createdAt, expiresAt }` |
| PATCH | `/api/models/:token` | Bearer | `{ expiresAt }` |
| DELETE | `/api/models/:token` | Bearer | удалить модель |
| GET | `/api/models/:token/file` | — | GLB binary |

Viewer: `/v/:token`

## Env (Netlify)

- `ADMIN_SECRET` — секрет для upload/patch/delete
- `ALLOWED_ORIGIN` — CORS (default `*`)

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
