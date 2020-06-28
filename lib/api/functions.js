const { mdiConsoleNetwork, mdiFitToPageOutline } = require("@mdi/js");

formatTimer = function(secs) {
    "use strict";
    // returns seconds in 00:00:00 (up to 86400 seconds)
    const secMinutes = Math.floor(secs / 60);
    const secHours = Math.floor(secs / 60 / 60);
    const minute = (secMinutes%60)+":";
    const minutes = ("0"+(secMinutes%60)).slice(-2)+":";
    const finalSecs = ( secMinutes >= 1 || secs < 10 ? ("0"+(secs%60)).slice(-2) : secs%60 );
    const finalMinutes = ( secHours >= 1 || minutes >= 10 ? minutes : minute );
	const finalHours = ( secHours >= 1 ? secHours%60+":" : "" );
	if ( secs >= 0 )
	return finalHours+finalMinutes+finalSecs;
};

randomQuest = function(totals, mode) {
    // Modes
    // 1 is Easy
    // 2 is Medium
    // 3 is Hard
    let data = {
        owner: totals.userId,
        created: totals.created
    };
    const
    printers = [{ print: "M8co" },{ print: "Tri-Goo" },{ print: "Squish" }];
    data.print = printers[Math.floor(Math.random()*3)].print;
    data.type = Math.floor(Math.random()*100+1) > 50 ? "Goods" : "Parts";
    let
    min = totals[data.print].min >= 5 ? totals[data.print].min-4 : totals[data.print].min;
    min = min == 0 ? 1 : min;
    const
    extra = mode == 3 ? 1 : 0,
    max = totals[data.print].max+extra,
    boost = mode > 1 ? 10 : 0,
    rand = data.type == "Goods" ? 10+boost : 20+(boost*2);
    data.level = Math.floor(Math.random()*max+min);
    data.amount = Math.floor(Math.random()*rand+1);
    let
    multiply = data.type == "Goods" ? data.level*data.amount*2 : data.level*data.amount,
    exp = Math.floor(Math.random()*(multiply*80)+(multiply*40));
    exp = mode == 2 ? exp*0.8 : exp;
    exp = mode == 1 ? exp*0.6 : exp;
    data.exp = Math.round(exp/10)*10;
    data.rating = mode;
    return data;
}

questCheck = function(userId) {
    const quests = Quest.find({ owner: userId }).count();
    if ( quests < 3 ) {
        let totals = {
            'M8co': { min: 0, max: 0 },
            'Tri-Goo': { min: 0, max: 0 },
            'Squish': { min: 0, max: 0 }
        };
        const
        user = Meteor.users.findOne({ _id: userId },{ fields: { exp: 1 } }),
        level = !user || !user.exp ? 1 : expPlayerLevel(user.exp),
        employee = Prospect.find({ owner: userId },{ fields: { skills: 1 } }).fetch(),
        printers = [{ print: "M8co" },{ print: "Tri-Goo" },{ print: "Squish" }];
        for ( let i = 0; employee.length > i; i++ ) {
            const skills = !employee[i].skills ? false : employee[i].skills;
            for ( let o = 0; printers.length > o; o++ ) {
                const
                emp_skill = !skills ? false: skills[printers[o].print],
                skill = !emp_skill ? 0 : expLevel(emp_skill);
                let
                min = totals[printers[o].print].min,
                max = totals[printers[o].print].max;
                totals[printers[o].print].min = !min || skill < min ? skill : min;
                totals[printers[o].print].max = !max || skill > max ? skill : max;
            }
        }
        totals.userId = userId;
        totals.created = new Date().getTime();
        for ( let i = 0; 7 > i; i++ ) {
            let mode = i <= 1 ? 1 : 2;
            mode = i > 3 ? 3 : mode;
            Quest.insert(randomQuest(totals, mode));
        }
    };
};

playerBonus = function(level) {
    const
    employee_limit = level >= 57 ? 20 : Math.floor(level/3)+1,
    pay_limit_offset = level >= 60 ? 4 : Math.floor(level/12),
    pay_limit = level >= 72 ? 16 : Math.floor(level/4)-pay_limit_offset+2,
    break_timer = level >= 74 ? 40 : level-employee_limit-pay_limit+2;
    return {
        employees: employee_limit,
        pay: pay_limit,
        timer: break_timer
    };
};

