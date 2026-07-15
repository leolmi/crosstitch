# Crosstitch

Web app per il punto croce, in un monorepo [Nx](https://nx.dev).

## Struttura

| Progetto | Percorso | Stack |
| --- | --- | --- |
| `frontend` | `apps/frontend` | Angular 22 (zoneless, signals, standalone) + Angular Material (M3) |
| `backend` | `apps/backend` | NestJS 11 + Mongoose (MongoDB) |
| `floss-colors` | `packages/floss-colors` | Lib condivisa: catalogo colori DMC/Anchor + conversioni colorimetriche (Lab, CIEDE2000) |

Endpoint backend attuali: `GET /api/patterns` (dati statici provvisori) e
`GET /api/image-proxy?url=…` (proxy per immagini da URL esterni, evita il
canvas CORS-tainted; blocca host locali/privati).

## Sviluppo

```sh
# frontend su http://localhost:4200 (proxya /api verso il backend, se attivo)
npx nx serve frontend

# backend su http://localhost:3000/api (avviarlo a parte quando serve)
npx nx serve backend
```

### Configurazione

Copia `.env.example` in `.env` e adatta i valori. Il backend legge:

- `MONGODB_URI` — connessione MongoDB (default `mongodb://localhost:27017/crosstitch`). **Al momento la connessione Mongoose è predisposta ma commentata** in `apps/backend/src/app/app.module.ts`: il backend gira senza database e espone dati statici da `GET /api/patterns`. Decommenta il blocco `MongooseModule` quando MongoDB sarà disponibile.
- `PORT` — porta del backend (default `3000`).

## Task utili

```sh
npx nx build frontend      # build di produzione
npx nx test frontend       # unit test (vitest)
npx nx lint frontend       # lint
npx nx run-many -t build lint test   # tutti i progetti
```
