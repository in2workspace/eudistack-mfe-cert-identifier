# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-07-15

### Added

- **DoctorID OIDC callback handling**: `ClaveAuthComponent.ngOnInit()` detects the OIDC authorization-code callback (`?code=&state=`), validates the state parameter, cleans the URL, and completes the flow via `OidcService.completarFlujoOIDCPortal()` — redirecting the user to the issuance portal on success. The redirect URI is now `/cert` instead of `/identify/portal`, so the callback lands on the cert-identifier MFE.
- **`OidcService.completarFlujoOIDCPortal(code)`**: exchanges the authorization code for tokens at the verifier token endpoint (PKCE, `authorization_code`), decodes the `id_token` JWT payload, and returns an `AuthenticatedUser` with `authMethod: 'doctorId'`.
- **VideoIdentificación method**: new auth method entry in the selector; simulated video call screen with agent placeholder, self-view thumbnail, connection status badge, duration counter and call controls (mute, camera toggle, hang-up).

### Fixed

- **OIDC redirect URI** (`oidcPortalRedirectUri`): changed from `/identify/portal` to `/cert` in `environment.ts`, `assets/env.js`, and the nginx entrypoint default — ensures the OIDC authorization-code callback is delivered to the cert-identifier MFE instead of the issuance portal.
- **Verifier OIDC client** (`vc-auth-client-cgcom` in `clients.yaml`): added `/cert` to `redirectUris` so the verifier accepts the new callback URI.

### Changed

- **`AuthMethod` type**: extended with `'doctorId'` and `'video'` in `auth.model.ts`.
- **CI/CD**: added `OIDC_AUTHORIZATION_ENDPOINT` environment variable to the `Generate env.js` steps in both `cd-stg` and `cd-pro` jobs so the OIDC flow works on staging and production deployments.

## [0.1.0] - 2026-07-01

### Added

- Initial release: cert-identifier Angular 19 MFE with eDNI, Certificado Digital, Cl@ve Móvil, and DoctorID authentication method selectors; mTLS certificate popup flow via cert-server.
