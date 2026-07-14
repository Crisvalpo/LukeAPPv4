# P5 — Autogestión de cuentas: registro con aprobación + recuperación de contraseña

**Para:** agente Antigravity · **Alcance:** `apps/dashboard` + `supabase/migrations` · **No bloqueante para** el resto de la cartera, pero sí antes de abrir la plataforma a usuarios que no sean tú.

## Objetivo

Hoy la única forma de entrar es que exista un `auth.users` creado a mano. Faltan tres cosas que quedaron sueltas:

1. **Registro** — un usuario nuevo puede solicitar una cuenta.
2. **Aprobación** — nadie entra a datos hasta que un ADMIN/GERENCIA lo apruebe y le asigne un contexto válido (proyecto + rol). Sin aprobación, la cuenta existe pero no ve nada.
3. **Recuperación de contraseña** — flujo estándar de "olvidé mi contraseña".

Regla dura (la razón de ser de todo esto): **una cuenta recién registrada no debe poder leer ni escribir ningún dato de ningún proyecto hasta que un administrador la apruebe y le dé membresía.** RLS ya lo garantiza a nivel de datos; esto agrega el flujo y las pantallas alrededor.

## Estado actual (no reimplementar, respetar)

- Migración `001_nucleo.sql` ya tiene la función/trigger `lukeapp.crear_perfil_usuario()` → `trg_auth_crear_perfil AFTER INSERT ON auth.users`, que inserta el perfil en `lukeapp.usuarios (id, email, nombre)`. **Hoy no fija ningún estado**, así que `usuarios.activo` queda en su default `true`. Hay que cambiar ese trigger, no crear otro.
- `lukeapp.usuarios`: `id` (FK `auth.users`), `email`, `nombre`, `telefono`, `telegram_id`, `activo BOOLEAN DEFAULT true`, `acceso_global BOOLEAN DEFAULT false`. **No existe** columna de estado de solicitud.
- `lukeapp.membresias`: `usuario_id`, `proyecto_id`, `rol lukeapp.rol_usuario`, `activo`, `invitado_por`, `UNIQUE(usuario_id, proyecto_id)`.
- ENUM `lukeapp.rol_usuario`: `ADMIN, OT, QAQC, LOGISTICA, SUPERVISOR, GERENCIA`.
- RLS de lectura: `lukeapp.tiene_acceso_lectura(proyecto_id)` = membresía activa **OR** `acceso_global`. Escritura siempre exige `tiene_membresia()` (nunca global). No tocar estas funciones.
- `apps/dashboard`: sin router de URLs. `App.tsx` decide la vista por estado; `!session` → `<Login/>`. `supabaseClient.ts` usa `db.schema = 'lukeapp'` (todas las RPC y tablas van a ese esquema).

## El gate: 4 estados tras el login

`App.tsx`, una vez hay `session`, debe resolver el estado de la cuenta y mostrar:

1. `estado_cuenta = 'pendiente'` → pantalla **"Cuenta pendiente de aprobación"** (no cartera).
2. `estado_cuenta = 'rechazado'` → pantalla **"Solicitud rechazada"** + `motivo_rechazo`.
3. `estado_cuenta = 'aprobado'` **y** sin membresía activa **y** sin `acceso_global` → pantalla **"Cuenta aprobada, sin proyectos asignados — contacta al administrador"**.
4. Aprobado con al menos una membresía activa **o** `acceso_global` → **cartera** (comportamiento actual).

Excepción transversal: si el evento de auth es `PASSWORD_RECOVERY`, mostrar la pantalla de reset **antes** que cualquier gate.

---

## Prerrequisito de infra (Cristian, no Antigravity)

En el GoTrue del Supabase self-hosted de `lukeserver`, confirmar/ajustar:

