var app = angular.module("vpapp", []);
app.controller("VpAppController", VpApp);
app.controller("VpLayoutController", VpLayout);
app.service("VpSettingsSvc", VpSettings);
app.service("VpAlmanacSvc", VpAlmanac);
app.directive("vpGrid", VpGrid);

function VpApp(VpSettingsSvc, $window, $timeout)
{
	this.show = {banner: true};
	this.viewinfo = {};
	this.columninfo = {view: {column: true}, btnclass: {column: {checked: true}}};
	this.listinfo = {view: {list: true}, btnclass: {list: {checked: true}}};
	this.expandinfo = {view: {expand: true}, btnclass: {expand: {checked: true}}};
	this.settings = VpSettingsSvc;
	this.sign_msg = "Signing In...";
	this.multi_col_count_options = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 8: 8, 10: 10, 12: 12};

	$timeout(function(){
		VpSettingsSvc.load();
		this.sign_msg = "Signed Out";
		this.show = {banner: true, grid: true};
		this.viewinfo = this.columninfo;
	}.bind(this), 3000);

	this.onclickPrint = function() {
		$window.open("vpprint.htm");
	}

	this.onclickSettings = function() {
		this.show = {settings: true};
	}

	this.onclickCancel = function() {
		this.form.$setPristine(true);
		this.show = {banner: true, grid: true};
	}

	this.redrawGrid = function() {
		this.show.grid = false;
		$timeout(function(){
			this.show.grid = true;
		}.bind(this), 100);
	}
}

// s = angular.element($0).scope()
// angular.element($0).injector().get("VpSettingsSvc")
