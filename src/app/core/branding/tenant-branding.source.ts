import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, timeout, catchError, map, TimeoutError } from 'rxjs';
import { TenantBrandingDescriptor, TenantBrandingResult } from './tenant-branding.model';

/**
 * Carga en runtime el descriptor de branding de un tenant desde el
 * repositorio de assets compartido, servido **same-origin** por nginx a
 * partir de `eudistack-platform-assets` (volumen montado en
 * `/assets/tenants/`, sin variable de entorno de host externo) — mismo
 * mecanismo y misma ruta que ya usa `eudistack-cgcom-mfe-issuance-portal`
 * (EUD-166) y la Wallet PWA (SAD §8.8). Nunca lanza ni propaga el error al
 * llamante: siempre emite un `TenantBrandingResult` fail-safe. La política de
 * fallback (a qué default caer) vive en `resolveTenantBranding()`, no aquí.
 */
@Injectable({ providedIn: 'root' })
export class TenantBrandingSource {
  private readonly http = inject(HttpClient);

  /** Presupuesto de tiempo para no bloquear el primer render. */
  private static readonly REQUEST_TIMEOUT_MS = 3_000;

  load(tenant: string): Observable<TenantBrandingResult> {
    const url = `/assets/tenants/${tenant}/theme.json`;

    return this.http.get<unknown>(url).pipe(
      timeout(TenantBrandingSource.REQUEST_TIMEOUT_MS),
      map((descriptor) => this.toResult(descriptor, tenant)),
      catchError((err: unknown) => of(this.toErrorResult(err))),
    );
  }

  private toResult(descriptor: unknown, tenant: string): TenantBrandingResult {
    if (typeof descriptor !== 'object' || descriptor === null || Array.isArray(descriptor)) {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, descriptor: this.rewriteAssetPaths(descriptor as TenantBrandingDescriptor, tenant) };
  }

  /**
   * El `theme.json` real comparte rutas placeholder entre tenants
   * (`/assets/tenant/logo.png`, singular genérico) — hay que normalizarlas a
   * la carpeta real del tenant (`/assets/tenants/{tenant}/logo.png`, plural)
   * antes de que lleguen al resolver.
   */
  private rewriteAssetPaths(descriptor: TenantBrandingDescriptor, tenant: string): TenantBrandingDescriptor {
    if (!descriptor.branding || typeof descriptor.branding !== 'object') {
      return descriptor;
    }
    return {
      ...descriptor,
      branding: {
        ...descriptor.branding,
        logoUrl: this.rewriteAssetPath(descriptor.branding.logoUrl, tenant),
        logoDarkUrl: this.rewriteAssetPath(descriptor.branding.logoDarkUrl, tenant),
        faviconUrl: this.rewriteAssetPath(descriptor.branding.faviconUrl, tenant),
      },
    };
  }

  private rewriteAssetPath(rawPath: unknown, tenant: string): unknown {
    if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
      return rawPath;
    }
    const normalized = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
    if (normalized.startsWith('assets/tenant/')) {
      return `/assets/tenants/${tenant}/${normalized.slice('assets/tenant/'.length)}`;
    }
    return rawPath;
  }

  private toErrorResult(err: unknown): TenantBrandingResult {
    if (err instanceof TimeoutError) {
      return { ok: false, reason: 'timeout' };
    }

    if (err instanceof HttpErrorResponse) {
      if (err.status === 404) {
        console.warn('[TenantBrandingSource] tenant branding descriptor not found (absent)');
        return { ok: false, reason: 'absent' };
      }
      if (err.status === 0 || err.status >= 500) {
        console.warn('[TenantBrandingSource] network/server failure loading tenant branding', err.status);
        return { ok: false, reason: 'error' };
      }
      // Fallos de parseo del body (JSON inválido) llegan como HttpErrorResponse con status 200.
      console.warn('[TenantBrandingSource] malformed tenant branding descriptor');
      return { ok: false, reason: 'invalid' };
    }

    console.warn('[TenantBrandingSource] unexpected failure loading tenant branding', err);
    return { ok: false, reason: 'error' };
  }
}
