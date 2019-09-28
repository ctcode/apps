var vpAPIClientID = window.localStorage.getItem("vp-APIClientID");
if (!vpAPIClientID)
{
	vpAPIClientID = window.prompt("API Client ID");
	if (vpAPIClientID)
		window.localStorage.setItem("vp-APIClientID", vpAPIClientID);
}

var vpAPIKey = window.localStorage.getItem("vp-APIKey");
if (!vpAPIKey)
{
	vpAPIKey = window.prompt("API Key");
	if (vpAPIKey)
		window.localStorage.setItem("vp-APIKey", vpAPIKey);
}

function ga_hit(category, action) {}
