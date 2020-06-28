Meteor.methods({
    'employeeVacation': function(employeeId){
        if ( Meteor.isServer ) {   
        const vacationing = Prospect.findOne({ "$and": [
            { owner: this.userId },
            { vacation: { $exists: true } }
        ]},{ fields: { _id: 1 } });
        if ( !vacationing ) {
            const
            employee = Prospect.findOne({ "$and": [
                { _id: employeeId },
                { owner: this.userId }            
            ]}),
            exp = !employee.exp ? 1 : employee.exp,
            cost = employeeCost(exp),
            payment = moneyUpdate(this.userId, -cost, true);
            if ( payment )
            startVacation(employee);
        };
    }
    },
    'noticeMessage': function(message){
        message.owner = this.userId;
        message.created = new Date().getTime();
        message.notice = true;
        Message.insert(message);
    },
    'upgradeStation': function(stationName){
        const
        station = Station.findOne({ "$and": [
            { owner: this.userId },
            { print: stationName }
        ]},{ fields: { _id: 1, level: 1 } }),
        upgrading = Station.findOne({ "$and": [
            { owner: this.userId },
            { upgrading: { $exists: true } }
        ]},{ fields: { _id: 1 } }),
        level = !station || !station.level ? 1 : station.level,
        data = {
            owner: this.userId,
            print: stationName,
            level: level
        };
        if ( !upgrading ) {
            const payment = moneyUpdate(this.userId,  -1000*level, true);
            if ( payment )
            stationUpgrade(data);
        };
    },
    'fireEmployee': function(prospectId){
        const employee = Prospect.findOne({ _id: prospectId });
        if ( employee )
        employeeFire(employee, true);
    },
    'payEmployee': function(prospectId, days){   
        const
        player = Meteor.users.findOne({
            _id: this.userId
        },{ fields: { exp: 1 } }),
        exp = !player.exp ? 1 : player.exp,
        level = expPlayerLevel(exp),
        limit = playerBonus(level).pay,
        max = limit,
        prospect = Prospect.findOne({ "$and": [
            { _id: prospectId },
            { owner: this.userId }            
        ]});
        if ( prospect ) {
            days = !days ? max-prospect.paid : days;
            const
            exp = !prospect.exp ? 1 : prospect.exp,
            cost = -days*employeeCost(exp);
            if ( days >= 1 && prospect.paid+days <= max ) {
                const payment = moneyUpdate(this.userId, cost, true);
                if ( payment )
                Prospect.update({ "$and": [
                    { _id: prospectId },
                    { owner: this.userId }            
                ]},{ $inc: { 
                    paid: days
                }});
            };
        };
    },
    'sellItems': function(items, quantity){ 
        if ( Meteor.isServer ) {   
            let total = 0;
            for ( let i = 0; i < items.length; i++ ) {
                quantity = quantity >=1 ? quantity : items[i].amount;
                const
                level = items[i].level,
                type = items[i].type,
                sale = salePrice(type, level, quantity);
                let item = [
                    { type: type },
                    { print: items[i].print },
                    { level: level },
                    { name: items[i].name }
                ];
                Paperwork.findOne({ "$and": item });
                if ( quantity && sale ) {
                    item.push({ owner: items[i].owner });
                    item.push({ amount: { $gte: quantity } });
                    const update = Inventory.update({ "$and":
                        item 
                    },{ $inc: {
                        amount: -quantity
                    }});
                    if ( update )
                    total += sale;
                };
                quantity = 0;
            }
            if ( total >= 1 )
            Meteor.users.update({
                _id: this.userId
            },{ $inc: {
                money: total,
                exp: total
            }});
        };
    },
    'cancelCrafting': function(craftId) {
        if ( Meteor.isServer ) {
            const crafting = Crafting.findOne({ _id: craftId });
            if ( crafting )
            cancelCrafting(crafting, true);
        };
    },
    'craftItem': function(employee, item){
        if ( Meteor.isServer ) {
            const
            prospect = Prospect.findOne({ _id: employee }),
            paperwork = Paperwork.findOne({ _id: item }),
            crafts = Crafting.find({ "$and": [
                { owner: this.userId },
                { print: paperwork.print },
                { completed: { $exists: false } }
            ]},{ fields: { _id: 1 } }).count();
            let station = Station.findOne({ "$and": [
                { owner: this.userId },
                { print: paperwork.print }
            ]},{ fields: { level: 1, upgraded: 1 } }),
            level = !station || !station.level ? 1 : station.level,
            limit = 1+Math.floor(level/5);
            if ( prospect && paperwork && crafts < limit ) {
                const crafting = Crafting.findOne({ "$and": [
                    { owner: this.userId },
                    { employeeId: employee },
                    { completed: { $exists: false } }
                ] });
                // Clear previous crafting for employee
                if ( crafting )
                cancelCrafting(crafting);

                let insert = {
                    owner: this.userId,
                    employeeId: employee,
                    item: item,
                    print: paperwork.print,
                    started: new Date().getTime()
                };
                if ( !station )
                station = { upgraded: insert.started, level: 1 };
                // If crafting Goods, build craft list
                if ( paperwork.type == "Goods" ) {
                    const one = Paperwork.findOne({ "$and": [
                        { print: paperwork.print },
                        { level: paperwork.level },
                        { name: paperwork.part1 }
                    ] });
                    const two = Paperwork.findOne({ "$and": [
                        { print: paperwork.print },
                        { level: paperwork.level },
                        { name: paperwork.part2 }
                    ] });
                    if ( one && two ) {
                        const list = [ one, two, paperwork ];
                        insert.list = list;
                        insert.position = 0;
                    };
                };
                Crafting.insert(insert,
                function(err, craftId) {
                    if ( craftId ) {
                        insert._id = craftId;
                        craftStart(insert, paperwork, prospect, station);
                    };
                });
            };
        };
    },
    'applyTrademark': function(type, name, print, level, one, two) {
        let insert = {
            owner: this.userId,
            type: type,
            name: name,
            level: level,
            print: print
        }
        if ( type == "Goods" ) {
            insert.part1 = one;
            insert.part2 = two;
        };
        if ( type == "Parts" )
        insert.resources = one;
        const cost = type == "Goods" ? level*1800 : level*900; 
        const payment = verifyPayment(this.userId, cost);
        if ( payment )
        Meteor.users.update({
            _id: this.userId
        },{ $inc: {
            money: -cost
        } },
        function(err, count) {
            if ( !err ) {
                Paperwork.remove({ "$and": [
                    { owner: payment._id },
                    { name: type+" Trademark" },
                    { pending: { $exists: true } }
                ] });
                Paperwork.insert(insert);
            };
        });
    },
    'buyOption': function(name) {
        // Search global variable Paper by name selected
        if ( Meteor.isServer ) {    
            for ( let i = 0; i < Paper.length; i++ ) {
                if ( Paper[i].name == name ) {
                    let pending_trademark;
                    const llc_license = Paperwork.findOne({ "$and": [{
                        owner: this.userId
                    },{
                        name: "LLC License"
                    }] });
                    const corp_license = Paperwork.findOne({ "$and": [{
                        owner: this.userId
                    },{
                        name: "CORP License"
                    }] });
                    // If LLC License make sure no LLC exists.
                    const llc = Paper[i].name == "LLC License" && !llc_license;
                    // If CORP License make sure an LLC exists and no CORP exists.
                    const corp = Paper[i].name == "CORP License" && llc_license && !corp_license;
                    // If License make sure on above is true. 
                    const license = Paper[i].type == "License" && llc || corp;
                    // If Trademark make sure there is a business.
                    const trademark = Paper[i].type == "Trademark" && llc_license || corp_license;
                    if ( trademark )
                    pending_trademark = Paperwork.findOne({ "$and": [
                        { owner: this.userId },
                        { type: "Trademark" },
                        { pending: { $exists: true } }
                    ]});
                    if ( license || ( trademark && !pending_trademark ) ) {
                        const payment = verifyPayment(this.userId, Paper[i].cost);
                        if ( payment )
                        Meteor.users.update({
                            _id: this.userId
                        },{ $inc: {
                            money: -Paper[i].cost
                        } },
                        function(err, count) {
                            if ( !err ) {
                                const timenow = new Date().getTime();
                                let insert = {
                                    owner: payment._id,
                                    type: Paper[i].type,
                                    name: Paper[i].name
                                };
                                // An LLC License instantly creates a certificate.
                                if ( license && llc ) {
                                    insert.created = timenow;
                                    insert.paid = 1;
                                    // LLC certificate.
                                    Paperwork.insert({
                                        certificate: true,
                                        type: "LLC",
                                        name: payment.username+" LLC",
                                        created: timenow
                                    }, function(err, certId) {
                                        // LLC, completed paperwork.
                                        if ( certId ) {
                                            insert.certId = certId;
                                            Paperwork.insert(insert); 
                                        };
                                    });
                                } else {
                                    // CORP or Trademark, pending paperwork.
                                    insert.pending = timenow;
                                    Paperwork.insert(insert);
                                };
                            };
                        }); 
                    };   
                };
            };
        };
    },
    'employeeProspect': function(prospectId) {
        const
        player = Meteor.users.findOne({
            _id: this.userId
        },{ fields: { exp: 1 } }),
        exp = !player.exp ? 1 : player.exp,
        level = expPlayerLevel(exp),
        limit = playerBonus(level).employees,
        prospect = Prospect.findOne({ "$and": [
            { owner: { $exists: false } },
            { _id: prospectId }
        ] },{ fields: { exp: 1, name: 1 } }),
        count = Prospect.find({ owner: this.userId }).count();
        if ( prospect && limit > count ) {
            const
            prospect_exp = !prospect.exp ? 0 : prospect.exp,
            prospect_level = expLevel(prospect_exp),
            cost = employeeCost(prospect.exp),
            employeed = new Date().getTime();
            if ( prospect_level <= level ) {
                const payment = Meteor.users.findOne({ "$and": [
                    { _id: this.userId },
                    { money: { $gte: cost } }
                ] },{ fields: { _id: 1 } });
                if ( payment ) {
                    Meteor.users.update({
                        _id: this.userId
                    },{ $inc: {
                        money: -cost
                    } });
                    Prospect.update({ "$and": [
                        { owner: { $exists: false } },
                        { _id: prospectId }
                    ] },{ $set: {
                        owner: this.userId,
                        started: employeed,
                        employeed: employeed,
                        paid: 1
                    } },
                    function(err, count) {
                        const employee = {
                            _id: prospectId,
                            started: employeed,
                            employeed: employeed,
                            name: prospect.name,
                            owner: payment._id,
                            paid: 1
                        };
                        if ( !err )
                        employeeStart(employee);
                    });
                };
            };
        };        
    },
    'leaderPosition': function(amount, updated) {
        if ( Meteor.isServer ) {
            return Meteor.users.find({ "$or": [
                { money: { $gt: amount } 
            },{ "$and": [
                { money: { $eq: amount } },
                { updated: { $gte: updated }
            }]}] },{ sort: {
                money: -1,
                updated: -1
            }}).count();
        }
    },
});