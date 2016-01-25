var http = require("http");
var fs = require("fs");
var readline = require('readline');
var objKeys = Object.keys || require('object-keys');

require("datejs") //Adds awesome capabilities to the Date object. Used for time parsing

var aktier = {
    "smør": 100,
    "mælk": 10
};

var teams = {};
var startMoney = 600;
var updateInterval = 1000;

server = http.createServer(function(req, res){
    if (req.url.indexOf("team") > 0) {
        res.writeHeader(200, {"Content-Type": "text-html", "charset": "utf-8"});
        res.write(fs.readFileSync("team.html"));
    } else {
        res.writeHeader(200, {"Content-Type": "text/html", "charset": "utf-8"});
        res.write(fs.readFileSync("overview.html"));
    }
    res.end();
})
server.listen(8080);
console.log("Server running on port 8080");

function buy_action(team, aktie, amount) {
    var prevMoney = teams[team]['money']
    if (prevMoney < (aktier[aktie] * amount)) {
        return "du kan ikke bruge flere penge, end du har";
    }
    teams[team]['money'] -= aktier[aktie] * amount;
    teams[team]['aktier'][aktie] += amount;
    
    //Update stock value
    aktier[aktie] *= 1 + (Math.log(amount) / Math.log(10))
    aktier[aktie] = Math.round(aktier[aktie]);
}
function sell_action(team, aktie, amount) {
    var prevAmount = teams[team]['aktier'][aktie];
    if (prevAmount < amount) {
        return "du kan ikke sælge flere aktier, end du ejer"
    }
    teams[team]['money'] += amount * aktier[aktie];
    teams[team]['aktier'][aktie] -= amount;
    return false;
}

var io = require("socket.io")(server);
io.on("connection", function(socket) {
    var team;
    socket.on("sign_in", function(msg) {
        console.log("Connection: " + msg);
        if (! teams.hasOwnProperty(msg)) {
            teams[msg] = {'aktier': {}, money: startMoney};
            for (key in aktier) {
                teams[msg]['aktier'][key] = 0;
            }
        }
        team = msg;
        
        function sendOwnDetails() {
            socket.emit("own_details", teams[team]);
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
                socket.emit('error_msg', err);
            }
            var sell = msg['sell']
            var sErr = sell_action(team, sell[0], sell[1]);
            if (sErr) {
                socket.emit('error_msg', sErr);
            };
            sendOwnDetails();
        })
        socket.on("card_action", function(msg) {
            
        });
        
        //Send the team its own details
        sendOwnDetails();
    });
});

var conf = { // "aktie": [mål, mål_tid, error]
    "smør": [200, Date.parse("+30 sec"), 5],
    "mælk": [-2, Date.parse("+1h"), 5]
}

function updateAktier() {
    //var conf = JSON.parse(fs.readFileSync("config"));
    for (key in conf) {
        var goalValue = conf[key][0];
        var goalTime = conf[key][1]
        var error = conf[key][2];
        var current = aktier[key];
        var distX = Math.max(goalTime - new Date(), updateInterval + 1);
        var distY = goalValue - current;
        var stepY = distY/(distX / updateInterval);
        var high = stepY + (error/2);
        var low = stepY - (error/2);
        aktier[key] += Math.floor(Math.random() * (high - low + 1) + low); // Generate a random new value in the range {trend +- (error/2)}
        if (aktier[key] < 0) {
            aktier[key] += (stepY / 2);
        }
    }
    io.emit("update_aktier", aktier);
}

setInterval(updateAktier, updateInterval);

//Create interface for managing stocks and sessions. Only for admins
function stockMenu() {
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log("Der findes følgende aktier:")
        var keys = objKeys(aktier);
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
                var label = keys[index - 1];
                console.log("You chose: " + label);
                console.log("Current goal: " + conf[label][0]);
                console.log("Time to reach said goal: " + conf[label][1]);
                console.log("Error: " + conf[label][2]);        

                rl.question('Enter new goal: ', function(goal) {
                    rl.question('Enter time delay: ', function(time) {
                        rl.question('Enter error: ', function(error) {
                            conf[label] = [goal, Date.parse(time), error]
                            rl.close(function() {stockMenu()});
                        });
                    });
                });
            }
        });
//    });
}
//stockMenu();