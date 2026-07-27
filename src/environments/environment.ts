export const environment = {
  production: false,
  // Absolute URL of the cert-server's mTLS-capable endpoint (bypasses nginx/
  // CloudFront so the browser's TLS handshake actually reaches the mTLS
  // listener). In STG this is a dedicated ALB-bypass host on a separate port
  // (see CERT_SERVER_URL) — it is NOT same-origin with the rest of the app.
  certServerUrl: 'https://cgcom.127.0.0.1.nip.io:4443',
  // Override de identidad de tenant para dev/local. Vacío = resolver desde el subdominio.
  tenant: '',
};
