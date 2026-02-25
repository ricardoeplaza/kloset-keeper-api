# 🧥 Kloset Keeper API

An open-source **RESTful API** built with NestJS for advanced garment management and digital closet organization.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NestJS](https://img.shields.io/badge/Framework-NestJS-E0234E?logo=nestjs)](https://nestjs.com/)
[![Drizzle ORM](https://img.shields.io/badge/ORM-Drizzle-C5F74F?logo=drizzle)](https://orm.drizzle.team/)

## 📌 Overview

**Kloset Keeper API** is an open-source, self-hosted alternative to closed-source fashion apps like **Acloset**, **Whering**, and **Smart Closet**. It is designed to provide the foundational infrastructure needed to build sophisticated fashion platforms.

### Key Features

- **Garment Metadata:** Track brand, color, season, category, and more.
- **Physical Location:** Organize items by closet, drawer, or storage box.
- **Automated Ingestion Engine:** A scalable bulk-upload system that handles background removal, color extraction, and semantic categorization in a non-blocking asynchronous pipeline.
- **Semantic Vector Search:** Deep integration with `pgvector` allows for natural language queries, moving beyond simple keyword matching to true conceptual search.
- **Localization-Ready Architecture:** Uses a token-based naming system (`auto:[category]:[color]`) to delegate UI rendering to the frontend, ensuring full internationalization support.

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

### 📦 The AI Processing Pipeline

Kloset Keeper uses a non-blocking multimodal pipeline:

1. **Image Pre-processing:** Automated background removal via U2Net to isolate the garment and improve visual feature extraction.
2. **Chromatic Analysis:** Identification of dominant color groups to facilitate faceted filtering and naming.
3. **Multimodal Synthesis:** Fusion of visual features and extracted metadata into a 512-dimension vector space.
4. **Taxonomic Mapping:** Zero-shot classification against pre-computed category embeddings to ensure consistent organization.

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
   # Start DB, Redis, and Workers
   docker-compose up -d

   # IMPORTANT: Manual pgvector activation (replace <db_container_name> with your actual container ID/name)
   docker exec -it <db_container_name> psql -U user -d kloset_db -c "CREATE EXTENSION IF NOT EXISTS vector;"

   # Sync Schema
   npm run db:push

   ```

4. **Run Development Server**

   ```bash
   npm run start:dev
   ```

---

### Quick Start Flow (cURL)

**1. Setup Admin Account**

```bash
curl --location 'http://localhost:3000/system/setup' \
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
--form 'image=@"/path/to/cloth.webp"'

```

---

### 🤝 Collaborative Development

This project is built for the community. The architecture is strictly decoupled to encourage contributions across different domains:

- **Backend (NestJS):** Refining the core API, database schemas with Drizzle ORM, and BullMQ orchestration.
- **AI Worker (FastAPI):** Enhancing computer vision models, improving extraction accuracy, or adding new multimodal features.
- **Frontend Ecosystem:** Developing reference implementations in Angular, React, or mobile frameworks that consume the API.

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
