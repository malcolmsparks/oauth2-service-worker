import { generateRandomString, pkceChallengeFromVerifier } from "./utils.js";

async function authorization_code_request_info({
  authorization_endpoint,
  client_id,
  redirect_uri,
}) {
  const state = generateRandomString();

  const code_verifier = generateRandomString();
  const code_challenge = await pkceChallengeFromVerifier(code_verifier);

  const query_params = new URLSearchParams({
    response_type: "code",
    client_id,
    state,
    redirect_uri,
    code_challenge,
    code_challenge_method: "S256",
  });
  return {
    url: `${authorization_endpoint}?${query_params.toString()}`,
    state,
    code_verifier,
  };
}

async function postMessageToWorker(obj) {
  const registration = await navigator.serviceWorker.ready;
  const serviceWorker = registration.active;
  serviceWorker.postMessage(obj);
}

export function exchangeCodeForAccessToken({ query_params }) {
  const state1 = localStorage.getItem("pkce_state");
  const state2 = query_params.get("state");
  const code = query_params.get("code");

  if (!code || !state2) {
    console.log("No code or state in query params");
    return;
  }

  if (state1 !== state2) {
    console.error("State mismatch");
    return;
  }

  const redirect_uri = localStorage.getItem("oauth2_redirect_uri");
  const client_id = localStorage.getItem("oauth2_client_id");
  const code_verifier = localStorage.getItem("pkce_code_verifier");

  const payload_params = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirect_uri,
    client_id: client_id,
    code_verifier: code_verifier,
  });

  const token_endpoint = localStorage.getItem("oauth2_token_endpoint");

  return fetch(token_endpoint, {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/x-www-form-urlencoded",
    }),
    body: payload_params,
    credentials: "include",
  });
}

export async function authorize(config) {
  // store config in service worker
  postMessageToWorker({
    type: "storeConfig",
    config,
  });

  const { url, state, code_verifier } = await authorization_code_request_info(
    config
  );
  localStorage.setItem("pkce_state", state);
  localStorage.setItem("pkce_code_verifier", code_verifier);
  localStorage.setItem("oauth2_client_id", config.client_id);
  localStorage.setItem("oauth2_token_endpoint", config.token_endpoint);
  localStorage.setItem("oauth2_redirect_uri", config.redirect_uri);
  window.location = url;
}

export async function useOAuth2() {
  await navigator.serviceWorker.register("./service-worker.js");

  // we need this as a workaround to the fact that the service worker doesn't kick in with a hard refresh
  !navigator.serviceWorker.controller && location.reload();
}
