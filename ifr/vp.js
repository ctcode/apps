function vp_main($scope, $document, $timeout)
{
	$scope.toolbtnclass = {};
	$scope.gridurl = "";
	$scope.show = {banner: true};
	$scope.settings = {banner_text: "visual-planner", vipconfig: {}};
	$scope.sign_msg = "Signing In...";

	$timeout(function(){
		$scope.sign_msg = "Signed Out";
		$scope.show = {banner: true, grid: true};
		$scope.settings = {banner_text: "vp/ifr", vipconfig: {}};
		$scope.onclickColumn();
	}, 3000);

	//this.div.focus();

	$scope.onclickColumn = function() {
		$scope.toolbtnclass = {column: {checked: true}};
		$scope.gridurl = "vpcolumn.htm";
	}

	$scope.onclickList = function() {
		$scope.toolbtnclass = {list: {checked: true}};
		$scope.gridurl = "vplist.htm";
	}

	$scope.onclickExpand = function() {
		$scope.toolbtnclass = {expand: {checked: true}};
		$scope.gridurl = "vpexpand.htm";
	}

	$scope.onclickSettings = function() {
		$scope.show = {settings: true};
	}

	$scope.onclickCancel = function() {
		//$scope.settings = gAppData.getAppData();
		$scope.form.$setPristine(true);
		$scope.show = {banner: true, grid: true};
	}
}

// s = angular.element($0).scope()
