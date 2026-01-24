# Amor Compartido 💕

Una aplicación web para parejas que permite compartir y gestionar tareas juntos.

## Características

- ✅ Gestión de tareas compartidas
- 👥 Dos usuarios con cambio rápido
- 📊 Seguimiento de progreso
- 💌 Sección de tareas asignadas por tu pareja
- 📱 Diseño mobile-first
- 📲 Instalable como PWA

## Configuración

### Variables de entorno

Crea un archivo `.env.local` con:

```env
MYSQL_HOST=tu-host
MYSQL_PORT=3306
MYSQL_USER=tu-usuario
MYSQL_PASSWORD=tu-password
MYSQL_DATABASE=tu-base-de-datos
```

### Desarrollo local

```bash
npm install
npm run dev
```

### Despliegue en Vercel

1. Conecta el repositorio de GitHub a Vercel
2. Configura las variables de entorno en Vercel:
   - `MYSQL_HOST`
   - `MYSQL_PORT`
   - `MYSQL_USER`
   - `MYSQL_PASSWORD`
   - `MYSQL_DATABASE`
3. Despliega

## Estructura de la base de datos

Las tablas usan el prefijo `AppChecklist_`:

- `AppChecklist_users` - Usuarios de la aplicación
- `AppChecklist_tasks` - Tareas compartidas

## Tecnologías

- Next.js 15
- MySQL
- CSS puro con diseño moderno
- PWA con manifest
