
//////////////////////////////////////////////////////////////////////

function VpSettingsSvc($timeout, $rootScope)
{
	var gAppData = {};
	var defaults = {};

	defaults.planner_title = "visual-planner";
	defaults.vpconfig = {
		month_count: 6,
		month_count_portrait: 3,
		auto_scroll: true,
		auto_scroll_offset: -1,
		first_month: 1,
		weekends: "6,0",
		align_weekends: true,
		font_scale_pc: 80,
		past_opacity: 0.7,
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
	};
	
	this.reset = function() {
		this.planner_title = angular.copy(defaults.planner_title);
		this.vpconfig = angular.copy(defaults.vpconfig);
		gAppData = {};  // temp
	}

	this.revert = function() {
		this.planner_title = angular.copy(gAppData.planner_title);
		this.vpconfig = angular.copy(gAppData.vpconfig);
	}

	this.load = function() {
		$timeout(function() {
			gAppData.planner_title = "vp-ng";  // temp
			gAppData.vpconfig = angular.copy(defaults.vpconfig);  // temp
			this.revert();
			$rootScope.$broadcast("settings:load");
		}.bind(this), 1000);
	}

	this.save = function() {
		gAppData.planner_title = angular.copy(this.planner_title);  // temp
		gAppData.vpconfig = angular.copy(this.vpconfig);  // temp
	}
	
	this.reset();
}



//////////////////////////////////////////////////////////////////////

function VpAccountSvc($timeout, $rootScope)
{
	this.signIn = function() {
		this.sign_msg = "Signing In...";

		$timeout(function() {
			this.sign_msg = "user";
			$rootScope.$broadcast("account:signin");
		}.bind(this), 3000);
	}

	this.signOut = function() {
		this.sign_msg = "Signed Out";
		$rootScope.$broadcast("account:signout");
	}
	
	this.signIn();
}



//////////////////////////////////////////////////////////////////////

function VpViewStorageSvc($rootScope, $window)
{
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
}



//////////////////////////////////////////////////////////////////////

function VpAlmanacSvc(vpSettings)
{
	this.vpsettings = vpSettings;
	
	VpDate.weekends = this.vpsettings.vpconfig.weekends.split(',').map(s => parseInt(s));
	VpDate.localemonth = this.vpsettings.vpconfig.month_names.split('-');
	
	this.loadPrintInfo();
}

VpAlmanacSvc.prototype.initPage = function()
{
	var cfg = this.vpsettings.vpconfig;
	this.month_offset = -6;
	
	if (cfg.auto_scroll)
	{
		this.month_offset += cfg.auto_scroll_offset;
	}
	else
	{
		var off = ((cfg.first_month-1) - new Date().getMonth());
		if (off > 0)
			off -= 12;

		this.month_offset += off;
	}

	this.createMonths();
}

VpAlmanacSvc.prototype.offsetPage = function(off)
{
	this.month_offset += (6*off);
	this.createMonths();
}

VpAlmanacSvc.prototype.createMonths = function()
{
	var cfg = this.vpsettings.vpconfig;
		
	if (this.isPortrait())
		cfg.month_count = cfg.month_count_portrait;
	
	var vdt = new VpDate();
	vdt.toStartOfMonth();
	vdt.offsetMonth(this.month_offset);

	this.vpmonths = [];
	for (var i=0; i < (cfg.month_count+12); i++)
	{
		var vpmonth = new VpMonth(vdt.ymd());
		this.vpmonths.push(vpmonth);

		vdt.offsetMonth(1);
	}

	function VpMonth(ymd) {
		var vdt = new VpDate(ymd);
		
		this.hdr = vdt.MonthTitle();
		
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

		if (vdt.isWeekend())
			this.weekend = true;

		if (VpDate.isToday(ymd))
			this.today = true;
	}
}

VpAlmanacSvc.prototype.savePrintInfo = function(pos)
{
	var print_span = [];
	var n = Math.floor((this.vpmonths.length * pos) + 0.6);
	var c = (n + this.vpsettings.vpconfig.month_count)
	
	for (var i=n; i < c; i++)
		print_span.push(this.vpmonths[i]);

	window.VpPrintInfo = print_span;
}

VpAlmanacSvc.prototype.loadPrintInfo = function()
{
	if (window.opener && window.opener.VpPrintInfo)
	{
		this.vpmonths = window.opener.VpPrintInfo;
		this.printinfo = true;
	}
}

VpAlmanacSvc.prototype.isPortrait = function()
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
