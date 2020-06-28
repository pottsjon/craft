import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { ReactiveDict } from 'meteor/reactive-dict';
import { UserStatus } from 'meteor/mizzao:user-status';
import { mdiAccount, mdiCursorDefaultClick, mdiDirections } from '@mdi/js';

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
	certSub = Meteor.subscribe("cert");
	statisticsSub = Meteor.subscribe('statistics');
	certSubs = function (certificateId) {
		try { certSub.stop() } catch (e) { };
		certSub = Meteor.subscribe("cert", certificateId);
		try { statisticsSub.stop() } catch (e) { };
		statisticsSub = Meteor.subscribe('statistics', certificateId);
		certId = certificateId;
		certIdDep.changed();
	};
	Paperwork.find({ certId: { $exists: true } },
		{ fields: { certId: 1 } }).observeChanges({
		added: function(id, fields) {
			certSubs(fields.certId);
		},
		changed: function(id, fields) {
			certSubs(fields.certId);
		}
	});
	let plevel = 0;
	Player.find({},
		{ fields: { exp: 1 } }).observeChanges({
		added: function(id, fields) {
			const
			exp = !fields.exp ? 1 : fields.exp,
			level = expPlayerLevel(exp);
			plevel = level > plevel ? level : plevel;
			bonus = playerBonus(level);
			bonusDep.changed();
		},
		changed: function(id, fields) {
			const
			exp = !fields.exp ? 1 : fields.exp,
			level = expPlayerLevel(exp);
			levelled = level > plevel ? true : false;
			plevel = level > plevel ? level : plevel;
			bonus = playerBonus(level);
			bonusDep.changed();
			if ( levelled ) {
				bonus.level = level;
				bonus.levelled = true;
				overlay = bonus;
				overlayDep.changed();
			};
		}
	});
	//	Employee.find({},{ fields: { name: 1, exp: 1, skills: 1 } }).observe({
	//		changed: function(next, prev) {
	//		}
	//	})
});

Template.overlay.helpers({
	overlay(){
		overlayDep.depend();
		if ( overlay.levelled )
		return [overlay];
	},
	headline(){
		return "You have reached level "+this.level;
	},
	bonuses(){
		let
		third = this.level > 57 ? 1 : this.level % 3,
		fourth = this.level > 72 || !third ? 1 : this.level % 4,
		other = this.level <= 74 && third && fourth ? 0 : 1;
		third = !third ? "(+1) " : "";
		fourth = !fourth ? "(+1) " : "";
		other = !other ? "(+1) " : "";
		return [
			{ bonus: "(+1) Stations Max Level "+this.level },
			{ bonus: third+"Employee Limit "+this.employees },
			{ bonus: fourth+"Pay Time Limit "+this.pay },
			{ bonus: other+"Reduce Break Timer "+this.timer }
		];
	}
});
Template.overlay.events({
	'click .overlay, click .accept'() {
		overlay = {};
		overlayDep.changed();
	},
	'click .inside'(e) {
		e.stopPropagation();
  	}
});

Template.quests.onCreated(function () {
	this.selected = new ReactiveVar(false);
});
Template.quests.helpers({
	quests(){
		let selected = Template.instance().selected.get();
		return Quest.find({},{ sort: {
			rating: -1,
			level: -1,
			print: 1,
			type: 1,
			amount: -1
		}}).map(function(quest){
			if ( quest._id == selected )
			quest.highlight = "highlight";
			return quest;
    	});
	},
	initial(){
		return "("+this.type.charAt(0)+")";
	},
	pay(){
		return this.exp*.1;
	},
	rating(){
		const mode = this.rating == 1 ? "Easy" : "Medium";
		return this.rating == 3 ? "Hard" : mode;
	},
	timer(){
		timeDep.depend();
		const
		quest = Quest.findOne({},{ fields: { created: 1 } }),
		created = quest ? quest.created : 0,
		timer = time-created,
		format = 1800-Math.floor(timer/1000);
		return formatTimer(format);
	},
	buttons(){
		if ( Template.instance().selected.get() == this._id ) {
			const
			inv = Inventory.findOne({ "$and": [
				{ level: this.level },
				{ print: this.print },
				{ type: this.type },
				{ amount: { $gte: this.amount } }
			]}),
			highlight = !inv ? "" : "ready";
			return "<div class='bottom'><div class='button fulfill "+highlight+"'>Fulfill</div></div>";
		};
	}
});
Template.quests.events({
	'click .quest'(e,t) {
		let selected = t.selected.get();
		selected = !selected || selected != this._id ? this._id : false;
		t.selected.set(selected);
	}
});

