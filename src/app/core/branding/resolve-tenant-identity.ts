/**
 * Resuelve la identidad de tenant desde el subdominio (`window.location.hostname`),
 * con override de `window['env']['tenant']` para dev/local. Función pura:
 * sin caché de módulo ni estado entre invocaciones — cada llamada re-resuelve
 * desde cero, base del aislamiento entre tenants.
 *
 * El subdominio es un trust boundary: a diferencia de otros mecanismos de
 * identidad de tenant del producto, esta función NO valida contra una
 * allow-list de tenants conocidos — cualquier candidato no válido cae al
 * branding neutro más adelante en el pipeline vía `TenantBrandingSource`
 * (404 → `absent`), nunca aquí.
 *
 * Puerto verbatim del mismo mecanismo de `eudistack-cgcom-mfe-issuance-portal`
 * (EUD-166) para que ambos MFEs resuelvan siempre el mismo tenant.
 *
 * @returns el candidato a tenant, o `null` si no hay override y el hostname
 *   no tiene subdominio — nunca adivina ni reutiliza un tenant previo.
 */
export function resolveTenantIdentity(
  location: Pick<Location, 'hostname'>,
  env: { tenant?: string },
): string | null {
  const override = env.tenant?.trim();
  if (override) {
    return override;
  }

  const segments = location.hostname.toLowerCase().split('.');
  if (segments.length < 2) {
    return null;
  }

  const candidate = segments[0].trim();
  return candidate.length > 0 ? candidate : null;
}
