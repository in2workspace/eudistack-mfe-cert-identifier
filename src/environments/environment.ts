export const environment = {
  production: false,
  // Absolute URL of the cert-server's mTLS-capable endpoint (bypasses nginx/
  // CloudFront so the browser's TLS handshake actually reaches the mTLS
  // listener). Only needed in STG (see CERT_SERVER_URL there). Locally the
  // same nginx serves /identify/ under every tenant subdomain — empty means
  // "fall back to the current origin" (ClaveAuthComponent.certServerOrigin()).
  certServerUrl: '',
  // Override de identidad de tenant para dev/local. Vacío = resolver desde el subdominio.
  tenant: '',
};
