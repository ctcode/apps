
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
		auto_page: true,
		first_month: 1,
		hide_scrollbars: false,
		align_weekends: true,
		weekends: "6,0",
		first_day_of_week: 1,
		font_scale_pc: 100,
		past_opacity: 0.6,
		month_names: "Jan-Feb-Mar-Apr-May-Jun-Jul-Aug-Sep-Oct-Nov-Dec",
		proportional_events: false,
		proportional_start_hour: 8,
		proportional_end_hour: 20,
		show_all_day_events: true,
		single_day_as_multi_day: false,
		show_timed_events: true,
		event_on_separate_line: false,
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

angular.module("vpApp").service("vpEvents", function($timeout, $window, vpAccount) {
	var calendars;
	var reqcal;
	var isoSpan = {};
	var tmo=null;
	var fAddEvent = function(){};
	var fRemoveEvent = function(){};

	function load() {
		if (reqcal) {
			reqCalendars({});
		}
		else {
			for (cal of calendars)
				cal.loadEvents();
		}
	}

	function reqCalendars(reqparams) {
		if (!vpAccount.status.signed_in)
			return;

		gapi.client.request({
			path: "https://www.googleapis.com/calendar/v3/users/me/calendarList",
			method: "GET",
			params: reqparams
		})
		.then(rcv, fail);

		function rcv(response) {
			$timeout.cancel(tmo);
			for (item of response.result.items) {
				if (item.selected)
					calendars.push(new VpCalendar(item));
			}

			if (response.result.nextPageToken) {
				reqparams.pageToken = response.result.nextPageToken;
				reqCalendars(reqparams);
			}

			tmo = $timeout(1000);
		};

		reqcal = false;
	}

	function VpCalendar(item) {
		var cal = this;
		var id = item.id;
		var synctok = null;
		var cls = {};
		this.name = item.summary;
		this.colour = {fore: item.foregroundColor, back: item.backgroundColor};
		this.cls = cls;
		syncStg(false);

		function reqEvents(reqparams) {
			if (!vpAccount.status.signed_in)
				return;
			
			gapi.client.request({
				path: "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(id) + "/events",
				method: "GET",
				params: reqparams
			})
			.then(rcv, reqfail);

			function rcv(response) {
				$timeout.cancel(tmo);

				for (item of response.result.items)
					makeEvent(item);

				if (response.result.nextPageToken) {
					reqparams.pageToken = response.result.nextPageToken;
					reqEvents(reqparams);
				}
				else if (response.result.nextSyncToken)
					synctok = response.result.nextSyncToken;

				tmo = $timeout(1000);
			};
		
			function makeEvent(item) {
				if (item.kind != "calendar#event")
					return;
		
				if (item.status == "cancelled") {
					fRemoveEvent(item.id);
					return;
				}

				if (item.hasOwnProperty("recurrence"))
					return;

				if (!item.hasOwnProperty("start"))
					return;

				if (reqparams.syncToken)
					fRemoveEvent(item.id);

				fAddEvent(new VpEvent(cal, item));
			}
		
			function reqfail(reason) {
				if (reason.status == 410) {
					fRemoveEvent();
					load();
				}
				else
					fail(reason);
			};
		}

		this.loadEvents = function() {
			reqEvents({timeMin: isoSpan.start, timeMax: isoSpan.end, singleEvents: true});
		}

		this.syncEvents = function() {
			reqEvents({syncToken: synctok, singleEvents: true});
		}

		this.toggle = function() {
			cls.checked = cls.checked ? false : true;
			syncStg(true);
		}

		function syncStg(write) {
			var tog = JSON.parse($window.localStorage.getItem("vp-caltoginfo"));
			if (!tog)
				tog = {};

			if (write) {
				delete tog[id];
				if (cls.checked)
					tog[id] = true;

				$window.localStorage.setItem("vp-caltoginfo", JSON.stringify(tog));
			}
			else {
				if (tog[id])
					cls.checked = true;
			}
		}
		
		this.loadEvents();
	}

	function VpEvent(cal, item) {
		this.id = item.id;
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

	var msg=true;
	function fail(reason) {
		console.error(reason);

		if (msg) {
			alert("Calendar event error.\n\n" + reason.result.error.message);
			msg = false;
		}
	}

	this.reset = function() {
		reqcal = true;
		calendars = [];
		this.calendars = calendars;
	}

	this.register = function(add, remove) {
		fAddEvent = add;
		fRemoveEvent = remove;
	}

	this.setDateSpan = function(span) {
		isoSpan.start = new Date(span.start).toISOString();
		isoSpan.end = new Date(span.end).toISOString();
	}

	this.load = function() {
		load();
	}

	this.reload = function() {
		fRemoveEvent();
		load();
	}

	this.sync = function() {
		for (cal of calendars)
			cal.syncEvents();
	}

	this.reset();
});



//////////////////////////////////////////////////////////////////////

angular.module("vpApp").service("vpAlmanac", function(vpSettings, vpEvents, $window) {
	var cfg = vpSettings.config;
	var vpmonths = [];
	var vpdays = [];
	var datespan;
	vpEvents.register(addEvent, removeEvent);

	this.makePage = function(pageoffset, pagelength) {
		VpDate.weekends = cfg.weekends.split(',').map(s => parseInt(s));
		VpDate.localemonth = cfg.month_names.split('-');
		
		var vdt = new VpDate();
		vdt.toStartOfMonth();
		vdt.offsetMonth(pageoffset);
		var isoStart = vdt.dt.toISOString();
		datespan = {start: vdt.ymd()};

		vpmonths = [];
		vpdays = [];
		for (var i=0; i < pagelength; i++) {
			vpmonths.push(new VpMonth(vdt.ymd(), pageoffset + i));
			vdt.offsetMonth(1);
			datespan.end = vdt.ymd();
		}

		vpEvents.setDateSpan(datespan);
		vpEvents.load();
	}

	this.getPage = function() {
		return vpmonths;
	}

	function addEvent(evt) {
		var d = VpDate.DaySpan(vpdays[0].ymd, evt.start);
		for (var c=0; c < evt.duration; c++) {
			if (vpdays[d])
				vpdays[d].addEvent(evt);

			d++;
		}
	}

	function removeEvent(id) {
		var month;
		for (month of vpmonths)
			month.removeEvent(id);
	}

	function VpMonth(ymd, off) {
		var vdt = new VpDate(ymd);

		this.offset = off;
		this.hdr = vdt.MonthTitle();
		this.vpdays = [];
		this.cls = {};
		
		if (vdt.isPastMonth())
			this.cls.past = true;

		var m = vdt.getMonth();
		while (m == vdt.getMonth()) {
			var vpday = new VpDay(this, vdt);
			this.vpdays.push(vpday);
			vpdays.push(vpday);
			vdt.offsetDay(1);
		}
		
		this.removeEvent = function(id) {
			if (id) {
			}
			else
				delete this.evts;
			
			var day;
			for (day of this.vpdays)
				day.removeEvent(id);
		}
	}
	
	VpMonth.prototype.onclickHdr = function() {
		$window.open("https://www.google.com/calendar/r/month/" + new VpDate(this.vpdays[0].ymd).GCalURL());
	}

	function VpDay(vpmonth, vdt) {
		this.ymd = vdt.ymd();
		this.num = vdt.DayOfMonth();
		this.cls = {};

		if (cfg.align_weekends) {
			if (this.num == 1) {
				var dayoffset = vdt.DayOfWeek() - cfg.first_day_of_week;
				
				if (dayoffset < 0)
					dayoffset += 7;

				this.cls["dayoffset" + dayoffset] = true;
			}
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
	
	VpDay.prototype.removeEvent = function(id) {
		if (this.evts) {
			if (id) {
				for (var i=0; i < this.evts.length; i++) {
					if (this.evts[i].id == id)
						this.evts.splice(i, 1);
				}
			}
			else
				delete this.evts;
		}
	}
	
	VpDay.prototype.onclickNum = function() {
		$window.open("https://www.google.com/calendar/r/week/" + new VpDate(this.ymd).GCalURL());
	}
});




//////////////////////////////////////////////////////////////////////

angular.module("vpApp").directive("vpGrid", function(vpSettings, vpAlmanac, vpEvents, $window, $timeout) {
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
		var ngbox = angular.element(box);
		var grid;

		function initUI() {
			grid = {buffer: 0, offset: 0, length: 0, pos: 0};
			
			if (scrolling)
				grid.buffer = 6;
			
			if (cfg.auto_scroll) {
				grid.offset = cfg.auto_scroll_offset - grid.buffer;
			}
			else {
				var off = ((cfg.first_month-1) - new Date().getMonth());
				if (off > 0) off -= 12;
				grid.offset = off - grid.buffer;
			}
			
			grid.length = grid.buffer + cfg.month_count + grid.buffer;
			grid.pos = grid.offset + grid.buffer;

			ngbox.removeClass("hidescroll");
			if (cfg.hide_scrollbars)
				ngbox.addClass("hidescroll");
		}

		function updateUI() {
			box.style.visibility = "hidden";
			ngbox.off("scroll");

			$timeout(function() {
				vpAlmanac.makePage(grid.offset, grid.length);
				$scope.vpgrid.view = view;
				$scope.vpgrid.page = vpAlmanac.getPage();
				$scope.vpgrid.fontscale = cfg.font_scale_pc/100;
				$scope.vpgrid.past_opacity = cfg.past_opacity;
				$scope.vpgrid.scroll_size = scrolling ? (grid.length / cfg.month_count)*100 : 100;
				$scope.vpgrid.scroll_size_portrait = scrolling ? $scope.vpgrid.scroll_size * 2 : 100;
				$scope.vpgrid.cls = cfg.event_on_separate_line ? {} : {vpeventsingleline: true};

				$timeout(function() {
					setScrollIndex(grid.pos - grid.offset);
					box.style.visibility = "";
					box.focus();

					if (scrolling)
						ngbox.on("scroll", onScroll);
				});
			});
		}

		var tmo=null;
		function onScroll(evt) {
			$timeout.cancel(tmo);

			grid.pos = vpAlmanac.getPage()[getScrollIndex()].offset;
			
			if (cfg.auto_page) {
				var pos = view.sel.list ? box.scrollTop : box.scrollLeft;
				var max = view.sel.list ? (box.scrollHeight - box.clientHeight) : (box.scrollWidth - box.clientWidth);

				var off = false;
				if (pos == 0) off = -1;
				if (pos >= max) off = 1;

				if (off)
					tmo = $timeout(offsetPage, 1000, true, off);
			}

			function offsetPage(off) {
				grid.offset += (off * grid.buffer);
				updateUI();
			}
		}

		function getScrollIndex() {
			if (!scrolling)
				return 0;
			
			var monthdiv = document.getElementById("vpgrid").firstElementChild;
			for (var i=0 ; monthdiv; i++) {
				if (view.sel.column)
				if (monthdiv.firstElementChild.offsetLeft >= box.scrollLeft)
					return i;

				if (view.sel.list)
				if (monthdiv.firstElementChild.offsetTop >= box.scrollTop)
					return i;

				monthdiv = monthdiv.nextElementSibling;
			}
		}

		function setScrollIndex(idx) {
			if (!scrolling) {
				box.scrollTo(0, 0);
				return;
			}
			
			var monthdiv = document.getElementById("vpgrid").firstElementChild;
			for (var i=0 ; monthdiv; i++) {
				if (i == idx) {
					if (view.sel.column) {
						box.scrollTo(monthdiv.firstElementChild.offsetLeft, 0);
						return;
					}

					if (view.sel.list) {
						box.scrollTo(0, monthdiv.firstElementChild.offsetTop);
						return;
					}
				}

				monthdiv = monthdiv.nextElementSibling;
			}
		}

		this.init = function() {
			initUI();
			updateUI();
		}

		this.initpos = function(pos) {
			initUI();
			grid.pos = pos;
			grid.offset = pos - grid.buffer;
			updateUI();
		}

		this.onclickView = function(name) {
			setViewInfo(name);
			initUI();
			updateUI();
		}

		this.onclickPrint = function() {
			$window.open("vpprint.htm#" + grid.pos);
		}

		this.onkeydown = function(evt) {
			switch (evt.code)
			{
				case "ArrowLeft":
				case "ArrowUp":
					if (evt.ctrlKey || evt.shiftKey || evt.altKey || evt.metaKey) return;
					setScrollIndex(getScrollIndex() - 1);
					break;
				case "ArrowRight":
				case "ArrowDown":
					if (evt.ctrlKey || evt.shiftKey || evt.altKey || evt.metaKey) return;
					setScrollIndex(getScrollIndex() + 1);
					break;
				case "KeyR":
					if (evt.shiftKey || evt.altKey || evt.metaKey) return;
					if (event.ctrlKey)
						vpEvents.reload();
					else
						vpEvents.sync();
					break;
				default:
					return;
			}

			evt.preventDefault();
		}
	}

	function fLink(scope, element, attrs) {
		if (!attrs.hasOwnProperty("disableScrolling"))
			scrolling = true;

		if (!attrs.hasOwnProperty("disableAutoload"))
			scope.vpgrid.init();
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
