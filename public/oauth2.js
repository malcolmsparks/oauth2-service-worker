import { generateRandomString, pkceChallengeFromVerifier } from "./utils.js";

async function authorization_code_request_info({ authorization_endpoint, client_id, redirect_uri }) {
  const state = generateRandomString();

  const code_verifier = generateRandomString();
  const code_challenge = await pkceChallengeFromVerifier(code_verifier);

  const query_params = new URLSearchParams({
    response_type: "code",
    client_id,
    state,
    redirect_uri,
    code_challenge,
    code_challenge_method: "S256"
  });
  return {
    url: `${authorization_endpoint}?${query_params.toString()}`,
    state,
    code_verifier
  }
}

class ControlledFetch {

  constructor(config, uri, opts) {
    this.fetch = fetch(uri, opts);
    const { origin } = new URL(uri);
    this.config_item = config.find((item) => item.origin === origin);
  }

  async then(delegate) {
    if (this.config_item) {
      const ci = this.config_item;
      this.fetch.then(async function(response) {
	if (response.status == 401) {
	  const { url, state, code_verifier } = await authorization_code_request_info(ci);
	  localStorage.setItem("pkce_state", state);
	  localStorage.setItem("pkce_code_verifier", code_verifier);
	  throw new Error("TODO")
	} else {
	  delegate(response)
	}
      });
    } else {
      this.fetch.then(x);
    }
  }
}

function make_controlled_fetch(config) {
  return function(uri, opts) {
    return new ControlledFetch(config, uri, opts);
  };
}

export function useOAuth2(config) {
  return { controlled_fetch: make_controlled_fetch(config) }
}