stationTimeout = [];
stationTimer = function (station) {
    try { Meteor.clearTimeout(stationTimeout[station.owner]) } catch(e) {};
    const
    timer = station.level*3600000,
    running = new Date().getTime()-station.upgrading,
    current = running/timer,
    left = running >= timer ? 0 : timer-(current*timer);
    stationTimeout[station.owner] = Meteor.setTimeout(function() {
        Station.update({ "$and": [
            { print: station.print },
            { owner: station.owner }
        ]},{
            $inc: { level: 1 },
            $set: { upgraded: new Date().getTime() },
            $unset: { upgrading: "" }
        },{ upsert: true });
    }, left);
};

startStations = function () {
    let station = Station.find({ upgrading: { $exists: true } },
    { sort: { upgrading: -1 } }).fetch();
	for ( let i = 0; station.length > i; i++ ) {
        stationTimer(station[i]);
    }
};

stationUpgrade = function (station) {
    station.upgrading = new Date().getTime();
    Station.update({ "$and": [
        { print: station.print },
        { owner: station.owner }
    ]},{ $set: {
        upgrading: station.upgrading,
        level: station.level
    } },
    { upsert: true });
    stationTimer(station);
};

stationDetails = function (level) {
    const
    fifth = Math.floor(level/5),
    sPoints = level-1-fifth;
    return { stations: fifth+1, dupes: sPoints };
};

unemployedHappiness = function () {
    Meteor.setInterval(function() {
        Prospect.update({ "$and": [
            { employeed: { $exists: false } },
            { happiness: { $lt: 90 } }
        ]},{ $inc: { happiness: 1 } },
        { multi: true },
        function(err, count) {
        });
    }, 60000);
};

vacationTimeout = [];
startVacation = function (employee) {
    try { Meteor.clearTimeout(vacationTimeout[employee.owner]) } catch(e) {};
    try { Meteor.clearTimeout(employeeTimeout[employee._id]) } catch(e) {};
    const crafting = Crafting.findOne({ "$and": [
        { owner: employee.owner },
        { employeeId: employee._id },
        { completed: { $exists: false } }
    ] });
    if( crafting )
    cancelCrafting(crafting, true);
    employee.vacation = new Date().getTime();
    Prospect.update({ _id: employee._id },{ 
    $unset: { started: "" },
    $set: { vacation: employee.vacation } });
    vacationTimer(employee);
};

startVacations = function () {
    let vacations = Prospect.find({
    vacation: { $exists: true }
    },{ sort: { vacation: -1 } }).fetch();
	for ( let i = 0; vacations.length > i; i++ ) {
        vacationTimer(vacations[i]);
    }
};

vacationTimer = function (employee) {  
    const
    player = Meteor.users.findOne({
        _id: employee.owner
    },{ fields: { exp: 1 } }),
    exp = !player.exp ? 1 : player.exp,
    level = expPlayerLevel(exp),
    reduction = playerBonus(level).timer/100,
    timer = 3600000-(3600000*reduction),
    running = new Date().getTime()-employee.vacation,
    current = running/timer,
    left = running >= timer ? 0 : timer-(current*timer);
    vacationTimeout[employee.owner] = Meteor.setTimeout(function() { 
        // Need to get the current happiness of the employee
        const
        happiness = employee.happiness <= 70 ? 30 : 100-employee.happiness,
        started = new Date().getTime();
        Prospect.update({ _id: employee._id },{
        $inc: { happiness: happiness },
        $unset: { vacation: "" },
        $set: { started: started } });
        employee.happiness = employee.happiness+happiness;
        employee.started = started;
        delete employee.vacation;
        employeeStart(employee)
    }, left);
};

// mass employee restart
startEmployees = function () {
    const employee = Prospect.find({
        started: { $exists: true }
    },{ sort: { employeed: -1 } }).fetch();
	for ( let i = 0; employee.length > i; i++ ) {
        employeeStart(employee[i]);
    }
};

employeeTimeout = [];
// single employee start
employeeStart = function (employee) {
    try { Meteor.clearTimeout(employeeTimeout[employee._id]) } catch(e) {};
    const
    timer = 3600000,
    running = new Date().getTime()-employee.employeed,
    current = (running/timer)%1,
    left = timer-(current*timer);
    if ( left < timer ) {
        employeeTimeout[employee._id] = Meteor.setTimeout(function() {
            const update = Prospect.update({ "$and": [
                { _id: employee._id },
                { paid: { $gte: 2 } }
            ]},{ $inc: { paid: -1 } });
            if ( update >= 1 ) {
                employeeStart(employee);
            } else {
                employeeFire(employee);
            };
        }, left);
    } else {
        employeeFire(employee);
    };
};

