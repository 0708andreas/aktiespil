/**********************************
*            NOTER                *
* DigitalOcean password: Aktie123 *
* GigitalOcean IP: 178.62.245.118 *
***********************************/
// Copyright (c) 2016 Andreas Poulsen All Rights Reserved.

var http = require("http");
var fs = require("fs");
var path = require("path");
var send = require("send");
var readline = require('readline');
var objEqual = require('deep-equal');
var extend = require('jquery-extend');
var objKeys = Object.keys || require('object-keys');

require("datejs") //Adds awesome capabilities to the Date object. Used for time parsing

var Card = function (opts) {
    return {
        raises: {
            stock: "?",
            amount: 60
        },
        lowers: {
            stock: "?",
            amount: 60
        },
        money: 0,
        special: function (team) {
            
        }
    }
}

var possibleCards = [
    extend(true, new Card(), {
        raises: {
            stock: "*",
            amount: 10
        }
    }),
    extend(true, new Card(), {
        lowers: {
            stock: "*",
            amount: 10
        }
    }),
    extend(true, new Card(), {
        money: 100
    }),
    extend(true, new Card(), {
        raises: {
            stock: "?",
            amount: 100
        },
        lowers: {
            stock: "*",
            amount: 10
        },
        money: -160
    })
]

var aktier = {
    "smør": 100,
    "mælk": 100,
    "æg": 100,
    "piber": 100,
    "rødt": 100,
    "BMW": 50
};
var conf = { // "aktie": [mål, mål_tid, error]
    "smør": [90, Date.parse("+7 min"), 2],
    "mælk": [70, Date.parse("+5 min"), 3],
    "æg": [50, Date.parse("+2 min"), 1],
    "piber": [110, Date.parse("+10 min"), 2],
    "rødt": [100, Date.parse("+3 min"), 0],
    "BMW": [130, Date.parse("+15 min"), 10],
}

var teams = {};
var startMoney = 600;
var updateInterval = 1000;
var stockResDelay = 7;

server = http.createServer(function(req, res){
    send(req, req.url, {root: __dirname}).pipe(res);
})
server.listen(8080);
console.log("Server running on port 8080");

function createCard(team) {
    var template = possibleCards[Math.floor(Math.random() * possibleCards.length)];
    if (template['raises']['stock'] == '?') {
        template['raises']['stock'] = objKeys(aktier)[Math.floor(Math.random() * objKeys(aktier).length)];
    }
    if (template['lowers']['stock'] == '?') {
        template['lowers']['stock'] = objKeys(aktier)[Math.floor(Math.random() * objKeys(aktier).length)];
    }
    if (template.lowers.stock == template.raises.stock && template.lowers.amount == template.raises.amount) {
        return createCard(team);
    }
    for (var i = 0; i<teams[team].cards.length; i++) {
        if (objEqual(template, teams[team].cards[i])) {
            return createCard(team);
        }
    }
    teams[team].cards.push(template);
}

function buy_action(team, aktie, amount) {
    var prevMoney = teams[team]['money']
    if (teams[team].money - (aktier[aktie] * amount) < 0) {
        return "du kan ikke bruge flere penge, end du har";
    }
    teams[team]['money'] -= parseInt(aktier[aktie] * parseInt(amount));
    if (isNaN(teams[team].money)) {
        console.log("NaN: buy_action")
    }
    teams[team]['aktier'][aktie] += amount;
    
    //Update stock value
    oldAktie = conf[aktie];
    var newGoal = Math.round(oldAktie[0] * (1 + (Math.log(amount) / Math.log(1000))));
    var newDate = new Date(Math.max(oldAktie[1], new Date())).addMinutes(stockResDelay);
    conf[aktie] = [newGoal, newDate, oldAktie[2]];
}
function sell_action(team, aktie, amount) {
    var prevAmount = teams[team]['aktier'][aktie];
    if (prevAmount < amount) {
        return "du kan ikke sælge flere aktier, end du ejer"
    }
    teams[team]['money'] += parseInt(parseInt(amount) * aktier[aktie]);
    if (isNaN(teams[team].money)) {
        console.log("NaN: sell_action");
    }
    teams[team]['aktier'][aktie] -= amount;
    oldAktie = conf[aktie];
    var newGoal = Math.round(oldAktie[0] / (1 + (Math.log(amount) / Math.log(1000))));
    var newDate = new Date(Math.max(oldAktie[1], new Date())).addMinutes(stockResDelay);
    conf[aktie] = [newGoal, newDate, oldAktie[2]];
}

