var osMap;
var pos_marker=null;

function map_init()
{
	var div = document.createElement('div');
	div.id = 'map';
	div.style.position = "absolute";
	div.style.left = "0px";
	div.style.top = "0px";
	div.style.width = "100%";
	div.style.height = "100%";
	document.body.appendChild(div);

/*
	var btn = document.createElement('button');
	btn.innerHTML = "[+]";
	btn.onclick=function(){document.getElementById("map").webkitRequestFullScreen()};
	btn.style.position = "absolute";
	btn.style.left = div.offsetWidth - 40;
	btn.style.top = 10;
	btn.style.zIndex = "10";
	document.body.appendChild(btn);
*/

	osMap = new OpenSpace.Map('map');

	var xhttp = new XMLHttpRequest();
	xhttp.open("GET", "http://localhost/files/canals.gpx", false);
	xhttp.send();

	var parser = new DOMParser();
	var gpxdoc = parser.parseFromString(xhttp.responseText, "text/xml");

	var fmtgpx = new OpenLayers.Format.GPX({
		internalProjection: new OpenLayers.Projection("EPSG:27700"),
		extractWaypoints:false,
		extractTracks:true,
		extractRoutes:true,
		extractAttributes:false
	});

/*
	var fmtkml = new OpenLayers.Format.KML({
		internalProjection: new OpenLayers.Projection("EPSG:27700"),
		//extractWaypoints:false,
		extractTracks:false,
		//extractRoutes:true,
		extractAttributes:false
	});
*/

	osMap.getVectorLayer().addOptions({style: {strokeColor: "blue", strokeWidth: 15, strokeOpacity: 0.3}}, false);
	osMap.getVectorLayer().addFeatures(fmtgpx.read(gpxdoc));

	LoadMarkers();
	LoadPosition(true);

	osMap.events.register("click", this, this.onMapClick);
	
	var h = window.location.hash;
	if (h.contains("eastings"))
	if (h.contains("northings"))
	{
		var e = parseInt(h.substr(h.search("eastings")+9));
		var n = parseInt(h.substr(h.search("northings")+10));
		var pos = new OpenSpace.MapPoint(e, n);
		var size = new OpenLayers.Size(33, 45);
		var offset = new OpenLayers.Pixel(-16, -37);
		var icon = new OpenSpace.Icon('http://openspace.ordnancesurvey.co.uk/osmapapi/img_versions/img_1.1/OS/images/markers/marker_green.png', size, offset);
		var marker = osMap.createMarker(pos, icon);
		marker.events.register('click', marker, function(evt) {
			if (evt.ctrlKey)
			{
				osMap.removeMarker(marker);
				CreateMarker(e,n);
				SaveMarkers();
				alert("Saved marker: Easting=" + e + " Northing=" + n);
			}
			OpenLayers.Event.stop(evt);
		});
		osMap.setCenter(pos, 5);
	}
}

function onMapClick(evt)
{
	if (evt.ctrlKey && !evt.shiftKey)
	{
		var click_pos = osMap.getLonLatFromViewPortPx(evt.xy);

		CreateMarker(click_pos.lon, click_pos.lat);
		SaveMarkers();
		SavePosition(click_pos.lon, click_pos.lat);

		OpenLayers.Event.stop(evt);
	}
}

function onMarkerClick(evt)
{
	if (evt.ctrlKey)
	{
		if (evt.shiftKey)
		{
			SavePosition(this.lonlat.lon, this.lonlat.lat);
			LoadPosition(false);
		}
		else
		{
			osMap.removeMarker(this);
			SaveMarkers();
		}

		OpenLayers.Event.stop(evt);
	}
}

function CreateMarker(lon, lat)
{
	var pos = new OpenSpace.MapPoint(lon, lat);
	var size = new OpenLayers.Size(33, 45);
	var offset = new OpenLayers.Pixel(-16, -37);
	var icon = new OpenSpace.Icon('http://openspace.ordnancesurvey.co.uk/osmapapi/img_versions/img_1.1/OS/images/markers/marker_grey.png', size, offset);
	var marker = osMap.createMarker(pos, icon);
	marker.events.register('click', marker, onMarkerClick);
}

