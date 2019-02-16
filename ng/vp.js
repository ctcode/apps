function vp_main($scope, $timeout)
{
	$scope.show = {banner: true, grid: false, settings: false};
	$scope.settings = {banner_text: "visual-planner", vipconfig: new VpGridConfig()};
	$scope.sign_msg = "Signing In...";
	console.log($scope.vpgrid);

	$timeout(function(){
		$scope.sign_msg = "Signed Out";
		$scope.show = {banner: true, grid: true, settings: false};
		$scope.settings = {banner_text: "vpng", vipconfig: new VpGridConfig()};
		$scope.vpgrid = new VpGrid();
		$scope.vpgrid.setView({column: true});
	}, 3000);

	//this.div.focus();

	$scope.onclickColumns = function() {
		$scope.vpgrid.setView({column: true});
	}

	$scope.onclickList = function() {
		$scope.vpgrid.setView({list: true});
	}

	$scope.onclickExpand = function() {
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

	$scope.scroll = function() {
		//$scope.$apply();
	}
}

// s = angular.element($0).scope()