employeeFire = function (employee, fired) {
    try { Meteor.clearTimeout(craftTimeout[employee._id]) } catch(e) {};
    try { Meteor.clearTimeout(employeeTimeout[employee._id]) } catch(e) {};
    const crafting = Crafting.findOne({ "$and": [
        { owner: employee.owner },
        { employeeId: employee._id },
        { completed: { $exists: false } }
    ] });
    if( crafting )
    cancelCrafting(crafting);
    let insert = {
        owner: employee.owner,
        created: new Date().getTime(),
        notice: true,
        employee: employee.name
    };
    const type = fired ? "fired" : "quit";
    insert[type] = true;
    Message.insert(insert);
    Prospect.update({
        _id: employee._id
    },{ $unset: {
        started: "",
        employeed: "",
        paid: "",
        owner: ""
    }});
};

// Verifies money payment is available
verifyPayment = function (userId, cost) {
    return Meteor.users.findOne({ "$and": [
        { _id: userId },
        { money: { $gte: cost } }
    ] },{
        fields: { _id: 1, username: 1 }
    });
};

// Updates money with date updated
moneyUpdate = function (userId, amount, check) {
    let update = [{ _id: userId }];
    if ( check ) {
        const check_amount = amount < 0 ? -amount : amount;
        update.push({ money: { $gte: check_amount } });
    };
    const updated = Meteor.users.update({ "$and":
        update
    },{ $inc: { 
        money: amount
    }, $set: { 
        updated: new Date().getTime()
    } });
    return updated >= 1 ? true : false;
};

happyCheck = function (craft, paperwork, employee, station) {
    const
    skill = employee.skills[paperwork.print],
    exp = !skill ? 0 : skill,
    level = expLevel(exp),
    difference = level-paperwork.level;
    if ( level == paperwork.level ) {
        if ( employee.happiness <= 99.95 )
        employee.happiness += .05;
        Prospect.update({ "$and": [
            { _id: employee._id },
            { happiness: { $lte: 99.95 } }
        ]},{ $inc: {
            happiness: .05
        }});
    } else if ( level > paperwork.level ) {
        let adjust = difference*.05;
        adjust = employee.happiness <= adjust ? employee.happiness : adjust;
        employee.happiness -= adjust;
        Prospect.update({ "$and": [
            { _id: employee._id },
            { happiness: { $gte: adjust } }
        ]},{ $inc: {
            happiness: -adjust
        }});
    };    
    craftMaterials(craft, paperwork, employee, station);
};

cancelCrafting = function (craft, refund) {
    try { Meteor.clearTimeout(craftTimeout[craft.employeeId]) } catch(e) {};
    if ( refund )
    refundCraft(craft);
    let update = Crafting.update({ "$and": [
        { owner: craft.owner },
        { employeeId: craft.employeeId },
        { completed: { $exists: false } }
    ] },{ $set: { 
        completed: new Date().getTime()
    }});
    return true;
};

refundCraft = function (craft) {
    const refundId = !craft.list ? craft.item : craft.list[craft.position]._id;
    const refund = Paperwork.findOne({ _id: refundId});
    // Refund money or parts
    if ( refund && refund.type == "Goods" ) {
        let update = Inventory.update({ "$and": [
            { owner: craft.owner },
            { print: refund.print },
            { level: refund.level },
            { "$or": [
                { name: refund.part1 },
                { name: refund.part2 }
            ]}
        ]},{ $inc: {
            amount: 1
        } },{ multi: true });
    } else if ( refund && refund.type == "Parts" ) {
        moneyUpdate(craft.owner, refund.level*3)
    };
};

// Crafting functions
let craftTimeout = [];
craftTimer = function (craft, paperwork, employee, station) {
    let timer = ( craft.list && craft.list[craft.position].type == "Goods" ) ? 30000 : 15000;
    const running = new Date().getTime()-craft.started;
    const current = ( running / timer ) % 1;
    const remain = current * timer;
    const timed = timer-remain;
    try { Meteor.clearTimeout(craftTimeout[craft.employeeId]) } catch(e) {};
    craftTimeout[craft.employeeId] = Meteor.setTimeout(function() {
        awardItem(craft, paperwork, employee, station);
    }, timed);
};

