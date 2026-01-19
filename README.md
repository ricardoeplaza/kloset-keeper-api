# 🧥 Kloset Keeper API

An open-source **RESTful API** designed for advanced garment management and digital closet organization.

## 📌 Project Overview

Kloset Keeper API aims to provide a **robust, self-hosted alternative** to closed-source fashion apps like **Acloset**, **Whering**, and **Smart Closet**.

Unlike basic wardrobe apps, this project goes beyond simple item cataloging. It enables structured storage of:
- Garment metadata (brand, color, season, category, etc.)
- Physical location tracking (e.g., closet, drawer, storage box)
- Custom tags and usage history

This empowers developers to build their own **custom frontends**—whether mobile, web, or desktop—on top of a reliable, extensible backend.

---

## 🛠️ Tech Stack

| Layer             | Technology                                                                 |
|------------------|----------------------------------------------------------------------------|
| **Framework**     | [NestJS](https://nestjs.com/) – A progressive, modular Node.js framework    |
| **Database**      | PostgreSQL                                                                 |
| **ORM**           | [Drizzle ORM](https://orm.drizzle.team/) – Type-safe, lightweight, modern  |
| **Infrastructure**| Docker & Docker Compose for easy local setup and reproducibility           |

> 💡 **Why NestJS + Drizzle?**  
> NestJS offers enterprise-grade architecture with dependency injection, modularity, and TypeScript support. Drizzle ORM provides excellent type safety, performance, and developer experience without the overhead of heavier ORMs.

---

## 🚀 Getting Started

### ✅ Prerequisites

- **Node.js** v18 or higher
- **Docker** and **Docker Compose** installed

### 🔧 Installation & Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/resteban/kloset-keeper
   cd kloset-keeper
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example file and customize it:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` to set your database connection:

   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/kloset_db"
   ```

4. **Start the PostgreSQL database with Docker**

   ```bash
   docker-compose up -d
   ```

5. **Push the initial schema to the database**

   ```bash
   npm run db:push
   ```

6. **Launch the development server**

   ```bash
   npm run start:dev
   ```

   The API will be available at `http://localhost:3000` (or your configured port).

---

## 🧪 Available Scripts

| Command                | Description                                      |
|------------------------|--------------------------------------------------|
| `npm run start:dev`    | Starts the app in watch mode (auto-reload)       |
| `npm run build`        | Compiles the project for production              |
| `npm run db:studio`    | Opens **Drizzle Studio** – a GUI to explore your DB |
| `npm run lint`         | Runs ESLint to enforce code quality              |
| `npm run test`         | Executes unit tests                              |

---

## 🤝 Contributing & Standards

We follow the **[Conventional Commits](https://www.conventionalcommits.org/)** specification to maintain a clean, readable Git history and enable automated changelogs.

### Commit Message Prefixes

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `chore:` — Maintenance tasks (deps, config, etc.)

> 💬 **Want to help?**  
> This project is in **early development**, and your contributions can make a big difference!  
> Feel free to:
> - Open an issue to suggest features or report bugs
> - Submit a pull request with improvements
> - Help improve documentation or tests  
>
> Stay tuned for upcoming updates—we’re building something stylish and sustainable! 👗👕👖