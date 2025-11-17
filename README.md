# 📦 Microservicios con Kong Gateway - Configuración

Este repositorio contiene la configuración de **Kong Gateway** y **Docker Compose** para orquestar un sistema completo de microservicios con autenticación JWT y comunicación gRPC.

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         Kong Gateway                             │
│                    (Puerto 8000 - API)                          │
│                    (Puerto 8001 - Admin)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
    │   Users     │ │   Posts    │ │ Interactions│
    │  Service    │ │  Service   │ │   Service   │
    │   (Go)      │ │  (Node.js) │ │  (Node.js)  │
    │  Port 3001  │ │  Port 3000 │ │  Port 3000  │
    └──────┬──────┘ └─────┬──────┘ └─────┬───────┘
           │               │               │
           │      gRPC     │               │
           │    (50051)    │               │
           └───────────────┘               │
           │               │               │
    ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼───────┐
    │ PostgreSQL  │ │  MongoDB   │ │   MongoDB   │
    │  (Users)    │ │   (Posts)  │ │(Interactions)│
    └─────────────┘ └────────────┘ └─────────────┘
```

---

## 📋 Requisitos Previos

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Git**

---

## 🚀 Instalación y Configuración

### 1. Clonar el Repositorio

```bash
git clone <tu-repositorio>
cd proyecto-microservicios-kong-compose
```

### 2. Estructura de Carpetas Requerida

El repositorio **NO incluye** el código de los microservicios. Debes agregar las carpetas de cada microservicio en la raíz del proyecto:

```
proyecto-microservicios-kong-compose/
├── compose.yml              ✅ (Incluido en este repo)
├── kong.yml                 ✅ (Incluido en este repo)
├── users-api/               ❌ (Debes agregarlo)
│   ├── Dockerfile
│   ├── main.go
│   └── ...
├── posts-api/               ❌ (Debes agregarlo)
│   ├── Dockerfile
│   ├── package.json
│   └── ...
├── interactions-service/    ❌ (Debes agregarlo)
│   ├── Dockerfile
│   ├── package.json
│   └── ...
├── media-service/           ❌ (Debes agregarlo)
│   ├── Dockerfile
│   ├── app.py
│   └── ...
└── dockerImages/            ❌ (Opcional - imágenes locales)
```

### 3. Agregar los Microservicios

Coloca cada microservicio en su respectiva carpeta:

```bash
# Ejemplo con Git Submodules (recomendado)
git submodule add <repo-users-api> users-api
git submodule add <repo-posts-api> posts-api
git submodule add <repo-interactions> interactions-service
git submodule add <repo-media> media-service

# O copia manualmente las carpetas
cp -r /ruta/a/users-api ./users-api
cp -r /ruta/a/posts-api ./posts-api
# ... etc
```

### 4. Levantar el Sistema Completo

```bash
# Construir y levantar todos los servicios
docker-compose up --build

# O en segundo plano
docker-compose up -d --build
```

### 5. Verificar que Todo Funciona

```bash
# Verificar contenedores activos
docker ps

# Verificar logs
docker-compose logs -f

# Probar Kong Gateway
curl http://localhost:8000/api/posts/health
```

---

## 🔧 Configuración de Kong Gateway

Kong actúa como **API Gateway único** para todos los microservicios. La configuración se encuentra en `kong.yml`.

### Características Principales:

#### 1. **Autenticación JWT con Cookies** 🔐
- Kong valida JWTs automáticamente usando el plugin `jwt`
- Los tokens se envían mediante **cookies HTTP-only** (más seguro que headers)
- No se requiere validación manual en cada microservicio

```yaml
plugins:
  - name: jwt
    config:
      key_claim_name: kid
      secret_is_base64: false
      claims_to_verify:
        - exp
      cookie_names:
        - auth_token  # Kong busca el JWT en esta cookie
