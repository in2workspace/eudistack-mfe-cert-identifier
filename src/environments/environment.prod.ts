export const environment = {
  production: true,
  oidcClientId: window["env"]["oidcClientId"],
  oidcAuthorizationEndpoint: window["env"]["oidcAuthorizationEndpoint"],
  oidcPortalRedirectUri: window["env"]["oidcPortalRedirectUri"],
  tenant: window["env"]["tenant"]
};
