# API for Le Chef

## 🚀 Drizzle

Update Database

```bash
npx drizzle-kit generate
```

```bash
npx drizzle-kit migrate 
```

```bash
npx drizzle-kit push
```

---

## 🤖 OpenAI

Model: gpt-5.4-mini

---

## 📂 Folder Structure

```
src/
├── app.ts
├── config
│ ├── config.ts
│ ├── db.ts
│ └── upstash.ts
├── controllers
│ └── authController.ts
├── db
│ └── schema.ts
├── middleware
│ └── rateLimiter.ts
├── routes
│ └── authRoute.ts
└── server.ts
```
