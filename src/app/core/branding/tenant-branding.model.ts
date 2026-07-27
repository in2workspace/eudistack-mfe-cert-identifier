/**
 * Branding resuelto para un tenant. Siempre completo y válido:
 * `resolveTenantBranding()` garantiza que todo consumidor recibe una
 * instancia utilizable, nunca campos parciales o crudos.
 *
 * Puerto del pipeline de branding de EUD-166 (`eudistack-cgcom-mfe-issuance-portal`),
 * sin la parte de idioma (este MFE no usa `@ngx-translate`).
 */
export interface TenantBranding {
  /** CSS custom properties del tema (`--brand-*`), consumidas por Tailwind. */
  tokens: Record<string, string>;
  logoUrl: string;
  faviconUrl: string;
  appName: string;
}

/**
 * Branding neutro de EUDIStack. Constante estática (nunca mutada ni derivada
 * de un tenant previo) — es la base del aislamiento entre tenants: ante
 * ausencia/error, todos los titulares ven exactamente este mismo default.
 */
export const DEFAULT_EUDISTACK_BRANDING: Readonly<TenantBranding> = Object.freeze({
  tokens: Object.freeze({
    '--brand-primary': '#0F2B5B',
    '--brand-primary-contrast': '#ffffff',
    '--brand-secondary': '#00BFA6',
    '--brand-secondary-contrast': '#ffffff',
  }),
  // El header de este MFE es blanco: se usa la variante oscura del logo
  // (contraste sobre fondo claro), nunca la clara `logo.svg` (pensada para
  // fondos de color/oscuros — sería invisible aquí).
  logoUrl: '/assets/tenants/eudistack/logo-dark.svg',
  faviconUrl: '/assets/tenants/eudistack/favicon.svg',
  appName: 'EUDIStack',
});

/**
 * Forma cruda del descriptor de branding tal como lo publica el repositorio de
 * assets compartido (`eudistack-platform-assets/tenants/{tenant}/theme.json`,
 * servido same-origin por nginx). Todos los campos son `unknown`/opcionales:
 * `resolveTenantBranding()` valida y sanitiza cada uno antes de aceptarlo —
 * este tipo nunca se usa para renderizar directamente. Solo se modelan los
 * campos de color/logo; `content.*`, `i18n.*` y otros campos del theme.json
 * real no son de interés en este MFE.
 */
export type TenantBrandingDescriptor = {
  branding?: {
    name?: unknown;
    primaryColor?: unknown;
    primaryContrastColor?: unknown;
    secondaryColor?: unknown;
    secondaryContrastColor?: unknown;
    logoUrl?: unknown;
    /** Variante de logo con contraste sobre fondo claro (theme.json real: `branding.logoDarkUrl`). */
    logoDarkUrl?: unknown;
    faviconUrl?: unknown;
  };
};

/**
 * Resultado fail-safe de cargar el descriptor de un tenant. `reason` distingue
 * las 4 categorías de fallo que `TenantBrandingSource` puede producir;
 * `resolveTenantBranding()` trata todas ellas igual: cae al default.
 */
export type TenantBrandingResult =
  | { ok: true; descriptor: TenantBrandingDescriptor }
  | { ok: false; reason: 'absent' | 'invalid' | 'error' | 'timeout' };
