# Estrategia de ramas

El objetivo es que varios desarrolladores trabajen en paralelo sin pisarse.
Como cada módulo vive en su propia carpeta (`src/modules/<modulo>/`), dos personas
en módulos distintos casi nunca tocan los mismos archivos.

## Ramas principales

```
main       Producción. Lo que está publicado en Vercel. Protegida: no se commitea directo.
develop    Integración. Acá se juntan los módulos terminados antes de ir a producción.
```

## Ramas de trabajo (una por módulo / feature)

```
feat/clientes
feat/comercial      ← ejemplo: vos trabajás acá
feat/postventa      ← ejemplo: otro dev trabaja acá
feat/ventas
feat/service
feat/configuracion
```

## Flujo de trabajo

### 1. Cada dev arranca su rama desde develop
```bash
git checkout develop
git pull
git checkout -b feat/postventa
```

### 2. Trabaja y commitea en su rama
```bash
git add .
git commit -m "postventa: panel de visitas"
git push -u origin feat/postventa
```

### 3. Cuando termina una parte, la integra a develop
En GitHub, abre un **Pull Request** de `feat/postventa` → `develop`.
Otro del equipo lo revisa y lo aprueba. Se mergea.

### 4. Cuando develop está estable, va a producción
Pull Request de `develop` → `main`. Al mergear, Vercel publica solo.

## Ejemplo concreto (el caso que planteaste)

- **Vos** trabajás en comercial:
  ```bash
  git checkout develop && git pull
  git checkout -b feat/comercial
  # editás src/modules/comercial/ ...
  git push -u origin feat/comercial
  ```
- **Otro dev** trabaja en postventa, al mismo tiempo:
  ```bash
  git checkout develop && git pull
  git checkout -b feat/postventa
  # edita src/modules/postventa/ ...
  git push -u origin feat/postventa
  ```

Como uno toca `modules/comercial/` y el otro `modules/postventa/`, cuando ambos
mergeen a `develop` **no hay conflicto**.

## Reglas para minimizar conflictos

1. **Un módulo = una carpeta = una persona a la vez.** Si dos tienen que tocar el
   mismo módulo, coordinen o dividan en sub-archivos.
2. **Los componentes compartidos** (`src/shared/`, `src/lib/`, `src/layout/`) se
   tocan con cuidado: avisá al equipo antes de cambiarlos, porque los usan todos.
3. **Agregar un módulo al menú y al ruteo** implica tocar `src/App.jsx` y
   `src/layout/Layout.jsx`. Son cambios chicos; coordiná para no chocar.
4. **Actualizá tu rama seguido** con lo último de develop para evitar sorpresas:
   ```bash
   git checkout feat/mi-modulo
   git merge develop
   ```

## Proteger main (recomendado)

En GitHub → Settings → Branches → Add rule sobre `main`:
- Require pull request before merging.
- (Opcional) Require approvals.

Así nadie rompe producción con un push directo.
