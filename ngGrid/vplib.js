
angular.module("vpApp", []);

//////////////////////////////////////////////////////////////////////

angular.module("vpApp").service("vpAccount", function($rootScope) {
	var auth = null;
	var status = {
		signed_in: false,
		msg: "Connecting..."
	};

	this.connect = function() {
		gapi.load("client:auth2", onLoadAuth);
	}

	function onLoadAuth() {
		var oauthScope = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.appdata';
		gapi.auth2.init({client_id: vpAPIClientID, scope: oauthScope}).then(onInitAuth, onFail);
	}

	function onInitAuth(au) {
		auth = au;
		auth.isSignedIn.listen(onSign);
		onSign();
	}

	function onSign() {
		status.signed_in = auth.isSignedIn.get();
		
		if (status.signed_in)
		{
			var gu = auth.currentUser.get();
			var bp = gu.getBasicProfile();
			status.msg = bp.getEmail();

			$rootScope.$broadcast("account:signin");
		}
		else
		{
			status.msg = "Signed Out";
			$rootScope.$broadcast("account:signout");
		}
	}

	function onFail(reason) {
		var msg = "";
		
		if (reason.error)
		{
			msg = "[" + reason.error + "]";

			if (reason.details)
				msg += reason.details;
		}

		status.msg = "Unable to sign in";
		alert("Account Error : " + msg);
	}

	this.SignIn = function() {
		auth.signIn();
	}

	this.SignOut = function() {
		auth.signOut();
	}
	
	this.status = status;
});



//////////////////////////////////////////////////////////////////////

angular.module("vpApp").service("vpSettings", function($rootScope) {
	var defaults = {
		title: "visual-planner",
		month_count: 6,
		auto_scroll: true,
		auto_scroll_offset: -1,
		first_month: 1,
		hide_scrollbars: false,
		align_weekends: true,
		weekends: "6,0",
		font_scale_pc: 100,
		past_opacity: 0.6,
		month_names: "Jan-Feb-Mar-Apr-May-Jun-Jul-Aug-Sep-Oct-Nov-Dec",
		proportional_events: false,
		proportional_start_hour: 8,
		proportional_end_hour: 20,
		show_all_day_events: true,
		single_day_as_multi_day: false,
		show_timed_events: true,
		multi_day_opacity: 0.8
	};

	var cfg = {};
	this.config = cfg;
	publish(defaults);
	
	var file_name = "settings002.json";
	var file_id = null;
	var appdata = null;

	function publish(settings) {
		angular.copy(settings, cfg);
	}

	this.revert = function() {
		publish(appdata ? appdata : defaults);
	}
	
	this.reset = function() {
		appdata = null;
		publish(defaults);
	}
	
	this.load = function() {
		loadFileID(function() {
			if (file_id) {
				gapi.client.request({
					path: "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(file_id),
					method: "GET",
					params: {alt: 'media'}
				})
				.then(rcv, fail);
			}
			else onLoad();

			function rcv(response) {
				appdata = JSON.parse(response.body);
				publish(appdata);
				loadGCalSettings();
			};
		});

		function loadGCalSettings() {
			gapi.client.request({
				path: "https://www.googleapis.com/calendar/v3/users/me/settings/format24HourTime",
				method: "GET",
				params: {}
			})
			.then(rcv, fail);

			function rcv(response) {
				if (response.result)
				if (response.result.kind == "calendar#setting")
				if (response.result.id == "format24HourTime")
					VpDateTime.time24h = (response.result.value == "true");

				onLoad();
			};
		};

		function onLoad() {
			$rootScope.$broadcast("settings:load");
		};
	}

	this.save = function() {
		appdata = angular.copy(cfg);

		loadFileID(function() {
			if (file_id) {
				write();
			}
			else {
				gapi.client.request({
					path: "https://www.googleapis.com/drive/v3/files",
					method: "POST",
					params: {uploadType: "resumable"},
					body: {name: file_name, mimeType:"application/json", parents: ['appDataFolder']}
				})
				.then(rcv, fail);
			}

			function rcv(response) {
				file_id = response.result.id;
				write();
			};
		});
		
		function write() {
			gapi.client.request({
				path: "https://www.googleapis.com/upload/drive/v3/files/" + encodeURIComponent(file_id),
				method: "PATCH",
				params: {uploadType: "media"},
				body: JSON.stringify(appdata)
			})
			.then(rcv, fail);

			function rcv(response) {
			};
		}
	}
	
	function loadFileID(thenDoThis) {
		if (file_id) {
			thenDoThis();
			return;
		}

		gapi.client.request({
			path: "https://www.googleapis.com/drive/v3/files",
			method: "GET",
			params: {q: "name = '" + file_name + "'", spaces: 'appDataFolder'}
		})
		.then(rcv, fail);

		function rcv(response) {
			if (response.result.files.length == 1)
				file_id = response.result.files[0].id;

			thenDoThis();
		}
	}

	function logFileInfo() {
		gapi.client.request({
			path: "https://www.googleapis.com/drive/v3/files",
			method: "GET",
			params: {spaces: 'appDataFolder'}
		})
		.then(rcv, fail);

		function rcv(response) {
			var files = response.result.files;
			console.log(files.length + " files");

			for (var i=0; i < files.length; i++)
				console.log(files[i]);
		}
	}

	function fail(reason) {
		alert(reason.result.error.message);
	}
});



