import { Injectable, signal } from '@angular/core';
import { TenantBranding } from './tenant-branding.model';

/**
 * Aplica un `TenantBranding` ya resuelto al documento: CSS custom properties
 * en `:root`, favicon, `document.title`, y señales de logo/nombre para el
 * encabezado. `apply()` siempre reescribe el estado completo — nunca lee ni
 * mezcla con la aplicación anterior — por eso es idempotente y no acumula
 * branding de un tenant previo.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly _logoUrl = signal<string>('');
  private readonly _appName = signal<string>('');

  readonly logoUrl = this._logoUrl.asReadonly();
  readonly appName = this._appName.asReadonly();

  apply(branding: TenantBranding): void {
    this.applyTokens(branding.tokens);
    this.setFavicon(branding.faviconUrl);
    document.title = branding.appName;
    this._logoUrl.set(branding.logoUrl);
    this._appName.set(branding.appName);
  }

  private applyTokens(tokens: Record<string, string>): void {
    const root = document.documentElement;
    for (const [token, value] of Object.entries(tokens)) {
      root.style.setProperty(token, value);
    }
  }

  private setFavicon(href: string): void {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;
  }
}
