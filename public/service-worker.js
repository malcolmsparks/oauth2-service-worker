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
const configStore = new Map();

self.addEventListener("message", (event) => {
  console.log("new message received in worker:", event.data);

  const type = event.data.type;

  switch (type) {
    case "storeConfig":
      configStore.set(event.data.config.origin, event.data.config);
      break;
    default:
      console.log("type:", type, "not handled");
  }
});

// to intercept the request and add the access token to the Authorization header when hitting the protected resource URL.
async function attachBearerToken(request, _clientId) {
  const { origin } = new URL(request.url);

  const configItem = configStore.get(origin);
  if (!configItem) {
    return request;
  }

  const accessToken = tokenStore.get(configItem.origin);

  if (accessToken) {
    const headers = new Headers(request.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    return new Request(request, { headers });
  } else {
    return request;
  }
}

function isTokenEndpoint(url) {
  for (const [_, value] of configStore) {
    if (value.token_endpoint === url) {
      return value;
    }
  }
}

const modifyResponse = async (response) => {
  const url = response.url;
  const configItem = isTokenEndpoint(url);

  if (!configItem) {
    return response;
  }

  const { access_token, ...payload } = await response.json();

  tokenStore.set(configItem.origin, access_token);

  return new Response(JSON.stringify(payload, null, 2), {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
};

async function fetchWithBearerToken({ request, clientId }) {
  const newRequest =
    request instanceof Request ? request : new Request(request);
  const attachBearerTokenFn = await attachBearerToken(newRequest, clientId);
  return fetch(attachBearerTokenFn).then(modifyResponse);
}

addEventListener("fetch", (event) => {
  event.respondWith(fetchWithBearerToken(event));
});
