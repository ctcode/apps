
var vpapp = angular.module("vpApp", []);

//////////////////////////////////////////////////////////////////////

vpapp.service("vpAccount", function($rootScope) {
	var auth = null;
	var status = {
		signed_in: false,
		msg: "Connecting..."
	};

	gapi.load("client:auth2", onLoadAuth);

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

vpapp.service("vpSettings", function($rootScope) {
	var defaults = {
		planner_title: "visual-planner",
		vpconfig: {
			month_count: 6,
			month_count_portrait: 3,
			auto_scroll: true,
			auto_scroll_offset: -1,
			first_month: 1,
			weekends: "6,0",
			align_weekends: true,
			font_scale_pc: 80,
			past_opacity: 0.6,
			month_names: "Jan-Feb-Mar-Apr-May-Jun-Jul-Aug-Sep-Oct-Nov-Dec",
			show_event_time: true,
			show_event_title: true,
			show_event_marker: true,
			colour_event_title: false,
			proportional_events: false,
			proportional_start_hour: 8,
			proportional_end_hour: 20,
			show_all_day_events: true,
			single_day_as_multi_day: false,
			show_timed_events: true,
			multi_day_as_single_day: false,
			first_day_only: false,
			marker_width: 0.85,
			multi_day_opacity: 0.8
		}
	};

	var file_name = "settings002.json";
	var file_id = null;
	var appdata = null;
	var pub = this;
	publish(defaults);

	function publish(settings) {
		pub.planner_title = angular.copy(settings.planner_title);
		pub.vpconfig = angular.copy(settings.vpconfig);
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
				onLoad();
			};
		});

		function onLoad() {
			$rootScope.$broadcast("settings:load");
		};
	}

	this.save = function() {
		appdata = {
			planner_title: angular.copy(pub.planner_title),
			vpconfig: angular.copy(pub.vpconfig)
		};

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

	this.getMonthCount = function() {
		return isPortrait() ? this.vpconfig.month_count_portrait : this.vpconfig.month_count;
	}

	function isPortrait()
	{
		var so = "";
		if (screen.orientation && screen.orientation.type)
			so = screen.orientation.type;
		if (screen.msOrientation)  // edge, ie
			so = screen.msOrientation;

		if (so.includes("portrait"))
			return true;

		return false;
	}
});



//////////////////////////////////////////////////////////////////////

vpapp.service("vpViewStorage", function($window) {
	this.load = function() {
		var stg = $window.localStorage.getItem("vp-viewname");
		var name = stg ? stg : "column";

		this.sel = {};
		this.sel[name] = true;

		this.cls = {};
		this.cls[name] = {checked: true};
	}

	this.setName = function(name) {
		$window.localStorage.setItem("vp-viewname", name);
		this.load();
	}

	this.load();
});



//////////////////////////////////////////////////////////////////////

