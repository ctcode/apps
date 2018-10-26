var osMap;

function init_map(os_map_point, zoom)
{
	var div = document.createElement('div');
	div.id = 'map';
	div.style.position = "absolute";
	div.style.left = "0px";
	div.style.top = "0px";
	div.style.width = "100%";
	div.style.height = "100%";
	document.body.appendChild(div);

	osMap = new OpenSpace.Map('map');
	osMap.events.on({"moveend": onMapMove});

	if (os_map_point && zoom)
		osMap.setCenter(os_map_point, zoom);
	else if (window.localStorage && "osview-lon" in localStorage && "osview-lat" in localStorage && "osview-zoom" in localStorage)
		osMap.setCenter(new OpenSpace.MapPoint(localStorage["osview-lon"], localStorage["osview-lat"]), localStorage["osview-zoom"]);
	else
		osMap.setCenter(new OpenSpace.MapPoint(379200, 392000), 5);  // Sale
}

function onMapMove(evt)
{
	if (window.localStorage)
	{
		localStorage["osview-lon"] = evt.object.center.lon;
		localStorage["osview-lat"] = evt.object.center.lat;
		localStorage["osview-zoom"] = evt.object.zoom;
	}
}

function geolocate()
{
	if (navigator.geolocation)
		navigator.geolocation.getCurrentPosition(geolocate_found, geolocate_fail, {enableHighAccuracy: false, timeout: 3000, maximumAge: 60000});
	else
		init_map(null);
}

function geolocate_found(position)
{
	var lonlat = new OpenLayers.LonLat(position.coords.longitude, position.coords.latitude);
	var gridProjection = new OpenSpace.GridProjection();
	var mapPoint = gridProjection.getMapPointFromLonLat(lonlat);

	init_map(mapPoint, 8);
};

function geolocate_fail(pos_error)
{
	if (pos_error.code == pos_error.PERMISSION_DENIED)
		init_map(null);
	else
	{
		if (confirm("\n\nUnable to get current location.\n\n(" + pos_error.message + ")\n\nTry again?\n\n"))
			geolocate();
		else
			init_map(null);
	}
};
