(function (window) {
  window["env"] = {
    certServerUrl: "${CERT_SERVER_URL}",
    oidcClientId: "${OIDC_CLIENT_ID}",
    oidcAuthorizationEndpoint: "${OIDC_AUTHORIZATION_ENDPOINT}",
    oidcPortalRedirectUri: "${OIDC_PORTAL_REDIRECT_URI}",
    issuancePortalUrl: "${ISSUANCE_PORTAL_URL}"
  };
})(window);