var io = require("socket.io")(server);
io.on("connection", function(socket) {
    var team;
    socket.on("sign_in", function(msg) {
        socket.join(msg);
        if (! teams.hasOwnProperty(msg)) {
            teams[msg] = {aktier: {}, money: startMoney, locked: false, cards: []}; //TODO: implement team locking and cards
            for (key in aktier) {
                teams[msg]['aktier'][key] = 0;
            }
            for (var i = 0; i<4; i++) {
                createCard(msg);
            }
        }
        team = msg;
        
        function sendOwnDetails() {
            /*if (isNaN(teams[team].money)) {
                io.to(team).emit("error_msg", "")
            }*/
            io.to(team).emit("own_details", teams[team]);
        }
        
        //Initialize all possible actions. Shouldn't be avaliable before sign-in
        socket.on("buy_action", function(msg) { //msg=["aktie", amount]
            var aktie = msg[0];
            var amount = parseInt(msg[1]);
            var err = buy_action(team, aktie, amount);
            if (err) {
                socket.emit('error_msg', err);
            }
            sendOwnDetails();
        });
        socket.on("sell_action", function(msg) { //msg=["aktie", amount]
            var aktie = msg[0];
            var amount = parseInt(msg[1]);
            var err = sell_action(team, aktie, amount);
            if (err) {
                socket.emit('error_msg', err);
            }
            sendOwnDetails();
        });
        socket.on('buy_sell_action', function (msg) { //msg={buy: ["aktie", maount], sell: ["aktie", amount]}
            var buy = msg['buy'];
            var bErr = buy_action(team, buy[0], buy[1]);
            if (bErr) {
                socket.emit('error_msg', bErr);
            }
            var sell = msg['sell']
            var sErr = sell_action(team, sell[0], sell[1]);
            if (sErr) {
                socket.emit('error_msg', sErr);
            };
            sendOwnDetails();
        })
        socket.on("card_action", function(msg) {
            if (new Date() < teams[team].locked) {
                socket.emit("error_msg", "Dit team er låst. I kan ikke bruge kort endnu");
                return;
            }
            var i = msg[1];
            msg = msg[0];
            if (teams[team].money + msg.money < 0) {
                socket.emit("error_msg", "Du har ikke penge nok til at bruge dette kort");
                return;
            }
            teams[team].money += parseInt(msg.money);
            teams[team].money = Math.max(0, teams[team].money)
            if (isNaN(teams[team].money)) {
                console.log("NaN: card_action");
            }
            if (msg.lowers.stock == '*') {
                for (key in conf) {
                    var old = conf[key];
                    conf[key] = [parseInt(old[0]) - parseInt(msg.lowers.amount), old[1], old[2]];
                }
            } else {
                var old = conf[msg.lowers.stock];
                conf[msg.lowers.stock] = [parseInt(old[0]) - parseInt(msg.lowers.amount), old[1], old[2]];
            }
            if (msg.raises.stock == '*') {
                for (key in conf) {
                    var old = conf[key];
                    conf[key] = [parseInt(old[0]) - parseInt(msg.raises.amount), old[1], old[2]];
                }
            } else {
                var old = conf[msg.raises.stock];
                conf[msg.raises.stock] = [parseInt(old[0]) + parseInt(msg.raises.amount), old[1], old[2]];
            }
            teams[team].cards.splice(i, 1);
            teams[team].locked = Date.parse("+5 min");
            
            sendOwnDetails();
        });

        //Send the team its own details
        sendOwnDetails();
    });
});

