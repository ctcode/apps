//////////////////////////////////////////////////////////////////////

function VpAppController(vpViewStorage, vpAccount, vpSettings, $scope, $timeout)
{
	this.show = {planner: true};
	this.account = vpAccount;
	this.settings = vpSettings;
	this.view = vpViewStorage;
	this.busy = false;
	this.month_count_options = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 8: 8, 10: 10, 12: 12};

	this.onclickView = function(name) {
		vpViewStorage.setName(name);
		$scope.vpscroll.initView();
	}

	this.onclickPrint = function() {
		$scope.vpscroll.initPrint();
	}

	this.onclickSettings = function() {
		this.form.$setPristine(true);
		this.show = {settings: true};
	}

	this.onclickCancel = function() {
		vpSettings.revert();
		this.show = {planner: true};
	}

	this.onclickSave = function() {
		this.busy = true;
		vpSettings.save();
		$timeout(function() {
			this.busy = false;
			this.form.$setPristine(true);
			this.show = {planner: true};
			$scope.vpscroll.initView();
		}.bind(this), 2000)
	}

	$scope.$on("account:signin", function() {
		$scope.$apply(function() {
			vpSettings.load();
			$scope.vp.show = {planner: true};
		});
	});

	$scope.$on("account:signout", function() {
		$scope.$apply(function() {
			vpSettings.reset();
			$scope.vp.show = {planner: true};
			$scope.vpscroll.initView();
		});
	});

	$scope.$on("settings:load", function() {
		$scope.$apply(function() {
			$scope.vpscroll.initView();
		});
	});
}



//////////////////////////////////////////////////////////////////////

function VpScrollDirective(vpViewStorage, vpSettings, $rootScope, $timeout)
{
	function fLink(scope, element, attrs) {
		scope.vpscroll = {};
		var div = element[0];
		var view = {};

		element.on("scroll", onScroll);

		scope.vpscroll.initView = function() {
			view = vpViewStorage.sel;
			
			var m = vpSettings.getMonthCount();
			scope.vp.scroll_size = ((m+12)/m)*100;

			showView(false);
			element.off("wheel");
			if (view.column)
				element.on("wheel", onWheel);

			element.css("overflow", "auto");
			if (view.column)
				element.css("overflow-y", "hidden");
			if (view.list)
				element.css("overflow-x", "hidden");

			$timeout(function() {
				$rootScope.$broadcast("cmd:view");

				$timeout(function() {
					resetScroll();
					showView(true);
				});
			});
		}

		scope.vpscroll.initPrint = function() {
			$rootScope.$broadcast("cmd:print", getScrollPos());
		}

		function showView(show) {
			element.css("visibility", show ? "" : "hidden");
		}

		function getScrollPos() {
			return view.list ? (div.scrollTop / div.scrollHeight) : (div.scrollLeft / div.scrollWidth);
		}

		function resetScroll() {
			div.scrollTop = view.list ? (div.scrollHeight-div.clientHeight)/2 : 0;
			div.scrollLeft = view.list ? 0 : (div.scrollWidth-div.clientWidth)/2;
		}

		function pageScroll() {
			var pos = view.list ? div.scrollTop : div.scrollLeft;
			var max = view.list ? (div.scrollHeight - div.clientHeight) : (div.scrollWidth - div.clientWidth);

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



//////////////////////////////////////////////////////////////////////

function VpAccountSvc($rootScope)
{
	var auth = null;
	var status = {
		signed_in: false,
		msg: "Connecting..."
	};

	gapi.load("client:auth2", onLoadAuth);

	function onLoadAuth() {
		var oauthScope = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.appdata';
		gapi.auth2.init({client_id: vp_oauthClientID, scope: oauthScope}).then(onInitAuth, onFail);
	}

	function onInitAuth(au) {
		auth = au;
		auth.isSignedIn.listen(onSign);
		onSign();
	}

	function onSign() {
		status.signed_in = auth.isSignedIn.get();
		
		if (status.signed_in)
		{
			var gu = auth.currentUser.get();
			var bp = gu.getBasicProfile();
			status.msg = bp.getEmail();

			$rootScope.$broadcast("account:signin");
		}
		else
		{
			status.msg = "Signed Out";
			$rootScope.$broadcast("account:signout");
		}
	}

	function onFail(reason) {
		var msg = "";
		
		if (reason.error)
		{
			msg = "[" + reason.error + "]";

			if (reason.details)
				msg += reason.details;
		}

		status.msg = "Unable to sign in";
		alert("Account Error : " + msg);
	}

	this.SignIn = function() {
		auth.signIn();
	}

	this.SignOut = function() {
		auth.signOut();
	}
	
	this.status = status;
}
