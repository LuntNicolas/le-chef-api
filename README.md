# Le Chef — API

REST API powering **Le Chef**, an AI meal-planning app for iOS: photograph your fridge, get a full week of recipes built
around what you already have, and let missing ingredients land on a shared shopping list automatically.

The goal: waste less food, skip the "what should we cook?" debate, and keep a whole household in sync.

## How it works

1. **Scan** — the app sends a fridge photo (base64). A vision model extracts a normalized inventory: name, quantity,
   unit, emoji, expiry date. The output is constrained by a JSON schema (structured outputs), duplicates are merged,
   and units are validated server-side before insert.
2. **Plan** — the API builds a prompt from the household's inventory (including expiry dates), household size, and
   dietary preferences, and generates 21 recipes (breakfast/lunch/dinner for the next 7 days). Recipes are planned
   around the fridge contents, and soon-to-expire ingredients are scheduled first. Generating again replaces the
   previous plan.
3. **Shop & cook** — ingredients the household doesn't have are aggregated across all recipes into one shopping-list
   row per item (quantities summed). Purchasing moves them into the fridge; "mark as cooked" deducts each recipe's
   stored amounts (with unit conversion, e.g. `kg → g`).

Everything is scoped to a **household**, so multiple people share one fridge, one plan, and one shopping list.

## Tech stack

| Layer         | Choice                                                                    |
|---------------|---------------------------------------------------------------------------|
| Runtime       | Node.js, TypeScript (ESM), Express 5                                      |
| Database      | Neon (serverless Postgres) via Drizzle ORM + drizzle-kit migrations       |
| Auth          | Clerk (`@clerk/express`) — the app sends session JWTs as Bearer tokens    |
| AI            | OpenAI Responses API (vision for fridge scanning, text for meal planning) |
| Rate limiting | Upstash Redis sliding window                                              |
| Deployment    | Railway (Nixpacks, `npm run build` → `npm start`)                         |

## Try it — public demo

A read-only demo of a seeded household is exposed without authentication:

```bash
curl https://le-chef-api-production.up.railway.app/api/demo/fridge
curl "https://le-chef-api-production.up.railway.app/api/demo/recipes?date=$(date +%F)"
curl https://le-chef-api-production.up.railway.app/api/demo/grocery
curl https://le-chef-api-production.up.railway.app/health
```

| Method | Route                      | Description                           |
|--------|----------------------------|---------------------------------------|
| `GET`  | `/api/demo/fridge`         | Demo household's fridge inventory     |
| `GET`  | `/api/demo/recipes?date=…` | Demo recipes (optionally for one day) |
| `GET`  | `/api/demo/recipe/:id`     | Demo recipe detail with ingredients   |
| `GET`  | `/api/demo/grocery`        | Demo shopping list                    |

The demo is enabled by seeding a household (`npm run seed:demo`) and setting the printed `DEMO_HOUSEHOLD_ID`
environment variable. All demo routes are read-only — the authenticated API below is unaffected.

## API

Base path: `/api`. All routes expect a Clerk Bearer token unless noted.

### Auth & profile — `/api/auth`

| Method  | Route     | Description                                                                                |
|---------|-----------|--------------------------------------------------------------------------------------------|
| `POST`  | `/`       | Create profile + household after Clerk sign-up (accepts `dietary_prefs`, `household_size`) |
| `GET`   | `/me`     | Current user's profile                                                                     |
| `PATCH` | `/me`     | Update dietary preferences                                                                 |
| `GET`   | `/health` | Auth-aware health check                                                                    |

### Fridge — `/api/fridge`

| Method   | Route         | Description                                     |
|----------|---------------|-------------------------------------------------|
| `POST`   | `/scan`       | Photo → AI inventory extraction → insert items  |
| `POST`   | `/add`        | Add an item manually                            |
| `GET`    | `/`           | Household inventory, sorted by expiry           |
| `PATCH`  | `/:id/deduct` | Deduct a quantity (unit-aware; deletes at zero) |
| `DELETE` | `/:id`        | Remove an item                                  |

### Recipes — `/api/recipe`

