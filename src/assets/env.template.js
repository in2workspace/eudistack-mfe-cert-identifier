(function (window) {
  window["env"] = {
    oidcClientId: "${OIDC_CLIENT_ID}",
    oidcAuthorizationEndpoint: "${OIDC_AUTHORIZATION_ENDPOINT}",
    oidcPortalRedirectUri: "${OIDC_PORTAL_REDIRECT_URI}",
    tenant: "${CERT_IDENTIFIER_TENANT}"
  };
})(window);
