var osMap;
var mapPoint;

function init_map()
{
	var gps = decodeURI(window.location.hash.slice(1));
	var locinfo = parseTrkino(gps);

	if (locinfo)
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

		var lonlat = new OpenLayers.LonLat(locinfo.lon, locinfo.lat);
		var gridProjection = new OpenSpace.GridProjection();
		mapPoint = gridProjection.getMapPointFromLonLat(lonlat);
		osMap.setCenter(mapPoint, window.devicePixelRatio > 1 ? 8 : 7);
		var marker = osMap.createMarker(mapPoint);
		marker.events.register('click', marker, onMarkerClick);
	}
	else
		document.write("Invalid GPS location:  " + gps);
}

function parseTrkino(txt)
// #2,223056.000,0053.4246,N,-0002.3142,W,
{
	var info = {};

	var csv = txt.split(',');
	if (csv.length < 5) return null;

	info.lat = parseFloat(csv[2]);
	info.lon = parseFloat(csv[4]);
	
	return info;
}

function onMarkerClick(evt)
{
	if (evt.ctrlKey)
	{
		window.location.replace("http://localhost/apps/osnav/osnav.htm#" + mapPoint.toString());
		OpenLayers.Event.stop(evt);
	}
}
