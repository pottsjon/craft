import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { ReactiveDict } from 'meteor/reactive-dict';
import { UserStatus } from 'meteor/mizzao:user-status';
import { mdiAccount } from '@mdi/js';

import './main.html';

import '../lib/api/collections.js';
import './subscriptions.js';
import './deps.js';
import './routing.js';
import './helpers.js';
import '../lib/config/at_config.js';
import '../lib/config/globals.js';
import '../lib/api/functions.js';
import '../lib/api/methods.js';

UI.body.onRendered(function() {
	Tracker.autorun(function() {
    Meteor.setInterval(function() {
      const timenow = TimeSync.serverTime( (new Date()).getTime() );
      if ( timenow ) {
        time = timenow;
        timeDep.changed();
	  };
    }, 333);
  });
});

Deps.autorun(function(c) {
	try {
    UserStatus.startMonitor({
      threshold: 1000*60*15,
      interval: 1000*60*3,
      idleOnBlur: true
    });
    return c.stop();
	} catch (e) {}
});

Template.main.onCreated(function () {
	craftingSub = Meteor.subscribe("craft", "M8co", "Goods");
	papersSub = Meteor.subscribe("paperwork");
	let count = 0;
	findCert = function () {
		const cert = Paperwork.findOne({
			certId: {
				$exists: true
			}
		},{ fields: {
			certId: 1
		} });
		if ( cert && cert.certId ) {
			try { papersSub.stop() } catch (e) { };
			papersSub = Meteor.subscribe("paperwork", cert.certId);
			certId = cert.certId;
			certIdDep.changed();
		} else if ( count >= 5 ) {
			try { papersSub.stop() } catch (e) { };
			papersSub = Meteor.subscribe("paperwork");
		} else {
			count++
			Meteor.setTimeout(function() {
				findCert();
			}, 200);
		};
	};
	findCert();
	Employee.find({},{ fields: { name: 1, exp: 1, skills: 1 } }).observe({
		changed: function(next, prev) {
			const
			prints = [{ print: "M8co" },{ print: "Tri-Goo" },{ print: "Squish" }],
			nextExp = expLevel(next.exp),
			prevExp = expLevel(prev.exp),
			message = {
				employee: next.name,
				level: nextExp
			};
			if ( prev.exp && nextExp > prevExp )
			Meteor.call('noticeMessage', message);
			if ( prev.skills )
			for ( let i = 0; prints.length > i; i++ ) {
				const
				nData = expLevel(next.skills[prints[i].print]),
				pData = expLevel(prev.skills[prints[i].print]),	
				message = {
					employee: next.name,
					skill: prints[i].print,
					level: nData
				};
				if ( nData && pData && nData > pData )
				Meteor.call('noticeMessage', message);
			}
		}
	});
});

Template.info.helpers({
	business(){
		return Paperwork.find({ certificate: true });
	},
	player(){
		return Player.find({},{ fields: { username: 1, money: 1, exp: 1 } });
	},
	level(){
		let exp = !this.exp ? 0 : this.exp;
		return expPlayerLevel(exp);
	},
	exp(){
		let exp = !this.exp ? 0 : this.exp;
		const level = expPlayerLevel(exp, true);
		return toNumbers(exp-level.last)+"/"+toNumbers(level.next-level.last);
	}
});

Template.info.events({
	'click .logout'() {
    	Meteor.logout();
  	}
});

Template.player.helpers({
	options(){
		return Paper;
	},	
	licenses(){
		return Paperwork.find({ type: "License" });
	},
	paid(){
		return ( !this.paid ) ? "Pending" : this.paid + " Day(s)";
	},
	cost(){
		return this.cost ? this.cost : ( !this.cost && !this.exp ) ? 300 : 600;
	}
});

Template.player.events({
	'click .option'() {
		Meteor.call('buyOption', this.name, (error) => {
			if ( !error )
			findCert();
		});
	}
});

Template.statistics.helpers({
	statistic(){
		return Statistics.find({},{ sort: { level: -1, print: 1, type: 1, made: -1 } });
	},
	type(){
		return "("+this.type.charAt(0)+")";
	},
	level(){
		return "Lvl "+this.level;
	}
});

