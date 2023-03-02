class ControlledFetch {

  constructor(config, uri, opts) {
    this.fetch = fetch(uri, opts);
    const { origin } = new URL(uri);
    this.config_item = config.find((item) => item.origin === origin);
  }

  then(x) {
    if (this.config_item) {
      this.fetch.then(response => {
	if (response.status == 401) {
	  console.log("TODO: let's authorize");
	  console.dir(response);
	  console.dir(this.config_item);
	  throw new Error("TODO: write authorize fetch");
	} else {
	  x(response)
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