Template.info.helpers({
	business(){
		return Cert.find({});
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

Template.office.helpers({
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
Template.office.events({
	'click .option'() {
		Meteor.call('buyOption', this.name);
	}
});

Template.statistics.helpers({
	statistic(){
		return Statistics.find({},{
			sort: {
				level: -1,
				print: 1,
				businessId: -1,
				type: 1,
				made: -1
			}
		});
	},
	type(){
		return "("+this.type.charAt(0)+")";
	},
	level(){
		return "Lvl "+this.level;
	},
	made(){
		const made = !this.businessId ? toNumbers(this.made) : toDollars(this.made);
		return made;
	}
});

Template.stations.onCreated(function () {
	this.selected = new ReactiveVar(false);
	this.printSelection = new ReactiveVar(false);
});
Template.stations.helpers({
	action(){
		const
		employee = Employee.findOne({},{ fields: { _id: 1 } }),
		crafting = Crafting.findOne({},{ fields: { _id: 1 } }),
		icon = !employee ? "account-plus-outline" : "printer-3d",
		action = !employee ? "hire" : "print";
		let outcome = !crafting ? "Start Printing" : false;
		outcome = !employee ? "Hire an Employee" : outcome;
		const
		format_outcome = "<span>"+outcome+"</span>",
		format_icon = "<span class='mdi mdi-"+icon+"'></span>";
		if ( outcome )
		return "<div class='start'><div class='button "+action+" round-sm'>"+format_icon+format_outcome+"</div></div>";
	},
	crafting(){
		return Crafting.find({ print: this.print },{
			sort: { 'employee.name': -1 }
		}).map(function(crafting){
			const employee = Employee.findOne({ _id: crafting.employeeId });
			if ( employee )
			crafting.employee = employee;
			if ( crafting._id == Template.instance().printSelection.get() )
			crafting.menu = true;
			return crafting;
    	});
	},
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
		cost = "<div class='detail cost'>"+cash+"<span>"+toDollars(this.level*1000)+"</span></div>",
		timing = "<div class='detail time'>"+clock+"<span>"+this.level+" Hour"+s+"</span></div>",
		fifth = this.level % 5 == 0,
		details = stationDetails(this.level+1),
		stationPlural = details.stations == 1 ? "" : "s",
		button = "<div class='button upgrade'>Upgrade</div>";
		let data = !fifth ? details.dupes+"% Dupes" : details.stations+" Station"+stationPlural;
		data = this.level == 50 ? "40% Dupes" : data;
		data = "<div class='detail note'>"+data+"</div>";
		if ( selected == this.print || selected == this._id )
		return "<div class='details'><div class='amounts'>"+data+cost+timing+button+"</div></div>";
	},
	progress(){
		timeDep.depend();
		const timer = this.level*3600000;
		const running = time-this.upgrading;
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
	'click .cancel'(e,t) {
		Meteor.call('cancelCrafting', this);
	},
	'click .crafting'(e,t) {
		e.stopPropagation();
		let update = t.printSelection.get() != this._id ? this._id : false;
		t.printSelection.set(update);
		workerSelect = update;
		workerSelectDep.changed();
	},
	'click .upgrade'() {
		Meteor.call('upgradeStation', this.print)
	},
	'click .station'(e,t) {
		let data = !this._id ? this.print : this._id;
		data = t.selected.get() == data ? false : data;
		if ( !this.upgrading )
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

Template.inventory.onCreated(function () {
	this.invSelection = new ReactiveVar(false);
	this.sellQuantity = new ReactiveVar(1);
});
Template.inventory.helpers({
	details(){
		const inv = Template.instance().invSelection.get() == this._id;
		return  inv;
	},
	receive(){
		let value = Template.instance().sellQuantity.get();
		let sale = salePrice(this.type, this.level, value);
		if ( value && value >= 1 && value <= this.amount )
		return "<div class='receive'>Receive "+toDollars(sale)+"</div>";
	},
	initial(){
		if ( this.type == "Goods" || this.type == "Parts" )
		return this.type == "Goods" ? "(G)" : "(P)";
	},
	inventory(){
		return Inventory.find({ amount: { $gte: 1 } },{ sort: { level: -1, type: 1, amount: -1 } });
	},
	sellable(){
		let value = Template.instance().sellQuantity.get();
		if ( value && value >= 1 && value <= this.amount )
		return "ready";
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
Template.inventory.events({
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
	}
});

Template.print.helpers({
	quick(){
		if ( this.employee.employeed ) {
			timeDep.depend();
			bonusDep.depend();
			const
			base = 3600000,
			running = time-this.employee.employeed,
			current = (running/base)%1,
			left = base-(current*base)+(base*(this.employee.paid-1)),
			humanized = formatTimer(Math.floor(left/1000));
			return humanized;
		};
	},
	payment(){
		if ( this.employee.employeed ) {
			timeDep.depend();
			bonusDep.depend();
			const
			base = 3600000,
			pay = !bonus.pay ? 2 : bonus.pay,
			reduction = !bonus.timer ? 0 : bonus.timer/100,
			timer = !this.employee.vacation ? base*pay : base-(base*reduction),
			start = !this.employee.vacation ? this.employee.employeed : this.employee.vacation,
			running = time-start,
			current = (running/base)%1,
			left = !this.employee.vacation ? base-(current*base)+(base*(this.employee.paid-1)) : timer-(current*timer),
			width = (left/timer)*100,
			vacation = !this.employee.vacation ? "" : "On break for ";
			humanized = formatTimer(Math.floor(left/1000));
			//humanized = moment.duration({ milliseconds: left, }).humanize();
			return "<div class='progress'><div class='bar' style='width:"+width+"%;'><span>"+vacation+humanized+"</span></div></div>";
		};
	},
	happiness(){
		let data = {};
		for ( let i = 0; i < Feeling.length; i++ ) {
			if ( this.employee.happiness >= Feeling[i].amount ) {
				data.icon = Feeling[i].icon;
				data.label = Feeling[i].label;
			};
		}
		return "<span class='icon "+data.label+"'><span class='mdi mdi-"+data.icon+"'></span></span>";
	},
	button(){
		workerSelectDep.depend();
		workerMenuDep.depend();
		const
		buttons = [
			{ label: "Break" },
			{ label: "Pay" },
			{ label: "Fire" },
			{ label: "Cancel" }
		],
		vacation = [
			{ label: "Send on Break", break: true, employeeId: this.employeeId },
			{ label: "Back" }
		],
		pay = [
			{ label: "Full", full: true, employeeId: this.employeeId },
			{ label: "1 Hour", pay: true, employeeId: this.employeeId },
			{ label: "Back" }
		],
		fire = [
			{ label: "Fire "+this.employee.name+"?", fire: true, employeeId: this.employeeId },
			{ label: "Back" }
		],
		cancel = [
			{ label: "Cancel Crafting?", cancel: true, craftId: this._id },
			{ label: "Back" }
		];
		let data = buttons;
		data = workerMenu == "Break" ? vacation : data;	
		data = workerMenu == "Pay" ? pay : data;
		data = workerMenu == "Fire" ? fire : data;
		data = workerMenu == "Cancel" ? cancel : data;
		if ( workerSelect == this._id )
		return data;
	},
	cost(){
		let exp = !this.employee.exp ? 1 : this.employee.exp;
		return employeeCost(exp);
	},
	level(){
		let exp = !this.employee.exp ? 0 : this.employee.exp;
		return "Lvl "+expLevel(exp);
	},
	print(){
		const
		print = this.employee.skills[this.item.print],
		amount = !print ? 0 : print,
		level = expLevel(amount, true);
		return this.print+" Lvl "+level.now;
	},
	skill(){
		const
		print = this.employee.skills[this.item.print],
		amount = !print ? 0 : print,
		level = expLevel(amount, true),
		current = toNumbers(Math.floor(amount-level.last)),
		next = toNumbers(level.next-level.last),
		exp = "<span class='exp'>"+current+"/"+next+"</span>";
		return exp;
	},
	skills(){
		let
		data = "",
		prints = [ 
			{ name:	"M8co" },
			{ name:	"Tri-Goo" },
			{ name:	"Squish" }
		];
		
		if ( this.employee.skills )
		for ( let i = 0; i < prints.length; i++ ) {
			let amount = this.employee.skills[prints[i].name];
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
	},
	progress(){
		timeDep.depend();
		const timer = ( this.list && this.list[this.position].type == "Goods" ) ? 30000 : 15000;
		const running = time-this.started;
		const current = ( running / timer ) % 1;
		const remain = current * timer;
		const width = 100-( ( ( timer-remain ) / timer)*100 );
		return "<div class='bar' style='width: "+width+"%;' ></div>"
	},
	timer(){
		timeDep.depend();
		const timer = ( this.list && this.list[this.position].type == "Goods" ) ? 30000 : 15000;
		const running = time-this.started;
		const current = ( running / timer ) % 1;
		const remain = current * timer;
		return Math.round( (timer-remain) / 1000 );
	},
	count(){
		return this.list ? (this.position+1)+"/3 -" : "";
	},
	current(){
		if ( this.list )
		return this.list[this.position].name;
	},
	more(){
		return this.menu;
	}
});
Template.print.events({
	'click .action'(e) {
		e.stopPropagation();
		if ( this.break ) {
			Meteor.call('employeeVacation', this.employeeId);
		} else if ( this.full ) {
			Meteor.call('payEmployee', this.employeeId);
		} else if ( this.pay ) {
			Meteor.call('payEmployee', this.employeeId, 1);
		} else if ( this.fire ) {
			Meteor.call('fireEmployee', this.employeeId);
		} else if ( this.cancel ) {
			Meteor.call('cancelCrafting', this.craftId );
		} else if ( this.label == "Back" ) {
			workerMenu = false;
			workerMenuDep.changed();
		} else {
			workerMenu = this.label;
			workerMenuDep.changed();
		};
	}
});

Template.option.helpers({
	printing(){
		if ( this.crafting )
		return "<span class='current'>("+this.crafting.item.name+")</span>";
	},
	skill(){
		const
		amount = !this.skills || !this.skills[this.print] ? 0 : this.skills[this.print],
		level = expLevel(amount, true),
		current = toNumbers(Math.floor(amount-level.last)),
		next = toNumbers(level.next-level.last),
		exp = current+"/"+next,
		icon = this.limit == 1 ? "<span class='mdi mdi-menu-down'></span>" : "";
		return "<span class='skill'><span class='level'>"+this.print+" Lvl "+level.now+"</span><span class='exp'>"+exp+"</span>"+icon+"</span>";
	}
});

Template.crafting.onCreated(function () {
	this.limit = new ReactiveVar(1);
	this.employee = new ReactiveVar(false);
	this.sort = new ReactiveVar(-1);
	this.printSelection = new ReactiveVar(false);
	this.craftSelection = new ReactiveVar(false);
	this.craftingPrint = new ReactiveVar( "M8co" );
	this.craftingType = new ReactiveVar( "Goods" );
	try { craftingSub.stop() } catch (e) { };
	craftingSub = Meteor.subscribe("craft", this.craftingPrint.get(), this.craftingType.get());
});
Template.crafting.helpers({
	sort(){
		return Template.instance().sort.get() == -1 ? "Level Descending" : "Level Ascending";
	},
	details(){
		const craft = Template.instance().craftSelection.get() == this._id;
		return  craft;
	},
	employees(){
		const print = Template.instance().craftingPrint.get();
		let level = !this.skill || !this.skill[print] ? 1 : this.skill[print];
		return level+" - "+this.name;
	},
	crafting(){
		return Crafting.find({},{
			sort: { 'employee.name': -1 }
		}).map(function(crafting){
			if ( crafting._id == Template.instance().printSelection.get() )
			crafting.menu = true;
			return crafting;
    	});
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
		let
		selected = Template.instance().employee.get(),
		limit = Template.instance().limit.get(),
		sort = {},
		level = {},
		exists = {};
		level["skills."+this.print] = { $gte: levelAmount(this.level-1) };
		exists["skills."+this.print] = this.level == 1 ? { $exists: false } : {};
		sort["skills."+this.print] = -1;
		lookup = !selected || limit == 10 ? [level,exists] : [{ _id: selected }];
		return Employee.find({ "$and": [
			{ vacation: { $exists: false } },
			{ "$or": lookup }
		] },{ sort: { started: -1 },
			limit: limit
		}).map(function(employee){
			employee.crafting = Crafting.findOne({ employeeId: employee._id });
			employee.print = Template.instance().craftingPrint.get();
			employee.limit = limit;
			return employee;
		});
	},
	crafts(){
		const
		sort = Template.instance().sort.get(),
		print = Template.instance().craftingPrint.get(),
		station = Station.findOne({ print: print }),
		level = !station ? 1 : station.level;
		return Craft.find({ level: { $lte: level } },{
			sort: {
				level: sort
			}
		}).map(function(item){
			if ( item._id == Template.instance().craftSelection.get() )
			item.class = "selected";
			return item;
    	});
	},
	time(){
		return Template.instance().craftingType.get() == "Goods" ? "60" : "15";
	},
	ready(){
		const
		selected = Template.instance().employee.get(),
		sort = {},
		level = {},
		exists = {};
		level["skills."+this.print] = { $gte: levelAmount(this.level-1) };
		exists["skill."+this.print] = this.level == 1 ? { $exists: false } : {};
		sort["skill."+this.print] = -1,
		employee = Employee.findOne({ "$or": [level,exists]},{ sort: sort });
		if ( selected && employee )
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
	}
});
Template.crafting.events({
	'click .sort'(e,t) {
		t.sort.set( t.sort.get() == -1 ? 1 : -1 );
	},
	'click .employee'(e,t) {
		e.stopPropagation();
		t.employee.set(this._id);
	},
	'click .option'(e,t) {
		e.stopPropagation();
		t.limit.set( t.limit.get() == 1 ? 10 : 1 );
	},
	'click .cancel'(e,t) {
		Meteor.call('cancelCrafting', this);
	},
	'click .crafting'(e,t) {
		e.stopPropagation();
		let update = t.printSelection.get() != this._id ? this._id : false;
		t.printSelection.set(update);	
	},
	'click .start'(e,t) {
		const employee = t.employee.get();
		if ( employee )
		Meteor.call('craftItem', employee, this._id);
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

Template.menu.onCreated(function () {
	this.hover = new ReactiveVar( false );	
});
Template.menu.helpers({
	data(){
		const hover = Template.instance().hover.get();
		if ( hover == this.tooltip )
		return "show";
	},
	option(){
		return [		
			{
				icon: "home-outline",
				tooltip: "Home"
			},{
				icon: "printer-3d",
				tooltip: "Print"
			},{
				icon: "account-plus-outline",
				tooltip: "Prospects"
			},{
				icon: "star",
				tooltip: "Quests"
			},{
				icon: "sack",
				tooltip: "Inventory"
			},{
				icon: "text-box-check-outline",
				tooltip: "Trademarks"
			}
		];
	}
});
Template.menu.events({
	'mouseover .option'(e,t) {
		t.hover.set(this.tooltip);
	},
	'mouseleave .option'(e,t) {
		t.hover.set(false);
	}
});

Template.player.onCreated(function () {
	this.menu = new ReactiveVar( false );	
});
Template.player.helpers({
	Home(){
		if ( !Template.instance().menu.get() )
		return true;
	},
	Print(){
		if ( Template.instance().menu.get() == "Print" )
		return true;
	},
	Prospects(){
		if ( Template.instance().menu.get() == "Prospects" )
		return true;
	},
	Quests(){
		if ( Template.instance().menu.get() == "Quests" )
		return true;
	},
	Trademarks(){
		if ( Template.instance().menu.get() == "Trademarks" )
		return true;
	},
	Inventory(){
		if ( Template.instance().menu.get() == "Inventory" )
		return true;
	}
});
Template.player.events({
	'click .hire'(e,t) {
		t.menu.set("Prospects");
	},
	'click .print'(e,t) {
		t.menu.set("Print");
	},
	'click .option'(e,t) {
		const setting = this.tooltip == "Home" ? false : this.tooltip;
		t.menu.set(setting);
	}
});

Template.worker.helpers({
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
		if ( this.employeed ) {
			timeDep.depend();
			bonusDep.depend();
			const
			base = 3600000,
			pay = !bonus.pay ? 2 : bonus.pay,
			reduction = !bonus.timer ? 0 : bonus.timer/100,
			timer = !this.vacation ? base*pay : base-(base*reduction),
			start = !this.vacation ? this.employeed : this.vacation,
			running = time-start,
			current = (running/timer)%1,
			left = !this.vacation ? base-(current*base)+(base*(this.paid-1)) : timer-(current*timer),
			width = (left/timer)*100,
			vacation = !this.vacation ? "" : "On break for ";
			humanized = formatTimer(Math.floor(left/1000));
			//humanized = moment.duration({ milliseconds: left, }).humanize();
			return "<div class='progress'><div class='bar' style='width:"+width+"%;'><span>"+vacation+humanized+"</span></div></div>";
		};
	},
	buttons(){
		workerSelectDep.depend();
		workerMenuDep.depend();
		let
		menu = workerMenu,
		selected = workerSelect == this._id,
		data = !this.owner ? "Hire" : "Fire",
		pay = menu || !this.owner ? "" : "<div class='button paying'>Pay</div>",
		vacation = menu || !this.owner ? "" : "<div class='button breaking'>Break</div>",
		sure = menu == "fire" ? "Fire" : "Hire";
		pay = menu == "pay" ? "<div class='button full'>Full</div><div class='button pay'>1 Hour</div>" : pay,
		vacation = menu == "break" ? "<div class='button break'>Send on Break</div>" : vacation,
		data = !menu ? data : "Back",
		sure = menu == "fire" || menu == "hire" ? "<div class='button "+sure.toLowerCase()+"'>"+sure+" "+this.name+"?</div>" : "";
		if ( selected )
		return "<div class='bottom'>"+vacation+pay+sure+"<div class='button "+data.toLowerCase()+"'>"+data+"</div></div>";
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
			name = "<span class='print'>"+prints[i].name+"</span> Lvl "+level.now,
			current = toNumbers(Math.floor(amount-level.last)),
			next = toNumbers(level.next-level.last),
			exp = current+"/"+next;
			data = extra+"<span class='skill'>"+name+"</span>";
			};
		}
		return data;
	},
	class(){
		return !this.owner ? "prospect" : "employee";
	}
});
Template.worker.events({
	'click .back'(e) {
		e.stopPropagation();
		workerMenu = false;
		workerMenuDep.changed();
	},
	'click .paying'(e) {
		e.stopPropagation();
		workerMenu = "pay";
		workerMenuDep.changed();
	},
	'click .breaking'(e) {
		e.stopPropagation();
		workerMenu = "break";
		workerMenuDep.changed();
	},
	'click .break'(e) {
		e.stopPropagation();
		workerSelect = false;
		workerSelectDep.changed();
		workerMenu = false;
		workerMenuDep.changed();
		Meteor.call('employeeVacation', this._id);
	},
	'click .full'(e) {
		e.stopPropagation();
		Meteor.call('payEmployee', this._id);
	},
	'click .pay'(e) {
		e.stopPropagation();
		Meteor.call('payEmployee', this._id, 1);
	},
	'click .hire'(e) {
		e.stopPropagation();
		workerMenuDep.depend();
		if ( workerMenu != "hire" ) {
			workerMenu = "hire";
			workerMenuDep.changed();
		} else if ( workerMenu == "hire" ) {
			workerMenu = false;
			workerMenuDep.changed();
			workerSelect = false;
			workerSelectDep.changed();
			Meteor.call('employeeProspect', this._id);
		};
	},
	'click .fire'(e) {
		e.stopPropagation();
		workerMenuDep.depend();
		if ( workerMenu != "fire" ) {
			workerMenu = "fire";
			workerMenuDep.changed();
		} else if ( workerMenu == "fire" ) {
			workerMenu = false;
			workerMenuDep.changed();
			workerSelect = false;
			workerSelectDep.changed();
			Meteor.call('fireEmployee', this._id);
		};
	},
	'mouseleave .prospect'() {
		workerMenu = false;
		workerMenuDep.changed();
		workerSelect = false;
		workerSelectDep.changed();
	},
	'click .prospect'(e) {
		e.stopPropagation();
		workerSelectDep.depend();
		workerMenu = false;
		workerMenuDep.changed();
		let update = workerSelect != this._id ? this._id : false;
		if ( !this.vacation ) {
			workerSelect = update;
			workerSelectDep.changed();
		};
  	}
});

Template.employees.helpers({
	employees(){
		return Employee.find({},{ sort: { exp: -1 } });
	}
});

Template.prospects.onCreated(function () {
	this.sorting = new ReactiveVar( -1 );	
});
Template.prospects.helpers({
	sorting(){
		const direction = Template.instance().sorting.get() == -1 ? "Descending" : "Ascending";
		return "<span>Hourly "+direction+"</span>";
	},
	prospects(){
		const sorting = Template.instance().sorting.get();
		return Prospect.find({},{ sort: { exp: sorting } });
	}
});
Template.prospects.events({
	'click .sort'(e,t) {
		const sorting = t.sorting.get();
		t.sorting.set(sorting == -1 ? 1 : -1);
	}
});

Template.notices.onCreated(function () {
	this.more = new ReactiveVar( 2 );	
});
Template.notices.helpers({
	notice(){
		const more = Template.instance().more.get();
		return Notice.find({},{ sort: { created: -1 }, limit: more });
	},
	show(){
		return Template.instance().more.get() == 2 ? "Show More" : "Show Less";
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
Template.notices.events({
	'click .show'(e,t) {
		t.more.set(t.more.get() == 2 ? 10 : 2);
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
