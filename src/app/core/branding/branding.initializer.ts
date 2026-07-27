import { inject } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TenantBrandingResult } from './tenant-branding.model';
import { resolveTenantIdentity } from './resolve-tenant-identity';
import { resolveTenantBranding } from './resolve-tenant-branding';
import { TenantBrandingSource } from './tenant-branding.source';
import { BrandingService } from './branding.service';

/**
 * Orquesta identidad → carga → resolución → aplicación de branding ANTES de
 * que Angular bootstree el árbol de componentes (sin flash). Resuelve
 * SIEMPRE — nunca rechaza la promesa (belt-and-suspenders): cada paso del
 * pipeline ya es fail-safe por diseño, pero un fallo inesperado no debe
 * impedir el arranque del portal.
 *
 * Registro en `app.config.ts`:
 * ```ts
 * provideAppInitializer(initializeBranding)
 * ```
 */
export async function initializeBranding(): Promise<void> {
  const source = inject(TenantBrandingSource);
  const brandingService = inject(BrandingService);

  try {
    const tenant = resolveTenantIdentity(window.location, environment);

    const result: TenantBrandingResult | null = tenant
      ? await firstValueFrom(
          source.load(tenant).pipe(catchError(() => of<TenantBrandingResult>({ ok: false, reason: 'error' }))),
        )
      : null;

    const branding = resolveTenantBranding(result);
    brandingService.apply(branding);
  } catch (err) {
    console.error('[BrandingInitializer] unexpected failure — bootstrap continues with neutral default', err);
  }
}