Template.stations.onCreated(function () {
	this.selected = new ReactiveVar(false);
});
Template.stations.helpers({
	station(){
		let
		prints = [
			{ print: "M8co", level: 1 },
			{ print: "Tri-Goo", level: 1 },
			{ print: "Squish", level: 1 }
		],
		stations = Station.find({},{ sort: { level: -1 } }).fetch();
		for ( let i = 0; prints.length > i ; i++ ) {
			let hold = true;
			if ( stations.length >= 1 )
			for ( let o = 0; stations.length > o ; o++ ) {
				if ( prints[i].print == stations[o].print )
				hold = false;
			}
			if ( hold )
			stations.push(prints[i]);
		}
		return stations;
	},
	upgrade(){
		const
		s = this.level <= 1 ? "" : "s",
		selected = Template.instance().selected.get(),
		clock = "<span class='mdi mdi-clock-outline'></span>",
		cash = "<span class='mdi mdi-cash-usd-outline'></span>",
		cost = "<div class='detail cost'>"+cash+"<span>"+toDollars(this.level*2000)+"</span></div>",
		timing = "<div class='detail time'>"+clock+"<span>"+this.level+" Hour"+s+"</span></div>";
		if ( selected == this.print || selected == this._id )
		return "<div class='amounts'>"+cost+timing+"</div>";
	},
	details(){
		const
		fifth = this.level % 5 == 0,
		selected = Template.instance().selected.get(),
		details = stationDetails(this.level+1),
		stationPlural = details.stations == 1 ? "" : "s";
		let data = !fifth ? details.dupes+"% Dupes" : details.stations+" Station"+stationPlural;
		data = this.level == 50 ? "40% Dupes" : data;
		if ( selected == this.print || selected == this._id )
		return "<div class='note'>"+data+"</div>";
	},
	buttons(){
		const selected = Template.instance().selected.get();
		if ( selected == this.print || selected == this._id )
		return "<div class='bottom'><div class='button upgrade'>Upgrade</div></div>";
	},
	progress(){
		timeDep.depend();
		const timer = this.level*3600000;
		const running = new Date().getTime()-this.upgrading;
		const current = ( running / timer ) % 1;
		const remain = current * timer;
		const width = 100-( ( ( timer-remain ) / timer)*100 );
		if ( this.upgrading )
		return "<div class='progress'><div class='bar' style='width: "+width+"%;' ><div class='timer'>Upgrading "+formatTimer(Math.ceil( (timer-remain) / 1000 ))+"</div></div></div>"
	},
	upgrades(){
		const
		details = stationDetails(this.level),
		stationsPlural = details.stations <= 1 ? "" : "s",
		stations = details.stations+" Station"+stationsPlural,
		points = details.dupes >= 1 ? ", "+details.dupes+"% Dupes" : "";
		return "<div class='upgrades'>"+stations+points+"</div>";
	}
});
Template.stations.events({
	'click .upgrade'() {
		Meteor.call('upgradeStation', this.print)
	},
	'click .station'(e,t) {
		let data = !this._id ? this.print : this._id;
		data = t.selected.get() == data ? false : data;
		t.selected.set(data);
	}
});


Template.trademark.onCreated(function () {
	this.trademarkName = new ReactiveVar(false);
	this.trademarkPrint = new ReactiveVar("M8co");
	this.trademarkLevel = new ReactiveVar(1);
	this.partOne = new ReactiveVar({});
	this.partTwo = new ReactiveVar({});
	this.resources = new ReactiveVar([]);
});

