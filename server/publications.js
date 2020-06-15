Meteor.publish("player", function () {
	let pub = this,
	playersPub = [],
	foundPub = Meteor.users.find({
		_id: this.userId
	},{ fields: {
		username: 1,
		money: 1,
		exp: 1,
		updated: 1
	} });
	if ( this.userId ) {
		playersPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				pub.added('player', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('player', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('player', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			playersPub.stop();
		});
	};
});

Meteor.publish("business", function () {
	let pub = this,
	businessPub = [],
    foundPub = Paperwork.find({
		certificate: true 
	},{ sort: {
		money: -1,
		updated: -1,
		created: -1
	} });
	if ( this.userId ) {
		businessPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				pub.added('business', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('business', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('business', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			businessPub.stop();
		});
	};
});

Meteor.publish("crafting", function () {
	let pub = this,
	craftingPub = [],
    foundPub = Crafting.find({ "$and": [
		{ owner: this.userId },
		{ completed: {
			$exists: false
		} }
	]});
	if ( this.userId ) {
		craftingPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				const
				item = Paperwork.findOne({ _id: oFields.item }),
				employee = Prospect.findOne({ _id: oFields.employeeId },{ fields: { name: 1 } });
				if ( item )
				oFields.item = item;
				if ( employee )
				oFields.employeeName = employee.name;
				pub.added('crafting', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('crafting', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('crafting', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			craftingPub.stop();
		});
	};
});

Meteor.publish("craft", function (print, type, level) {
	let pub = this,
	craftPub = [],
	find = [{ print: print },{ type: type }];
	if ( level )
	find.push({ level: level })
	foundPub = Paperwork.find({ "$and": find });
	if ( this.userId ) {
		craftPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				pub.added('craft', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('craft', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('craft', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			craftPub.stop();
		});
	};
});

Meteor.publish("print", function (print, type, level) {
	let pub = this,
	printPub = [],
	find = [{ print: print },{ type: type }];
	if ( level )
	find.push({ level: level })
	foundPub = Paperwork.find({ "$and": find });
	if ( this.userId ) {
		printPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				pub.added('print', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('print', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('print', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			printPub.stop();
		});
	};
});

Meteor.publish("paperwork", function (certId) {
	let pub = this,
	paperworkPub = [],
	foundPub = Paperwork.find({ owner: this.userId });
	if ( certId )
	foundPub = Paperwork.find({ "$or": [
		{ _id: certId },
		{ owner: this.userId }
	] });
	if ( this.userId ) {
		paperworkPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				pub.added('paperwork', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('paperwork', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('paperwork', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			paperworkPub.stop();
		});
	};
});

Meteor.publish("notice", function () {
	let pub = this,
	noticePub = [],
    foundPub = Message.find({ "$and": [
		{ owner: this.userId },
		{ notice: true }
	]},{ sort: { created: -1 }, limit: 20 });
	if ( this.userId ) {
		noticePub = foundPub.observeChanges({
			added: function(oId, oFields) {
				pub.added('notice', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('notice', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('notice', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			noticePub.stop();
		});
	};
});

Meteor.publish("prospect", function () {
	let pub = this,
	prospectPub = [],
    foundPub = Prospect.find({ owner: { $exists: false } });
	if ( this.userId ) {
		prospectPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				pub.added('prospect', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('prospect', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('prospect', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			prospectPub.stop();
		});
	};
});

Meteor.publish("employee", function () {
	let pub = this,
	employeePub = [],
    foundPub = Prospect.find({ owner: this.userId });
	if ( this.userId ) {
		employeePub = foundPub.observeChanges({
			added: function(oId, oFields) {
				pub.added('employee', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('employee', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('employee', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			employeePub.stop();
		});
	};
});

Meteor.publish("station", function () {
	let pub = this,
	stationPub = [],
	foundPub = Station.find({ owner: this.userId });
	if ( this.userId ) {
		stationPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				pub.added('station', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('station', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('station', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			stationPub.stop();
		});
	};
});

Meteor.publish("inventory", function () {
	let pub = this,
	inventoryPub = [],
	foundPub = Inventory.find({ owner: this.userId });
	if ( this.userId ) {
		inventoryPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				pub.added('inventory', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('inventory', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('inventory', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			inventoryPub.stop();
		});
	};
});

Meteor.publish("statistics", function () {
	let pub = this,
	statisticsPub = [],
    foundPub = Statistics.find();
	if ( this.userId ) {
		statisticsPub = foundPub.observeChanges({
			added: function(oId, oFields) {
				pub.added('statistics', oId, oFields);
			},
			changed: function(oId, oFields) {
				pub.changed('statistics', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('statistics', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			statisticsPub.stop();
		});
	};
});

Meteor.publish("leaders", function (skip) {
	let pub = this,
    leadersPub = [],
    foundPub = Meteor.users.find({
        //'status.online': true
    },{
		fields: {
			username: 1,
            'status.online': 1,
            'status.idle': 1,
            money: 1,
            updated: 1
		},
		sort: {
			money: -1,
			updated: -1
		},
		skip: skip*40,
		limit: 41
	});	
	if ( this.userId ) {
		leadersPub = foundPub.observeChanges({
			added: function(oId,oFields) {
				pub.added('leaders', oId, oFields);
			},
			changed: function(oId,oFields) {
				pub.changed('leaders', oId, oFields);
			},
			removed: function(oId) {
				pub.removed('leaders', oId);
			}
		});
		pub.ready();
		pub.onStop(function () {
			leadersPub.stop();
		});
	};
});