```

#### 2. **Separación de Rutas Públicas y Protegidas**

**Rutas Públicas (sin JWT):**
- `POST /api/auth/register` - Registro de usuarios
- `POST /api/auth/login` - Login
- `GET /api/posts` - Ver todos los posts (feed público)
- `GET /api/posts/:id` - Ver post específico

**Rutas Protegidas (requieren JWT):**
- `GET /api/auth/me` - Información del usuario actual
- `POST /api/posts` - Crear post
- `PUT /api/posts/:id` - Actualizar post (solo autor)
- `DELETE /api/posts/:id` - Eliminar post (solo autor)
- `GET /api/posts/my-posts` - Mis posts

#### 3. **CORS Configurado** 🌐

```yaml
plugins:
  - name: cors
    config:
      origins:
        - "http://localhost:5173"  # Frontend (Vite/React)
      credentials: true
      max_age: 3600
```

#### 4. **GraphQL Endpoints** 📊

Cada servicio expone su endpoint GraphQL a través de Kong:

- `/users-graphql` → `http://users-service:3001/graphql`
- `/interactions-graphql` → `http://interactions-service:3000/graphql`
- `/media-graphql` → `http://media-service:5000/graphql`

---

## 🐳 Configuración de Docker Compose

### Servicios Definidos:

| Servicio | Tecnología | Puerto Externo | Puerto Interno |
|----------|------------|----------------|----------------|
| **kong** | Kong Gateway 3.4 | 8000, 8001 | 8000, 8001 |
| **users-service** | Go | - | 3001, 50051 (gRPC) |
| **posts-service** | Node.js | - | 3000 |
| **interactions-service** | Node.js | - | 3000 |
| **media-service** | Python/Flask | - | 5000 |
| **postgres** | PostgreSQL 15 | 5432 | 5432 |
| **posts-mongo** | MongoDB 6 | 27018 | 27017 |
| **mongo** | MongoDB 7 | 27017 | 27017 |
| **media-postgres** | PostgreSQL 15 | 5433 | 5432 |
| **minio** | MinIO | 9000, 9001 | 9000, 9001 |

### Características del Compose:

#### 1. **Red Interna (`kong-net`)**
Todos los servicios están en la misma red Docker, permitiendo comunicación interna por nombre de servicio.

```yaml
networks:
  - kong-net
```

#### 2. **Healthchecks** ✅
Cada servicio tiene un healthcheck para asegurar que esté listo:

```yaml
healthcheck:
  test: ["CMD", "wget", "--spider", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

#### 3. **Dependencias Ordenadas**
Los servicios se inician en orden correcto:

```yaml
depends_on:
  postgres:
    condition: service_healthy
  users-service:
    condition: service_started
```

#### 4. **Comunicación gRPC** 🔌
El servicio de Posts se comunica con Users vía gRPC:

```yaml
environment:
  USERS_GRPC_URL: "users-service:50051"
```

#### 5. **Volúmenes Persistentes**
Los datos se mantienen entre reinicios:

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
  - mongo_data:/data/db
  - posts_mongo_data:/data/db
  - media_postgres_data:/var/lib/postgresql/data
  - minio_data:/data
```

---

## 🔑 Sistema de Autenticación

### Flujo Completo:

```
1. Usuario → POST /api/auth/login
2. Users Service → Valida credenciales
3. Users Service → Genera JWT (con claim 'sub' = user_id)
4. Users Service → Establece cookie HTTP-only 'auth_token'
5. Kong → Lee cookie en requests subsecuentes
6. Kong → Valida JWT (firma + expiración)
7. Kong → Redirige a microservicio si JWT válido
8. Microservicio → Lee user_id del JWT sin validar (Kong ya lo hizo)
```

### Claims del JWT:

```json
{
  "sub": 1,                    // User ID (CRÍTICO para Kong)
  "username": "johndoe",
  "email": "john@example.com",
  "exp": 1763495763,           // Expiración (24h)
  "iat": 1763409363,           // Emitido en
  "nbf": 1763409363            // No válido antes de
}
```

---

## 🔌 Comunicación gRPC