Template.trademark.helpers({
	trademark(){
		return Paperwork.find({ "$or": [
			{ type: "Trademark" },
			{ "$and": [
				{ owner: Meteor.userId() },
				{ "$or": [
					{ type: "Parts" },
					{ type: "Goods" }
				]}
			]}
		]},{
			sort: {
				pending: -1,
				level: -1
			}
		});
	},
	level(){
		let count = 0,
		data = !this.level? "Pending" : this.level,
		one = Template.instance().partOne.get(),
		two = Template.instance().partTwo.get(),
		level = Template.instance().trademarkLevel.get(),
		name = Template.instance().trademarkName.get(),
		print = Template.instance().trademarkPrint.get()
		resources = Template.instance().resources.get();
		for ( let i = 0; i < resources.length; i++ ) {
			if ( resources[i].resource )
			count++
		}
		name = ( name.length >= 3 && name.length <= 14 ) ? name : false;
		let good = one.name && two.name && level && name && print,
		part = name && count == 3;
		return ( this.type == "Trademark" && ( good || part ) ) ? "Ready" : data;
	},
	group(){
		let name = Template.instance().trademarkPrint.get();
		return ([
			{ name: "M8co" },
			{ name: 'Tri-Goo' },
			{ name: 'Squish' }
		]).map(function(print){
			if ( print.name == name )
			print.hightlight = "highlight";
			return print;
    	});
	},
	searching(){
		let pending,
		count = 0,
		one = Template.instance().partOne.get(),
		two = Template.instance().partTwo.get();
		resources = Template.instance().resources.get();
		for ( let i = 0; i < resources.length; i++ ) {
			if ( resources[i].pending )
			pending = true;
		}
		const part = ( one.pending || two.pending ),
		resource = pending;
		if ( part ) {
			return "Part";
		} else if ( resource ) {
			return "Resource";
		};
	},
	part(){
		let one = Template.instance().partOne.get(),
		two = Template.instance().partTwo.get();
		if ( !one.pending && !two.pending ) {
			return [one,two];
		} else {
			return Print.find().map(function(print){
				print.class = "selection";
				return print;
			});
		};
	},
	resource(){
		let pending, count = 0,
		resources = Template.instance().resources.get();
		for ( let i = 0; i < resources.length; i++ ) {
			if ( resources[i].resource )
			count++
			if ( resources[i].pending )
			pending = true;
		}
		if ( !pending ) {
			return resources;
		} else {
			return [
				{ name: "Metal", resource: true, class: "choose" },
				{ name: "Plastic", resource: true, class: "choose" },
				{ name: "Organic", resource: true, class: "choose" }
			];
		};
	},
	adding(){
		let pending, count = 0,
		resources = Template.instance().resources.get();
		for ( let i = 0; i < resources.length; i++ ) {
			if ( resources[i].resource )
			count++
			if ( resources[i].pending )
			pending = true;
		}
		if ( count < 3 && !pending )
		return '<div class="option noselect"><div class="button resource">Select Resource</div></div>'

	},
	goods(){
		return this.name == "Goods Trademark";
	},
	name(){	
		let name = ( ( this.type == "Goods" || this.type == "Parts" ) && ( this.class != "selection" && this.class != "selected" ) )? this.print+" "+this.name : this.name;
		return !this.name ? "Select Part" : name;
	},
	listing(){
		return ( this.type == "Goods" || this.type == "Parts" ) ? "listing" : "trademark";
	},
	initial(){
		if ( this.type == "Goods" || this.type == "Parts" )
		return this.type == "Goods" ? "(G)" : "(P)";
	},
	nameSelect(){
		return Template.instance().trademarkName.get();
	},
	levelSelect(){
		return Template.instance().trademarkLevel.get();
	},
	remove() {
		if ( this.class == "selected" || this.class == "chosen" )
		return '<div class="remove">X</div>'
	},
	ready(){
		let count = 0,
		one = Template.instance().partOne.get(),
		two = Template.instance().partTwo.get(),
		level = Template.instance().trademarkLevel.get(),
		name = Template.instance().trademarkName.get(),
		print = Template.instance().trademarkPrint.get(),
		resources = Template.instance().resources.get();
		for ( let i = 0; i < resources.length; i++ ) {
			if ( resources[i].resource )
			count++
		}
		name = ( name.length >= 3 && name.length <= 14 ) ? name : false;
		if ( ( one.name && two.name && level && name && print ) || ( name && count == 3 ) )
		return true;
	}
});