function LoadMarkers()
{
	if (window.localStorage && "osnav-markers" in localStorage)
	{
		var markers = JSON.parse(localStorage["osnav-markers"]);

		for (key in markers)
			CreateMarker(markers[key].lon, markers[key].lat);
	}
}

function SaveMarkers()
{
	var markers = {};
	var lyr = osMap.getMarkerLayer();
	for (i in lyr.markers)
	{
		//console.log(lyr.markers[i]);
		//markers.push({lon: lyr.markers[i].lonlat.lon, lat: lyr.markers[i].lonlat.lat});
		var m = lyr.markers[i].lonlat;
		markers[m.lon + "." + m.lat] = {lon: m.lon, lat: m.lat};
	}

	localStorage["osnav-markers"] = JSON.stringify(markers);
}

function LoadPosition(set_scale)
{
	if (window.localStorage && "osnav-position" in localStorage)
	{
		var pos = JSON.parse(localStorage["osnav-position"]);
		
		updatePosMarker(pos.lon, pos.lat);
		osMap.setCenter(new OpenSpace.MapPoint(pos.lon, pos.lat), set_scale ? 5:null);
	}
	else
		osMap.setCenter(new OpenSpace.MapPoint(379200, 392000), 5);  // Sale
}

function SavePosition(pos_lon, pos_lat)
{
	if (window.localStorage)
	{
		localStorage["osnav-position"] = JSON.stringify({lon: pos_lon, lat: pos_lat});
		updatePosMarker(pos_lon, pos_lat);
	}
}

function updatePosMarker(pos_lon, pos_lat)
{
	if (pos_marker)
		osMap.removeMarker(pos_marker);

	var pos = new OpenSpace.MapPoint(pos_lon, pos_lat);
	var size = new OpenLayers.Size(33, 45);
	var offset = new OpenLayers.Pixel(-16, -37);
	var icon = new OpenSpace.Icon('http://openspace.ordnancesurvey.co.uk/osmapapi/img_versions/img_1.1/OS/images/markers/marker_red.png', size, offset);
	pos_marker = osMap.createMarker(pos, icon);
	pos_marker.events.register('click', pos_marker, function() {});
}

var segnext=0;
var seglist=null;
function marktrkseg(showseg)
{
	if (seglist == null)
	{
		var xhttp = new XMLHttpRequest();
		xhttp.open("GET", "http://localhost/files/canals.gpx", false);
		xhttp.send();

		var parser = new DOMParser();
		var gpxdoc = parser.parseFromString(xhttp.responseText, "text/xml");
		seglist = gpxdoc.getElementsByTagName("trkseg");
		console.log("track segments loaded: " + seglist.length);
	}
	
	if (showseg == -1)
		segnext++;
	else
		segnext = showseg;

	console.log("segment: " + segnext);
	
	var trkptlist = seglist[segnext].getElementsByTagName("trkpt");
	for (var i=0; i < trkptlist.length; i++)
	{
		var trkpt = trkptlist[i];

		var pos = new OpenSpace.MapPoint(trkpt.getAttribute("lon"), trkpt.getAttribute("lat"));
		var size = new OpenLayers.Size(33, 45);
		var offset = new OpenLayers.Pixel(-16, -37);
		var icon = new OpenSpace.Icon('http://openspace.ordnancesurvey.co.uk/osmapapi/img_versions/img_1.1/OS/images/markers/marker_yellow.png', size, offset);
		var marker = osMap.createMarker(pos, icon);
		marker.events.register('click', marker, function(lat, lon){console.log("lat: " + lat + " - lon: " + lon);}.bind(this, trkpt.getAttribute("lat"), trkpt.getAttribute("lon")));
	}
}
