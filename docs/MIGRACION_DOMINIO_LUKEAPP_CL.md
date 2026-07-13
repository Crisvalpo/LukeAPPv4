# Migración de dominio: lukeapp.me → lukeapp.cl

> Estado al 2026-07-13 (tarde): **Fases 1, 2 y GoTrue de Fase 3 COMPLETADAS y verificadas.** Dual-domain operativo: los 15 hostnames responden en `.cl` y `.me` a la vez. `~/.ssh/config` dev ya usa `ssh.lukeapp.cl` (fallback `luke-ssh-me`). `API_EXTERNAL_URL=https://api.lukeapp.cl` aplicado (auth+studio recreados; backup en `supabase-docker/docker/.env.bak-pre-cl`). Repo v4 apuntando a `.cl`. **Pendiente**: n8n (`WEBHOOK_URL`/`N8N_HOST` siguen `.me`), rebuild de apps productivas (Fase 3.2), referencias externas (Fase 4) y corte (Fase 5). `lukeapp.me` dejará de estar disponible pronto (no se renovará).

## Arquitectura actual (relevada en lukeserver)

Todo el tráfico entra por **un único Cloudflare Tunnel** (`010c6e17-af4b-4ce6-bc6e-9fd6ad8beef3`, servicio systemd `cloudflared`, config local en `/etc/cloudflared/config.yml`). No hay reverse proxy ni certificados propios en el server: Cloudflare termina TLS. Hostnames actuales del túnel:

| Hostname (.me) | Servicio local | Uso |
|---|---|---|
| api.lukeapp.me | 127.0.0.1:8000 (Kong/Supabase) | **API Supabase — crítico** (v4, andina, jaime, delivery, equipos) |
| db.lukeapp.me / db-connect.lukeapp.me | tcp://localhost:5432 | Postgres directo (ETL, Power BI, túnel dev) |
| ssh.lukeapp.me | ssh://localhost:22 | **Acceso SSH al server — crítico** (vía `cloudflared access`) |
| studio.lukeapp.me | localhost:54323 | Supabase Studio |
| n8n.lukeapp.me | localhost:5678 | n8n (webhooks externos apuntan aquí) |
| deploy.lukeapp.me | localhost:9000 | Webhook push-to-deploy (**GitHub webhooks externos apuntan aquí**) |
| www / lukeapp.me / delivery | :3000 / :3010 | Web + delivery |
| jaime / andina / quiz / ruleta / equipos | :3001 / :3005 / :3002 / :3003 / :3020 | Apps productivas |

Referencias al dominio encontradas:

- **Server** — `supabase-docker/docker/.env`: `API_EXTERNAL_URL=https://api.lukeapp.me` (GoTrue). Apps con `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` a `.me`: `andina-dashboard`, `jaime-agent`, `luke-delivery` (además `N8N_WEBHOOK_URL`), `luke-equipos` (además `NEXT_PUBLIC_BASE_URL`), `ruleta-virtual` (`NEXT_PUBLIC_APP_URL`).
- **Repo v4** — `.env` y `.env.example` (`SUPABASE_URL`, `VITE_SUPABASE_URL`, `DATABASE_URL` con `db.lukeapp.me`), `etl/migrar_413.py` (fallback URL y emails de siembra `cristian@lukeapp.me`).
- **Máquina dev** — `~/.ssh/config`: host `luke-ssh` → `ssh.lukeapp.me` vía `cloudflared access`.
- **Externo** — GitHub webhooks (deploy), webhooks n8n de terceros, conexiones Power BI a `db.lukeapp.me`.

## Plan (dual-domain primero, corte después)

Como el túnel es de la **cuenta** Cloudflare (no de la zona), sirve hostnames de ambas zonas a la vez. La estrategia es operar en paralelo `.me` + `.cl` y cortar `.me` recién cuando todo esté verificado.

### Fase 1 — Habilitar .cl en el túnel (server, ~10 min, downtime ~5-10 s)
1. Editar `/etc/cloudflared/config.yml`: duplicar cada entrada de ingress con el hostname `.cl` equivalente (mantener las `.me`).
2. Crear las rutas DNS en la zona .cl (CNAME proxied → `010c6e17-....cfargotunnel.com`):
   > ⚠️ **Gotcha detectado 2026-07-13**: el `cert.pem` del server (`~/.cloudflared/cert.pem`, feb 2026) está autorizado **solo para la zona lukeapp.me**. Ejecutar `route dns` con ese cert crea registros basura `*.lukeapp.cl.lukeapp.me` en la zona .me (pasó; limpiarlos del dashboard .me es opcional). Antes de crear las rutas hay que renovar la autorización: `cloudflared tunnel login` en el server y **seleccionar lukeapp.cl** en el navegador (reemplaza cert.pem; el túnel corriendo no se ve afectado — usa el JSON de credenciales, no el cert). Alternativa sin login: crear a mano en el dashboard de la zona .cl los 16 CNAME proxied → `010c6e17-af4b-4ce6-bc6e-9fd6ad8beef3.cfargotunnel.com`.
   ```bash
   for h in www api db db-connect ssh studio n8n deploy jaime andina quiz ruleta delivery equipos; do
     cloudflared tunnel route dns 010c6e17-af4b-4ce6-bc6e-9fd6ad8beef3 $h.lukeapp.cl
   done
   cloudflared tunnel route dns 010c6e17-af4b-4ce6-bc6e-9fd6ad8beef3 lukeapp.cl
   ```
