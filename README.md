# Challenge Blog – Backend

Backend de la aplicación **Challenge Blog**, construido con **NestJS**, **TypeScript**, **PostgreSQL** y **TypeORM**. Incluye autenticación con JWT, manejo de posts, usuarios, tests unitarios, tests e2e, Docker y configuración lista para despliegue.

---

## 🚀 Stack Tecnológico

* **Node.js** 20
* **NestJS**
* **TypeScript**
* **PostgreSQL** 16
* **TypeORM**
* **JWT (access + refresh tokens)**
* **Jest** (unit + e2e tests)
* **Docker & Docker Compose**

---

## 📦 Requisitos

* Node.js >= 20
* pnpm
* Docker + Docker Compose

---

## ⚙️ Variables de entorno

Crear un archivo `.env` basado en `.env.example`.

---

## ▶️ Ejecutar en local (sin Docker)
(asegurarse tener instalado y corriendo PostgreSQL)

```bash
pnpm install
pnpm db:setup
pnpm start
```

La API quedará disponible en:

```
http://localhost:3000/api
```

La documentacion Swagger quedará disponible en:

```
http://localhost:3000/api/docs#
```
---

## 🧪 Testing

### Tests unitarios

```bash
pnpm test
```

### Tests end-to-end

```bash
pnpm test:e2e
```

Incluye un **health check**:

```
GET /api/health
→ { "status": "ok" }
```

---

## 🐳 Docker

### Levantar backend + base de datos

```bash
docker compose up --build
```

Servicios:

* **API**: [http://localhost:3000](http://localhost:3000)
* **Postgres**: puerto 5432

---

## 📁 Estructura principal

```text
src/
├─ auth/
├─ posts/
├─ users/
├─ health/
├─ app.module.ts
└─ main.ts

Dockerfile
docker-compose.yml
```

---

## 🔐 Autenticación

* Login / Register con JWT
* Access Token + Refresh Token
* Rotación de refresh token
* Protección por roles

---

## 📝 Notas

* El backend está preparado para ejecutarse en entornos Docker.
* Los tests cubren servicios críticos y un flujo e2e básico.
* El health check puede ser usado por load balancers o servicios de monitoreo.

---

## 👩‍💻 Autora

Florencia Samanta Bazan