Template.trademark.events({
	'click .close'(e,t) {
		let pending,
		count,
		one = t.partOne.get(),
		two = t.partTwo.get();
		resources = t.resources.get();
		for ( let i = 0; i < resources.length; i++ ) {
			if ( resources[i].pending ) {
				pending = true;
				count = i;
			};
		}
		if ( one.pending ) {
			t.partOne.set({});
		} else if ( two.pending ) {
			t.partTwo.set({});
		} else if ( pending ) {
			resources.splice(count, 1);
			t.resources.set( resources );
		};
	},
	'click .apply'(e,t) {
		const one = t.partOne.get(),
		two = t.partTwo.get(),
		level = t.trademarkLevel.get(),
		name = t.trademarkName.get(),
		print = t.trademarkPrint.get(),
		resources = t.resources.get();
		if ( this.name == "Goods Trademark" ) {
			Meteor.call('applyTrademark', "Goods", name, print, level, one.name, two.name);
		} else {
				for ( let i = 0; i < resources.length; i++ ) {
					try {
						delete  resources[i].resource;
						delete  resources[i].class;
					} catch (e) { };
				}
			Meteor.call('applyTrademark', "Parts", name, print, level, resources);
		};
		t.resources.set([]);
		t.partOne.set({});
		t.partTwo.set({});
		t.trademarkLevel.set(1);
		t.trademarkName.set(false);
		t.trademarkPrint.set("M8co");
	},
	'focus #nameSelect'() {
		$("#nameSelect").select();
	},
	'keyup #nameSelect'(e,t) {
		let value = e.currentTarget.value;
		t.trademarkName.set(value);
	},
	'focus #levelSelect'() {
		$("#levelSelect").select();
	},
	'keyup #levelSelect'(e,t) {
		let value = parseInt(e.currentTarget.value);
		if ( value >= 1 && value <= 200 ) {
			t.trademarkLevel.set(value);
			try { trademarkSub.stop() } catch (e) { };
			trademarkSub = Meteor.subscribe("print", t.trademarkPrint.get(), "Parts", value);
			if ( !t.partOne.get().pending )
			t.partOne.set({});
			if ( !t.partTwo.get().pending )
			t.partTwo.set({});
		};
	},
	'click .part'(e,t) {
		let level = t.trademarkLevel.get();
		if ( !this.name && level ) {
			if ( !t.partOne.get()._id ) {
				t.partOne.set({ pending: true });
			} else if ( !t.partTwo.get()._id ) {
				t.partTwo.set({ pending: true });
			};
			try { trademarkSub.stop() } catch (e) { };
			trademarkSub = Meteor.subscribe("print", t.trademarkPrint.get(), "Parts", t.trademarkLevel.get());
		};
	},
	'click .chosen'(e,t) {
		let resources = t.resources.get();
		for ( let i = 0; i < resources.length; i++ ) {
			if ( resources[i].name == this.name )
			resources.splice(i, 1)
		}
	},
	'click .choose'(e,t) {
		let resources = t.resources.get();
		for ( let i = 0; i < resources.length; i++ ) {
			if ( resources[i].pending )
			resources.splice(i, 1)
		}
		this.class = "chosen";
		resources.push(this);
		t.resources.set(resources);
	},
	'click .resource'(e,t) {
		let count = 0,
		resources = t.resources.get();		
		for ( let i = 0; i < resources.length; i++ ) {
			if ( resources[i].resource )
			count++
		}
		resources.push({ pending: true });
		if ( count < 3 )
		t.resources.set(resources);
	},
	'click .selection'(e,t) {
		const one = t.partOne.get(),
		two = t.partTwo.get();
		this.class = "selected";
		if ( one.pending && two._id != this._id ) {
			t.partOne.set(this);
		} else if ( two.pending && one._id != this._id ) {
			t.partTwo.set(this);
		};
	},	
	'click .selected'(e,t) {
		const one = t.partOne.get(),
		two = t.partTwo.get();
		if ( this._id == one._id )
		t.partOne.set(two);
		t.partTwo.set({});
	},
	'click .group'(e,t) {
		t.trademarkPrint.set(this.name);
		try { trademarkSub.stop() } catch (e) { };		
		trademarkSub = Meteor.subscribe("print", this.name, "Parts", t.trademarkLevel.get());
		if ( !t.partOne.get().pending )
		t.partOne.set({});
		if ( !t.partTwo.get().pending )
		t.partTwo.set({});
	}
});

Template.crafting.onCreated(function () {
	this.printSelection = new ReactiveVar(false);
	this.craftSelection = new ReactiveVar(false);
	this.invSelection = new ReactiveVar(false);
	this.sellQuantity = new ReactiveVar(1);
	this.craftingPrint = new ReactiveVar( "M8co" );
	this.craftingType = new ReactiveVar( "Goods" );
	try { craftingSub.stop() } catch (e) { };
	craftingSub = Meteor.subscribe("craft", this.craftingPrint.get(), this.craftingType.get());
});