| Method | Route               | Description                                                                                |
|--------|---------------------|--------------------------------------------------------------------------------------------|
| `GET`  | `/generate`         | Generate a 7-day plan (21 recipes) + aggregated shopping list (replaces the previous plan) |
| `GET`  | `/?date=YYYY-MM-DD` | Recipes for a given day                                                                    |
| `GET`  | `/:id`              | Recipe detail with resolved fridge/shopping ingredients                                    |
| `POST` | `/:id/cook`         | Mark cooked — deducts the recipe's ingredient amounts from the fridge                      |

### Shopping list — `/api/grocery`

| Method   | Route           | Description                                 |
|----------|-----------------|---------------------------------------------|
| `GET`    | `/`             | Household shopping list                     |
| `POST`   | `/purchase/:id` | Mark purchased → moves item into the fridge |
| `DELETE` | `/delete/:id`   | Remove an item                              |

## Data model

```
households ─┬─▶ profiles   (clerk_id, dietary_prefs, household_size)
            ├─▶ fridge     (name, quantity, unit, unit_type, emoji, expires_at)
            ├─▶ recipes    (title, meal_type, date, steps, duration, kcal,
            │               fridge_ingredients {id,name,quantity,unit}[],
            │               fridge_ingredient_ids, shopping_ingredient_ids)
            └─▶ shopping   (name, quantity, unit, emoji, purchased, recipe_id)
```

Units are a Postgres enum (`stück`, `packung`, `flasche`, `glas`, `dose`, `g`, `kg`, `ml`, `l`) with a `unit_type`
dimension (`count` / `weight` / `volume`) so quantities can be converted and compared safely.

## Getting started

**Prerequisites:** Node 20+, a Neon database, Clerk application, OpenAI API key.

```bash
npm install
cp .env.example .env        # fill in the values below
npx drizzle-kit migrate     # apply schema migrations
npm run dev                 # tsx watch mode on :3000
```

### Environment variables

| Variable                                              | Purpose                                      |
|-------------------------------------------------------|----------------------------------------------|
| `DATABASE_URL`                                        | Neon Postgres connection string              |
| `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`          | Clerk auth                                   |
| `OPENAI_API_KEY`                                      | Fridge scanning + meal planning              |
| `GEMINI_API_KEY`                                      | Google GenAI (experimental, optional)        |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting                                |
| `DEMO_HOUSEHOLD_ID`                                   | Enables the public read-only demo (optional) |
| `PORT`                                                | Defaults to `3000`                           |

### Scripts

| Command                    | What it does                               |
|----------------------------|--------------------------------------------|
| `npm run dev`              | Dev server with hot reload (`tsx --watch`) |
| `npm run build`            | Compile TypeScript to `dist/`              |
| `npm start`                | Run the compiled server                    |
| `npx drizzle-kit generate` | Create a migration from schema changes     |
| `npx drizzle-kit migrate`  | Apply migrations                           |
| `npm run seed:demo`        | Seed the public demo household             |

## Design decisions

- **Household as the tenancy unit, not the user.** A fridge is shared by definition — every table hangs off
  `household_id`, which makes multi-user sync trivial and keeps queries simple.
- **LLM output is a contract, not a hope.** Both AI calls use OpenAI structured outputs with strict JSON schemas
  (enums for units and meal types), truncated responses are detected via the response status, and everything still
  passes through server-side unit normalization (`normalizeUnit`) before touching the database.
- **Expiry-aware planning.** The generation prompt includes each item's expiry date and instructs the model to schedule
  soon-to-expire ingredients early in the week — the food-waste feature is a prompt-engineering feature.
- **Serverless-friendly stack.** Neon's HTTP driver and Upstash's REST Redis need no connection pooling, so the API can
  scale to zero on Railway without dangling connections.

## Roadmap

- [x] Structured LLM outputs (JSON schema) for scan + generation
- [x] Public read-only demo endpoints
- [ ] OpenAPI spec + Swagger UI at `/docs`
- [ ] zod request validation on all endpoints
- [ ] Household invite flow (join an existing household by code)
- [ ] Transactional multi-step writes (purchase → fridge move)
- [ ] Test suite (unit conversion, endpoint integration with mocked LLM) + CI

## Related

- **Mobile app** — Expo / React Native iOS client (separate repository)
