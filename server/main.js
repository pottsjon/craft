import { Meteor } from 'meteor/meteor';
import { UserStatus } from 'meteor/mizzao:user-status';

import '../lib/api/collections.js';
import '../lib/api/functions.js';
import './publications.js';
import './crons.js';
import '../lib/config/at_config.js';
import '../lib/config/globals.js';
import '../lib/api/methods.js';

Accounts.onCreateUser(function(options, user) {
  user.money = 100;
  updated = new Date().getTime();
	return user;
});

// don't let people write arbitrary data to their 'profile' field from the client
Meteor.users.deny({
	update() {
	  return true;
	},
});

idleTimers = [];
Meteor.startup(() => {
  setTrademarks();
  startEmployees();
  startCrafting();
  startStations();
  unemployedHappiness();
  lastOnline = function (userId) {
		Meteor.users.update({
      _id: userId
    },{	$set: {
      'status.lastOnline': new Date()
    }, $unset: {
      'status.online': "",
      'status.idle': "",
      'status.lastActivity': ""
      }
		});
  }
	UserStatus.events.on("connectionLogout", function(fields) {
    lastOnline(fields.userId);
	});
	UserStatus.events.on("connectionIdle", function(fields) {
    idleTimers[fields.userId] = Meteor.setTimeout(function() {
      lastOnline(fields.userId);
    }, 1000*60*15);
  });
	UserStatus.events.on("connectionActive", function(fields) {
    try { Meteor.clearTimeout(idleTimers[fields.userId]) } catch(e) {};
  });
});
