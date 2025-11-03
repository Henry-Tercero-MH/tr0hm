## Documentación del Frontend — trohm (Next.js)

Última revisión: 31-10-2025

Resumen rápido
- Stack: Next.js + React + TypeScript.
- Cliente HTTP: `axios` (con interceptores para refresh de token).
- Comunicación en tiempo real: `socket.io-client` (incluido como dependencia).

Objetivo
Esta documentación resume la estructura del frontend, la configuración principal, cómo ejecutar la aplicación localmente, y notas importantes para la entrega del proyecto.

1) Scripts disponibles (archivo `package.json`)

- `npm run dev` — Ejecuta Next.js en modo desarrollo.
- `npm run build` — Compila la app para producción.
- `npm run start` — Inicia la app compilada en modo producción.

2) Variables de entorno
- `NEXT_PUBLIC_API_URL` — URL base de la API (por defecto `http://localhost:4000`).
- Hay un ejemplo de env en `frontend/.env.local.example`.

3) Estructura de carpetas (resumen)

- `pages/` — Rutas de Next.js (SSR/SSG/Client rendered). Algunas páginas clave:
  - `index.tsx` — Feed principal.
  - `login.tsx`, `register.tsx` — Autenticación.
  - `messages.tsx`, `users/`, `posts/[id].tsx` — Páginas de mensajes, usuarios y posts.
  - `_app.tsx`, `_document.tsx` — Envoltura de la app y html base.
- `components/` — Componentes reutilizables de UI:
  - `ConfirmModal.tsx`, `FollowButton.tsx`, `InstallButton.tsx`, `NotificationsDropdown.tsx`, `UserBadge.tsx`.
- `context/` — React Contexts para estado compartido:
  - `AuthContext.tsx` — gestión de sesión/usuario, login/logout y redirecciones.
  - `NotificationsContext.tsx`, `ToastContext.tsx` — notificaciones y toasts.
- `lib/` — utilidades del cliente:
  - `api.ts` — instancia de `axios` con interceptores para añadir `Authorization` y manejo de refresh tokens.
- `public/` — assets estáticos (manifest, service worker `sw.js`, icons).
- `styles.css` — estilos globales.

4) Detalles importantes del cliente HTTP y autenticación

- `frontend/lib/api.ts` crea una instancia de `axios` usando la variable `NEXT_PUBLIC_API_URL`.
- Interceptor de petición: añade el header `Authorization: Bearer <token>` si existe `localStorage.token`.
- Interceptor de respuesta: cuando el backend responde 401, hay una lógica de refresh:
  - Mantiene una cola (`failedQueue`) para reintentar solicitudes fallidas mientras se obtiene un nuevo token.
  - Envía `POST ${API}/api/auth/refresh` con `refreshToken` (guardado en `localStorage`) para pedir un nuevo token.
  - Si se renueva correctamente, almacena `token` y `refreshToken` en `localStorage` y reintenta las solicitudes.
  - En caso de fallo en refresh, emite un evento `session-expired` y limpia tokens.

5) Flujo de autenticación (resumen)

- `AuthContext` al inicializar intenta obtener `/api/auth/me` para recuperar el usuario actual.
- `login(email,password)` en `AuthContext` llama a `api.post('/api/auth/login', ...)` y guarda `token` y `refreshToken` en `localStorage`, luego recupera el usuario con `/api/auth/me`.
- `logout()` intenta revocar el refresh token en backend y limpia `localStorage`.

6) Recomendaciones para ejecución local y entrega

Requisitos: Node.js 18+ recomendado.

Pasos mínimos para ejecutar localmente (desde `frontend`):

```bash
# instalar dependencias
npm install

# desarrollo (hot reload)
npm run dev

# build para producción
npm run build

# servir build (después de build)
npm run start
```

Notas:
- Asegurarse de apuntar `NEXT_PUBLIC_API_URL` al backend (por ejemplo `http://localhost:4000`) o al entorno de prueba del backend antes de iniciar.
- Para pruebas de flujo de autenticación, limpiar `localStorage` entre pruebas o usar pestañas privadas.

7) Puntos para incluir en el informe de entrega

- Capturas de pantalla de las páginas clave: feed (`/`), perfil (`/users/[id]`), vista de post (`/posts/[id]`), mensajes y notificaciones.
- Diagrama breve del flujo de autenticación: login -> guardar tokens -> peticiones con Authorization -> refresh token.
- Dependencias principales y sus versiones (ver `package.json`): `next`, `react`, `axios`, `socket.io-client`.
- Instrucciones de despliegue: para Vercel o servidor Node, ejecutar `npm run build` y `npm run start` (o desplegar usando la integración de Vercel).

8) Notas conocidas y recomendaciones de mejora

- El proyecto usa `localStorage` para tokens y refresh tokens. Para mayor seguridad en producción, evaluar el uso de httpOnly cookies para refresh tokens.
- Añadir tests e2e (Playwright/Cypress) para flujos críticos (login, publicar, follow/unfollow, notificaciones).
- Documentar los endpoints esperados del backend en el README del backend y enlazarlos aquí.

9) Archivos leídos para generar esta documentación

- `frontend/package.json` (scripts y dependencias)
- `frontend/README.md` (notas iniciales)
- `frontend/tsconfig.json` (configuración TypeScript)
- `frontend/lib/api.ts` (cliente axios y refresh token flow)
- `frontend/context/AuthContext.tsx` (flujo auth)
- Estructura de `frontend/pages/` y `frontend/components/` (listado de archivos)

-----

Si quieres, puedo:
- añadir capturas de pantalla automáticas (requiere levantar el frontend y tomar snapshots).
- generar un diagrama SVG del flujo de autenticación.
- extender la documentación con una sección de API (endpoints usados) si me das acceso a la documentación o al backend.

Fin de la documentación del frontend.
