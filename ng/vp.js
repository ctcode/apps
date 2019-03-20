//////////////////////////////////////////////////////////////////////

function VpAppController(vpViewStorage, vpAlmanac, vpSettings, $timeout, $window)
{
	this.show = {banner: true};
	this.view = vpViewStorage;
	this.settings = vpSettings;
	this.sign_msg = "Signing In...";
	this.multi_col_count_options = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 8: 8, 10: 10, 12: 12};

	$timeout(function(){
		vpSettings.load();
		this.sign_msg = "Signed Out";
		this.show = {banner: true, grid: true};
	}.bind(this), 3000);

	this.onclickPrint = function() {
		vpAlmanac.prePrint();
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



//////////////////////////////////////////////////////////////////////

function VpViewStorageSvc($window)
{
	this.load = function() {
		var stg = $window.localStorage.getItem("vp-viewname");
		var name = stg ? stg : "column";

		this.info = {};
		this.info[name] = {cls: {checked: true}};
	}

	this.setName = function(name) {
		$window.localStorage.setItem("vp-viewname", name);
		this.load();
	}

	this.load();
}



//////////////////////////////////////////////////////////////////////

function VpScrollDirective(vpAlmanac, $timeout)
{
	function fLink(scope, element, attrs) {

		var div = element[0];
		var scrollpos = (1/3);

		scope.$watch("vp.view.info", updateUI);

		function updateUI(vpv) {
			if (vpv.column)
				element.on("wheel", onWheel);
			else
				element.off("wheel", onWheel);

			if (vpv.column || vpv.expand)
				div.scrollLeft = (div.scrollWidth * scrollpos);
			else
				div.scrollTop = (div.scrollHeight * scrollpos);

			element.on("scroll", onScroll);
			
			element.css("overflow", "hidden");
			$timeout(function() {
				element.css("overflow", "auto");
				if (vpv.column)
					element.css("overflow-y", "hidden");
				if (vpv.list)
					element.css("overflow-x", "hidden");
			});
		}

		function onScroll() {
			if (scope.vp.view.info.column || scope.vp.view.info.expand)
				scrollpos = (div.scrollLeft / div.scrollWidth);
			else
				scrollpos = (div.scrollTop / div.scrollHeight);
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