### Users Service (Servidor gRPC - Go):

**Puerto:** `50051`

**Métodos disponibles:**
- `GetUser(user_id)` → Devuelve información de un usuario
- `GetUsers(user_ids[])` → Devuelve múltiples usuarios (batch)

### Posts Service (Cliente gRPC - Node.js):

Cuando se solicita un post, automáticamente enriquece la respuesta con datos del usuario:

```json
{
  "post_id": "post_abc123_1763409845076",
  "author_id": 2,
  "author": {
    "id": 2,
    "username": "janesmith",
    "first_name": "Jane",
    "last_name": "Smith"
  },
  "description": "My post content",
  "tags": ["react", "node"],
  "created_at": "2025-11-17T20:04:05.076Z"
}
```

**Ventajas del gRPC:**
- ⚡ **Rápido:** Protocolo binario (más rápido que REST/JSON)
- 📦 **Eficiente:** Batch requests reducen llamadas de red
- 🔒 **Type-safe:** Definición clara de contratos con `.proto`

---

## 🌐 Endpoints Disponibles

### **Autenticación (Users Service)**
```bash
POST   /api/auth/register     # Registro (público)
POST   /api/auth/login        # Login (público)
POST   /api/auth/logout       # Logout (público)
GET    /api/auth/me           # Usuario actual (protegido)
```

### **Usuarios (Users Service)**
```bash
GET    /api/users             # Listar usuarios (protegido)
GET    /api/users/:id         # Usuario por ID (protegido)
PUT    /api/users/:id         # Actualizar usuario (protegido)
DELETE /api/users/:id         # Eliminar usuario (protegido)
```

### **Seguidores (Users Service)**
```bash
POST   /api/followers/follow              # Seguir usuario (protegido)
DELETE /api/followers/unfollow/:id        # Dejar de seguir (protegido)
GET    /api/followers/my-followers        # Mis seguidores (protegido)
GET    /api/followers/my-following        # A quién sigo (protegido)
```

### **Posts (Posts Service)**
```bash
GET    /api/posts                    # Ver todos los posts (público)
GET    /api/posts/:id                # Ver post específico (público)
GET    /api/posts/author/:authorId  # Posts por autor (público)
GET    /api/posts/my-posts           # Mis posts (protegido)
POST   /api/posts                    # Crear post (protegido)
PUT    /api/posts/:id                # Actualizar post (protegido - solo autor)
DELETE /api/posts/:id                # Eliminar post (protegido - solo autor)
GET    /api/posts/health             # Health check (público)
```

### **Comentarios (Interactions Service)**
```bash
GET    /api/comments          # Listar comentarios (protegido)
POST   /api/comments          # Crear comentario (protegido)
GET    /api/comments/:id      # Comentario por ID (protegido)
PUT    /api/comments/:id      # Actualizar comentario (protegido)
DELETE /api/comments/:id      # Eliminar comentario (protegido)
```

### **Media (Media Service)**
```bash
POST   /api/media/upload      # Subir archivo (protegido)
GET    /api/media/:id         # Obtener archivo (protegido)
DELETE /api/media/:id         # Eliminar archivo (protegido)
GET    /api/media             # Listar archivos (protegido)
```

### **GraphQL**
```bash
POST   /users-graphql         # GraphQL Users (protegido)
POST   /interactions-graphql  # GraphQL Interactions (protegido)
POST   /media-graphql         # GraphQL Media (protegido)
```

### **Documentación**
```bash
GET    /swagger/index.html    # Swagger Users API
GET    /posts-docs            # Swagger Posts API (protegido)
GET    /media-docs            # Swagger Media API (protegido)
```

---

## 🧪 Pruebas con cURL

### 1. Registrar Usuario
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "username": "johndoe",
    "password": "password123"
  }'
```

### 2. Login (guarda cookie)
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "password123"
  }' \
  -c cookies.txt -v
```

### 3. Ver Todos los Posts (público)
```bash
curl http://localhost:8000/api/posts
```