//////////////////////////////////////////////////////////////////////

angular.module("vpApp").service("vpEvents", function($timeout, $window, vpSettings) {
	var calendarlist = {request: true, items: []};
	var isoSpan = {};

	this.load = function(datespan, fRcv) {
		isoSpan.start = new Date(datespan.start).toISOString();
		isoSpan.end = new Date(datespan.end).toISOString();

		if (calendarlist.request) {
			reqCalendars();
			calendarlist.request = false;
		}
		else {
			for (vpcal of calendarlist.items)
				vpcal.reqEvents();
		}

		function reqCalendars(tok) {
			gapi.client.request({
				path: "https://www.googleapis.com/calendar/v3/users/me/calendarList",
				method: "GET",
				params: tok ? {pageToken: tok} : {}
			})
			.then(rcv, fail);

			function rcv(response) {
				$timeout(function(){
					for (item of response.result.items) {
						if (item.selected)
							calendarlist.items.push(new VpCalendar(item));
					}
				}.bind(this));

				if (response.result.nextPageToken)
					reqCalendars(response.result.nextPageToken);
			};
		}

		function VpCalendar(item) {
			this.id = item.id;
			this.name = item.summary;
			this.colour = {fore: item.foregroundColor, back: item.backgroundColor};
			syncStg(this, false);

			this.reqEvents = function(tok) {
				var reqparams = {timeMin: isoSpan.start, timeMax: isoSpan.end, singleEvents: true};
				if (tok) reqparams.pageToken = tok;
				
				gapi.client.request({
					path: "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(this.id) + "/events",
					method: "GET",
					params: reqparams
				})
				.then(rcv.bind(this), fail);

				function rcv(response) {
					$timeout(function(){
						for (item of response.result.items) {
							var evt = new VpEvent(this, item);
							if (evt.id)
								fRcv(evt);
						}
					}.bind(this));

					if (response.result.nextPageToken)
						this.reqEvents(response.result.nextPageToken);
					else if (response.result.nextSyncToken)
						this.synctok = response.result.nextSyncToken;
				};
			}

			this.toggle = function() {
				if (this.cls)
					delete this.cls;
				else
					this.cls = {checked: true};

				syncStg(this, true);
			}

			function syncStg(cal, write) {
				var tog = JSON.parse($window.localStorage.getItem("vp-caltoginfo"));
				if (!tog)
					tog = {};

				if (write) {
					delete tog[cal.id];
					if (cal.cls)
						tog[cal.id] = true;

					$window.localStorage.setItem("vp-caltoginfo", JSON.stringify(tog));
				}
				else {
					if (tog[cal.id])
						cal.cls = {checked: true};
				}
			}
			
			this.reqEvents();
		}

		function VpEvent(cal, item) {
			if (item.kind != "calendar#event")
				return;

			if (item.hasOwnProperty("recurrence"))
				return;

			if (!item.hasOwnProperty("start"))
				return;

			this.id = item.id;
			
			if (item.status == "cancelled") {
				this.deleted = true;
				return;
			}
						
			this.cal = cal;
			this.htmlLink = item.htmlLink;
			
			if ("dateTime" in item.start)
			{
				this.timed = true;
				//this.timespan = {start: item.start.dateTime, end: item.end.dateTime};

				var vdttStart = new VpDateTime(item.start.dateTime);
				var vdttEnd = new VpDateTime(item.end.dateTime);

				this.start = vdttStart.ymd();
				this.duration = VpDate.DaySpan(vdttStart.ymd(), vdttEnd.ymd()) + 1;
				this.title = vdttStart.TimeTitle() + " " + item.summary;
			}
			else
			{
				this.timed = false;
				this.start = item.start.date;
				this.duration = VpDate.DaySpan(item.start.date, item.end.date);
				this.title = item.summary;
			}
			
			this.edit = function() {
				$window.open(this.htmlLink.replace("event?eid=", "r/eventedit/"));
			}
		}
	}

	function fail(reason) {
		alert(reason.result.error.message);
	}

	this.calinfo = calendarlist.items;
});