Template.crafting.helpers({
	more(){
		if ( Template.instance().printSelection.get() == this._id )
		return "<div class='bottom'><div class='button cancel'>Cancel</div></div>";
	},
	progress(){
		timeDep.depend();
		const timer = ( this.list && this.list[this.position].type == "Goods" ) ? 30000 : 15000;
		const running = new Date().getTime()-this.started;
		const current = ( running / timer ) % 1;
		const remain = current * timer;
		const width = 100-( ( ( timer-remain ) / timer)*100 );
		return "<div class='bar' style='width: "+width+"%;' ></div>"
	},
	timer(){
		timeDep.depend();
		const timer = ( this.list && this.list[this.position].type == "Goods" ) ? 30000 : 15000;
		const running = new Date().getTime()-this.started;
		const current = ( running / timer ) % 1;
		const remain = current * timer;
		return Math.ceil( (timer-remain) / 1000 );
	},
	current(){
		if ( this.list )
		return this.list[this.position].name;
	},
	employees(){
		const print = Template.instance().craftingPrint.get();
		let level = !this.skill || !this.skill[print] ? 1 : this.skill[print];
		return level+" - "+this.name;
	},
	crafting(){
		return Crafting.find({},{ sort: { employeeName: -1 } });
	},
	inventory(){
		return Inventory.find({ amount: { $gte: 1 } },{ sort: { level: -1, type: 1, amount: -1 } });
	},
	initial(){
		if ( this.type == "Goods" || this.type == "Parts" )
		return this.type == "Goods" ? "(G)" : "(P)";
	},
	groups(){
		let name = Template.instance().craftingPrint.get();
		return ([
			{ name: "M8co" },
			{ name: 'Tri-Goo' },
			{ name: 'Squish' }
		]).map(function(print){
			if ( print.name == name )
			print.hightlight = "highlight";
			return print;
    	});
	},
	types(){
		let name = Template.instance().craftingType.get();
		return ([
			{ name: "Goods" },
			{ name: 'Parts' }
		]).map(function(print){
			if ( print.name == name )
			print.hightlight = "highlight";
			return print;
    	});
	},
	options(){
		let sort = {},
		level = {},
		exists = {};
		level["skills."+this.print] = { $gte: levelAmount(this.level-1) };
		exists["skills."+this.print] = this.level == 1 ? { $exists: false } : {};
		sort["skills."+this.print] = -1;
		return Employee.find({ "$or": [level,exists]},{ sort: { started: -1 } });
	},
	crafts(){
		const
		print = Template.instance().craftingPrint.get(),
		station = Station.findOne({ print: print }),
		level = !station ? 1 : station.level;
		return Craft.find({ level: { $lte: level } },{
			sort: {
				level: -1
			}
		}).map(function(item){
			if ( item._id == Template.instance().craftSelection.get() )
			item.class = "selected";
			return item;
    	});
	},
	details(){
		const
		craft = Template.instance().craftSelection.get() == this._id,
		inv = Template.instance().invSelection.get() == this._id;
		return  craft || inv;
	},
	time(){
		return Template.instance().craftingType.get() == "Goods" ? "60" : "15";
	},
	ready(){
		let sort = {},
		level = {},
		exists = {};
		level["skills."+this.print] = { $gte: levelAmount(this.level-1) };
		exists["skill."+this.print] = this.level == 1 ? { $exists: false } : {};
		sort["skill."+this.print] = -1;
		let employee = Employee.findOne({ "$or": [level,exists]},{ sort: sort });
		if ( employee )
		return true;
	},
	list(){
		const items = Craft.findOne({
			_id: Template.instance().craftSelection.get()
		},{ fields: {
			resources: 1,
			part1: 1,
			part2: 1
		} },{
			sort: {
				name: 1
			}
		});
		if ( items.part1 ) {
			return items.part1+", "+items.part2;
		} else {
			let data;
			for ( let i = 0; i < items.resources.length; i++ ) {
				data = !data ? items.resources[i].name : data+", "+items.resources[i].name;
			}
			return data;
		};
	},
	sellable(){
		let value = Template.instance().sellQuantity.get();
		if ( value && value >= 1 && value <= this.amount )
		return "ready";
	},
	receive(){
		let value = Template.instance().sellQuantity.get();
		let sale = salePrice(this.type, this.level, value);
		if ( value && value >= 1 && value <= this.amount )
		return "<div class='receive'>Receive "+toDollars(sale)+"</div>";
	},
	all(){
		let total = 0;
		const inv = Inventory.find({ amount: { $gte: 1 } },{ fields: { level: 1, type: 1, amount: 1 } }).fetch();
		for ( let i = 0; i < inv.length; i++ ) {
			const item = inv[i];
			total += salePrice(
				item.type,
				item.level,
				item.amount
			);
		}
		if ( total > 0 )
		return "<div class='all'><span>"+toDollars(total)+"</span><span class='amount'><div class='button sellAll'>Sell All</div></span></div>";
	},
	sellQuantity(){
		return Template.instance().sellQuantity.get();
	}
});
Template.crafting.events({
	'click .cancel'(e,t) {
		Meteor.call('cancelCrafting', this);
	},
	'click .crafting'(e,t) {
		e.stopPropagation();
		let update = t.printSelection.get() != this._id ? this._id : false;
		t.printSelection.set(update);	
	},
	'click .sellAll'(e,t) {
		const inv = Inventory.find({ amount: { $gte: 1 } }).fetch();
		Meteor.call('sellItems', inv);
		t.invSelection.set(false);
		t.sellQuantity.set(false);
	},
	'click .item'(e,t) {
		e.stopPropagation();
		t.sellQuantity.set(1);
		let update = t.invSelection.get() != this._id ? this._id : false;
		t.invSelection.set(update);
	},
	'click .sell'(e,t) {
		e.stopPropagation();
		let value = t.sellQuantity.get();
		if ( value && value >= 1 && value <= this.amount )
		Meteor.call('sellItems', [this], value);
		if ( value == this.amount ) {
			t.invSelection.set(false);
			t.sellQuantity.set(false);
		};
	},
	'click #sellQuantity'(e,t) {
		e.stopPropagation();
	},
	'focus #sellQuantity'(e,t) {
		e.stopPropagation();
		$("#sellQuantity").select();
	},
	'keyup #sellQuantity'(e,t) {
		const value = e.currentTarget.value >= 1 ? e.currentTarget.value : 1;
		t.sellQuantity.set( parseInt(value) );
		$("#sellQuantity").val(value);
	},
	'click .start'() {
		const employee = $("#craftEmp").val();
		if ( employee )
		Meteor.call('craftItem', employee, this._id);
	},
	'click #craftEmp'(e,t){
		e.stopPropagation();
	},
	'click .craft'(e,t) {
		e.stopPropagation();
		let update = t.craftSelection.get() != this._id ? this._id : false;
		t.craftSelection.set(update);
	},
	'click .group'(e,t) {		
		t.craftSelection.set(false);
		t.craftingPrint.set(this.name);
		try { craftingSub.stop() } catch (e) { };
		craftingSub = t.subscribe("craft", this.name, t.craftingType.get());
	},
	'click .type'(e,t) {
		t.craftSelection.set(false);
		t.craftingType.set(this.name);
		try { craftingSub.stop() } catch (e) { };
		craftingSub = t.subscribe("craft", t.craftingPrint.get(), this.name);
	}
});

