// client-side collections
Leaders = new Meteor.Collection("leaders");
Business = new Meteor.Collection("business");
Player = new Meteor.Collection("player");
Print = new Meteor.Collection("print");
Craft = new Meteor.Collection("craft");
Notice = new Meteor.Collection("notice");
Cert = new Meteor.Collection("cert");

Meteor.subscribe('prospect');
Meteor.subscribe('employee');
Meteor.subscribe('player');
Meteor.subscribe('inventory');
Meteor.subscribe('business');
Meteor.subscribe('crafting');
Meteor.subscribe('station');
Meteor.subscribe('notice');
Meteor.subscribe("paperwork");
Meteor.subscribe("quest");