var http = require("http");
var fs = require("fs");
var jade = require("jade");

var aktier = {
    "smør": 100,
    "mælk": 120
};

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
    console.log("Connection");
/*    setInterval(function() {
        io.emit("update_aktier", JSON.stringify(aktier));
    }, 500);*/  
});

function updateAktier() {
    var conf = JSON.parse(fs.readFileSync("config"));
    for (key in conf) {
        var trend = conf[key][0];
        var error = conf[key][1];
        var high = trend + (error/2);
        var low = trend - (error/2);
        aktier[key] += Math.floor(Math.random() * (high - low + 1) + low); // Generate a random new value in the range {trend +- (error/2)}
    }
    io.emit("update_aktier", JSON.stringify(aktier));
}

setInterval(updateAktier, 1000);
