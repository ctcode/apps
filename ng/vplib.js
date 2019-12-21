
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
		show_timed_events: true,
		multi_day_opacity: 0.6
	};

	var cfg = {};
	var calendarcolours = {};

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

angular.module("vpApp").service("vpEvents", function($window, vpAccount, vpSettings) {
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
		if (vpSettings.config.event_background == "cal")
			this.colour = cal.colour;
		if (vpSettings.config.event_background == "white")
			this.colour = {background: "#ffffff"};
		if (vpSettings.config.event_background == "evt") {
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

	this.setDateSpan = function(span) {
		isoSpan.start = new Date(span.start).toISOString();
		isoSpan.end = new Date(span.end).toISOString();
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
	var cfg = vpSettings.config;
	var vpmonths = [];
	var vpdays = [];
	var datespan;
	vpEvents.register(addEvent, removeEvent, updateEvents);

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
			var month = new VpMonth(vdt.ymd());
			month.index = vpmonths.length;
			vpmonths.push(month);
			vdt.offsetMonth(1);
			datespan.end = vdt.ymd();
		}

		vpEvents.setDateSpan(datespan);
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
				vpdays[d].addEvent(evt);

			d++;
		}

		tmo = $timeout(updateLayout, 1000);
	}

	function removeEvent(id) {
		var month;
		for (month of vpmonths)
			month.removeEvent(id);
		
		$timeout(updateLayout);
	}

	function updateEvents() {
		$timeout(updateLayout);
	}

	function updateLayout() {
		var month;
		for (month of vpmonths)
			month.updateLayout();
	}

	function VpMonth(ymd) {
		var vdt = new VpDate(ymd);

		this.id = ymd.slice(0,7);
		this.hdr = vdt.MonthTitle();
		this.days = [];
		this.dayoffset = 0;
		this.cls = {};
		
		if (vdt.isPastMonth())
			this.cls.past = true;

		var m = vdt.getMonth();
		while (m == vdt.getMonth()) {
			var vpday = new VpDay(this, vdt);
			vpday.index = this.days.length;

			if (vpday.index == 0) {
				if (cfg.align_weekends) {
					this.dayoffset = vdt.DayOfWeek() - cfg.first_day_of_week;
					
					if (this.dayoffset < 0)
						this.dayoffset += 7;
				}

				vpday.cls["offset" + this.dayoffset] = true;
			}

			this.days.push(vpday);
			vpdays.push(vpday);

			vdt.offsetDay(1);
		}
	
		this.addEvent = function(day, addevt) {
			if (!this.labels)
				this.labels = [];
			
			var lab;
			for (lab of this.labels) {
				if (lab.evt === addevt) {
					lab.setCellEnd(day.index);
					return;
				}
			}
		
			lab = new VpLabel(addevt);
			lab.setCellStart(this.index, day.index, this.dayoffset);
			this.labels.push(lab);
		}
		
		this.removeEvent = function(id) {
			removeEventFromOwner(this, id);

			var day;
			for (day of this.days)
				day.removeEvent(id);
		}

		this.updateLayout = function() {
			var slots = [];

			if (this.labels) {
				var lab;
				for (lab of this.labels)
					lab.updateLayout(slots);
			}

			var day;
			for (day of this.days)
				day.updateLayout(slots);
		}
	}
	
	VpMonth.prototype.onclickHdr = function() {
		$window.open("https://www.google.com/calendar/r/month/" + new VpDate(this.days[0].ymd).GCalURL());
	}

	function VpDay(vpmonth, vdt) {
		this.ymd = vdt.ymd();
		this.num = vdt.DayOfMonth();
		this.month = vpmonth;
		this.cls = {};

		if (vdt.isWeekend())
			this.cls.weekend = true;

		if (VpDate.isToday(this.ymd))
			this.cls.today = true;
	}
	
	VpDay.prototype.addEvent = function(evt) {
		if ((evt.duration > 1) || (cfg.single_day_as_multi_day && !evt.timed)) {
			this.month.addEvent(this, evt);
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
					this.labelboxstyle["margin-right"] = slotmargin + "em";
					break;
				}
			}
			
			for (var lab of this.labels)
				lab.updateLayout();
		}
	}
	
	VpDay.prototype.onclickNum = function() {
		$window.open("https://www.google.com/calendar/r/week/" + new VpDate(this.ymd).GCalURL());
	}

	function VpLabel(vpevent) {
		this.evt = vpevent;
		this.style = {};

		var multi = false;
		var month;
		var day;
		var dayoffset;
		var span;

		var clr = this.evt.colour;
		if (clr.text)
			this.style["color"] = clr.text;
		if (clr.background)
			this.style["background-color"] = clr.background;
		
		this.setCellStart = function(imonth, iday, off) {
			multi = true;
			month = imonth;
			day = iday;
			dayoffset = off;
			span = 1;
		}
		
		this.setCellEnd = function(iday) {
			span = (iday - day) + 1;
		}
		
		this.updateLayout = function(slots) {
			this.style["display"] = "none";
			if (this.evt.cal.cls.checked)
				return;

			this.style["display"] = "";

			if (multi) {
				var slot = getSlot(slots);
				
				this.style["right"] = 0.5 + (1.4*slot) + "em";
				this.style["grid-column"] = month + 1 + " / span 1";
				this.style["grid-row"] = dayoffset + day + 2 + " / span " + span;
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
	var cfg = vpSettings.config;
	var view = {};

	var stg = $window.localStorage.getItem("vp-viewinfo");
	if (stg)
		view = JSON.parse(stg);
	else
		setViewInfo('column');

	function setViewInfo(add, del) {
		if (add)
			view[add] = {checked: true};

		if (del)
			delete view[del];

		$window.localStorage.setItem("vp-viewinfo", JSON.stringify(view));
	}

	function fCtl($scope) {
		var box = document.getElementById("vpbox");
		var ngbox = angular.element(box);
		var gridui;

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
			showGrid(false);

			vpAlmanac.makePage(gridui.offset, gridui.length);
			$scope.vpgrid.page = vpAlmanac.getPage();
			$scope.vpgrid.view = view;
			$scope.vpgrid.fontscale = cfg.font_scale_pc/100;
			$scope.vpgrid.past_opacity = cfg.past_opacity;
			$scope.vpgrid.scroll_size = (gridui.length / cfg.month_count)*100;
			$scope.vpgrid.scroll_size_portrait = $scope.vpgrid.scroll_size*2;
			$scope.vpgrid.multi_day_opacity = cfg.multi_day_opacity;

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

		var tmo=null;
		function onScroll(evt) {
			$timeout.cancel(tmo);
			var shift = false;
			
			var pos = view.list ? box.scrollTop : box.scrollLeft;
			var max = view.list ? (box.scrollHeight - box.clientHeight) : (box.scrollWidth - box.clientWidth);

			if (pos == 0) shift = -1;
			if (pos >= max) shift = 1;

			if (shift)
				tmo = $timeout(shiftPage, 500);

			function shiftPage() {
				gridui.visid = getVisInfo().id;
				gridui.offset += (shift * gridui.buffer);
				updateUI();
			}
		}

		function showGrid(show) {
			if (show) {
				box.style.visibility = "";
				box.focus();
				
				if (!cfg.disable_scroll)
					ngbox.on("scroll", onScroll);
			}
			else {
				box.style.visibility = "hidden";
				ngbox.off("scroll");
			}
		}

		function getVisInfo() {
			var info = {div: null, id: null, visdivs: [], invisdivs: [], months: []};

			var mdiv = box.querySelectorAll(".vpmonth");
			var v = -1;
			for (var i=0; i < mdiv.length; i++) {
				var hdr = mdiv[i].firstElementChild;
				
				if (v < 0) {
					if (view.column)
					if (hdr.offsetLeft + (hdr.offsetWidth / 2) > box.scrollLeft)
						v = i;

					if (view.list)
					if (hdr.offsetTop + (hdr.offsetHeight / 2) > box.scrollTop)
						v = i;
				}

				if (v == i) {
					info.div = mdiv[i];
					info.id = mdiv[i].id;
				}

				if (v >= 0 && i < (v + gridui.vislength)) {
					info.visdivs.push(mdiv[i]);
					info.months.push($scope.vpgrid.page[i]);
				}
				else
					info.invisdivs.push(mdiv[i]);
			}
			
			return info;
		}

		function setVisMonth(id) {
			var monthdiv = document.getElementById(id);

			if (view.column)
				box.scrollTo(monthdiv.firstElementChild.offsetLeft, 0);

			if (view.list)
				box.scrollTo(0, monthdiv.firstElementChild.offsetTop);
		}

		function scrollMonth(next) {
			var sibdiv = next ? getVisInfo().div.nextElementSibling : getVisInfo().div.previousElementSibling;
			
			if (sibdiv)
				setVisMonth(sibdiv.id);
		}

		this.init = function() {
			initUI();
			updateUI();
		}

		this.onclickColumn = function() {
			if (view.column)
				return;

			var pos = box.scrollTop / box.scrollHeight;
			showGrid(false);

			setViewInfo('column', 'list');

			$timeout(function() {
				box.scrollTo(box.scrollWidth * pos, 0);
				showGrid(true);
				box.focus();
			});
		}

		this.onclickList = function() {
			if (view.list)
				return;

			var pos = box.scrollLeft / box.scrollWidth;
			showGrid(false);

			setViewInfo('list', 'column');

			$timeout(function() {
				box.scrollTo(0, box.scrollHeight * pos);
				showGrid(true);
				box.focus();
			});
		}

		this.onclickExpand = function() {
			if (view.expand)
				setViewInfo(false, 'expand');
			else
				setViewInfo('expand');

			box.focus();
		}

		this.onclickSync = function(evt) {
			if (evt.ctrlKey)
				vpEvents.reload();
			else
				vpEvents.sync();

			box.focus();
		}

		this.onkeydown = function(evt) {
			switch (evt.code)
			{
				case "ArrowLeft":
				case "ArrowUp":
					if (evt.ctrlKey || evt.shiftKey || evt.altKey || evt.metaKey) return;
					scrollMonth(false);
					break;
				case "ArrowRight":
				case "ArrowDown":
					if (evt.ctrlKey || evt.shiftKey || evt.altKey || evt.metaKey) return;
					scrollMonth(true);
					break;
				case "KeyR":
					if (evt.shiftKey || evt.altKey || evt.metaKey) return;
					this.onclickSync(evt);
					break;
				default:
					return;
			}

			evt.preventDefault();
		}

		this.onclickPrint = function() {
			$window.vpprintgrid = {
				page: getVisInfo().months,
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

		$window.onbeforeprint = function() {
			var info = getVisInfo();

			for (var m of info.visdivs)
				m.classList.remove("noprint");

			for (var m of info.invisdivs)
				m.classList.add("noprint");
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
