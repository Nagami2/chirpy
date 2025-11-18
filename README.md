# Chirpy

Chirpy is a RESTful API for a microblogging platform similar to Twitter. It allows users to create accounts, post short messages ("chirps"), and interact with other users' content.

This project was built from scratch to demonstrate backend web development concepts using **TypeScript**, **Node.js**, and **PostgreSQL**.

## 🚀 Features

* **User Authentication:** Secure signup and login using Argon2 password hashing.
* **Session Management:** Industry-standard security with short-lived JWT Access Tokens and long-lived Refresh Tokens.
* **CRUD Operations:** Full Create, Read, Update, and Delete capabilities for Users and Chirps.
* **Database ORM:** Uses Drizzle ORM for type-safe database interactions and migrations.
* **Webhooks:** Handles external events (e.g., "upgrading" user membership) via simulated payment provider webhooks.
* **Admin Tools:** specialized endpoints for metrics and system resets.

## 🛠️ Tech Stack

* **Language:** TypeScript / Node.js
* **Framework:** Express.js
* **Database:** PostgreSQL (running via Docker)
* **ORM:** Drizzle ORM + Drizzle Kit
* **Auth:** JSON Web Tokens (JWT) & Argon2

## ⚙️ Installation & Setup

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) and [Docker](https://www.docker.com/) installed.

### 2. Clone and Install
```bash
git clone [https://github.com/YOUR_USERNAME/chirpy.git](https://github.com/YOUR_USERNAME/chirpy.git)
cd chirpy
npm install
```

## 3. Database Setup
Start the PostgreSQL container:
```bash
docker compose up -d
```

### 4. Environment Variables
Create a .env file in the root directory and add the following configuration:
```bash
# Database Connection
DB_URL="postgres://postgres:postgres@localhost:5432/chirpy?sslmode=disable"

# Environment (use 'dev' to enable the /reset endpoint)
PLATFORM="dev"

# Security Secrets
JWT_SECRET="your_super_secure_random_string_here"
POLKA_KEY="f271c81ff7084ee5b99a5091b42d486e"
```

## 5. Run migrations
Initialize the database schema:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

# Usage
Start the development server
```bash
npm run dev
```
The API will be available at http://localhost:8080.

## Key endpoints
Method,Endpoint,Description
GET,/api/chirps,Retrieve all chirps (supports ?sort=desc and ?author_id=...)
GET,/api/chirps/:id,Retrieve a single chirp
POST,/api/users,Create a new account
POST,/api/login,Login to receive Access & Refresh tokens
POST,/api/chirps,Post a new chirp (Requires Auth)
DELETE,/api/chirps/:id,Delete your own chirp (Requires Auth)
POST,/api/polka/webhooks,Upgrade user membership (Requires API Key)

# Testing
You can verify the API works using the included test suite (for Auth) or by using Postman/curl.
```bash
# run unit tests
npm test
```
