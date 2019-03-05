var app = angular.module("vpapp", []);
app.controller("VpController", VpCtrl);
app.service("VpSettingsSvc", VpSettings);

function VpCtrl(VpSettingsSvc, $window, $timeout)
{
	this.toolbtnclass = {};
	this.gridurl = "";
	this.show = {banner: true};
	this.settings = VpSettingsSvc;
	this.sign_msg = "Signing In...";
	this.multi_col_count_options = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 8: 8, 10: 10, 12: 12};

	$timeout(function(){
		VpSettingsSvc.load();
		this.sign_msg = "Signed Out";
		this.show = {banner: true, grid: true};
		this.onclickColumn();
	}.bind(this), 3000);

	this.onclickColumn = function() {
		this.toolbtnclass = {column: {checked: true}};
		this.gridurl = "vpcolumn.htm";
	}

	this.onclickList = function() {
		this.toolbtnclass = {list: {checked: true}};
		this.gridurl = "vplist.htm";
	}

	this.onclickExpand = function() {
		this.toolbtnclass = {expand: {checked: true}};
		this.gridurl = "vpexpand.htm";
	}

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
}

// s = angular.element($0).scope()
// angular.element($0).injector().get("VpSettingsSvc")
