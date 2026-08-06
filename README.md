# DRAP · Sistema Integral de Gestión Comercial, Postventa y Service

App de gestión para empresa de drones: clientes, CRM comercial, ventas, postventa y service.
Frontend en **React + Vite** (responsive, mobile-first). Backend en **Supabase**. Deploy en **Vercel**.

---

## Arranque rápido (modo demo, sin backend)

Podés levantar la app sin configurar nada. Arranca con datos de ejemplo en memoria.

```bash
npm install
npm run dev
```

Abrí la URL que muestra la consola (por defecto http://localhost:5173).
Vas a ver un cartel **"Modo demo"** en la barra superior: significa que todavía no
está conectado a Supabase y los datos no se guardan.

---

## Conectar Supabase (backend real)

### 1. Crear el proyecto en Supabase
1. Entrá a https://supabase.com y creá una cuenta (gratis).
2. **New project**. Elegí un nombre (ej. `drap`), una contraseña para la base y una región cercana.
3. Esperá a que termine de crearse (1-2 minutos).

### 2. Crear las tablas
1. En el proyecto, menú lateral -> **SQL Editor** -> **New query**.
2. Abrí el archivo [`supabase/schema.sql`](supabase/schema.sql) de este repo, copiá **todo** el contenido.
3. Pegalo en el editor y apretá **Run**. Se crean todas las tablas.

### 3. Obtener las credenciales
1. Menú lateral -> **Project Settings** -> **API**.
2. Copiá dos valores:
   - **Project URL**
   - **anon public** (la API key pública)

### 4. Cargar las credenciales en la app
1. En la raíz del proyecto, copiá `.env.example` como `.env`:
   ```bash
   cp .env.example .env
   ```
2. Completá el `.env` con tus valores:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```
3. Reiniciá el servidor (`npm run dev`). El cartel "Modo demo" desaparece: ya usa la base real.

---

## Subir a GitHub

```bash
git init
git add .
git commit -m "DRAP: andamiaje inicial"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/drap.git
git push -u origin main
```

> El archivo `.env` **no se sube** (está en `.gitignore`). Cada desarrollador
> crea el suyo. Nunca subas credenciales al repo.

Después creá la rama de integración:
```bash
git checkout -b develop
git push -u origin develop
```

Ver la estrategia de ramas completa en [`docs/RAMAS.md`](docs/RAMAS.md).

---

## Publicar en Vercel

1. Entrá a https://vercel.com y logueate con tu cuenta de GitHub.
2. **Add New -> Project** y elegí el repo `drap`.
3. Vercel detecta Vite solo. Dejá la configuración por defecto:
   - Build command: `npm run build`
   - Output directory: `dist`
4. En **Environment Variables**, cargá las mismas dos variables del `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. **Deploy**. En un minuto tenés la app publicada con una URL.

Cada vez que hagas `push` a `main`, Vercel vuelve a publicar solo.
Se recomienda publicar `main` (producción) y usar `develop` para pruebas.

---

## Estructura del proyecto

```
drap/
├── index.html                  raíz de Vite
├── package.json
├── vite.config.js
├── .env.example                plantilla de credenciales
├── supabase/
│   └── schema.sql              todas las tablas para crear la base
├── docs/
│   ├── RAMAS.md                estrategia de ramas de Git
│   └── FEATURES.md             especificación de las features nuevas
└── src/
    ├── main.jsx                punto de entrada
    ├── App.jsx                 ruteo (agregar módulos acá)
    ├── layout/                 sidebar + topbar (responsive)
    ├── lib/
    │   ├── supabase.js         cliente y detección de modo demo
    │   ├── db.js               capa de acceso a datos (usar SIEMPRE esto)
    │   └── demoData.js         datos de ejemplo del modo demo
    ├── shared/                 componentes reutilizables
    │   ├── Icon.jsx
    │   ├── ui.jsx              PageHeader, BackButton, helpers
    │   └── Board.jsx           Kanban/Lista con drag & drop (features 1 y 2)
    ├── styles/
    │   └── global.css
    └── modules/                UN MÓDULO POR CARPETA
        ├── clientes/           ← módulo completo de ejemplo
        ├── comercial/          ← usa Board (ejemplo de las 3 features)
        ├── ventas/             ← andamiaje
        ├── postventa/          ← andamiaje
        ├── service/            ← andamiaje
        ├── dashboard/          ← KPIs clickeables (feature 3)
        └── configuracion/      ← andamiaje
```

## Cómo trabajar los datos (importante)

Nunca llames a Supabase directo desde un módulo. Usá `src/lib/db.js`:

```js
import { listar, obtener, crear, actualizar, eliminar } from '@/lib/db';

const clientes = await listar('clientes');
const cliente  = await obtener('clientes', 5);
await crear('clientes', { tipo: 'Empresa', razon_social: 'ACME', ... });
await actualizar('clientes', 5, { telefono: '...' });
```

Así el mismo código funciona en modo demo y con Supabase, y si algún día se
cambia el backend, se toca un solo archivo.

## Seguridad (antes de producción real)

El esquema arranca con acceso abierto a la clave anónima para simplificar el
piloto. **Antes de exponer datos reales**, activá Row Level Security (RLS) en
Supabase y definí políticas por rol (quién puede ver/editar qué). Va de la mano
con la matriz de permisos del sistema.

## Módulos: estado actual

| Módulo         | Estado                                             |
|----------------|----------------------------------------------------|
| Clientes       | Completo (listar, crear, editar, ficha con tabs)   |
| Comercial      | Kanban/Lista + drag & drop funcionando (ejemplo)   |
| Dashboard      | KPIs clickeables (ejemplo)                          |
| Ventas         | Andamiaje                                           |
| Postventa      | Andamiaje                                           |
| Service        | Andamiaje                                           |
| Configuración  | Andamiaje                                           |

Los módulos "andamiaje" tienen la carpeta y la ruta listas; se desarrollan
siguiendo el patrón de Clientes y Comercial.