vpapp.service("vpAlmanac", function(vpSettings) {
	var vpmonths = [];
	var month_offset;
	var scroll_buffer=0;
	var cfg;

	if (window.opener && window.opener.VpPrintInfo)
	{
		vpmonths = window.opener.VpPrintInfo;
		this.printload = true;
	}

	this.savePrintInfo = function(pos) {
		var span = [];
		var n = pos ? Math.floor((vpmonths.length * pos) + 0.6) : 0;
		var c = (n + cfg.month_count)
		
		for (var i=n; i < c; i++)
			span.push(vpmonths[i]);

		window.VpPrintInfo = span;
	}

	this.initPage = function() {
		month_offset = -scroll_buffer;
		cfg = vpSettings.vpconfig;
		
		if (cfg.auto_scroll) {
			month_offset += cfg.auto_scroll_offset;
		}
		else {
			var off = ((cfg.first_month-1) - new Date().getMonth());
			if (off > 0)
				off -= 12;

			month_offset += off;
		}

		createMonths();
	}

	this.offsetPage = function(off) {
		month_offset += (6*off);
		createMonths();
	}

	this.getMonths = function() {
		return vpmonths;
	}

	this.setScrollBuffer = function(n) {
		scroll_buffer = n;
	}

	function createMonths() {
		VpDate.weekends = cfg.weekends.split(',').map(s => parseInt(s));
		VpDate.localemonth = cfg.month_names.split('-');
		
		var vdt = new VpDate();
		vdt.toStartOfMonth();
		vdt.offsetMonth(month_offset);

		vpmonths = [];
		for (var i=0; i < (vpSettings.getMonthCount()+(scroll_buffer*2)); i++) {
			vpmonths.push(new VpMonth(vdt.ymd()));
			vdt.offsetMonth(1);
		}
	}

	function VpMonth(ymd) {
		var vdt = new VpDate(ymd);
		
		this.hdr = vdt.MonthTitle();
		this.gcal = vdt.GCalURL();
		
		if (vdt.isPastMonth())
			this.past = true;
		
		this.dayoffset = 0;
		if (cfg.align_weekends)
			this.dayoffset = vdt.DayOfWeek();

		this.vpdays = [];

		var m = vdt.getMonth();
		while (m == vdt.getMonth())
		{
			var vpday = new VpDay(vdt.ymd());
			this.vpdays.push(vpday);

			vdt.offsetDay(1);
		}
	}

	function VpDay(ymd) {
		var vdt = new VpDate(ymd);

		this.id = ymd;
		this.num = vdt.DayOfMonth();
		this.gcal = vdt.GCalURL();

		if (vdt.isWeekend())
			this.weekend = true;

		if (VpDate.isToday(ymd))
			this.today = true;
	}
});



//////////////////////////////////////////////////////////////////////

vpapp.directive("vpTable", function(vpViewStorage, vpSettings, vpAlmanac, $window) {
	function fCtl($scope) {

		if (vpAlmanac.printload)
		{
			initView();
			return;
		}

		this.cmdView = function() {
			vpAlmanac.initPage();
			initView();
		}

		this.cmdPrint = function(pos) {
			vpAlmanac.savePrintInfo(pos);
			$window.open("vpprint.htm");
		}

		this.cmdScrollPage = function(off) {
			vpAlmanac.offsetPage(off);
			initView();
		}

		this.onclickHdr = function(vpcell) {
			window.open("https://www.google.com/calendar/r/month/" + vpcell.month.gcal);
		}

		this.onclickDayNum = function(vpcell) {
			window.open("https://www.google.com/calendar/r/week/" + vpcell.day.gcal);
		}

		function initView() {
			var rows = [];
			var months = vpAlmanac.getMonths();

			var sz = getPos(months.length, 31+6+1);
			for (var y=0; y < sz.y; y++)
			{
				var row = {cells: []};

				for (var x=0; x < sz.x; x++)
					row.cells.push({empty: true});

				rows.push(row);
			}

			for (var m=0; m < months.length; m++)
			{
				var vpmonth = months[m];
				
				var cell = {month: vpmonth, cls: {}};
				if (vpmonth.past)
					cell.cls.past = true;

				var pos = getPos(m, 0);
				rows[pos.y].cells[pos.x] = cell;

				for (var d=0; d < vpmonth.vpdays.length; d++)
				{
					var vpday = vpmonth.vpdays[d];
					var cell = {day: vpday, cls: {}};

					if (vpmonth.past)
						cell.cls.past = true;

					if (vpday.weekend)
						cell.cls.weekend = true;

					if (vpday.today)
						cell.cls.today = true;

					var pos = getPos(m, (d+1) + vpmonth.dayoffset);
					rows[pos.y].cells[pos.x] = cell;
				}
			}
			
			$scope.vptable.rows = rows;
			$scope.vptable.fontscale = vpSettings.vpconfig.font_scale_pc/100;
			$scope.vptable.past_opacity = vpSettings.vpconfig.past_opacity;
			$scope.vptable.view = vpViewStorage;
		}

		function getPos(xpos, ypos) {
			return vpViewStorage.sel.list ? {x: ypos, y: xpos} : {x: xpos, y: ypos};
		}
	}

	function fLink(scope, element, attrs) {
	}

	return {
		controller: fCtl,
		controllerAs: "vptable",
		link: fLink,
		templateUrl: "vptable.htm",
		restrict: 'E'
	};
});



