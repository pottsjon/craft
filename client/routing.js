Router.configure({
	loadingTemplate: 'loading'
});

Router.onBeforeAction(function() {
	if ( !Meteor.userId() ) {
		this.render('login');
	} else {
		this.next();
	};
});  

Router.route('/', {
	waitOn: function() {
        return []
	},
	onBeforeAction: function() {
		this.next();
	},
	action: function(){
		this.render('main');
	}
});