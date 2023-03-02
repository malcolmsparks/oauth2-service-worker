import { generateRandomString, pkceChallengeFromVerifier } from "./utils.js";

export function exchangeCodeForAccessToken({ query_params }) {
  const state1 = localStorage.getItem("pkce_state");
  const state2 = query_params.get("state")

  if (state1 !== state2) {
    throw new Error("State mismatch")
  }

  const code = query_params.get("code")

  const redirect_uri = localStorage.getItem("oauth2_redirect_uri")
  const client_id = localStorage.getItem("oauth2_client_id")
  const code_verifier = localStorage.getItem("pkce_code_verifier")

  const payload_params = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirect_uri,
    client_id: client_id,
    code_verifier: code_verifier
  });

  const token_endpoint = localStorage.getItem("oauth2_token_endpoint")

  fetch(token_endpoint,
	{ method: 'POST',
	  headers: new Headers({"Content-Type": "application/x-www-form-urlencoded"}),
	  body: payload_params,
	  credentials: 'include' })
    .then(response => { console.dir(response) })

}
