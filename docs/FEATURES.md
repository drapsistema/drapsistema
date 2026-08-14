# Features nuevas — especificación

Tres features pedidas para esta etapa. La 1 y la 2 están implementadas en el
componente compartido `src/shared/Board.jsx` y demostradas en el módulo Comercial.
La 3 está en el Dashboard. Este documento explica cómo aplicarlas a cada módulo.

---

## Feature 1 — Vista Kanban / Lista conmutable

**Qué:** en CRM comercial, postventa y service, el usuario elige ver la
información como **Kanban** (columnas por estado) o como **Lista** (agrupada por
estado). Un toggle arriba a la derecha cambia entre las dos.

**Cómo está resuelto:** el componente `<Board>` ya trae el toggle y ambas vistas.
El módulo solo le pasa los datos.

```jsx
import Board from '@/shared/Board';

<Board
  estados={ESTADOS}          // [{ id, label }]
  items={items}              // [{ id, estado, ...datos }]
  render={(item) => <MiTarjeta item={item} />}
  camposTransicion={fn}
  onMover={fn}
/>
```

Cada `item` debe tener una propiedad `estado` que coincida con el `id` de alguno
de los `estados`. En comercial, por ejemplo, se mapea `oportunidad.etapa → estado`.

---

## Feature 2 — Drag & drop entre estados con campos obligatorios

**Qué:** el usuario arrastra una tarjeta de un estado a otro. Si ese cambio de
estado exige datos (por ejemplo, pasar a "Cotización" pide la fecha de envío),
al soltar aparece un **modal con los campos obligatorios**. Recién al
completarlos se confirma el cambio.

**Cómo está resuelto:** `<Board>` maneja el drag & drop (con `@dnd-kit`) y el
modal. El módulo define qué campos pide cada transición con `camposTransicion`:

```js
function camposTransicion(desde, hacia) {
  if (hacia === 'Cotización') {
    return [{ name: 'fecha_envio', label: 'Fecha de envío', type: 'date', required: true }];
  }
  if (hacia === 'Cierre') {
    return [
      { name: 'resultado', label: 'Resultado', type: 'select', options: ['Ganada','Perdida'], required: true },
      { name: 'motivo', label: 'Motivo', type: 'text', required: false },
    ];
  }
  return []; // transición directa, sin modal
}
```

Tipos de campo soportados: `text`, `date`, `number`, `textarea`, `select`
(con `options`). `required: true` hace que el modal no deje confirmar si está vacío.

Cuando el usuario confirma, se llama `onMover(item, nuevoEstado, valores)`, donde
`valores` trae lo que cargó en el modal. Ahí el módulo persiste con `db.js`:

```js
async function onMover(item, nuevoEstado, valores) {
  const cambios = { etapa: nuevoEstado, ...mapearValores(valores) };
  await actualizar('oportunidades', item.id, cambios);
  // refrescar el estado local
}
```

**Para aplicarlo a postventa y service:** definir sus `ESTADOS` y su
`camposTransicion` con las reglas de negocio de cada uno. Ejemplos:
- **Service:** pasar a "Finalizada" exige que exista el informe técnico.
- **Postventa (visita):** pasar de "Solicitada" a "Agendada" exige la fecha de la visita.

---

## Feature 3 — KPIs del dashboard clickeables

**Qué:** cada indicador del dashboard es clickeable y lleva a la vista con esa
información, ya filtrada.

**Cómo está resuelto:** el componente `Kpi` del dashboard recibe un `to` con la
ruta destino (y filtros por querystring):

```jsx
<Kpi label="En cotización" value={n} to="/comercial?etapa=Cotización" />
```

**Para que el filtro se aplique en el destino**, el módulo destino lee el
querystring. Ejemplo en Comercial:

```js
import { useSearchParams } from 'react-router-dom';
const [params] = useSearchParams();
const filtroEtapa = params.get('etapa'); // 'Cotización' | null
// filtrar items por filtroEtapa si viene
```

Cada módulo que quiera exponer KPIs los agrega al Dashboard con su `to`
correspondiente.

---

## Resumen de dónde está cada cosa

| Feature | Archivo principal | Estado |
|---------|-------------------|--------|
| 1 · Kanban/Lista | `src/shared/Board.jsx` | Implementado, demostrado en Comercial |
| 2 · Drag & drop + campos | `src/shared/Board.jsx` | Implementado, demostrado en Comercial |
| 3 · KPIs clickeables | `src/modules/dashboard/Dashboard.jsx` | Implementado |

Para postventa y service: reutilizar `<Board>` igual que Comercial, definiendo
sus estados y reglas de transición propias.

---

## Tanda B1 — Permisos configurables + roles múltiples

- **Matriz de permisos** (Configuración → Permisos): el admin marca qué módulos ve
  cada rol. Se guarda en la tabla `permisos`. El Administrador ve todo siempre.
- **Roles múltiples**: un usuario puede tener varios roles (ej: Vendedor + Postventa)
  y ve la unión de lo que permiten. En la tabla `usuarios`, el campo es `roles` (array).
- **Alcance de datos** (Configuración → Parámetros): un interruptor global define si
  los vendedores ven todos los clientes o solo los suyos. Los tercerizados ven solo
  lo suyo siempre.
- **Cancelación de venta protegida**: solo el admin; pide reescribir el nombre exacto
  del cliente para confirmar (evita cancelaciones por error de clic).
- La lógica vive en `src/shared/permisos.js`; el guardián de rutas en
  `src/shared/ProtegerModulo.jsx`; el menú se filtra en `Layout.jsx`.

**Importante:** esto es control de UX en el frontend. La seguridad real la dará la
Tanda B2 (políticas RLS en Supabase), que impide el acceso a los datos a nivel base.
