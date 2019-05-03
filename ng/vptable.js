//////////////////////////////////////////////////////////////////////

function VpTableDirective(vpViewStorage, vpSettings, vpAlmanac, $window)
{
	function fCtl($scope) {
		
		if (vpAlmanac.printinfo)
		{
			initView();
			return;
		}

		$scope.$on("cmd:view", function() {
			vpAlmanac.initPage();
			initView();
		});

		$scope.$on("scroll:page", function(evt, off) {
			vpAlmanac.offsetPage(off);
			initView();
		});

		$scope.$on("cmd:print", function(evt, pos) {
			vpAlmanac.savePrintInfo(pos);
			$window.open("vpprint.htm");
		});

		function initView() {
			var rows = [];
			var months = vpAlmanac.getMonths();

			var sz = getPos(months.length, 31+6+1+1);
			for (var y=0; y < sz.y; y++)
			{
				var row = {cells: []};

				for (var x=0; x < sz.x; x++)
					row.cells.push({empty: true})

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

			$scope.vt.onclickHdr = function(vpcell) {
				window.open("https://www.google.com/calendar/r/month/" + vpcell.month.gcal);
			}

			$scope.vt.onclickDayNum = function(vpcell) {
				window.open("https://www.google.com/calendar/r/week/" + vpcell.day.gcal);
			}
			
			$scope.vt.rows = rows;
			$scope.vt.fontscale = vpSettings.vpconfig.font_scale_pc/100;
			$scope.vt.past_opacity = vpSettings.vpconfig.past_opacity;
			$scope.vt.tableview = vpViewStorage;
		}

		function getPos(xpos, ypos) {
			return vpViewStorage.sel.list ? {x: ypos, y: xpos} : {x: xpos, y: ypos};
		}
	}

	function fLink(scope, element, attrs) {
	}

	return {
		controller: fCtl,
		controllerAs: "vt",
		link: fLink,
		templateUrl: "vptable.htm",
		restrict: 'E'
	};
}