Template.workers.onCreated(function () {
	this.prospectSelection = new ReactiveVar(false);
});
Template.workers.helpers({
	happiness(){
		let data = {};
		for ( let i = 0; i < Feeling.length; i++ ) {
			if ( this.happiness >= Feeling[i].amount ) {
				data.icon = Feeling[i].icon;
				data.label = Feeling[i].label;
			};
		}
		return "<span class='icon "+data.label+"'><span class='mdi mdi-"+data.icon+"'></span></span>";
	},
	payment(){
		timeDep.depend();
		const
		base = 3600000,
		timer = base*4,
		paid = base*this.paid,
		running = new Date().getTime()-this.employeed,
		current = (running/base)%1,
		left = base-(current*base)+(base*(this.paid-1)),
		width = (left/timer)*100,
		humanized = moment.duration({ milliseconds: left, }).humanize();
		return "<div class='bar' style='width:"+width+"%;'><span>"+humanized+"</span></div>";
	},
	buttons(){
		const
		data = !this.owner ? "Hire" : "Fire",
		pay = !this.owner ? "" : "<div class='button full'>Pay Full</div><div class='button pay'>Pay 1</div>"
		if ( Template.instance().prospectSelection.get() == this._id )
		return "<div class='bottom'>"+pay+"<div class='button "+data.toLowerCase()+"'>"+data+"</div></div>";
	},
	employees(){
		return Employee.find({},{ sort: { exp: -1 } });
	},
	prospects(){
		return Prospect.find({},{ sort: { exp: -1 } });
	},
	class(){
		return !this.owner ? "prospect" : "employee";
	},
	cost(){
		return employeeCost(this.exp);
	},
	name(){
		return this.name;
	},
	level(){
		let exp = !this.exp ? 0 : this.exp;
		return "Lvl "+expLevel(exp);
	},
	skills(){
		let
		data = "",
		prints = [ 
			{ name:	"M8co" },
			{ name:	"Tri-Goo" },
			{ name:	"Squish" }
		];
		
		if ( this.skills )
		for ( let i = 0; i < prints.length; i++ ) {
			let amount = this.skills[prints[i].name];
			let more = data ? data+" " : "";
			let extra = i == 0 ? "" : more;
			if ( amount >= 1 ) {
			const
			level = expLevel(amount, true),
			name = "<span>Lvl "+level.now+" "+prints[i].name+"</span>",
			current = toNumbers(Math.floor(amount-level.last)),
			next = toNumbers(level.next-level.last),
			exp = "<span class='amount'>"+current+"/"+next;
			data = extra+"<div class='skill'>"+name+exp+"</span></div>";
			};
		}
		return data;
	}
});
Template.workers.events({
	'click .full'(e) {
		e.stopPropagation();
		Meteor.call('payEmployee', this._id);
	},
	'click .pay'(e) {
		e.stopPropagation();
		Meteor.call('payEmployee', this._id, 1);
	},
	'click .hire'() {
    	Meteor.call('employeeProspect', this._id);
	},
	'click .fire'(e,t) {
    	Meteor.call('fireEmployee', this._id);
	},
	'click .listing'(e,t) {
		let update = t.prospectSelection.get() != this._id ? this._id : false;
		t.prospectSelection.set(update);
  	}
});