craftPosition = function (craftId, position) {
    Crafting.update({
        _id: craftId
    },{ $set: {
        started: new Date().getTime(),
        position: position
    }});
};

craftMaterials = function (craft, paperwork, employee, station) {
    if ( paperwork.type == "Parts" ) {
        if ( craftResources(craft, paperwork) ) {
            craftTimer(craft, paperwork, employee, station);
        } else {
            cancelCrafting(craft);
        };
    } else {
        const part = craftParts(craft, paperwork);
        if ( !part ) {
            craftPosition(craft._id, 2);
            craft.position = 2;
            let inv = Inventory.update({ "$and": [
                { owner: craft.owner },
                { print: paperwork.print },
                { level: paperwork.level },
                { "$or": [
                    { name: craft.list[0].name },
                    { name: craft.list[1].name },
                ]},
                { amount: { $gte: 1 } }
            ]},
            { $inc: {
                amount: -1
            }},{ multi: true });
            craftTimer(craft, paperwork, employee, station);
        } else {
            for ( let i = 0; craft.list.length > i; i++ ) {
                if ( craft.list[i].name == part ) {
                    craftPosition(craft._id, i);
                    craft.position = i;
                };
            }
            if ( craftResources(craft, paperwork) ) {
                craftTimer(craft, paperwork, employee, station);
            } else {
                cancelCrafting(craft);
            };
        };
    };
};

// mass crafting restart
startCrafting = function () {
    const crafting = Crafting.find({
        completed: { $exists: false }
    },{ sort: { started: -1 } }).fetch();
	for ( let i = 0; crafting.length > i; i++ ) {
        let station = {};
        const
        paperwork = Paperwork.findOne({
            _id: crafting[i].item
        }),
        employee = Prospect.findOne({
            _id: crafting[i].employeeId
        },{ fields: { name: 1, happiness: 1, exp: 1, skills: 1 } });
        station = Station.findOne({ "$and": [
            { owner: crafting[i].owner },
            { print: crafting[i].print }
        ]});
        if ( !station )
        station = { upgraded: crafting[i].started, level: 1 };
        craftTimer(crafting[i], paperwork, employee, station);
    }
};

// single crafting start
craftStart = function (craft, paperwork, employee, station) {
    try { Meteor.clearTimeout(craftTimeout[craft.employeeId]) } catch(e) {};
    craftMaterials(craft, paperwork, employee, station);
};

