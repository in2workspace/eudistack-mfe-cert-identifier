export const environment = {
  production: false,
  oidcClientId: 'vc-auth-client-cgcom',
  oidcAuthorizationEndpoint: 'https://cgcom.127.0.0.1.nip.io:4443/verifier/oidc/authorize',
  oidcPortalRedirectUri: 'https://cgcom.127.0.0.1.nip.io:4443/cert',
  // Override de identidad de tenant para dev/local. Vacío = resolver desde el subdominio.
  tenant: '',
};
