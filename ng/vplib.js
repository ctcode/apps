
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

/*
			// calendar.settings.list
			gapi.client.request({
				path: "https://www.googleapis.com/calendar/v3/users/me/settings",
				method: "GET"
			})
			.then(function(){}, function(){});

			// calendar.settings.watch error
			gapi.client.request({
				path: "https://www.googleapis.com/calendar/v3/users/me/settings/watch",
				method: "POST"
			})
			.then(function(){}, function(){});
*/
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

angular.module("vpApp").service("vpSettings", function($rootScope, $window) {
	var defaults = {
		title: "visual-planner",
		month_count: 6,
		auto_scroll: true,
		auto_scroll_offset: -1,
		first_month: 1,
		hide_scrollbars: false,
		disable_scroll: false,
		fixed_row_height: false,
		align_weekends: true,
		weekends: "6,0",
		first_day_of_week: 1,
		font_scale_pc: 100,
		past_opacity: 0.6,
		month_names: "Jan-Feb-Mar-Apr-May-Jun-Jul-Aug-Sep-Oct-Nov-Dec",
		proportional_events: false,
		proportional_start_hour: 8,
		proportional_end_hour: 20,
		event_background: 'cal',
		show_all_day_events: true,
		single_day_as_multi_day: false,
		show_timed_events: true
	};

	var cfg = {};
	var calendarcolours = {};
	var gridview = {};
	
	var file_name = "settings002.json";
	var file_id = null;
	var appdata = null;

	var stg = $window.localStorage.getItem("vp-gridviewinfo");
	if (stg)
		gridview = JSON.parse(stg);
	else {
		setViewInfo('column');
		setViewInfo('collapse');
	}

	publish(defaults);

	function publish(settings) {
		angular.copy(settings, cfg);
	}

	this.getConfig = function() {
		return cfg;
	}

	this.revert = function() {
		publish(appdata ? appdata : defaults);
	}
	
	this.reset = function() {
		appdata = null;
		publish(defaults);
	}

	function setViewInfo(add, del) {
		if (add)
			gridview[add] = {checked: true};

		if (del)
			delete gridview[del];

		$window.localStorage.setItem("vp-gridviewinfo", JSON.stringify(gridview));
	}

	this.setGridView = function(sel) {
		if (sel.column) setViewInfo('column', 'list');
		if (sel.list) setViewInfo('list', 'column');
		if (sel.expand) setViewInfo('expand', 'collapse');
		if (sel.collapse) setViewInfo('collapse', 'expand');
	}

	this.getGridView = function() {
		return gridview;
	}
	
	this.getEventColour = function(cid) {
		if (calendarcolours.event)
			return {text: calendarcolours.event[cid].foreground, background: calendarcolours.event[cid].background};
		
		return {};
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
			else loadCalendarColours();

			function rcv(response) {
				appdata = JSON.parse(response.body);
				publish(appdata);
				loadCalendarColours();
			};
		});

		function loadCalendarColours() {
			gapi.client.request({
				path: "https://www.googleapis.com/calendar/v3/colors",
				method: "GET"
			})
			.then(rcv, fail);

			function rcv(response) {
				if (response.result.kind == "calendar#colors")
					calendarcolours = response.result;

				loadGCalSettings();
			};
		}

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

angular.module("vpApp").service("vpEvents", function($window, $timeout, vpAccount, vpSettings) {
	var cfg = vpSettings.getConfig();
	var calendars;
	var reqcal;
	var isoSpan = {};
	var fAdd = function(){};
	var fRemove = function(){};
	var fUpdate = function(){};

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
			for (item of response.result.items) {
				if (item.selected)
					calendars.push(new VpCalendar(item));
			}

			if (response.result.nextPageToken) {
				reqparams.pageToken = response.result.nextPageToken;
				reqCalendars(reqparams);
			}

			$timeout();
		};

		reqcal = false;
	}

	function VpCalendar(item) {
		var cal = this;
		var id = item.id;
		var synctok = null;
		var cls = {};
		this.name = item.summary;
		this.colour = {text: item.foregroundColor, background: item.backgroundColor};
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
				for (item of response.result.items)
					makeEvent(item);

				if (response.result.nextPageToken) {
					reqparams.pageToken = response.result.nextPageToken;
					reqEvents(reqparams);
				}
				else if (response.result.nextSyncToken)
					synctok = response.result.nextSyncToken;
			};
		
			function makeEvent(item) {
				if (item.kind != "calendar#event")
					return;
		
				if (item.status == "cancelled") {
					fRemove(item.id);
					return;
				}

				if (item.hasOwnProperty("recurrence"))
					return;

				if (!item.hasOwnProperty("start"))
					return;

				if (reqparams.syncToken)
					fRemove(item.id);

				fAdd(new VpEvent(cal, item));
			}
		
			function reqfail(reason) {
				if (reason.status == 410) {
					fRemove();
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
			fUpdate();
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

		this.colour = {};
		if (cfg.event_background == "cal")
			this.colour = cal.colour;
		if (cfg.event_background == "white")
			this.colour = {background: "#ffffff"};
		if (cfg.event_background == "evt") {
			this.colour = cal.colour;
			if (item.colorId)
				this.colour = vpSettings.getEventColour(item.colorId);
		}
		
		if ("dateTime" in item.start)
		{
			this.timed = true;
			//this.timespan = {start: item.start.dateTime, end: item.end.dateTime};

			var vdttStart = new VpDateTime(item.start.dateTime);
			var vdttEnd = new VpDateTime(item.end.dateTime);

			this.start = vdttStart.ymd();
			this.duration = VpDate.DaySpan(vdttStart.ymd(), vdttEnd.ymd()) + 1;
			this.title = vdttStart.TimeTitle() + " " + item.summary;
			this.timestamp = vdttStart.DayMinutes();
		}
		else
		{
			this.timed = false;
			this.start = item.start.date;
			this.duration = VpDate.DaySpan(item.start.date, item.end.date);
			this.title = item.summary;
			this.timestamp = -1;
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

	this.register = function(add, remove, update) {
		fAdd = add;
		fRemove = remove;
		fUpdate = update;
	}

	this.setStartDate = function(vdt) {
		isoSpan.start = vdt.dt.toISOString();
	}

	this.setEndDate = function(vdt) {
		isoSpan.end = vdt.dt.toISOString();
	}

	this.load = function() {
		load();
	}

	this.reload = function() {
		fRemove();
		load();
	}

	this.sync = function() {
		for (cal of calendars)
			cal.syncEvents();
	}

	this.reset();
});



//////////////////////////////////////////////////////////////////////

angular.module("vpApp").service("vpAlmanac", function($timeout, vpSettings, vpEvents, $window) {
	var cfg = vpSettings.getConfig();
	var gridview = vpSettings.getGridView();
	var vpmonths = [];
	var vpdays = [];
	vpEvents.register(addEvent, removeEvent, updateEvents);

	this.makePage = function(pageoffset, pagelength) {
		VpDate.weekends = cfg.weekends.split(',').map(s => parseInt(s));
		VpDate.localemonth = cfg.month_names.split('-');
		
		var vdt = new VpDate();
		vdt.toStartOfMonth();
		vdt.offsetMonth(pageoffset);
		vpEvents.setStartDate(vdt);

		vpmonths = [];
		vpdays = [];
		for (var i=0; i < pagelength; i++) {
			var month = new VpMonth(vdt);
			month.index = vpmonths.length;
			vpmonths.push(month);
			vdt.offsetMonth(1);
			vpEvents.setEndDate(vdt);
		}

		vpEvents.load();
	}

	this.getPage = function() {
		return vpmonths;
	}

	this.getMonth = function(i) {
		return vpmonths[i];
	}

	var tmo=null;
	function addEvent(evt) {
		$timeout.cancel(tmo);

		var d = VpDate.DaySpan(vpdays[0].ymd, evt.start);
		for (var c=0; c < evt.duration; c++) {
			if (vpdays[d])
				vpdays[d].addEvent(evt, c);

			d++;
		}

		tmo = $timeout(updateLayout, 1000);
	}

	function removeEvent(id) {
		$timeout.cancel(tmo);

		var month;
		for (month of vpmonths)
			month.removeEvent(id);
		
		tmo = $timeout(updateLayout, 100);
	}

	function updateEvents() {
		$timeout.cancel(tmo);
		tmo = $timeout(updateLayout, 100);
	}

	function updateLayout() {
		var month;
		for (month of vpmonths)
			month.updateLayout();
	}

	function VpMonth(vdt) {
		this.id = "M-" + vdt.ym();
		this.hdr = vdt.MonthTitle();
		this.gcal = vdt.GCalURL();
		this.days = [];
		this.dayoffset = 0;
		this.cls = {};
		
		if (vdt.isPastMonth())
			this.cls.past = true;

		var vdtDay = vdt.clone();
		var m = vdtDay.getMonth();
		while (m == vdtDay.getMonth()) {
			var vpday = new VpDay(this, vdtDay);
			vpday.index = this.days.length;

			if (vpday.index == 0) {
				if (cfg.align_weekends) {
					this.dayoffset = vdtDay.DayOfWeek() - cfg.first_day_of_week;
					
					if (this.dayoffset < 0)
						this.dayoffset += 7;
				}

				vpday.cls["offset" + this.dayoffset] = true;
			}

			this.days.push(vpday);
			vpdays.push(vpday);

			vdtDay.offsetDay(1);
		}
	
		this.addEvent = function(day, addevt, seq) {
			if (!this.labels)
				this.labels = [];
			
			for (var lab of this.labels) {
				if (lab.evt === addevt) {
					lab.setCellEnd(day.index, seq);
					return;
				}
			}
		
			lab = new VpLabel(addevt);
			lab.setCellStart(this, day.index, seq);
			this.labels.push(lab);
		}
		
		this.removeEvent = function(id) {
			removeEventFromOwner(this, id);

			for (var day of this.days)
				day.removeEvent(id);
		}

		this.updateLayout = function() {
			var slots = [];

			if (this.labels) {
				var lab;
				for (lab of this.labels)
					lab.updateLayout(slots);
			}

			for (var day of this.days)
				day.updateLayout(slots);
		}
	}
	
	VpMonth.prototype.onclickHdr = function() {
		$window.open("https://www.google.com/calendar/r/month/" + this.gcal);
	}

	function VpDay(vpmonth, vdt) {
		this.num = vdt.DayOfMonth();
		this.gcal = vdt.GCalURL();
		this.month = vpmonth;
		this.cls = {};

		if (vdt.isWeekend())
			this.cls.weekend = true;

		if (vdt.isToday())
			this.cls.today = true;
	}
	
	VpDay.prototype.addEvent = function(evt, seq) {
		if ((evt.duration > 1) || (cfg.single_day_as_multi_day && !evt.timed)) {
			this.month.addEvent(this, evt, seq);
			return;
		}
		
		if (!this.labels)
			this.labels = [];
		
		this.labels.push(new VpLabel(evt));
	}
	
	VpDay.prototype.removeEvent = function(id) {
		removeEventFromOwner(this, id);
	}
	
	VpDay.prototype.updateLayout = function(slots) {
		this.labelboxstyle = {};

		if (this.labels) {
			var key = Math.pow(2, this.index);

			for (var i = slots.length-1; i>=0; i--) {
				if (key & slots[i]) {
					var slotmargin = ((i + 1) * 1.4) + 0.5;
					this.labelboxstyle[gridview.column ? "margin-right" : "margin-bottom"] = slotmargin + "em";
					break;
				}
			}
			
			for (var lab of this.labels)
				lab.updateLayout();
		}
	}
	
	VpDay.prototype.onclickNum = function() {
		$window.open("https://www.google.com/calendar/r/week/" + this.gcal);
	}

	function VpLabel(vpevent) {
		this.evt = vpevent;
		this.style = {};

		var month;
		var day;
		var span;

		var clr = this.evt.colour;
		if (clr.text)
			this.style["color"] = clr.text;
		if (clr.background)
			this.style["background-color"] = clr.background;
		
		this.setCellStart = function(vpmonth, iday, seq) {
			month = vpmonth;
			day = iday;
			span = 1;
			
			this.multiboxstyle = {};
			this.updateBorderRadius(seq);
		}
		
		this.setCellEnd = function(iday, seq) {
			span = (iday - day) + 1;
			this.updateBorderRadius(seq);
		}
		
		this.updateBorderRadius = function(seq) {
			if (seq == 0) {
				this.style["border-top-left-radius"] = "1em";
				this.style[gridview.column ? "border-top-right-radius" : "border-bottom-left-radius"] = "1em";
			}
			
			if (seq+1 == this.evt.duration) {
				this.style["border-bottom-right-radius"] = "1em";
				this.style[gridview.column ? "border-bottom-left-radius" : "border-top-right-radius"] = "1em";
			}
		}
		
		this.updateLayout = function(slots) {
			this.style.display = "none";
			
			if (this.multiboxstyle)
				this.multiboxstyle.display = "none";

			if (this.evt.cal.cls.checked)
				return;

			delete this.style.display;

			if (this.multiboxstyle) {
				var slot = getSlot(slots);

				delete this.multiboxstyle.display;
				this.style[gridview.column ? "right" : "bottom"] = 0.5 + (1.4*slot) + "em";
				this.multiboxstyle[gridview.column ? "grid-column" : "grid-row"] = month.id + " / span 1";
				this.multiboxstyle[gridview.column ? "grid-row" : "grid-column"] = month.dayoffset + day + 2 + " / span " + span;
			}
		}
		
		function getSlot(slots) {
			var key = (Math.pow(2, span) - 1) << day;
			
			var i;
			for (i=0; i < slots.length; i++) {
				if (key & slots[i])
					continue;

				slots[i] |= key;
				return i;
			}
			
			slots.push(key);
			return i;
		}
	}
	
	function removeEventFromOwner(owner, id) {
		if (owner.labels) {
			if (id)
				for (var i=0; i < owner.labels.length; i++) {
					if (owner.labels[i].evt.id == id) {
						owner.labels.splice(i, 1);
						return;
					}
				}
			else
				delete owner.labels;
		}
	}
});




//////////////////////////////////////////////////////////////////////

angular.module("vpApp").directive("vpGrid", function(vpSettings, vpAlmanac, vpEvents, $window, $timeout) {
	var cfg = vpSettings.getConfig();
	var view = vpSettings.getGridView();

	function fCtl($scope) {
		var box = document.getElementById("vpgridbox");
		var ngbox = angular.element(box);
		var gridui;
		
		showGrid(false);

		function initUI() {
			gridui = {};
			gridui.buffer = cfg.disable_scroll ? 0 : 6;
			gridui.vislength = cfg.month_count;
			gridui.length = gridui.buffer + gridui.vislength + gridui.buffer;
			
			if (cfg.auto_scroll) {
				gridui.offset = cfg.auto_scroll_offset - gridui.buffer;
			}
			else {
				var off = ((cfg.first_month-1) - new Date().getMonth());
				if (off > 0) off -= 12;
				gridui.offset = off - gridui.buffer;
			}

			if (cfg.hide_scrollbars)
				ngbox.addClass("hidescroll");
		}

		function updateUI() {
			vpAlmanac.makePage(gridui.offset, gridui.length);
			$scope.vpgrid.page = vpAlmanac.getPage();
			$scope.vpgrid.gridareas = getGridAreas(vpAlmanac.getPage());
			$scope.vpgrid.view = view;
			$scope.vpgrid.fontscale = cfg.font_scale_pc/100;
			$scope.vpgrid.past_opacity = cfg.past_opacity;
			$scope.vpgrid.scroll_size = (gridui.length / cfg.month_count)*100;
			$scope.vpgrid.scroll_size_portrait = $scope.vpgrid.scroll_size*2;
			$scope.vpgrid.multi_day_opacity = cfg.multi_day_opacity;
			$scope.vpgrid.navbar = {year: 2020};
			$scope.vpgrid.calbar = vpEvents.calendars;

			$scope.vpgrid.cls = {};
			if (cfg.fixed_row_height)
				$scope.vpgrid.cls.fixrow = true;

			$timeout(function() {
				if (!gridui.visid)
					gridui.visid = vpAlmanac.getMonth(gridui.buffer).id;

				setVisMonth(gridui.visid);
				showGrid(true);
			});
		}

		function showGrid(show) {
			if (show) {
				box.style.visibility = "";
				box.focus();
				//ngbox.on("scroll", onScroll);
			}
			else {
				box.style.visibility = "hidden";
			}
		}

		function getGridAreas(page) {
			var gridareas = "";
			
			for (month of page) {
				if (view.column)
					gridareas += (month.id + ' ');
				if (view.list)
					gridareas += ('"' + month.id + '" ');
			}

			if (view.column)
				return '"' + gridareas + '"';
			
			return gridareas;
		}

		function setVisMonth(id) {
			var monthdiv = document.getElementById(id);

			if (view.column)
				box.scrollTo(monthdiv.firstElementChild.offsetLeft, 0);

			if (view.list)
				box.scrollTo(0, monthdiv.firstElementChild.offsetTop);
		}

		function getVisInfo() {
			var info = {months: [], index: null};
			var boxpos = view.column ? box.scrollLeft : box.scrollTop;

			var monthdivs = box.querySelectorAll(".vpmonth");
			for (var i=0; i < monthdivs.length; i++) {
				var hdr = monthdivs[i].firstElementChild;
				var monthpos = view.column ? hdr.offsetLeft : hdr.offsetTop;
				var monthsize = view.column ? hdr.offsetWidth : hdr.offsetHeight;
				
				if (monthpos + (monthsize / 2) > boxpos)
					info.months.push(vpAlmanac.getPage()[i]);

				if (info.months.length == 1)
					info.index = i;
				
				if (info.months.length == gridui.vislength)
					break;
			}
			
			return info;
		}

		this.init = function() {
			initUI();
			updateUI();
		}

		this.onclickColumn = function() {
			if (view.column)
				return;

			showGrid(false);
			$timeout(function() {
				vpSettings.setGridView({column: true});

				initUI();
				updateUI();
			});
		}

		this.onclickList = function() {
			if (view.list)
				return;

			showGrid(false);
			$timeout(function() {
				vpSettings.setGridView({list: true});

				initUI();
				updateUI();
			});
		}

		this.onclickExpand = function() {
			if (view.expand)
				vpSettings.setGridView({collapse: true});
			else
				vpSettings.setGridView({expand: true});

			box.focus();
		}

		this.onclickSync = function(evt) {
			if (evt.ctrlKey)
				vpEvents.reload();
			else
				vpEvents.sync();

			box.focus();
		}

		this.onclickContinue = function() {
			showGrid(false);
			$timeout(function() {
				var visinfo = getVisInfo();
				gridui.visid = visinfo.months[0].id;
				gridui.offset += (visinfo.index - gridui.buffer);
				updateUI();
			});
		}

		this.onclickPrint = function() {
			var visinfo = getVisInfo();
			var boxpos = view.column ? box.scrollLeft : box.scrollTop;

			$window.vpprintgrid = {
				page: visinfo.months,
				gridareas: getGridAreas(visinfo.months),
				view: $scope.vpgrid.view,
				cls: $scope.vpgrid.cls,
				fontscale: $scope.vpgrid.fontscale,
				past_opacity: 1,
				scroll_size: 100,
				scroll_size_portrait: 100,
				multi_day_opacity: 1
			};

			$window.open("vpprint.htm");
		}

		this.onkeydown = function(evt) {
			if (!evt.ctrlKey || evt.shiftKey || evt.altKey || evt.metaKey)
				return;

			switch (evt.key)
			{
				case "Enter":
					this.onclickContinue();
					break;
				default:
					return;
			}

			evt.preventDefault();
		}
		
		if ($scope.vpgridinit)
			this.init();
	}

	function fLink(scope, element, attrs) {
		//if (!attrs.hasOwnProperty("disableAutoload"))
			//scope.vpgrid.init();
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

function VpDate(ymd) {
	if (ymd) {
		this.dt = new Date(parseInt(ymd.substr(0,4)), parseInt(ymd.substr(5,2))-1, parseInt(ymd.substr(8,2)));  // local
		//this.dt = new Date(ymd);  // utc
	}
	else {
		var today = new Date();
		this.dt = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	}
}

VpDate.prototype.clone = function(vdt) {
	var cln = new VpDate();
	cln.dt = new Date(vdt.dt);
	return cln;
}

VpDate.prototype.ym = function() {
	return this.dt.getFullYear() + VpDate.ymdstr[this.dt.getMonth()];
}

VpDate.prototype.ymd = function() {
	return this.ym() + VpDate.ymdstr[this.dt.getDate()-1];
}

VpDate.prototype.isToday = function() {
	return (this.dt == VpDate.today);
}

VpDate.prototype.daysTo = function(vdt) {
	return (vdt.dt - this.dt)/86400000;
}

VpDate.prototype.getMonth = function() {
	return this.dt.getMonth()+1;
}

VpDate.prototype.offsetDay = function(off) {
	this.dt.setDate(this.dt.getDate() + off);
}

VpDate.prototype.offsetMonth = function(off) {
	this.dt.setMonth(this.dt.getMonth() + off);
}

VpDate.prototype.toStartOfWeek = function(startday) {
	while (this.dt.getDay() != startday)
		this.dt.setDate(this.dt.getDate() - 1);
}

VpDate.prototype.toStartOfMonth = function() {
	this.dt.setDate(1);
}

VpDate.prototype.toStartOfYear = function() {
	this.dt.setMonth(0);
	this.dt.setDate(1);
}

VpDate.prototype.DayOfMonth = function() {
	return this.dt.getDate();
}

VpDate.prototype.DayOfWeek = function() {
	return this.dt.getDay();
}

VpDate.prototype.isWeekend = function() {
	return (VpDate.weekends.includes(this.dt.getDay()));
}

VpDate.prototype.isPastMonth = function() {
	var today = new Date();
	
	if (this.dt.getYear() < today.getYear())
		return true;

	if (this.dt.getYear() > today.getYear())
		return false;
	
	return (this.dt.getMonth() < today.getMonth());
}

VpDate.prototype.MonthTitle = function() {
	return fmt("^ ^", VpDate.localemonth[this.dt.getMonth()], this.dt.getFullYear());
}

VpDate.prototype.GCalURL = function() {
	return fmt("^/^/^", this.dt.getFullYear(), this.dt.getMonth()+1, this.dt.getDate());
}

VpDate.ymdstr = ["-01", "-02", "-03", "-04", "-05", "-06", "-07", "-08", "-09", "-10",
	"-11", "-12", "-13", "-14", "-15", "-16", "-17", "-18", "-19", "-20",
	"-21", "-22", "-23", "-24", "-25", "-26", "-27", "-28", "-29", "-30", "-31"];

VpDate.weekends = [0, 6];
VpDate.localemonth = [];

VpDate.DaySpan = function(ymd1, ymd2)
{
	return (Date.parse(ymd2) - Date.parse(ymd1))/86400000;
}
VpDate.today = new VpDate().dt;




/////////////////////////////////////////////////////////////////

function VpDateTime(iso) {
	this.dt = new Date(iso);
}

VpDateTime.prototype = new VpDate;

VpDateTime.prototype.DayMinutes = function() {
	return ((this.dt.getHours()*60) + this.dt.getMinutes());
}

VpDateTime.prototype.TimeTitle = function() {
	var hh = this.dt.getHours();
	var mm = this.dt.getMinutes();
	var ss = this.dt.getSeconds();
	
	var minutes = fmt((mm < 10) ? "0^" : "^", mm);

	if (VpDateTime.time24h) 	{
		return fmt("^:^", hh, minutes);
	}
	else {
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