Template.notices.helpers({
	notice(){
		return Notice.find({},{ sort: { created: -1 } });
	},
	message(){
		timeDep.depend();
		let data = !this.fired ? " quit" : " was fired";
		data = this.level ? " made level " : data;
		data = this.skill ? " earned "+this.skill+" level " : data;
		data = this.duplicate ? " printed a duplicate "+this.duplicate : data;
		const
		level = !this.level ? "" : this.level+",",
		employee = !this.employee ? "An employee" : this.employee;
		return employee+data+level+" "+moment(this.created).fromNow()+".";
	}
});

Template.bizboard.helpers({
	businesses(){
		let skip = 0;
		certIdDep.depend();
		return Business.find({},
			{ sort: {
			money: -1,
			updated: -1
			},
			limit: 40
		}).map(function(business, index){
			if ( certId && certId == business._id )
			business.highlight = "highlight";
			business.rank = (skip)+index-(-1);
			return business;
    });
	}
});

Template.leaderboard.onCreated(function () {
	this.leaderSkip = new ReactiveVar( 0 );	
	findPosition = function (t) {
		const player = Player.findOne({},{ fields: { username: 1, money: 1, updated: 1 } });
		if ( player && player.money && player.updated ) {
			Meteor.call('leaderPosition', player.money, player.updated, (error, position) => {
				if ( position ) {
					position = Math.floor((position-1)/40);
					t.leaderSkip.set( position );
					try { leadersSub.stop() } catch (e) { };
					leadersSub = Meteor.subscribe("leaders", position);	
				};
			});
		} else {
			Meteor.setTimeout(function() {
				findPosition(t);
			}, 200);
		};
	};
	findPosition(this);
});

Template.leaderboard.onDestroyed(function () {
	try { leadersSub.stop() } catch (e) {};
});

Template.leaderboard.helpers({
	leaders(){
		let skip = Template.instance().leaderSkip.get()*40;
		return Leaders.find({},
			{ sort: {
			money: -1,
			updated: -1
			},
			limit: 40
		}).map(function(leader, index){
			if ( leader._id == Meteor.userId() )
			leader.highlight = "highlight";
			leader.rank = (skip)+index-(-1);
			return leader;
    });
	}
});

Template.leaderboard.events({
	'click .prev'(e,t) {
		const skip = t.leaderSkip.get();		
		if ( skip >= 1 ) {
			t.leaderSkip.set(skip-1);
			try { leadersSub.stop() } catch (e) { };
			leadersSub = Meteor.subscribe("leaders", skip-1);
		};
	},
	'click .next'(e,t) {
		const count = Leaders.find({}).count();
		const skip = t.leaderSkip.get();
		if ( count > 40 ) {
			t.leaderSkip.set(skip-(-1));
			try { leadersSub.stop() } catch (e) { };
			leadersSub = Meteor.subscribe("leaders", skip-(-1));
		};
	}
});
