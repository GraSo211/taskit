# Taskit MVP

## Puesta en marcha

1. Copia `.env.example` a `.env` y sustituye `BETTER_AUTH_SECRET` por un secreto aleatorio largo.
2. Levanta PostgreSQL local:

   ```bash
   docker compose up -d postgres
   ```

3. Instala dependencias, genera Prisma y aplica la migración (esto es obligatorio antes de registrarse o iniciar sesión):

   ```bash
   npm install
   npm run prisma:generate
   npm run prisma:migrate -- --name init
   ```

4. Arranca Next.js en `http://localhost:3001`:

   ```bash
   npm run dev
   ```

La autenticación usa Better Auth y el cliente siempre llama a `/api/auth` del mismo origen abierto en el navegador. Taskit usa exclusivamente Google OAuth: los endpoints de email/contraseña están desactivados, no se crean cuentas nuevas y el linking de cuentas está desactivado. Google debe reportar un email verificado y el servidor solo permite `santigs211@gmail.com` (comparación case-insensitive). El usuario de Google ya enlazado puede iniciar sesión normalmente.

Para producción, configura `BETTER_AUTH_URL` con la URL pública exacta de Taskit y define `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` como variables server-only. En Google Cloud Console, registra `https://<tu-dominio>/api/auth/callback/google` como URI de redirección autorizada. Los builds y tests locales pueden ejecutarse sin esas credenciales; el servidor de producción no arranca sin ambas.

Las tareas y sus cumplimientos pertenecen al usuario autenticado; el acceso de aplicación está limitado de forma case-insensitive a `santigs211@gmail.com`. Las fechas de esta primera versión se calculan en UTC.

## Limpieza manual posterior al despliegue

Esta limpieza no se ejecuta automáticamente ni forma parte del despliegue. Después de confirmar el login de Google y verificar que la cuenta permitida tiene un account `google` enlazado, realiza un backup y revisa primero todas las filas candidatas. Si procede, elimina únicamente los accounts de transición `providerId = 'credential'` de la cuenta confirmada; no elimines la fila `User`, sus tareas, ni accounts `google`. Ejecuta cualquier cambio destructivo solo con aprobación explícita y un procedimiento reversible probado contra una copia de la base de datos.

Si el formulario muestra un error `DATABASE_URL`, `P1001`, `P2021` o `P2022`, PostgreSQL no está disponible o la migración no se ha aplicado. Comprueba que `DATABASE_URL` apunte a la base correcta, ejecuta `docker compose up -d postgres` y vuelve a ejecutar `npm run prisma:migrate -- --name init`. No se incluye ningún secreto en el repositorio.
