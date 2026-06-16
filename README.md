# eudistack-cgcom-mfe-cert-identifier

Frontal del **Portal de Identificación con certificado FNMT** de CGCOM.

> ⚠️ **Material de demo.** Separado de `eudistack-platform-dev/dev-tools/demo-cgcom`
> (vibecoding para demos, no producto). React 18 + Vite + Tailwind v4. Aún **no** migrado
> a Angular ni alineado con el SDD de EUDIStack. Relacionado con la Épica
> [EUDISTACK-622](https://eudistack.atlassian.net/browse/EUDISTACK-622).

## Qué hace

App de una sola pantalla (`ClaveAuthPage`, extraída del flujo `demo-cgcom/src/portal.tsx`):
selecciona método de identificación (el principal es **Certificado Digital FNMT**), abre un
popup contra el cert-server mTLS, recibe los atributos X.509 por `postMessage`, los muestra
estructurados y —tras acción afirmativa— entrega el usuario al Portal de Emisión.

## Repos hermanos (separación de demo-cgcom)

| Repo | Rol |
|------|-----|
| **eudistack-cgcom-mfe-cert-identifier** (este) | Frontal de identificación FNMT |
| `eudistack-cgcom-cert-identifier-service` | Backend mTLS (cert-server) + bootstrap |
| `eudistack-cgcom-mfe-issuance-portal` | Portal de Emisión (flujo de credencial) |

## Ejecución local

```bash
npm install
npm run dev      # http://localhost:3000
```

Necesita el backend `eudistack-cgcom-cert-identifier-service` corriendo (`npm run cert-server`, puertos 3443/3444).

Variables de entorno:

| Var | Default | Uso |
|-----|---------|-----|
| `VITE_CERT_SERVER_URL` | `https://localhost:3443` | Origen del cert-server (popup + postMessage) |
| `VITE_ISSUANCE_PORTAL_URL` | `http://localhost:3001/portal` | Destino del handoff tras identificar |
| `VITE_OIDC_CLIENT_ID` | `PENDIENTE_CLIENT_ID` | Cliente OIDC (método DoctorID) |
| `VITE_OIDC_PORTAL_REDIRECT_URI` | `http://localhost:3001/portal` | Redirect OIDC |

## ⚠️ Deuda conocida (heredada de la demo)

- **Handoff a Emisión = placeholder inseguro** (`src/App.tsx`): el usuario identificado se
  pasa por `sessionStorage` + `?identified=1`. El contrato real (redirect firmado / postMessage /
  token de un solo uso) debe diseñarse en `/define-architecture` (EUDISTACK-622).
- **Tipos duplicados** con el repo de emisión (`src/types.ts`) — sin paquete de contrato.
- **Validación "emisor = FNMT" y "no caducado"** (DoD de la Épica) NO está reforzada en el
  front: hoy solo pinta lo que el cert-server extrae.
- `ui/` (48 primitivas shadcn/Radix) duplicado con el repo de emisión.
- Sin tests, sin CI. Fuera de `repository-map.md` y del SDD.
