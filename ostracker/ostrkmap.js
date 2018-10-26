function mainCtrl($scope)
{
	$scope.infobox = {};

	var locinfo=null;
	var gps = decodeURI(window.location.hash.slice(1));
	var sms = gps.toLowerCase();
	if (gps == "log")
	{
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "http://localhost/files/trknet.log", false);
		xhr.send();
		if (xhr.responseText.includes("tracker"))
			locinfo = parseNMEA(xhr.responseText);
	}
	else if (gps.includes("trkino"))
		locinfo = parseTrkino(gps);
	else if (gps.includes("imei") && gps.includes("tracker"))
		locinfo = parseNMEA(gps);
	else if (sms.includes("lat") && sms.includes("lon"))
		locinfo = parseSMS(sms);

	if (locinfo)
	{
		if (locinfo.dt)
		{
			$scope.infobox.line1 = fmtTimespan(locinfo.dt);
			$scope.infobox.line2 = locinfo.dt.toString();
		}

		var osMap = new OpenSpace.Map('map');
		var lonlat = new OpenLayers.LonLat(locinfo.lon, locinfo.lat);
		var gridProjection = new OpenSpace.GridProjection();
		var mapPoint = gridProjection.getMapPointFromLonLat(lonlat);
		osMap.setCenter(mapPoint, window.devicePixelRatio > 1 ? 8 : 7);
		osMap.createMarker(mapPoint);
	}
	else
		alert("Invalid GPS location:\n\n" + gps);

	function parseTrkino(txt)
	// #trkino,LOCATION,2,192218.000,0053.4246,N,-0002.3143,W,1,5,1.24,51.5,M,48.6,M,,,TIME,128,192218.000,17,10,2018,00,00
	// #trkino,LOCATION,2,190436.000,0053.4245,N,-0002.3144,W,,TIME,128,190440.000,24,10,2018,00,00
	{
		var info = {};

		var csv = txt.split(',');
		var l = csv.indexOf("LOCATION");
		var t = csv.indexOf("TIME");
		
		if (l < 0) return null;
		if (t < 0) return null;
		if ((t - l) < 6) return null;
		if ((csv.length - t) < 6) return null;

		info.lat = parseFloat(csv[l+3]);
		info.lon = parseFloat(csv[l+5]);

		info.dt = new Date(csv[t+5]+"-"+csv[t+4]+"-"+csv[t+3]+" "+csv[t+2].substr(0,2)+":"+csv[t+2].substr(2,2)+":"+csv[t+2].substr(4,2));
		info.dt.setMinutes(info.dt.getMinutes()-info.dt.getTimezoneOffset());
		
		return info;
	}

	function parseNMEA(txt)
	{
		var info = {};
		
		var csv = txt.split(',');
		if (csv.length < 11)
			return null;

		var t = csv[2];
		if (t.length < 12)
			return null;

		info.dt = new Date("20"+t.substr(0,2)+"-"+t.substr(2,2)+"-"+t.substr(4,2)+" "+t.substr(6,2)+":"+t.substr(8,2)+":"+t.substr(10,2));
		info.dt.setMinutes(info.dt.getMinutes()-info.dt.getTimezoneOffset());

		var dm = csv[7];
		if (dm.length < 9)
			return null;
		if (dm[4] != '.')
			return null;

		var lat;
		var d = dm.substr(0, 2);
		var m = dm.substr(2, 7);
		lat = (parseInt(d) + (parseFloat(m)/60));
		
		if (csv[8] == 'S')
			lat = (0 - lat);
		
		info.lat = lat;
		
		var dm = csv[9];
		if (dm.length < 10)
			return null;
		if (dm[5] != '.')
			return null;

		var lon;
		var d = dm.substr(0, 3);
		var m = dm.substr(3, 7);
		lon = (parseInt(d) + (parseFloat(m)/60));
		
		if (csv[10] == 'W')
			lon = (0 - lon);
		
		info.lon = lon;
		
		return info;
	}

	function parseSMS(txt)
	{
		var info = {};
		var i;

		i = txt.indexOf("lat:");
		if (i < 0) return null;
		info.lat = parseFloat(txt.substr(i+4));
		
		i = txt.indexOf("lon:");
		if (i < 0)
		{
			i = txt.indexOf("long:");
			if (i < 0) return null;
			info.lon = parseFloat(txt.substr(i+5));
		}
		else
		{
			info.lon = parseFloat(txt.substr(i+4));
		}

		i = txt.indexOf("T:");
		if (i < 0) return info;
		info.dt = new Date("20"+txt.substr(i+2, 17));
		
		return info;
	}

	function fmtTimespan(dt)
	{
		var t;

		var span = (Date.now() - dt.valueOf());
		var s = Math.floor(span/1000);
		var m = Math.floor(s/60);
		var h = Math.floor(m/60);

		var d=0;
		var cf = new Date();
		while (true)
		{
			if (dt.toDateString() == cf.toDateString())
				break;
			
			cf.setDate(cf.getDate() - 1);
			d++;
			
			if (d > 30)
			{
				d = Math.floor(h/24);
				break;
			}
		}
		
		if (d > 1) t = d + " days ago";
		else if ((d > 0) && (h > 12)) t = "Yesterday";
		else if (h > 1) t = h + " hours ago";
		else if (h > 0) t = "1 hour ago";
		else if (m > 1) t = m + " minutes ago";
		else if (m > 0) t = "1 minute ago";
		else t = "Just now";
		
		return t;
	}
}

//imei:868683022447472,tracker,171103024907,,F,014902.000,A,5301.6993,N,00236.2838,W,0.00,0;
//lat:53.2642 lon:-2.2349 T:17/11/21 11:30