function updateAktier() {
    for (key in conf) {
        var goalValue = conf[key][0];
        var goalTime = conf[key][1]
        var error = conf[key][2];
        var current = aktier[key];
        var distX = Math.max(goalTime - new Date(), updateInterval + 1);
        var distY = goalValue - current;
        var stepY = distY/(distX / updateInterval);
        var high = stepY + error;
        var low = stepY - error;
        aktier[key] += Math.floor(Math.random() * (high - low + 1) + low); // Generate a random new value in the range {trend +- error}
        if (aktier[key] < 10) {
            aktier[key] = 10;
            conf[key][0] = 10;
        }
        if (aktier[key] > 300) {
            for (var team in teams) {
                teams[team].money += parseInt(teams[team].aktier[key] * (conf[key][0] - 300));
                if (isNaN(teams[team].money)) {
                    console.log("NaN: updateAktier");
                }
                io.to(team).emit("own_details", teams[team]);
            }
            aktier[key] = 300;
            conf[key][0] = 300;
        }
    }
    io.emit("update_aktier", aktier);
}
function updateGoals() {
    var high = objKeys(conf).length;
    var stock1 = Math.floor(Math.random() * (high));
    var stock2 = Math.floor(Math.random() * (high));
    conf[objKeys(conf)[stock1]][0] += 50 * ((Math.round(Math.random()) * 2) - 1);
    conf[objKeys(conf)[stock1]][1] = new Date(Math.max(conf[objKeys(conf)[stock1]][1], new Date()));
    conf[objKeys(conf)[stock1]][1].addMinutes(stockResDelay);
    conf[objKeys(conf)[stock2]][0] += 50 * ((Math.round(Math.random()) * 2) - 1);
    conf[objKeys(conf)[stock2]][1] = new Date(Math.max(conf[objKeys(conf)[stock2]][1], new Date()));
    conf[objKeys(conf)[stock2]][1].addMinutes(stockResDelay);
    
    
}

setInterval(updateAktier, updateInterval);
setInterval(updateGoals, 1000 * 60);
setInterval(function() {
    for (var key in teams) {
        if (teams[key].cards.length < 4) {
            createCard(key);
        }
        io.to(key).emit("own_details", teams[key]);
    }
}, 1000 * 60 * 10);

function saveState(fil) {
    fs.writeFile("./" + fil, JSON.stringify({
        "teams": teams,
        "aktier": aktier,
        "conf": conf
    }), function (err) {
        if (err) {
            console.log(err);
        }
    });
}
function loadState(fil) {
    var load = JSON.parse(fs.readFileSync("./" + fil));
    teams = load.teams;
    aktier = load.aktier;
    conf = load.conf;
    for (var key in conf) {
        conf[key][1] = new Date(conf[key][1])
    };
}

//Create interface for managing stocks and sessions. Only for admins
function stockMenu() {
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log("Du kan ændre følgende: \n1. Aktier\n2. Teams (printer status)\n3. Loade et gammelt spil\n4. Gemme spillets tilstand");
    rl.question("Hvad vil du gøre? ", function(action) {
        if (action == 1) {
            console.log("Der findes følgende aktier:")
            var keys = objKeys(aktier);
            console.log("0. Status overview")
            for (var i = 0; i<keys.length; i++) {
                console.log((i+1) + ". " + keys[i]);
            };
            console.log("Du kan også skrive 'help' for docs.");
            
            rl.question('Enter index of stock: ', function (index) {
                if (index.toLowerCase() == "help") {
                    console.log(
                        "Aktier bevæger sig tilfældigt hen imod et mål. Enhver aktie har et mål og et tidspunkt, hvor den skal nå det mål. Derudover har aktier en 'error', der agiver hvor store udsving, der kan forekomme hver iteration."
                    )
                } else {
                    if (!index) {
                        rl.close();
                        stockMenu();
                        return;
                    }
                    if (index == 0) {
                        console.log(conf);
                        rl.close();
                        stockMenu();
                        return;
                    }
                    var label = keys[index - 1];
                    console.log("You chose: " + label);
                    console.log("Current goal: " + conf[label][0]);
                    console.log("Time to reach said goal: " + conf[label][1]);
                    console.log("Error: " + conf[label][2]);        
                    
                    rl.question('Enter new goal: ', function(goal) {
                        rl.question('Enter time delay: ', function(time) {
                            rl.question('Enter error: ', function(error) {
                                goal = goal || conf[label][0]
                                time = time || conf[label][1]
                                error = error || conf[label][2]
                                conf[label] = [goal, Date.parse(time), error]
                                rl.close();
                                stockMenu();
                            });
                        });
                    });
                }
            });
        } else if(action == 2) { // Ændr teams TODO
            console.log(teams);
            rl.close();
            stockMenu();
        } else if(action == 3) { // Load en state
            rl.question("Skriv et filnavn: ", function (fil) {
                loadState(fil);
                rl.close();
                stockMenu();
            })
        } else if (action == 4) { // Gem spillets state
            rl.question("Skriv et filnavn: ", function (fil) {
                saveState(fil)
                rl.close();
                stockMenu();
            })
        } else {
            console.log("Det forstår jeg ikke. Prøv igen");
            stockMenu();
        }
    });
}
//while (true) {
stockMenu();
//}