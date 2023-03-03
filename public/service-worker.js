import { generateRandomString, pkceChallengeFromVerifier } from "./utils.js";

// to immediately install the service worker
addEventListener("install", (event) => {
  // install on all site tabs without waiting for them to be opened
  skipWaiting();
});

// to immediately activate the service worker
addEventListener("activate", (event) => {
  // activate on all tabs without waiting for them to be opened
  event.waitUntil(clients.claim());
});

const tokenStore = new Map();

self.addEventListener("message", (event) => {
  console.log("message sent from client and received in worker:", event.data);

  const type = event.data.type;

  switch (type) {
    case "storeToken":
      tokenStore.set(event.data.origin, event.data.token);
      break;
    default:
      console.log("type:", type, "not handled");
  }

  event.source.postMessage("I received your message!");
});

const config = [
  {
    client_id: "surveyor",
    origin: "https://surveyor.site.test",
    redirect_uri: "https://surveyor.site.test:3000/index.html",
    requested_scopes: "",
    // These are from metadata
    authorization_endpoint: "https://auth.site.test/oauth/authorize",
    token_endpoint: "https://auth.site.test/oauth/token",
  },
];

async function createAuthorizationRequest({
  client_id,
  redirect_uri,
  authorization_endpoint,
  requested_scopes,
}) {
  // Create and store a random "state" value
  const state = generateRandomString();

  // Create and store a new PKCE code_verifier (the plaintext random secret)
  const codeVerifier = generateRandomString();

  // Build the authorization URL
  const queryParams = new URLSearchParams({
    response_type: "code",
    client_id,
    state,
    scope: requested_scopes,
    redirect_uri,
    code_challenge: await pkceChallengeFromVerifier(codeVerifier),
    code_challenge_method: "S256",
  });

  const url = `${authorization_endpoint}?${queryParams.toString()}`;

  return {
    request: new Request(url, { method: "GET", credentials: "include" }),
    codeVerifier,
    state,
  };
}

function createAccessTokenRequest({
  token_endpoint,
  client_id,
  redirect_uri,
  code,
  codeVerifier,
}) {
  return new Request(token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id,
      redirect_uri,
      code_verifier: codeVerifier,
    }),
    credentials: "include",
  });
}

function getConfigForOrigin(request) {
  const { origin } = new URL(request.url);
  return config.find((item) => item.origin === origin);
}

// to intercept the request and add the access token to the Authorization header when hitting the protected resource URL.
async function attachBearerToken(request, clientId) {
  return request;

  console.log("attachBearerToken");

  const configItem = getConfigForOrigin(request);
  if (!configItem) {
    return request;
  }

  const { access_token } = tokenStore.get(configItem.origin) || {};

  if (access_token) {
    const headers = new Headers(request.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${access_token}`);
    }
    return new Request(request, { headers });
  } else {
    return request;
  }

  // This is old stuff

  const authorizationRequest = await createAuthorizationRequest(configItem);
  console.log("Authorization Request", authorizationRequest);

  try {
    const authorizationResponse = await fetch(authorizationRequest.request);
    console.log("Authorization Response", authorizationResponse);
  } catch (e) {
    console.log("ERROR:", e);
  }

  const { location } = { ...authorizationResponse.headers };

  const locationUrl = new URL(location);
  const redirectUrl = new URL(configItem.redirect_uri);

  console.log(
    "mal> no access token yet, but we have an authorization response"
  );
  console.log("mal> locationUrl.origin is " + locationUrl.origin);
  console.log("mal> redirectUrl.origin is " + redirectUrl.origin);

  if (locationUrl.origin !== redirectUrl.origin) {
    console.log("mal> ");
    await sendMessage({
      type: "redirect",
      data: { url: locationUrl },
      info: "redirecting to auth server",
    });
    // TODO: how to stop the request from going through?
    // google how to abort request
  }

  const queryParams = new URLSearchParams(locationUrl.search);
  const state = queryParams.get("state");

  if (state !== authorizationRequest.state) {
    throw new Error("State mismatch");
  }

  const code = queryParams.get("code");

  const accessTokenRequest = createAccessTokenRequest({
    token_endpoint: configItem.token_endpoint,
    client_id: configItem.client_id,
    redirect_uri: configItem.redirect_uri,
    code,
    codeVerifier: authorizationRequest.codeVerifier,
  });
  console.log("AuthToken Request", accessTokenRequest);

  const authTokenResponse = await fetch(accessTokenRequest);
  console.log("AuthToken Response", authTokenResponse);
}

const modifyResponse = (response) => {
  return response;
};

async function fetchWithBearerToken({ request, clientId }) {
  return fetch(request);

  const newRequest =
    request instanceof Request ? request : new Request(request);
  const attachBearerTokenFn = await attachBearerToken(newRequest, clientId);
  return fetch(attachBearerTokenFn).then(modifyResponse);
}

addEventListener("fetch", (event) => {
  event.respondWith(fetchWithBearerToken(event));
});