//////////////////////////////////////////////////////////////////////

angular.module("vpApp").service("vpAlmanac", function(vpSettings, vpEvents, $window) {
	var cfg = vpSettings.config;
	var vpmonths = [];

	this.makePage = function(pageoffset, pagelength) {
		VpDate.weekends = cfg.weekends.split(',').map(s => parseInt(s));
		VpDate.localemonth = cfg.month_names.split('-');
		
		var vdt = new VpDate();
		vdt.toStartOfMonth();
		vdt.offsetMonth(pageoffset);
		var isoStart = vdt.dt.toISOString();
		var datespan = {start: vdt.ymd()};

		vpmonths = [];
		for (var i=0; i < pagelength; i++) {
			vpmonths.push(new VpMonth(vdt.ymd()));
			vdt.offsetMonth(1);
			datespan.end = vdt.ymd();
		}
		
		vpEvents.load(datespan, rcvEvent);
	}

	this.getPage = function() {
		return vpmonths;
	}

	function VpMonth(ymd) {
		var vdt = new VpDate(ymd);
		
		this.hdr = vdt.MonthTitle();
		this.vpdays = [];
		this.cls = {};
		
		if (vdt.isPastMonth())
			this.cls.past = true;

		var m = vdt.getMonth();
		while (m == vdt.getMonth()) {
			this.vpdays.push(new VpDay(vdt));
			vdt.offsetDay(1);
		}
	}
	
	VpMonth.prototype.onclickHdr = function() {
		$window.open("https://www.google.com/calendar/r/month/" + new VpDate(this.vpdays[0].ymd).GCalURL());
	}

	function VpDay(vdt) {
		this.cls = {};
		this.ymd = vdt.ymd();
		this.num = vdt.DayOfMonth();

		if (cfg.align_weekends) {
			if (this.num == 1)
				this.cls["dayoffset" + vdt.DayOfWeek()] = true;
		}

		if (vdt.isWeekend())
			this.cls.weekend = true;

		if (VpDate.isToday(this.ymd))
			this.cls.today = true;
	}
	
	VpDay.prototype.addEvent = function(evt) {
		if (!this.evts)
			this.evts = [];
		
		this.evts.push(evt);
	}
	
	VpDay.prototype.onclickNum = function() {
		$window.open("https://www.google.com/calendar/r/week/" + new VpDate(this.ymd).GCalURL());
	}

	function rcvEvent(evt) {
/*
		var d = VpDate.DaySpan(vpdays[0].ymd, evt.start);
		for (var c=0; c < evt.duration; c++) {
			if (d >= 0)
			if (d < vpdays.length)
				vpdays[d].addEvent(evt);

			d++;
		}
*/
	}
});
			



//////////////////////////////////////////////////////////////////////

