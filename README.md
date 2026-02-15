# 🧥 Kloset Keeper API

An open-source **RESTful API** built with NestJS for advanced garment management and digital closet organization.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NestJS](https://img.shields.io/badge/Framework-NestJS-E0234E?logo=nestjs)](https://nestjs.com/)
[![Drizzle ORM](https://img.shields.io/badge/ORM-Drizzle-C5F74F?logo=drizzle)](https://orm.drizzle.team/)

## 📌 Overview

**Kloset Keeper API** is a robust, self-hosted alternative to closed-source fashion apps like **Acloset**, **Whering**, and **Smart Closet**. Designed for enthusiasts who value data ownership and extensibility, it provides a powerful backend to build custom frontends.

### Key Features

- **Garment Metadata:** Track brand, color, season, category, and more.
- **Physical Location:** Organize items by closet, drawer, or storage box.
- **AI-Powered:** Multimodal processing for vector-based search and tagging.
- **Asynchronous Pipeline:** Scalable background jobs for image processing.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [NestJS](https://nestjs.com/) (Modular Node.js Architecture) |
| **Database** | **PostgreSQL** with `pgvector` extension |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) (Type-safe & Lightweight) |
| **Queue/Workers**| **BullMQ** & **Redis** for async task management |
| **AI/ML Service**| **FastAPI** (Python) for 512d vector embedding generation |
| **Infrastructure**| Docker & Docker Compose |

---

## 🚀 Getting Started

### ✅ Prerequisites

- **Node.js** v18+
- **Docker** & **Docker Compose**

### 🔧 Installation & Setup

1. **Clone & Install**

   ```bash
   git clone [https://github.com/resteban/kloset-keeper](https://github.com/resteban/kloset-keeper)
   cd kloset-keeper
   npm install

   ```

2. **Environment Configuration**

   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   # DATABASE_URL="postgresql://user:password@localhost:5432/kloset_db"

   ```

3. **Infrastructure Deployment**

   ```bash
   # Start DB, Redis and Workers
   docker-compose up -d

   # IMPORTANT: Manual pgvector activation
   docker exec -it <db_container_name> psql -U user -d kloset_db -c "CREATE EXTENSION IF NOT EXISTS vector;"

   # Sync Schema
   npm run db:push

   ```

4. **Run Development Server**

   ```bash
   npm run start:dev
   ```

---

## 🧪 Available Scripts

| Command | Action |
| --- | --- |
| `npm run start:dev` | Launch API in watch mode |
| `npm run db:studio` | GUI to explore your database (Drizzle Studio) |
| `npm run build` | Compile for production |
| `npm run lint` | Run ESLint check |
| `npm run test` | Run unit tests |

---

## 🔄 Workflow & AI Processing

Kloset Keeper uses a non-blocking multimodal pipeline:

1. **Ingestion:** NestJS saves the item as `pending`.
2. **Queue:** BullMQ dispatches a job to the worker.
3. **Embedding:** FastAPI generates a **512d vector** (Image + Name + Notes).
4. **Finalization:** The worker updates the status to `ready` and saves the embedding in PostgreSQL.

### Quick Start Flow (cURL)

**1. Setup Admin Account**

```bash
curl --location 'http://localhost:3000/users/setup' \
--header 'Content-Type: application/json' \
--data-raw '{
  "name": "Kloset Admin",
  "email": "admin@example.com",
  "password": "securepassword",
  "isAdmin": true
}'

```

**2. Login**

```bash
curl --location 'http://localhost:3000/auth/login' \
--header 'Content-Type: application/json' \
--data-raw '{ "email": "admin@example.com", "password": "securepassword" }'

```

**3. Upload Item**

```bash
curl --location 'http://localhost:3000/items/' \
--header 'Authorization: Bearer <YOUR_JWT_TOKEN>' \
--form 'image=@"/path/to/cloth.webp"' \
--form 'name="Cloth Name"' \
--form 'category="bottom"'

```

---

## 🤝 Contributing

We strictly follow **[Conventional Commits](https://www.conventionalcommits.org/)**:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation
- `chore:` Maintenance

> 💬 **Want to help?**  
> This project is in **early development**. If you want to help us build a more sustainable and stylish way to manage clothes, feel free to:
>
> - Open an issue to suggest features or report bugs
> - Submit a pull request with improvements
> - Help improve documentation or tests  

---

Made with ❤️ for the Self-Hoster Community.