//////////////////////////////////////////////////////////////////////

vpapp.directive("vpScroll", function(vpViewStorage, vpSettings, vpAlmanac, $timeout) {
	function fCtl($scope) {
		this.view = vpViewStorage;

		vpAlmanac.setScrollBuffer(6);
		var box = document.getElementById("vpscrollbox");
		var mkr = document.getElementById("vpscrollmarker");
		var ng_box = angular.element(box);
		var view = {};
		
		ng_box.on("scroll", onScroll);

		this.initView = function() {
			view = vpViewStorage.sel;
			
			var m = vpSettings.getMonthCount();
			this.scroll_size = ((m+12)/m)*100;

			showView(false);

			ng_box.off("wheel");
			if (view.column)
				ng_box.on("wheel", onWheel);

			ng_box.css("overflow", "auto");
			if (view.column)
				ng_box.css("overflow-y", "hidden");
			if (view.list)
				ng_box.css("overflow-x", "hidden");

			$timeout(function() {
				$scope.vptable.cmdView();

				$timeout(function() {
					resetScroll();
					showView(true);
				});
			});
		}

		this.initPrint = function() {
			var printoffset = view.list ? (box.scrollTop / box.scrollHeight) : (box.scrollLeft / box.scrollWidth);
			$scope.vptable.cmdPrint(printoffset);
		}

		function showView(show) {
			box.style.visibility = show ? "" : "hidden";
			mkr.style.visibility = show ? "" : "hidden";
		}

		function resetScroll() {
			box.scrollTop = view.list ? (box.scrollHeight-box.clientHeight)/2 : 0;
			box.scrollLeft = view.list ? 0 : (box.scrollWidth-box.clientWidth)/2;
		}

		function pageScroll(off) {
			showView(false);
			$timeout(function() {
				$scope.vptable.cmdScrollPage(off);
				$timeout(function() {
					resetScroll();
					showView(true);
				});
			});
		}

		var tmo=null;
		function onScroll(evt) {
			$timeout.cancel(tmo);
			
			var pos = view.list ? box.scrollTop : box.scrollLeft;
			var max = view.list ? (box.scrollHeight - box.clientHeight) : (box.scrollWidth - box.clientWidth);

			var pageoffset = false;
			if (pos == 0) pageoffset = -1;
			if (pos >= max) pageoffset = 1;

			if (pageoffset)
				tmo = $timeout(pageScroll, 1000, true, pageoffset);

			var scale = view.list ? (box.clientHeight / box.scrollHeight) : (box.clientWidth / box.scrollWidth);
			mkr.style.width = view.list ? "3px" : (box.clientWidth * scale) + "px";
			mkr.style.height = view.list ? (box.clientHeight * scale) + "px" : "3px";
			mkr.style.left = view.list ? "4px" : (box.scrollLeft * scale) + "px";
			mkr.style.top = view.list ? (box.scrollTop * scale) + "px" : "4px";
			mkr.style.opacity = pageoffset ? 0.6 : 0.3;
		}

		function onWheel(evt) {
			var dy = evt.deltaY;
			if (evt.deltaMode == 1) dy = (dy*30);
			if (evt.deltaMode == 2) dy = (dy*300);
			evt.preventDefault();

			box.scrollBy(dy,0);
		}
	}

	return {
		controller: fCtl,
		controllerAs: "vpscroll",
		templateUrl: "vpscroll.htm",
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
	return (Math.abs(Date.parse(ymd1) - Date.parse(ymd2))/86400000);
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

	if (VpGrid.time24h)
	{
		return fmt("^:^", hh, minutes);
	}
	else
	{
		var hours = (hh > 12) ? (hh-12) : hh;
		return fmt((hh < 12) ? "^:^am" : "^:^pm", hours, minutes);
	}
}



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
