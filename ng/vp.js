var app = angular.module("vpapp", []);
app.controller("vpApp", VpAppController);
app.directive("vpTable", VpTableDirective);
app.service("vpSettings", VpSettingsSvc);
app.service("vpAlmanac", VpAlmanacSvc);

function VpAppController(vpSettings, vpAlmanac, $timeout, $window)
{
	this.show = {banner: true};
	this.viewinfo = {};
	this.settings = vpSettings;
	this.sign_msg = "Signing In...";
	this.multi_col_count_options = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 8: 8, 10: 10, 12: 12};

	$timeout(function(){
		vpSettings.load();
		this.sign_msg = "Signed Out";
		this.show = {banner: true, grid: true};
		this.viewinfo = {view: {column: true}, btnclass: {column: {checked: true}}};
	}.bind(this), 3000);

	this.onclickPrint = function() {
		vpAlmanac.setStorage(0.28);  // todo
		$window.open("vpprint.htm");
	}

	this.onclickSettings = function() {
		this.show = {settings: true};
	}

	this.onclickCancel = function() {
		this.form.$setPristine(true);
		this.show = {banner: true, grid: true};
	}
}

// s = angular.element($0).scope()
// angular.element($0).injector().get("vpSettings")
