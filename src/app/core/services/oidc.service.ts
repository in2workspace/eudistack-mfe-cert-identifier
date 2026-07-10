import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Lógica PKCE/OIDC para el flujo DoctorID.
 *
 * Puerto de las funciones `toBase64UrlSafe` e `iniciarFlujoOIDCPortal`
 * de ClaveAuthPage.tsx (React) convertidas a servicio Angular.
 *
 * Endpoints y scopes son equivalentes a los del repo React:
 *   OIDC_AUTHORIZATION_ENDPOINT → verifier CGCOM en STG
 *   OIDC_SCOPE                  → openid + learcredential + role
 */
@Injectable({ providedIn: 'root' })
export class OidcService {
  private readonly authorizationEndpoint =
    'https://cgcom.stg.eudistack.net/verifier/oidc/authorize';

  private readonly clientId = environment.oidcClientId;
  private readonly redirectUri = environment.oidcPortalRedirectUri;
  private readonly scope =
    'openid profile email offline_access learcredential role';

  /**
   * Convierte un ArrayBuffer o Uint8Array a Base64-URL-safe sin padding.
   */
  private toBase64UrlSafe(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Genera los parámetros PKCE (code_verifier, code_challenge S256, state)
   * y redirige el navegador al authorization endpoint del verifier CGCOM.
   *
   * Persiste code_verifier y state en sessionStorage para el callback.
   */
  async iniciarFlujoOIDCPortal(): Promise<void> {
    const verifierBytes = new Uint8Array(32);
    crypto.getRandomValues(verifierBytes);
    const codeVerifier = this.toBase64UrlSafe(verifierBytes);

    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(codeVerifier),
    );
    const codeChallenge = this.toBase64UrlSafe(digest);

    const stateBytes = new Uint8Array(16);
    crypto.getRandomValues(stateBytes);
    const state = this.toBase64UrlSafe(stateBytes);

    try {
      sessionStorage.setItem('oidc_code_verifier', codeVerifier);
      sessionStorage.setItem('oidc_state', state);
    } catch {
      return;
    }

    const authUrl = new URL(this.authorizationEndpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('scope', this.scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    window.location.href = authUrl.toString();
  }
}