3. `sudo systemctl restart cloudflared` (reconexión del túnel: **todos** los servicios .me caen unos segundos — avisar/elegir horario).
4. Cloudflare Zero Trust: replicar la app de Access de `ssh.lukeapp.me` para `ssh.lukeapp.cl` (el SSH pasa por `cloudflared access`).
5. Verificar: `https://api.lukeapp.cl/rest/v1/` responde; `ssh` vía `ssh.lukeapp.cl` funciona.

### Fase 2 — Asegurar el acceso SSH (dev, PRIMERO tras Fase 1)
El acceso al server depende de `ssh.lukeapp.me`: si el dominio muere antes de esto, se pierde el acceso remoto. En `~/.ssh/config` de la máquina dev, cambiar/duplicar el host:
```
Host luke-ssh
  HostName ssh.lukeapp.cl
  User cristian
  ProxyCommand cloudflared access ssh --hostname %h
  IdentityFile ~/.ssh/id_ed25519_andina
  IdentitiesOnly yes
```

### Fase 3 — Supabase y aplicaciones
1. `supabase-docker/docker/.env`: `API_EXTERNAL_URL=https://api.lukeapp.cl`; revisar `SITE_URL`/`ADDITIONAL_REDIRECT_URLS` (agregar los dominios .cl de las apps que usen auth por email). Reiniciar `supabase-auth` (y Kong si cachea la URL).
2. Apps del server (una a una, verificando): actualizar `SUPABASE_URL`/`NEXT_PUBLIC_*` a `.cl` y **rebuild** (las `NEXT_PUBLIC_*` se hornean en build): `andina-dashboard`, `jaime-agent`, `luke-delivery` (+ `N8N_WEBHOOK_URL`), `luke-equipos`, `ruleta-virtual`, `LukeQUIZ`, `wa-bridge`.
3. n8n: revisar `WEBHOOK_URL`/`N8N_HOST` en su compose para que genere URLs `.cl`.
4. Repo v4: `.env`, `.env.example` (`api.lukeapp.cl`, `db.lukeapp.cl`), fallback en `etl/migrar_413.py`.

### Fase 4 — Referencias externas
- GitHub: webhooks de push-to-deploy → `https://deploy.lukeapp.cl/...`.
- Webhooks de terceros hacia n8n (`n8n.lukeapp.me/webhook/...`) → `.cl`.
- Power BI / conexiones directas a `db.lukeapp.me` → `db.lukeapp.cl`.
- Marcadores/documentación de Studio (`studio.lukeapp.cl`).

### Fase 5 — Corte de .me (cuando expire o antes)
1. Verificar en Cloudflare Analytics de la zona .me que ya no hay tráfico relevante.
2. Retirar las entradas `.me` del ingress del túnel y reiniciar cloudflared.
3. Eliminar el bloque `.me` duplicado de `~/.ssh/config`.

## Checklist de verificación post-migración
- [x] `https://api.lukeapp.cl/rest/v1/` responde ✅ 2026-07-13 (HTTP 200 con `Accept-Profile: lukeapp` — el esquema ya está expuesto vía `pgrst.db_schemas` in-database)
- [x] GoTrue sano en ambos dominios (`/auth/v1/health` HTTP 200) ✅ 2026-07-13
- [ ] Login Supabase Auth funciona desde una app apuntando a `.cl` (probar con el dashboard v4)
- [x] SSH vía `ssh.lukeapp.cl` operativo desde la máquina dev ✅ 2026-07-13 (alias `luke-ssh`)
- [ ] Túnel dev a Postgres (`db.lukeapp.cl`) operativo para ETL (re-crear el túnel local y probar)
- [ ] Push-to-deploy dispara con el webhook `.cl`
- [ ] Cada app productiva probada en su hostname `.cl` (hoy responden `.cl` pero con builds que apuntan a `api.lukeapp.me` — funcional en dual-domain, rebuild pendiente)
- [ ] Revisar en Zero Trust si `ssh.lukeapp.me` tenía Access application y replicarla para `ssh.lukeapp.cl` (hoy el SSH `.cl` conecta directo; la autenticación es solo por llave SSH)

## Adiciones 2026-07-13 (post-migración)
- **`app.lukeapp.cl`** → dashboard LukeAPP v4 (pm2 `lukeapp4-dashboard`, estático `dist/` en :3030). Push-to-deploy: repo `Crisvalpo/LukeAPPv4` registrado en `~/deploy/webhook.js` → `~/deploy/deploy-lukeapp4.sh` (git reset a origin/main + npm build en `apps/dashboard` + pm2 restart). El `.env` de build vive en `/home/cristian/LukeAPPv4/.env` (apunta a `api.lukeapp.cl`).
- **Studio protegido**: `studio.lukeapp.cl` y `.me` ahora pasan por Kong :8000 (basic-auth con `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` del `.env` de supabase-docker) en vez de ir directo al contenedor :54323 sin auth. Backup del config del túnel: `~/config.yml.bak-pre-app`.