### 4. Crear Post (requiere auth)
```bash
curl -X POST http://localhost:8000/api/posts \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "description": "Mi primer post!",
    "tags": ["golang", "microservices"]
  }'
```

### 5. Ver Mis Posts
```bash
curl http://localhost:8000/api/posts/my-posts \
  -b cookies.txt
```

### 6. Usuario Actual
```bash
curl http://localhost:8000/api/auth/me \
  -b cookies.txt
```

---

## 🛠️ Comandos Útiles

```bash
# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f users-service
docker-compose logs -f kong

# Reiniciar un servicio
docker-compose restart users-service

# Detener todo
docker-compose down

# Detener y eliminar volúmenes (⚠️ borra datos)
docker-compose down -v

# Reconstruir un servicio específico
docker-compose up -d --build users-service

# Ver estado de los contenedores
docker ps

# Inspeccionar red
docker network inspect proyecto-microservicios-kong-compose_kong-net
```

---

## 🔍 Troubleshooting

### ❌ Error: "connection refused" en gRPC
**Causa:** El servicio Users no expone el puerto 50051 o no está levantado.

**Solución:**
```bash
# Verificar que users-service esté corriendo
docker ps | grep users-service

# Ver logs
docker-compose logs users-service

# Reconstruir el servicio
docker-compose up -d --build users-service
```

### ❌ Error: "Unauthorized" en endpoints protegidos
**Causa:** Cookie de autenticación no válida o expirada.

**Solución:**
```bash
# Hacer login nuevamente
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "johndoe", "password": "password123"}' \
  -c cookies.txt
```

### ❌ Error: Servicios en estado "unhealthy"
**Causa:** Healthcheck falla (puerto incorrecto, ruta incorrecta, etc.)

**Solución:**
```bash
# Ver logs del servicio
docker-compose logs <servicio>

# Verificar que el endpoint de health existe
curl http://localhost:<puerto>/health

# Revisar configuración del healthcheck en compose.yml
```

### ❌ Kong no se conecta a los servicios
**Causa:** Los servicios no están en la red `kong-net`.

**Solución:**
```bash
# Verificar red
docker network inspect proyecto-microservicios-kong-compose_kong-net

# Reconstruir todo
docker-compose down
docker-compose up -d --build
```

---

## 📦 Variables de Entorno

### Users Service (Go)
```env
DATABASE_URL="host=postgres user=myuser password=mypassword dbname=usersdb port=5432 sslmode=disable"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
PORT="3001"
ENVIRONMENT="development"
```

### Posts Service (Node.js)
```env
PORT="3000"
MONGO_URI="mongodb://posts-mongo:27017/posts-db"
USERS_GRPC_URL="users-service:50051"
```

### Media Service (Python)
```env
DATABASE_URL="postgresql://postgres:password@media-postgres:5432/mediosdb"
MINIO_ENDPOINT="minio:9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin123"
MINIO_BUCKET="micro-medios"
MINIO_EXTERNAL_URL="http://localhost:9000"
FLASK_ENV="development"
```

---

## 🚀 Producción

Para desplegar en producción, considera:

1. **Cambiar JWT_SECRET** a un valor seguro y largo
2. **Usar HTTPS** (activar `secure: true` en cookies)
3. **Configurar Kong con base de datos** (PostgreSQL) en lugar de declarative mode
4. **Habilitar rate limiting** en Kong
5. **Configurar logs centralizados** (ELK, Loki, etc.)
6. **Agregar monitoring** (Prometheus + Grafana)
7. **Usar secrets de Docker** para credenciales sensibles
8. **Configurar backups automáticos** de las bases de datos

---

## 📄 Licencia

Este proyecto es de código abierto bajo la licencia MIT.

---

## 👥 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📞 Contacto

Para preguntas o sugerencias, abre un issue en el repositorio.

---

**Desarrollado con ❤️ usando Kong Gateway, Docker, Go, Node.js y Python**
