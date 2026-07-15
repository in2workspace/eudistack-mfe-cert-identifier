export const environment = {
  production: true,
  certServerUrl: window["env"]["certServerUrl"],
  oidcClientId: window["env"]["oidcClientId"],
  oidcAuthorizationEndpoint: window["env"]["oidcAuthorizationEndpoint"],
  oidcPortalRedirectUri: window["env"]["oidcPortalRedirectUri"],
  issuancePortalUrl: window["env"]["issuancePortalUrl"]
};