angular.module("vpApp").directive("vpGrid", function(vpSettings, vpAlmanac, $window, $timeout) {
	var cfg = vpSettings.config;
	var view = {sel: {}, cls: {}};
	var scrolling = false;

	var stg = $window.localStorage.getItem("vp-viewinfo");
	if (stg)
		view = JSON.parse(stg);
	else
		setViewInfo("column");

	function setViewInfo(name) {
		view.sel = {};
		view.sel[name] = true;

		view.cls = {};
		view.cls[name] = {checked: true};

		$window.localStorage.setItem("vp-viewinfo", JSON.stringify(view));
	}
	
	function fCtl($scope) {
		var box = document.getElementById("vpbox");
		var page;

		function resetPage() {
			page = {buffer: scrolling ? 6 : 0};
			
			if (cfg.auto_scroll) {
				page.offset = cfg.auto_scroll_offset - page.buffer;
			}
			else {
				var off = ((cfg.first_month-1) - new Date().getMonth());
				if (off > 0) off -= 12;
				page.offset = off - page.buffer;
			}
			
			page.length = page.buffer + cfg.month_count + page.buffer;
			page.visoffset = page.offset + page.buffer;

			angular.element(box).removeClass("hidescroll");
			if (cfg.hide_scrollbars)
				angular.element(box).addClass("hidescroll");
		}

		function updatePage() {
			showGrid(false);
			angular.element(box).off("scroll");

			$timeout(function() {
				vpAlmanac.makePage(page.offset, page.length);
				$scope.vpgrid.view = view;
				$scope.vpgrid.page = vpAlmanac.getPage();
				$scope.vpgrid.fontscale = vpSettings.config.font_scale_pc/100;
				$scope.vpgrid.past_opacity = vpSettings.config.past_opacity;
				$scope.vpgrid.scroll_size = scrolling ? (page.length / cfg.month_count)*100 : 100;
				$scope.vpgrid.scroll_size_portrait = scrolling ? $scope.vpgrid.scroll_size * 2 : 100;

				$timeout(function() {
					updateScrollPos();
					showGrid(true);

					if (scrolling)
						angular.element(box).on("scroll", onScroll);
				});
			});

			function updateScrollPos() {
				box.scrollTop = 0;
				box.scrollLeft = 0;
				
				if (!scrolling)
					return;

				if (view.sel.column) {
					var dim = (box.scrollWidth / page.length);
					box.scrollLeft = (page.visoffset - page.offset) * dim;
				}

				if (view.sel.list) {
					var dim = (box.scrollHeight / page.length);
					box.scrollTop = (page.visoffset - page.offset) * dim;
				}
			}

			var tmo=null;
			function onScroll(evt) {
				$timeout.cancel(tmo);

				if (view.sel.column) {
					var dim = (box.scrollWidth / page.length);
					page.visoffset = page.offset + Math.ceil((box.scrollLeft-1) / dim);
				}

				if (view.sel.list) {
					var dim = (box.scrollHeight / page.length);
					page.visoffset = page.offset + Math.ceil((box.scrollTop-1) / dim);
				}
				
				var pos = view.sel.list ? box.scrollTop : box.scrollLeft;
				var max = view.sel.list ? (box.scrollHeight - box.clientHeight) : (box.scrollWidth - box.clientWidth);

				var off = false;
				if (pos == 0) off = -1;
				if (pos >= max) off = 1;

				if (off)
					tmo = $timeout(offsetPage, 1000, true, off);
			}

			function offsetPage(off) {
				page.offset += (off * page.buffer);
				updatePage();
			}

			function showGrid(show) {
				document.getElementById("vpbox").style.visibility = show ? "" : "hidden";
			}
		}

		this.reset = function() {
			resetPage();
			updatePage();
		}

		this.set = function(off) {
			resetPage();
			page.offset = off;
			page.visoffset = page.offset + page.buffer;
			updatePage();
		}

		this.onclickView = function(name) {
			setViewInfo(name);
			resetPage();
			updatePage();
		}

		this.onclickPrint = function() {
			$window.open("vpprint.htm#" + page.visoffset);
		}
	}

	function fLink(scope, element, attrs) {
		if (!attrs.hasOwnProperty("disableScrolling"))
			scrolling = true;

		if (!attrs.hasOwnProperty("disableAutoload"))
			scope.vpgrid.reset();
	}

	return {
		controller: fCtl,
		controllerAs: "vpgrid",
		link: fLink,
		templateUrl: "vpgrid.htm",
		restrict: 'E'
	};
});



//////////////////////////////////////////////////////////////////////

angular.module("vpApp").directive("vpCalbar", function() {
	function fCtl($scope, vpEvents) {
		$scope.vpevents = vpEvents;
	}

	return {
		controller: fCtl,
		templateUrl: "vpcalbar.htm",
		restrict: 'E'
	};
});



//////////////////////////////////////////////////////////////////////

