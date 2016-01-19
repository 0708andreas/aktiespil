var http = require("http");
var fs = require("fs");
var jade = require("jade");

var aktier = {
    "smør": 100,
    "mælk": 10
};

var teams = {};
var startMoney = 600;

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

var io = require("socket.io")(server);
io.on("connection", function(socket) {
    var team;
    socket.on("sign_in", function(msg) {
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
            teams[team]['money'] -= aktier[aktie] * amount;
            teams[team]['aktier'][aktie] += amount;
            
            //Update stock value
            aktier[aktie] *= 1 + (Math.log(amount) / Math.log(10))
            aktier[aktie] = Math.round(aktier[aktie]);
            
            sendOwnDetails();
        });
        socket.on("sell_action", function(msg) { //msg=["aktie", amount]
            var aktie = msg[0];
            var amount = parseInt(msg[1]);
            var prevAmount = teams[team]['aktier'][aktie];
            amount = Math.min(amount, prevAmount);
            teams[team]['money'] += amount * aktier[aktie];
            teams[team]['aktier'][aktie] -= amount;
            sendOwnDetails();
        });
        socket.on("card_action", function(msg) {
            
        });
        
        //Send the team its own details
        sendOwnDetails();
    });
});

function updateAktier() {
    var conf = JSON.parse(fs.readFileSync("config"));
    for (key in conf) {
        var trend = conf[key][0];
        var error = conf[key][1];
        var high = trend + (error/2);
        var low = trend - (error/2);
        aktier[key] += Math.floor(Math.random() * (high - low + 1) + low); // Generate a random new value in the range {trend +- (error/2)}
        if (aktier[key] < 0) {
            aktier[key] += Math.abs(Math.floor(aktier[key]/10))*(trend*-2);
        }
    }
    io.emit("update_aktier", aktier);
}

setInterval(updateAktier, 1000);
