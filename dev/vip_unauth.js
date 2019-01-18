//////////////////////////////////////////////////////////////////////

function UnAuthCal()
{
	// initialise
	this.datespan = {dtStart: null, dtEnd: null};
	this.forwardEvent = function(){};
	this.api_key = "";

	// private
	this.calendars = {};
	this.xhttp = new XMLHttpRequest();
}

UnAuthCal.prototype.addCal = function(id)
{
	this.calendars[id] = {clr: "#2b67cf", set_clr: true};
}

UnAuthCal.prototype.setClr = function(clr)
{
	for (id in this.calendars)
	{
		var cal = this.calendars[id];

		if (cal.set_clr)
		{
			cal.clr = clr;
			cal.set_clr = false;
			break;
		}
	}
}

UnAuthCal.prototype.loadEvents = function()
{
	this.isoStart = this.datespan.dtStart.toISOString();
	this.isoEnd = this.datespan.dtEnd.toISOString();

	for (id in this.calendars)
	{
		var path =
			"https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(id) + "/events" +
			"?timeMin=" + this.isoStart +
			"&timeMax=" + this.isoEnd +
			"&key=" + this.api_key
		;

		this.xhttp.onreadystatechange = this.rcvEvents.bind(this, id);
		this.xhttp.open("GET", path);
		this.xhttp.send();
	}
}

UnAuthCal.prototype.rcvEvents = function(callsign)
{
	if (this.xhttp.readyState == 4 && this.xhttp.status == 200)
	{
		var response = JSON.parse(this.xhttp.responseText);
		var cal = this.calendars[callsign];
		
		for (var i in response.items)
		{
			var item = response.items[i];

			if (item.kind == "calendar#event")
			if (item.status != "cancelled")
			if (!item.hasOwnProperty("recurrence"))
			if (item.hasOwnProperty("start"))
			{
				var evt = {
					id: item.id,
					title: item.summary,
					htmlLink: item.htmlLink,
					colour: cal.clr,
					calendar: response.summary
				};
				
				if ("dateTime" in item.start)
				{
					evt.timed = true;
					evt.timespan = {start: item.start.dateTime, end: item.end.dateTime};
				}
				else
				{
					evt.timed = false;
					evt.datespan = {start: item.start.date, end: item.end.date};
				}
			}

			this.forwardEvent(evt);
		}
	}

/*
	if (response.nextPageToken)
		this.reqEvents({pageToken: response.result.nextPageToken, timeMin: this.isoStart, timeMax: this.isoEnd}, this.rcvLoadEvents, callsign);
*/
}
