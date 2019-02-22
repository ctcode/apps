function vp_main($scope, $document, $timeout)
{
	$scope.toolbtnclass = {};
	$scope.show = {banner: true, grid: false, settings: false};
	$scope.settings = {banner_text: "visual-planner", vipconfig: new VpGridConfig()};
	$scope.sign_msg = "Signing In...";

	$timeout(function(){
		$scope.sign_msg = "Signed Out";
		$scope.show = {banner: true, grid: true, settings: false};
		$scope.settings = {banner_text: "vpng", vipconfig: new VpGridConfig()};
		$scope.vpgrid = new VpGrid();
		$scope.onclickColumn();
		$document[0].getElementById("grid").onwheel = $scope.onwheel;
		console.log($scope.vpgrid);
	}, 3000);

	//this.div.focus();

	$scope.onclickColumn = function() {
		$scope.toolbtnclass = {column: {checked: true}};
		$scope.vpgrid.setView({column: true});
	}

	$scope.onclickList = function() {
		$scope.toolbtnclass = {list: {checked: true}};
		$scope.vpgrid.setView({list: true});
	}

	$scope.onclickExpand = function() {
		$scope.toolbtnclass = {expand: {checked: true}};
		$scope.vpgrid.setView({expand: true});
	}

	$scope.onclickSettings = function() {
		$scope.show = {banner: false, grid: false, settings: true};
	}

	$scope.onclickCancel = function() {
		//$scope.settings = gAppData.getAppData();
		$scope.form.$setPristine(true);
		$scope.show = {banner: true, grid: true, settings: false};
	}

	$scope.onwheel = function(evt) {
		$scope.vpgrid.onwheel(evt);
		$scope.$apply();
	}
}

// s = angular.element($0).scope()