- `GOTRUE_DISABLE_SIGNUP = false` — para permitir el registro público. (La seguridad la da la aprobación + RLS, no el bloqueo del signup.)
- `GOTRUE_SMTP_*` configurado con un remitente real — **imprescindible para la recuperación de contraseña** (el correo de reset sale por SMTP; sin esto, el flujo no funciona).
- `GOTRUE_SITE_URL` y `GOTRUE_URI_ALLOW_LIST` deben incluir el origen del dashboard (dev `http://localhost:5174` y la URL de producción cuando exista), para que el link de reset redirija de vuelta a la app.
- `GOTRUE_MAILER_AUTOCONFIRM`: recomendado `true` (autoconfirma el email en el registro). El gate de aprobación es el control real; así no dependemos de SMTP para el alta, solo para el reset. Si prefieres confirmación por correo, déjalo `false` (requiere SMTP para el alta también).
- **Bootstrap obligatorio:** debe existir al menos un usuario con `acceso_global = true` (GERENCIA) o con membresía `ADMIN`, para que haya quién apruebe al primero. Verificar que el usuario semilla lo tenga.

---

## Parte A — Migración `20260713_009_auth_registro_aprobacion.sql`

### A1. Estado de cuenta en `usuarios`

```sql
-- Backfill: los usuarios existentes (admin/seeds) quedan aprobados;
-- solo los NUEVOS registros entrarán como 'pendiente' (vía el trigger, abajo).
ALTER TABLE lukeapp.usuarios
  ADD COLUMN IF NOT EXISTS estado_cuenta TEXT NOT NULL DEFAULT 'aprobado'
    CHECK (estado_cuenta IN ('pendiente','aprobado','rechazado')),
  ADD COLUMN IF NOT EXISTS mensaje_solicitud TEXT,
  ADD COLUMN IF NOT EXISTS proyecto_solicitado_id UUID REFERENCES lukeapp.proyectos(id),
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT,
  ADD COLUMN IF NOT EXISTS solicitado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revisado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revisado_en TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON lukeapp.usuarios(estado_cuenta)
  WHERE estado_cuenta = 'pendiente';
```

### A2. El trigger de alta ahora marca 'pendiente'

Reemplazar el cuerpo de `lukeapp.crear_perfil_usuario()` para que un registro público entre **pendiente e inactivo**, copiando lo que el formulario mande en `raw_user_meta_data`:

```sql
CREATE OR REPLACE FUNCTION lukeapp.crear_perfil_usuario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO lukeapp.usuarios (
    id, email, nombre, telefono,
    estado_cuenta, activo,
    mensaje_solicitud, proyecto_solicitado_id, solicitado_en
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'telefono',
    'pendiente',            -- <── clave: nadie entra aprobado por auto-registro
    false,
    NEW.raw_user_meta_data->>'mensaje_solicitud',
    NULLIF(NEW.raw_user_meta_data->>'proyecto_solicitado_id','')::uuid,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

El trigger `trg_auth_crear_perfil` ya existe; no recrearlo.

### A3. Helper: ¿el llamante puede aprobar?

```sql
CREATE OR REPLACE FUNCTION lukeapp.puede_administrar_accesos(p_proyecto_id UUID DEFAULT NULL)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    EXISTS (SELECT 1 FROM lukeapp.usuarios u
            WHERE u.id = auth.uid() AND u.acceso_global = true)
    OR EXISTS (SELECT 1 FROM lukeapp.membresias m
               WHERE m.usuario_id = auth.uid() AND m.rol = 'ADMIN' AND m.activo
                 AND (p_proyecto_id IS NULL OR m.proyecto_id = p_proyecto_id));
