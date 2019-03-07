var app = angular.module("vpapp", []);
app.controller("VpController", VpCtrl);
app.controller("VpColLayoutController", VpColLayout);
app.controller("VpRowLayoutController", VpRowLayout);
app.service("VpSettingsSvc", VpSettings);
app.service("VpAlmanacSvc", VpAlmanac);

myonwheel = function(event)
{
	//console.log(event);
	document.getElementById("grid").scrollBy(event.deltaY, 0);
	event.preventDefault();
}
document.onwheel = myonwheel;

function VpCtrl(VpSettingsSvc, $window, $timeout)
{
	this.show = {banner: true};
	this.toolbtnclass = {};
	this.view = {};
	this.layout = {};
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
		this.view = {column: true};
		this.layout = {col: true};
		this.redrawGrid();
	}

	this.onclickList = function() {
		this.toolbtnclass = {list: {checked: true}};
		this.view = {list: true};
		this.layout = {row: true};
		this.redrawGrid();
	}

	this.onclickExpand = function() {
		this.toolbtnclass = {expand: {checked: true}};
		this.view = {expand: true};
		this.layout = {col: true};
		this.redrawGrid();
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

	this.redrawGrid = function() {
		this.show.grid = false;
		$timeout(function(){
			this.show.grid = true;
		}.bind(this), 100);
	}
}

// s = angular.element($0).scope()
// angular.element($0).injector().get("VpSettingsSvc")
