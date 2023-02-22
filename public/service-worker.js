
// to immediately install the service worker
addEventListener('install', (event) => {
  // install on all site tabs without waiting for them to be opened
  skipWaiting()
})

// to immediately activate the service worker
addEventListener('activate', (event) => {
  // activate on all tabs without waiting for them to be opened
  event.waitUntil(clients.claim())
})

// used only for refresh token
// const OAUTH2_CLIENT_ID = new URLSearchParams(location.search).get('lazy_oauth2_client_id') || ''
const OAUTH2_TOKEN_URL = new URLSearchParams(location.search).get('lazy_oauth2_token_url') || ''
const OAUTH2_PROTECTED_RESOURCE_URL = new URLPattern(
  Object.fromEntries(
    [...new URLSearchParams(location.search).entries()]
      .filter(([key]) => key.startsWith('lazy_oauth2_protected_'))
      .map(([key, value]) => [key.replace('lazy_oauth2_protected_', ''), value])
  )
)

const oauth2 = {
  access_token: '',
  token_type: '',
  expires_in: 0,
  refresh_token: '',
}

const isOauth2TokenURL = (url) => OAUTH2_TOKEN_URL === url
const isOauth2ProtectedResourceURL = (url) =>
  OAUTH2_PROTECTED_RESOURCE_URL.test(url)

// to intercept the request and add the access token to the Authorization header when hitting the protected resource URL.
const modifyRequest = (request) => {
  if (isOauth2ProtectedResourceURL(request.url) && oauth2.token_type && oauth2.access_token) {
    console.log("we are here in authorized endpoint")
    const headers = new Headers(request.headers)
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `${oauth2.token_type} ${oauth2.access_token}`)
    }
    return new Request(request, { headers })
  }

  return request
}

// to intercept the response containing the access token. For all other responses, the original response is returned.
const modifyResponse = async (response) => {
  if (isOauth2TokenURL(response.url) && response.status === 200) {
    const { access_token, token_type, expires_in, refresh_token, ...payload } =
      await response.json()

    oauth2.access_token = access_token
    oauth2.token_type = token_type
    oauth2.expires_in = expires_in
    oauth2.refresh_token = refresh_token

    console.log('oauth2', oauth2)

    return new Response(JSON.stringify(payload, null, 2), {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    })
  }

  return response
}

const fetchWithCredentials = (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init)
  return fetch(modifyRequest(request)).then(modifyResponse)
}

addEventListener('fetch', (event) => {
  event.respondWith(fetchWithCredentials(event.request))
})