awardItem = function (craft, paperwork, employee, station) {
    const
    data = craft.list ? craft.list[craft.position] : paperwork,
    exp = data.type == "Parts" ? data.level : data.level*3;

    let prospect = {};

    const checkStation = Station.findOne({ "$and": [
        { owner: craft.owner },
        { print: craft.print },
        { upgraded: { $gte: station.upgraded } }
    ]});
    if ( checkStation )
    station = checkStation;
    
    if ( !employee.skills )
    employee.skills = [];

    // Lower effort will reduce duplication chance
    const
    effort = employee.happiness/100,
    prospectLevelExp = exp*10,
    prospectSkillExp = (exp*5)*effort,
    employeeLevel = expLevel(employee.exp, true),
    employeeSkill = !employee.skills[data.print] ? 0 : employee.skills[data.print],
    employeeSkillLevel = expLevel(employeeSkill, true),
    dupChance = stationDetails(station.level).dupes,
    dupRoll = Math.random()*100;

    // Award duplicates based on station level
    const award = dupRoll <= dupChance*effort ? 2 : 1;

    // Tally awards lost due to employee happiness
    if ( dupRoll <= dupChance && dupRoll > dupChance*effort )
    Statistics.update({ "$and": [
        { owner: craft.owner },
        { type: data.type },
        { print: data.print },
        { loss: true }
    ]},{ $inc: { made: 1 } },
    { upsert: true });

    // Lower effort will reduce skill experience gained
    prospect['exp'] = prospectLevelExp;
    prospect['skills.'+data.print] = prospectSkillExp;

    employee.skills[data.print] += prospectSkillExp;
    employee.exp += prospectLevelExp;
    
    // Update employees skill experience
    Prospect.update({ "$and": [
        { _id: craft.employeeId },
        { owner: craft.owner }
    ]},{ $inc: prospect });

    if ( employeeLevel && employee.exp >= employeeLevel.next )
    Message.insert({
        employee: employee.name,
        level: employeeLevel.now+1,
        owner: craft.owner,
        created: new Date().getTime(),
        notice: true
    });

    if ( employeeSkillLevel && employee.skills[data.print] >= employeeSkillLevel.next )
    Message.insert({
        employee: employee.name,
        skill: craft.print,
        level: employeeSkillLevel.now+1,
        owner: craft.owner,
        created: new Date().getTime(),
        notice: true
    });

    // Update inventory
    Inventory.update({ "$and": [
        { owner: craft.owner },
        { type: data.type },
        { print: data.print },
        { level: data.level },
        { name: data.name }
    ]},{ $inc: {
        amount: award,
        total: award
    }},{ upsert: true });

    // Leads back to the Crafting Timer
    // Critical this happens after the inventory is updated
    happyCheck(craft, paperwork, employee, station);

    let insert = {
        owner: craft.owner,
        created: new Date().getTime(),
        notice: true,
        employee: employee.name,
        duplicate: data.name
    };
    if ( award == 2 )
    Message.insert(insert);
    
    // Reward the owner of Parts or Goods trademark
    // Only rewards if the owner is not the crafter
    if ( data.owner && data.owner != craft.owner ) {
        if ( !craft.businessId ) {
            const business = Paperwork.findOne({ "$and": [
                { owner: data.owner },
                { type: "License" },
                { name: "LLC License" },
            ]},{ fields: { certId: 1 } });
            if ( business.certId )
            craft.businessId = business.certId;
        };

        if ( craft.businessId ) {
            Paperwork.update({ _id: craft.businessId },
            { $inc: { money: prospectLevelExp } });

            Statistics.update({ "$and": [
                { businessId: craft.businessId },
                { print: data.print },
                { level: data.level },
                { type: data.type },
                { name: data.name }
            ]},{ $inc: { made: prospectLevelExp } },
            { upsert: true });
        };
    };

    // Update crafting statistics
    let
    update = [
        { print: data.print },
        { level: data.level }
    ];
    if ( data.type == "Parts" ) {
        let
        resources = {
            'Metal': 0,
            'Plastic': 0,
            'Organic': 0
        };
        updateMetal = JSON.parse(JSON.stringify(update));
        updatePlastic = JSON.parse(JSON.stringify(update));
        updateOrganic = JSON.parse(JSON.stringify(update));
        updateMetal.push({ type: "Resources" });
        updatePlastic.push({ type: "Resources" });
        updateOrganic.push({ type: "Resources" });
        for ( let i = 0; data.resources.length > i; i++ ) {
            resources[data.resources[i].name]++
        }
        if ( resources.Metal >= 1 ) {
            updateMetal.push({ name: "Metal" });
            Statistics.update({ "$and": updateMetal },
            { $inc: { made: resources.Metal*award } },
            { upsert: true });
        };
        if ( resources.Plastic >= 1 ) {
            updatePlastic.push({ name: "Plastic" });
            Statistics.update({ "$and": updatePlastic },
            { $inc: { made: resources.Plastic*award } },
            { upsert: true });
        };
        if ( resources.Organic >= 1 ) {
            updateOrganic.push({ name: "Organic" });
            Statistics.update({ "$and": updateOrganic },
            { $inc: { made: resources.Organic*award } },
            { upsert: true });            
        };
        update.push({ type: "Parts" });
        update.push({ name: data.name });
        Statistics.update({ "$and": update },
        { $inc: { made: award } },{ upsert: true });
    } else {
        update.push({ type: "Goods" });
        update.push({ name: data.name });
        Statistics.update({ "$and": update },
        { $inc: { made: award } },{ upsert: true });
    };
}

craftParts = function (craft, paperwork) {
    const partOne = Inventory.findOne({ "$and": [
        { owner: craft.owner },
        { print: paperwork.print },
        { level: paperwork.level },
        { name: paperwork.part1 },
        { amount: { $gte: 1 } }
    ] });
    const partTwo = Inventory.findOne({ "$and": [
        { owner: craft.owner },
        { print: paperwork.print },
        { level: paperwork.level },
        { name: paperwork.part2 },
        { amount: { $gte: 1 } }
    ] });
    let data = false;
    if ( !partOne ) {
        data = paperwork.part1;
    } else if ( !partTwo ) {
        data = paperwork.part2;
    };
    return data;
};

