import { ClaveAuthPage } from './components/portal/ClaveAuthPage';
import type { AuthenticatedUser } from './types';

/**
 * Portal de Identificación con certificado FNMT (standalone).
 *
 * Extraído del flujo monolítico `demo-cgcom/src/portal.tsx`, donde `ClaveAuthPage`
 * era la pantalla `auth` intermedia. Aquí es la aplicación completa: identifica al
 * usuario con su certificado FNMT (vía el cert-server mTLS de
 * `eudistack-cgcom-cert-identifier-service`) y, tras consentimiento explícito,
 * entrega los datos al Portal de Emisión.
 *
 * ── FRONTERA / HANDOFF (DEUDA: pendiente de diseño formal en EUDISTACK-622) ──
 * En la demo monolítica el handoff era una llamada de función en memoria
 * (`onAuthenticate(user)` → el portal avanzaba a `doctor-data`). Al separar en dos
 * SPAs ese contrato debe materializarse sobre el navegador. Opciones a decidir en
 * `/define-architecture`:
 *   - redirect con el usuario serializado (firmado) a la URL del Portal de Emisión, o
 *   - postMessage si el Portal de Emisión embebe este portal en un iframe/popup, o
 *   - un token de sesión de un solo uso resuelto contra backend.
 *
 * De momento (paridad con la demo) se hace un redirect con el payload en sessionStorage
 * + querystring mínima al Portal de Emisión. Inseguro para producción — es un placeholder
 * explícito, NO el diseño final.
 */

const ISSUANCE_PORTAL_URL =
  import.meta.env.VITE_ISSUANCE_PORTAL_URL ?? 'http://localhost:3001/portal';

function handleAuthenticated(user: AuthenticatedUser) {
  // PLACEHOLDER de handoff — ver nota de frontera arriba.
  try {
    sessionStorage.setItem('cgcom_identified_user', JSON.stringify(user));
  } catch {
    // sessionStorage no disponible — el Portal de Emisión deberá re-solicitar identidad.
  }
  window.location.href = `${ISSUANCE_PORTAL_URL}?identified=1`;
}

function handleBack() {
  // Sin pantalla previa en el portal standalone: volver al origen del cliente.
  window.history.length > 1 ? window.history.back() : (window.location.href = '/');
}

export default function App() {
  return <ClaveAuthPage onAuthenticate={handleAuthenticated} onBack={handleBack} />;
}
