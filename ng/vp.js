//////////////////////////////////////////////////////////////////////

function VpAppController(vpViewStorage, vpSettings, $scope)
{
	this.show = {planner: true};
	this.view = vpViewStorage;
	this.settings = vpSettings;
	this.sign_msg = "Signing In...";
	this.month_count_options = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 8: 8, 10: 10, 12: 12};

	$scope.$on("settings:load", function(evt) {
		this.sign_msg = "Signed Out";
		vpViewStorage.load();
		$scope.vpscroll.initView();
	}.bind(this));

	this.onclickView = function(name) {
		vpViewStorage.setName(name);
		$scope.vpscroll.initView();
	}

	this.onclickPrint = function() {
		$scope.vpscroll.initPrint();
	}

	this.onclickSettings = function() {
		this.show = {settings: true};
	}

	this.onclickCancel = function() {
		this.form.$setPristine(true);
		this.show = {planner: true};
	}
}



//////////////////////////////////////////////////////////////////////

function VpScrollDirective(vpViewStorage, $rootScope, $timeout)
{
	function fLink(scope, element, attrs) {
		scope.vpscroll = {};
		var div = element[0];
		var vpv = {};

		element.on("scroll", onScroll);

		scope.vpscroll.initView = function() {
			vpv = scope.vp.view.sel;

			showView(false);
			$timeout(function() {
				if (vpv.column)
					element.on("wheel", onWheel);
				else
					element.off("wheel");

				element.css("overflow", "auto");
				if (vpv.column)
					element.css("overflow-y", "hidden");
				if (vpv.list)
					element.css("overflow-x", "hidden");

				$rootScope.$broadcast("cmd:view");

				resetScroll();
				showView(true);
			});
		}

		scope.vpscroll.initPrint = function() {
			$rootScope.$broadcast("cmd:print", getScrollPos());
		}

		function showView(show) {
			element.css("visibility", show ? "" : "hidden");
		}

		function getScrollPos() {
			return vpv.list ? (div.scrollTop / div.scrollHeight) : (div.scrollLeft / div.scrollWidth);
		}

		function resetScroll() {
			div.scrollTop = vpv.list ? (div.scrollHeight/3) : 0;
			div.scrollLeft = vpv.list ? 0 : (div.scrollWidth/3);
		}

		var tmo=null;
		function onScroll(evt) {
			$timeout.cancel(tmo);

			var pos = vpv.list ? div.scrollTop : div.scrollLeft;
			var max = vpv.list ? (div.scrollHeight - div.clientHeight) : (div.scrollWidth - div.clientWidth);

			var off = false;
			if (pos == 0) off = -1;
			if (pos == max) off = 1;

			if (off)
			{
				tmo = $timeout(function() {
					showView(false);
					$timeout(function() {
						$rootScope.$broadcast("scroll:page", off);
						$timeout(function() {
							resetScroll();
							showView(true);
						});
					});
				}, 1000);
			}
		}

		function onWheel(evt) {
			var dy = evt.deltaY;
			if (evt.deltaMode == 1) dy = (dy*30);
			if (evt.deltaMode == 2) dy = (dy*300);

			evt.target.scrollBy(dy,0);
			evt.preventDefault();
		}
	}

	return {
		link: fLink,
		restrict: 'A'
	};
}
