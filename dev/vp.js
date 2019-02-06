function vp_main($scope, $timeout, $window)
{
	var gAccount = new AuthAccount();
	gAccount.authClientID = vp_oauthClientID;
	gAccount.authScope = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.appdata';

	var gAppData = new AuthAppData();
	gAppData.file_name = "settings001.json";
	gAppData.setDefault({banner_text: "visual-planner", vipconfig: new VipGridConfig()});

	gAppData.Patch = function(appdata) {
		if (!appdata.vipconfig.hasOwnProperty("first_month"))
			appdata.vipconfig.first_month = 1;
		if (!appdata.vipconfig.hasOwnProperty("weekends"))
			appdata.vipconfig.weekends = "6,0";
	}

	$scope.multi_col_count_options = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 8: 8, 10: 10, 12: 12};
	$scope.settings = gAppData.getAppData();
	$scope.signed_in = false;
	$scope.busy = false;
	$scope.sign_msg = "Signing In...";
	$scope.g_signbtn_ok = true;

	gAccount.onSignIn = function() {
		$scope.sign_msg = gAccount.getEmail();
		$scope.$apply();
		ReadAppdata();
	}

	gAccount.onSignOut = function() {
		gAppData.setAppData(null);
		$scope.settings = gAppData.getAppData();
		$scope.form.$setPristine(true);
		$scope.sign_msg = "Signed Out";
		$scope.signed_in = false;
		setView('home');
		$scope.$apply();
		initGrid();
	}

	gAccount.onError = function(msg) {
		alert("Account Error: " + msg);
	}

	gAccount.Connect();

	$scope.onclickListView = function() {
		setView('list');
		initListView();
		ga_hit("feature", "list_view");
	}

	$scope.onclickPrintView = function() {
		setView('print');
		initPrintView();
		ga_hit("feature", "print_view");
	}

	$scope.onclickCloseView = function() {
		setView('home');
	}

	$scope.onclickSettings = function() {
		setView('settings');
		$scope.g_signbtn_ok = (document.getElementById("g_signbtn").textContent.length > 0);
	}

	$scope.onclickSignIn = function() {
		gAccount.SignIn();
	}

	$scope.onclickSignOut = function() {
		gAccount.SignOut();
	}

	$scope.onclickSave = function() {
		$scope.busy = true;
		WriteAppdata();
	}

	$scope.onclickCancel = function() {
		$scope.settings = gAppData.getAppData();
		$scope.form.$setPristine(true);
		setView('home');
	}

	function ReadAppdata() {
		gAppData.Read(
			function() {
				$scope.settings = gAppData.getAppData();
				$scope.form.$setPristine(true);
				$scope.signed_in = true;
				setView('home');
				$scope.$apply();
				initGrid();
			},
			function(msg) {
				alert("Error loading settings.\n\n" + msg);
				ga_hit("appdata_error", msg);
			}
		);
	}

	function WriteAppdata() {
		gAppData.Write(
			$scope.settings,
			function() {
				$scope.busy = false;
				$scope.form.$setPristine(true);
				setView('home');
				$scope.$apply();
				initGrid();
			},
			function(msg) {
				alert("Error saving settings.\n\n" + msg);
				ga_hit("appdata_error", msg);
			}
		);
	}

	function initGrid() {
		document.title = $scope.settings.banner_text;

		var vg = new VipGrid("grid");
		var cb = new VipCalendarBar("calendarbar");

		if ($scope.signed_in)
		{
			var gCal = new AuthCal();
			gCal.onError = onCalError;

			vg.registerEventSource(gCal);
			cb.registerCalendarSource(gCal);
		}

		vg.cfg = $scope.settings.vipconfig;
		vg.init();
	}

	function setView(view) {
		$scope.view = view;
		
		if (view == 'home')
			$timeout(function(){$window.onresize();}, 100);
	}

	var cal_error_notified = false;
	function onCalError(msg) {
		if (cal_error_notified)
			return;

		alert("Error loading calendar events.\n\n" + msg);
		ga_hit("calendar_error", msg);

		cal_error_notified = true;
	}

	function initListView() {
		var viewcols = $window.vipgrid.getViewCols();
		$scope.listinfo = {rows: []};

		for (var icol=0; icol < viewcols.length; icol++)
		{
			var vipcol = viewcols[icol];
			
			var row = {hdr:vipcol.viphdr.getText(), cells: []};
			for (var i=0; i < (31+6); i++)
				row.cells.push({});

			var vipcell = vipcol.vipcells.First();
			while (vipcell)
			{
				var listcell = row.cells[vipcell.cellindex + vipcol.offsetday];
				listcell.num = vipcell.vipnum.getText();
				listcell.evts = [];
				listcell.classlist = ["vipday"];
				if (vipcell.hasClass("weekend"))
					listcell.classlist.push("weekend");

				vipcell = vipcell.Next();
			}

			$scope.listinfo.rows.push(row);
		}
	}

	function initPrintView() {
		var viewcols = $window.vipgrid.getViewCols();
		$scope.printinfo = {cols: [], rows: []};

		for (var i=0; i < (31+6); i++)
		{
			var row = {cells: []};

			for (var j=0; j < viewcols.length; j++)
				row.cells.push({});

			$scope.printinfo.rows.push(row);
		}

		for (var icol=0; icol < viewcols.length; icol++)
		{
			var vipcol = viewcols[icol];
			$scope.printinfo.cols.push(vipcol.viphdr.getText());

			var vipcell = vipcol.vipcells.First();
			while (vipcell)
			{
				var printcell = $scope.printinfo.rows[vipcell.cellindex + vipcol.offsetday].cells[icol];
				printcell.classlist = ["vipday"];
				if (vipcell.hasClass("weekend"))
					printcell.classlist.push("weekend");

				printcell.day = {num: vipcell.vipnum.getText(), evts: []};

				var vipevt = vipcell.vipevts.First();
				while (vipevt)
				{
					printcell.day.evts.push({title: vipevt.div.title, info: vipevt.info});
					vipevt = vipevt.Next();
				}

				vipcell = vipcell.Next();
			}
		}
		
		document.getElementById("printview").style.fontSize = $window.vipgrid.div.style.fontSize;
	}
}