function VpDate(ymd)
{
	this.dt = new Date();

	this.dt.setHours(0,0,0,0);
	
	if (ymd)
		this.dt.setFullYear(parseInt(ymd.substr(0,4)), parseInt(ymd.substr(5,2))-1, parseInt(ymd.substr(8,2)));  // local
		//this.dt = new Date(ymd);  // utc
}

VpDate.prototype.ymd = function()
{
	return this.dt.getFullYear() + VpDate.ymdstr[this.dt.getMonth()] + VpDate.ymdstr[this.dt.getDate()-1];
}

VpDate.prototype.ymdnum = function()
{
	return ((this.dt.getFullYear()*10000) + ((this.dt.getMonth()+1)*100) + this.dt.getDate());
}

VpDate.prototype.getMonth = function()
{
	return this.dt.getMonth()+1;
}

VpDate.prototype.offsetDay = function(off)
{
	this.dt.setDate(this.dt.getDate() + off);
}

VpDate.prototype.offsetMonth = function(off)
{
	this.dt.setMonth(this.dt.getMonth() + off);
}

VpDate.prototype.toStartOfWeek = function(startday)
{
	while (this.dt.getDay() != startday)
		this.dt.setDate(this.dt.getDate() - 1);
}

VpDate.prototype.toStartOfMonth = function()
{
	this.dt.setDate(1);
}

VpDate.prototype.toStartOfYear = function()
{
	this.dt.setMonth(0);
	this.dt.setDate(1);
}

VpDate.prototype.DayOfMonth = function()
{
	return this.dt.getDate();
}

VpDate.prototype.DayOfWeek = function()
{
	return this.dt.getDay();
}

VpDate.prototype.isWeekend = function()
{
	return (VpDate.weekends.includes(this.dt.getDay()));
}

VpDate.prototype.isPastMonth = function()
{
	var today = new Date();
	
	if (this.dt.getYear() < today.getYear())
		return true;

	if (this.dt.getYear() > today.getYear())
		return false;
	
	return (this.dt.getMonth() < today.getMonth());
}

VpDate.prototype.MonthTitle = function()
{
	return fmt("^ ^", VpDate.localemonth[this.dt.getMonth()], this.dt.getFullYear());
}

VpDate.prototype.GCalURL = function()
{
	return fmt("^/^/^", this.dt.getFullYear(), this.dt.getMonth()+1, this.dt.getDate());
}

VpDate.ymdstr = ["-01", "-02", "-03", "-04", "-05", "-06", "-07", "-08", "-09", "-10",
	"-11", "-12", "-13", "-14", "-15", "-16", "-17", "-18", "-19", "-20",
	"-21", "-22", "-23", "-24", "-25", "-26", "-27", "-28", "-29", "-30", "-31"];

VpDate.weekends = [0, 6];
VpDate.localemonth = [];

VpDate.ymdtoday = new VpDate().ymd();

VpDate.isToday = function(ymd)
{
	return (ymd == VpDate.ymdtoday);
}

VpDate.DaySpan = function(ymd1, ymd2)
{
	return (Date.parse(ymd2) - Date.parse(ymd1))/86400000;
}




/////////////////////////////////////////////////////////////////

function VpDateTime(iso)
{
	this.dt = new Date(iso);
}

VpDateTime.prototype = new VpDate;

VpDateTime.prototype.DayMinutes = function()
{
	return ((this.dt.getHours()*60) + this.dt.getMinutes());
}

VpDateTime.prototype.TimeTitle = function()
{
	var hh = this.dt.getHours();
	var mm = this.dt.getMinutes();
	var ss = this.dt.getSeconds();
	
	var minutes = fmt((mm < 10) ? "0^" : "^", mm);

	if (VpDateTime.time24h)
	{
		return fmt("^:^", hh, minutes);
	}
	else
	{
		var hours = (hh > 12) ? (hh-12) : hh;
		return fmt((hh < 12) ? "^:^am" : "^:^pm", hours, minutes);
	}
}

VpDateTime.time24h = true;



/////////////////////////////////////////////////////////////////

function fmt(fmtspec)
// returns string consisting of format specification with '^' placeholders
// replaced in sequence by any parameters supplied
{
	var str = "";
	var arg=1;
	for (var i in fmtspec)
	{
		if (fmtspec[i] == '^')
		{
			if (arg < arguments.length)
			{
				str += arguments[arg];
				arg++;
			}
		}
		else
		{
			str += fmtspec[i];
		}
	}

	return str;
}
