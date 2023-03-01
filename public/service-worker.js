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

self.addEventListener("message", (event) => {
  if (event.data.type === "update") {
    const data = event.data.data;
    console.log("data:", data);
  }
});

const tokenStore = new Map();

const config = [
  {
    origin: "https://home.juxt.site",
    client_id: "alx-app",
    token_endpoint: "https://auth.home.juxt.site/oauth/token",
    authorization_endpoint: "https://auth.home.juxt.site/oauth/authorize",
    redirect_uri: "http://localhost:3000/index.html",
    requested_scopes: "",
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
    request: new Request(url, { method: "GET", mode: "no-cors" }),
    codeVerifier,
    state,
  };
}

function createAuthTokenRequest({
  token_endpoint,
  client_id,
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
async function attachBearerToken(request) {
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
  }

  const authorizationRequest = await createAuthorizationRequest(configItem);
  console.log("Authorization Request", authorizationRequest);

  const authorizationResponse = await fetch(authorizationRequest.request);
  console.log("Authorization Response", authorizationResponse);

  const authTokenRequest = createAuthTokenRequest({
    token_endpoint: configItem.token_endpoint,
    client_id: configItem.client_id,
    code: "TODO: grab from authorization respone?",
    codeVerifier: authReq.codeVerifier,
  });
  console.log("AuthToken Request", authTokenRequest);

  const authTokenResponse = await fetch(authTokenRequest);
  console.log("AuthToken Response", authTokenResponse);
}

const modifyResponse = async (response) => {
  return response;
};

async function fetchWithBearerToken(input, init) {
  const request = input instanceof Request ? input : new Request(input, init);
  const attachBearerTokenFn = await attachBearerToken(request);
  return fetch(attachBearerTokenFn);
  // .then(modifyResponse);
}

addEventListener("fetch", (event) => {
  event.respondWith(fetchWithBearerToken(event.request));
});
