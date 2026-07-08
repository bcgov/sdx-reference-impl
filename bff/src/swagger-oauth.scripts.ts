const SWAGGER_OAUTH_CHANNEL = 'swagger-oauth2'

export function createSwaggerOAuthPopupScript(oidcOrigin: string) {
  return `(() => {
  const oidcOrigin = ${JSON.stringify(oidcOrigin)};
  const channel = new BroadcastChannel(${JSON.stringify(SWAGGER_OAUTH_CHANNEL)});
  const openWindow = window.open.bind(window);
  let authorizationCompleted = false;

  channel.addEventListener('message', (event) => {
    if (event.data?.type !== 'swagger-oauth-response' || authorizationCompleted) {
      return;
    }

    const oauth = window.swaggerUIRedirectOauth2;
    if (!oauth) {
      return;
    }
    authorizationCompleted = true;

    const responseUrl = new URL(event.data.url);
    const responseParams = new URLSearchParams(
      /code|token|error/.test(responseUrl.hash)
        ? responseUrl.hash.substring(1).replace('?', '&')
        : responseUrl.search.substring(1)
    );
    const token = Object.fromEntries(responseParams);
    const isValid = token.state === oauth.state;
    const flow = oauth.auth.schema.get('flow');
    const isAuthorizationCodeFlow =
      flow === 'accessCode' || flow === 'authorizationCode' || flow === 'authorization_code';

    if (!isAuthorizationCodeFlow || oauth.auth.code) {
      oauth.callback({
        auth: oauth.auth,
        token,
        isValid,
        redirectUrl: oauth.redirectUrl
      });
    } else {
      if (!isValid) {
        oauth.errCb({
          authId: oauth.auth.name,
          source: 'auth',
          level: 'warning',
          message:
            "Authorization may be unsafe, passed state was changed in server. " +
            "Passed state wasn't returned from auth server."
        });
      }

      if (token.code) {
        delete oauth.state;
        oauth.auth.code = token.code;
        oauth.callback({ auth: oauth.auth, redirectUrl: oauth.redirectUrl });
      } else {
        const message = token.error
          ? '[' + token.error + ']: ' +
            (token.error_description
              ? token.error_description + '. '
              : 'no accessCode received from the server. ') +
            (token.error_uri ? 'More info: ' + token.error_uri : '')
          : '[Authorization failed]: no accessCode received from the server';
        oauth.errCb({
          authId: oauth.auth.name,
          source: 'auth',
          level: 'error',
          message
        });
      }
    }

    channel.postMessage({ type: 'swagger-oauth-complete' });
  });

  window.open = (url, target, features) => {
    let destination;
    try {
      destination = new URL(String(url), window.location.href);
    } catch {
      return openWindow(url, target, features);
    }

    if (destination.origin !== oidcOrigin) {
      return openWindow(url, target, features);
    }

    const oauthWindow = openWindow(
      '',
      'swagger-oauth2',
      'popup=yes,width=700,height=800,resizable=yes,scrollbars=yes'
    );
    if (!oauthWindow) {
      return null;
    }

    try {
      oauthWindow.opener = window;
    } catch {
      // The opener is already established by window.open in normal browser configurations.
    }
    oauthWindow.location.href = destination.href;
    oauthWindow.focus();
    return oauthWindow;
  };
})();`
}

export function createSwaggerOAuthCallbackScript() {
  return `(() => {
  const channel = new BroadcastChannel(${JSON.stringify(SWAGGER_OAUTH_CHANNEL)});
  let attempts = 0;

  channel.addEventListener('message', (event) => {
    if (event.data?.type === 'swagger-oauth-complete') {
      window.close();
    }
  });

  const sendResponse = () => {
    channel.postMessage({
      type: 'swagger-oauth-response',
      url: window.location.href
    });
    attempts += 1;
    if (attempts < 10) {
      window.setTimeout(sendResponse, 250);
    }
  };

  sendResponse();
})();`
}

export function createSwaggerOAuthRedirectHtml(callbackScriptPath: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Completing authorization</title>
  </head>
  <body>
    <p>Completing authorization...</p>
    <script src="${callbackScriptPath}"></script>
  </body>
</html>`
}