$$;
```

### A4. RPCs (todas `SECURITY DEFINER`, `TO authenticated`)

Todo pasa por RPC en vez de abrir la RLS de `usuarios`, para no exponer el padrón de usuarios. El frontend usa `service_role` **jamás**.

- **`solicitudes_pendientes()`** → lista de cuentas `estado_cuenta='pendiente'` (id, email, nombre, telefono, mensaje_solicitud, proyecto_solicitado_id, solicitado_en). Primero valida `IF NOT lukeapp.puede_administrar_accesos() THEN RAISE EXCEPTION 'no autorizado'`.

- **`aprobar_usuario(p_usuario_id UUID, p_proyecto_id UUID, p_rol lukeapp.rol_usuario)`**:
  - Validar `lukeapp.puede_administrar_accesos(p_proyecto_id)`; si no, excepción.
  - `UPDATE lukeapp.usuarios SET estado_cuenta='aprobado', activo=true, revisado_por=auth.uid(), revisado_en=now() WHERE id=p_usuario_id`.
  - `INSERT INTO lukeapp.membresias (usuario_id, proyecto_id, rol, activo, invitado_por, creado_por) VALUES (p_usuario_id, p_proyecto_id, p_rol, true, auth.uid(), auth.uid()) ON CONFLICT (usuario_id, proyecto_id) DO UPDATE SET rol=EXCLUDED.rol, activo=true`.
  - (Opcional GERENCIA: si `p_rol='GERENCIA'`, además `UPDATE usuarios SET acceso_global=true`.)

- **`rechazar_usuario(p_usuario_id UUID, p_motivo TEXT)`**:
  - Validar `puede_administrar_accesos()`.
  - `UPDATE usuarios SET estado_cuenta='rechazado', activo=false, motivo_rechazo=p_motivo, revisado_por=auth.uid(), revisado_en=now()`.

- **`mi_perfil()`** → una fila para el gate del frontend, sin exponer otras filas:
  ```sql
  SELECT
    u.estado_cuenta,
    u.motivo_rechazo,
    u.acceso_global,
    EXISTS (SELECT 1 FROM lukeapp.membresias m
            WHERE m.usuario_id = auth.uid() AND m.activo) AS tiene_membresia_activa,
    lukeapp.puede_administrar_accesos()                   AS puede_administrar_accesos
  FROM lukeapp.usuarios u WHERE u.id = auth.uid();
  ```

`GRANT EXECUTE` de las cuatro a `authenticated`. Añadir `COMMENT ON FUNCTION` a cada una.

> Asignar proyectos **adicionales** a un usuario ya aprobado no necesita RPC nueva: la política de `membresias` ya permite a un ADMIN del proyecto insertar membresías. La RPC de aprobación existe solo porque el usuario pendiente aún no tiene proyecto y el aprobador puede ser GERENCIA (sin membresía ADMIN).

---

## Parte B — Frontend `apps/dashboard`

### B1. `Login.tsx` → pantalla de auth con 3 modos

Convertir el componente actual en una pantalla con `modo: 'ingresar' | 'registrar' | 'recuperar'` (mismo estilo visual actual). Enlaces bajo el botón: **"Crear cuenta"** y **"¿Olvidaste tu contraseña?"**.

- **registrar**: campos email, nombre, contraseña + un textarea **"¿A qué empresa/proyecto perteneces y quién es tu supervisor?"** (no puede haber dropdown de proyectos: el usuario aún no está autenticado y la RLS no le deja listarlos). Envío:
  ```ts
  await supabase.auth.signUp({
    email, password,
    options: { data: { nombre, mensaje_solicitud: mensaje } }
  });
  ```
  Tras éxito → mensaje: *"Solicitud enviada. Un administrador debe aprobar tu cuenta antes de que puedas ingresar."* (y si `MAILER_AUTOCONFIRM=false`, añadir *"Revisa tu correo para confirmar el email"*).

- **recuperar**: campo email →
  ```ts
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,   // vuelve a la app; el evento PASSWORD_RECOVERY dispara el reset
  });
  ```
  Mensaje neutro siempre (no revelar si el correo existe): *"Si el correo está registrado, te enviamos un enlace para restablecer la contraseña."*

### B2. `ResetPassword.tsx` (nuevo)

`App.tsx` ya suscribe `onAuthStateChange`. Capturar el evento `'PASSWORD_RECOVERY'` en un estado (`recoveryMode`) y, mientras esté activo, renderizar `<ResetPassword/>` por encima de todo: pide contraseña nueva + confirmación →
```ts
await supabase.auth.updateUser({ password });
```
Éxito → limpiar `recoveryMode`, `signOut()` y volver a `<Login/>` con aviso *"Contraseña actualizada, ingresa de nuevo."*

### B3. Gate en `App.tsx`

Tras `getSession()`/cambio de sesión y con `session` presente, llamar `supabase.rpc('mi_perfil')` (una vez, guardado en estado `perfil`, con su propio `perfilCargado`). Ramas:

- `recoveryMode` → `<ResetPassword/>`.
- `!perfilCargado` → "Cargando…".
- `perfil.estado_cuenta === 'pendiente'` → `<CuentaPendiente/>` (con botón Salir).
- `perfil.estado_cuenta === 'rechazado'` → `<CuentaRechazada motivo={perfil.motivo_rechazo}/>`.
- `estado_cuenta==='aprobado' && !tiene_membresia_activa && !acceso_global` → `<SinProyectos/>`.
- resto → layout actual (cartera).

Todas las pantallas de bloqueo comparten el estilo de la tarjeta oscura del login y llevan botón **Salir** (`supabase.auth.signOut()`).

### B4. `SolicitudesAcceso.tsx` (nuevo, panel de admin)

Visible en el header solo si `perfil.puede_administrar_accesos`. Nueva `Vista = 'solicitudes'`. Contenido:

- `supabase.rpc('solicitudes_pendientes')` → tabla de solicitudes (nombre, email, mensaje, fecha).
- Por fila, **Aprobar**: selector de proyecto (`v_cartera_kpis` o `proyectos` que el admin ya puede leer) + selector de rol (`rol_usuario`) → `supabase.rpc('aprobar_usuario', { p_usuario_id, p_proyecto_id, p_rol })`.
- **Rechazar**: pide motivo → `supabase.rpc('rechazar_usuario', { p_usuario_id, p_motivo })`.
- Refrescar la lista tras cada acción; toasts de éxito/error.

---

## Parte C — Seguridad / anti-patrones (recordatorio del AGENTS.md)

- `service_role` **nunca** en el frontend: la aprobación va por RPC `SECURITY DEFINER`, autorizada dentro de la función.
- No ampliar la RLS de `usuarios` para exponer el padrón; el listado de solicitudes sale por RPC autorizada.
- El mensaje de "recuperar contraseña" y el de registro no deben revelar si un correo ya existe.
- Registro público habilitado ⇒ posible spam de cuentas: quedan `pendiente`/`inactivo` sin acceso a nada (RLS), pero si se vuelve molesto, activar confirmación por email (`AUTOCONFIRM=false`) o captcha de GoTrue. Dejar anotado, no implementar ahora.

## Definition of Done

- [ ] Migración 009 aplicada; usuarios existentes quedaron `aprobado` (verificar que el admin/seed **no** quedó bloqueado).
- [ ] Un registro nuevo por el formulario crea `usuarios` con `estado_cuenta='pendiente'`, `activo=false`, y `mensaje_solicitud` poblado.
- [ ] Con la cuenta pendiente logueada: `mi_perfil()` devuelve `pendiente`; la app muestra la pantalla de pendiente; **cero filas** legibles de cualquier `cat_*/list_*/reg_*` (probar una consulta directa → 0 resultados por RLS).
- [ ] Un ADMIN/GERENCIA ve la solicitud en `SolicitudesAcceso`, aprueba con proyecto+rol → se crea la membresía → el usuario, al recargar, entra a la cartera y ve solo su proyecto.
- [ ] Rechazo: setea estado + motivo; el usuario ve la pantalla de rechazo.
- [ ] Reset de contraseña end-to-end: solicitar enlace → correo recibido → link abre la app en modo recovery → `updateUser({password})` → login con la nueva clave. (Requiere SMTP configurado.)
- [ ] Aprobado sin membresía y sin `acceso_global` → pantalla "sin proyectos asignados".
- [ ] `service_role` no aparece en el bundle del dashboard; el header solo muestra "Solicitudes" a admin/gerencia.

## Casos de prueba sugeridos

1. Registrar `test.pendiente@eimisa.cl` → confirmar fila pendiente + gate + RLS a cero.
2. Aprobar a EIMI00417 con rol OT → verificar membresía y acceso solo a ese proyecto.
3. Aprobar a un segundo usuario como GERENCIA → `acceso_global=true`, ve toda la cartera.
4. Rechazar un tercero con motivo → pantalla de rechazo.
5. Reset de contraseña de un usuario ya aprobado → login con clave nueva.
6. Intentar llamar `aprobar_usuario` desde una cuenta OT (no admin) → debe fallar con "no autorizado".
