//////////////////////////////////////////////////////////////////////

function VpAppController(vpViewStorage, vpAccount, vpSettings, $scope)
{
	this.show = {planner: true};
	this.account = vpAccount;
	this.settings = vpSettings;
	this.view = vpViewStorage;
	this.month_count_options = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 8: 8, 10: 10, 12: 12};

	$scope.$on("account:signin", function() {
		vpSettings.load();
	});

	$scope.$on("account:signout", function() {
		vpSettings.reset();
	});

	$scope.$on("settings:load", function() {
		$scope.vpscroll.initView();
	});

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
			
			var m = scope.vp.settings.vpconfig.month_count;
			scope.vp.scroll_size = ((m+12)/m)*100;

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
			div.scrollTop = vpv.list ? (div.scrollHeight-div.clientHeight)/2 : 0;
			div.scrollLeft = vpv.list ? 0 : (div.scrollWidth-div.clientWidth)/2;
		}

		function pageScroll() {
			var pos = vpv.list ? div.scrollTop : div.scrollLeft;
			var max = vpv.list ? (div.scrollHeight - div.clientHeight) : (div.scrollWidth - div.clientWidth);

			if (pos > 0 && pos < max)
				return;

			showView(false);
			$timeout(function() {
				$rootScope.$broadcast("scroll:page", pos == 0 ? -1 : 1);
				$timeout(function() {
					resetScroll();
					showView(true);
				});
			});
		}

		var tmo=null;
		function onScroll(evt) {
			$timeout.cancel(tmo);
			tmo = $timeout(pageScroll, 1000);
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
