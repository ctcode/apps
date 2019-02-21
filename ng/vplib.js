//////////////////////////////////////////////////////////////////////

var vpgrid;

function VpGrid()
{
	vpgrid = this;

	this.cfg = new VpGridConfig();
	this.view = {cls: {}, style: {}};
	this.layout = {};

	this.scrollinfo = {offset: 0, extent: this.cfg.multi_col_count};
	if (this.cfg.auto_scroll)
		this.scrollinfo.offset = this.cfg.auto_scroll_offset;
	
	VpDate.weekends = this.cfg.weekends.split(',').map(s => parseInt(s));
	VpDate.localemonth = this.cfg.month_names.split('-');

	this.initVpCells();
	this.initVpMonths();
}

VpGrid.prototype.setView = function(view)
{
	if (view.column)
	{
		this.view.cls = {vpcolview: true};
		this.setFontSizeStyle(1.4);
		this.initColLayout();
	}

	if (view.list)
	{
		this.view.cls = {vplistview: true};
		this.setFontSizeStyle(1.8);
		this.initListLayout();
	}

	if (view.expand)
	{
		this.view.cls = {vpexpandview: true};
		this.setFontSizeStyle(3);
		this.initColLayout();
	}

	this.applyVpCells();
}

VpGrid.prototype.setFontSizeStyle = function(max)
{
	var sz = ((max * this.cfg.font_scale_pc)/100);
	this.view.style['font-size'] = fmt("^vh", sz);
}

VpGrid.prototype.initVpCells = function()
{
	this.months = [];
	this.vpcells = [];

	var vdt = new VpDate();
	vdt.toStartOfMonth();
	if (this.cfg.auto_scroll)
		vdt.offsetMonth(this.cfg.auto_scroll_offset);

	var c=0;
	var m=0;
	while (true)
	{
		var month;
		
		if (m != vdt.getMonth())
		{
			if (c == this.cfg.multi_col_count)
				break;

			month = {
				hdr: vdt.MonthTitle(),
				seq: c,
				offset: 0
			};
		
			if (this.cfg.align_weekends)
				month.offset = vdt.DayOfWeek();

			this.months.push(month);
			m = vdt.getMonth();

			c++;
		}

		var vpcell = new VpCell(vdt.ymd(), month);
		this.vpcells.push(vpcell);

		vdt.offsetDay(1);
	}
}

VpGrid.prototype.initColLayout = function()
{
	this.layout = {column: true, hdrs: [], rows: []};

	for (var y=0; y < (31+6); y++)
	{
		var row = {cells: []};

		for (var x=0; x < this.cfg.multi_col_count; x++)
		{
			if (y == 0)
				this.layout.hdrs.push(this.months[x].hdr);

			row.cells.push({empty: true});
		}

		this.layout.rows.push(row);
	}
}

VpGrid.prototype.initListLayout = function()
{
	this.layout = {list: true, rows: []};

	for (var y=0; y < this.months.length; y++)
	{
		var row = {hdr: this.months[y].hdr, cells: []};

		for (var x=0; x < (31+6); x++)
			row.cells.push({empty: true});

		this.layout.rows.push(row);
	}
}

VpGrid.prototype.applyVpCells = function()
{
	for (var i=0; i < this.vpcells.length; i++)
	{
		var vpcell = this.vpcells[i];

		var day_index = (vpcell.num-1) + vpcell.month.offset;
		var month_index = vpcell.month.seq;

		if (this.layout.column)
			this.layout.rows[day_index].cells[month_index] = vpcell;

		if (this.layout.list)
			this.layout.rows[month_index].cells[day_index] = vpcell;
	}
}

VpGrid.prototype.scroll = function(forward)
{
	if (this.scrolling_disabled)
		return;

	if (forward)
	{
	}
	else
	{
	}
}

VpGrid.prototype.initVpMonths = function()
{
	this.vpmonths = [];

	var vdt = new VpDate();
	vdt.toStartOfMonth();
	vdt.offsetMonth(this.scrollinfo.offset);

	for (var i=0; i < this.scrollinfo.extent; i++)
	{
		var vpmonth = new VpMonth(vdt.ymd());
		this.vpmonths.push(vpmonth);

		vdt.offsetMonth(1);
	}
}



//////////////////////////////////////////////////////////////////////

function VpMonth(ymd)
{
	var vdt = new VpDate(ymd);
	
	this.hdr = vdt.MonthTitle();
	this.offset = 0;
	if (vpgrid.cfg.align_weekends)
		this.offset = vdt.DayOfWeek();

	this.vpdays = [];

	var m = vdt.getMonth();
	while (m == vdt.getMonth())
	{
		var vpday = new VpDay(vdt.ymd());
		this.vpdays.push(vpday);

		vdt.offsetDay(1);
	}
}



//////////////////////////////////////////////////////////////////////

function VpDay(ymd)
{
	var vdt = new VpDate(ymd);

	this.cls = {vpday: true};
	this.id = ymd;
	this.num = vdt.DayOfMonth();

	if (vdt.isWeekend())
		this.cls.weekend = true;

	if (VpDate.isToday(ymd))
		this.cls.today = true;
}



//////////////////////////////////////////////////////////////////////

function VpCell(ymd, month)
{
	var vdt = new VpDate(ymd);

	this.cls = {vpcell: true};
	this.id = ymd;
	this.month = month;
	this.num = vdt.DayOfMonth();

	if (vdt.isWeekend())
		this.cls.weekend = true;

	if (VpDate.isToday(ymd))
		this.cls.today = true;
}



//////////////////////////////////////////////////////////////////////

function VpGridConfig()
{
	this.multi_col_count = 6;
	this.multi_col_count_portrait = 3;
	this.auto_scroll = true;
	this.auto_scroll_offset = -1;
	this.first_month = 1;
	this.weekends = "6,0";
	this.align_weekends = true;
	this.font_scale_pc = 80;
	this.past_opacity = 0.7;
	this.month_names = "Jan-Feb-Mar-Apr-May-Jun-Jul-Aug-Sep-Oct-Nov-Dec";
	this.show_event_time = true;
	this.show_event_title = true;
	this.show_event_marker = true;
	this.colour_event_title = false;
	this.proportional_events = false;
	this.proportional_start_hour = 8;
	this.proportional_end_hour = 20;
	this.show_all_day_events = true;
	this.single_day_as_multi_day = false;
	this.show_timed_events = true;
	this.multi_day_as_single_day = false;
	this.first_day_only = false;
	this.marker_width = 0.85;
	this.multi_day_opacity = 0.8;
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
