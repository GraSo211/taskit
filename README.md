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

La autenticación usa Better Auth con email/contraseña y el cliente siempre llama a `/api/auth` del mismo origen abierto en el navegador. Para producción, configura `BETTER_AUTH_URL` con la URL pública exacta de Taskit. Las tareas y sus cumplimientos pertenecen al usuario autenticado; las fechas de esta primera versión se calculan en UTC.

Si el formulario muestra un error `DATABASE_URL`, `P1001`, `P2021` o `P2022`, PostgreSQL no está disponible o la migración no se ha aplicado. Comprueba que `DATABASE_URL` apunte a la base correcta, ejecuta `docker compose up -d postgres` y vuelve a ejecutar `npm run prisma:migrate -- --name init`. No se incluye ningún secreto en el repositorio.