craftResources = function (craft, paperwork) {
    return moneyUpdate(craft.owner, -paperwork.level*3, true);
};

// Initial trademark setup
setTrademarks = function () {
    if ( !Paperwork.findOne({ "$or": [{ type: "Goods" },{ type: "Parts" }] }) ) {
        Paperwork.insert({ type: "Goods", name: "Make Spanner", level: 1, print: "M8co", part1: "Gear", part2: "Rod" });
        Paperwork.insert({ type: "Parts", name: "Gear", level: 1, print: "M8co", resources: [{ name: "Metal" },{ name: "Metal" },{ name: "Plastic" }] });
        Paperwork.insert({ type: "Parts", name: "Rod", level: 1, print: "M8co", resources: [{ name: "Metal" },{ name: "Plastic" },{ name: "Organic" }] });
        Paperwork.insert({ type: "Goods", name: "The Tri-Tool", level: 1, print: "Tri-Goo", part1: "Sprocket", part2: "Stick" });
        Paperwork.insert({ type: "Parts", name: "Sprocket", level: 1, print: "Tri-Goo", resources: [{ name: "Metal" },{ name: "Plastic" },{ name: "Organic" }] });
        Paperwork.insert({ type: "Parts", name: "Stick", level: 1, print: "Tri-Goo", resources: [{ name: "Plastic" },{ name: "Plastic" },{ name: "Plastic" }] });
        Paperwork.insert({ type: "Goods", name: "Versatool", level: 1, print: "Squish", part1: "Gyro", part2: "Lock" });
        Paperwork.insert({ type: "Parts", name: "Gyro", level: 1, print: "Squish", resources: [{ name: "Metal" },{ name: "Metal" },{ name: "Organic" }] });
        Paperwork.insert({ type: "Parts", name: "Lock", level: 1, print: "Squish", resources: [{ name: "Metal" },{ name: "Metal" },{ name: "Plastic" }] });
    };
};

// A chron uses these to keep the workforce full
workforceEvaluate = function () {
    const workforceCount = Prospect.find({ owner: { $exists: false } },{ limit: 20 }).count();
    if ( workforceCount < 20 )
    workforceAdd(20-workforceCount);
};

workforceAdd = function (count) {
    const time_now = (new Date()).getTime();
    let names = [];
	for ( let i = 1; count >= i; i++ ) {
        names.push(Fake.user().name.charAt(0)+". "+Fake.user().surname);
    }
    names.forEach((name) => {
        Prospect.insert({
            name: name,
            created: time_now,
            happiness: 90
        });
    });
};

playerLevelAmount = function (level) {
    const amped = level*6000;
    const first = amped*(level/1.4);
    const second = -Math.log(amped)/Math.log(0.0000000001);
    return level == 0 ? 0 : Math.round( first*second );
};

expPlayerLevel = function (exp, next) {
	for ( let i = 1; 2000 >= i; i++ ) {
        const
        level = playerLevelAmount(i),
        last = i == 1 ? 0 : playerLevelAmount(i-1);
        let data = !next ? i : { now: i, next: level, last: last };
        if ( exp < level )
        return data;
	}
};

levelAmount = function (level) {
    const amped = level*3000;
    const first = amped*(level/1.25);
    const second = -Math.log(amped)/Math.log(0.0000000001);
    return level == 0 ? 0 : Math.round( first*second );
};

expLevel = function (exp, next) {
	for ( let i = 1; 2000 >= i; i++ ) {
        const
        level = levelAmount(i),
        last = i == 1 ? 0 : levelAmount(i-1);
        let data = !next ? i : { now: i, next: level, last: last };
        if ( exp < level )
        return data;
	}
};

employeeCost = function (exp) {
    exp = !exp ? 0 : expLevel(exp);
    return exp*300;
};

salePrice = function (type, level, quantity) {
    const price = type == "Parts" ? 10 : 45;
    quantity = !quantity ? 1 : quantity;
    return ( level*( price+(price*level) ) )*quantity;
};

toDollars = function (str) {
    return numeral(str).format('$0,0.[00]a');
};

toNumbers = function (str) {
    return numeral(str).format('0,0.[00]a');
};