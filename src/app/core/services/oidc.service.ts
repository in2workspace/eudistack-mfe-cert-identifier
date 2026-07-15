import { Injectable } from '@angular/core';
import { AuthenticatedUser } from '../models/auth.model';
import { environment } from '../../../environments/environment';

/** Lógica PKCE/OIDC para el flujo DoctorID. */
@Injectable({ providedIn: 'root' })
export class OidcService {
  private readonly authorizationEndpoint = environment.oidcAuthorizationEndpoint;
  private readonly tokenEndpoint = environment.oidcAuthorizationEndpoint.replace('/authorize', '/token');
  private readonly clientId = environment.oidcClientId;
  private readonly redirectUri = environment.oidcPortalRedirectUri;
  private readonly scope = 'openid doctorid';

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

  /**
   * Intercambia el authorization code por tokens y extrae el AuthenticatedUser
   * del id_token. Llamado por ClaveAuthComponent al detectar ?code= en la URL
   * de vuelta desde el verifier.
   */
  async completarFlujoOIDCPortal(code: string): Promise<AuthenticatedUser> {
    const codeVerifier = sessionStorage.getItem('oidc_code_verifier') ?? '';
    sessionStorage.removeItem('oidc_code_verifier');
    sessionStorage.removeItem('oidc_state');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      code_verifier: codeVerifier,
    });

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText);
      throw new Error(`Token exchange failed: ${err}`);
    }

    const tokens = await response.json();
    const idToken: string = tokens.id_token ?? '';

    // Decode id_token payload (no signature verification — demo only)
    let claims: Record<string, unknown> = {};
    try {
      const payload = idToken.split('.')[1] ?? '';
      const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
      claims = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      // Fallback to empty claims — defaults below will apply
    }

    const givenName = String(claims['given_name'] != null ? claims['given_name'] : (claims['givenName'] ?? ''));
    const familyName = String(
      claims['family_name'] != null ? claims['family_name'] :
      (claims['familyName'] != null ? claims['familyName'] : (claims['surname'] ?? ''))
    );
    const nameFull = [givenName, familyName].filter(Boolean).join(' ');
    const name = String(claims['name'] != null ? claims['name'] : (nameFull || 'Médico DoctorID'));

    return {
      id: `DOCTORID-${String(claims['sub'] ?? Date.now())}`,
      name,
      collegiateNumber: String(claims['collegiateNumber'] ?? claims['collegiate_number'] ?? ''),
      dni: String(claims['sub'] ?? ''),
      email: String(claims['email'] ?? ''),
      phone: String(claims['phone_number'] ?? ''),
      college: String(claims['college'] ?? claims['organization'] ?? 'Colegio Oficial de Médicos'),
      specialty: String(claims['specialty'] ?? ''),
      authMethod: 'doctorId',
    };
  }
}
