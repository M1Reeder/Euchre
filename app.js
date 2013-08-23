
/**
 * Module dependencies.
 */

var express = require('express')
	, routes = require('./routes')
	, user = require('./routes/user')
	, http = require('http')
	, sio   = require('socket.io')
	, path = require('path')
	, colors = require('colors')
	, engine = require('ejs-locals')
	, bcrypt = require('bcrypt')
	, passport = require('passport')
	, LocalStrategy = require('passport-local').Strategy
	, mongoose = require('mongoose')
	, Player = require("./player").Player
	, Game = require('./game').Game
	, Schema = require('./schema').Schema
	, Auth = require('./auth').Auth
	, app  = express();

var HEROKU = true;

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('ejs', engine);
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret: "meow"}));
app.use(express.methodOverride());
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}




var server = http.createServer(app);
var io = sio.listen(server);

if(HEROKU){
	io.configure(function () { 
		io.set("transports", ["xhr-polling"]); 
		io.set("polling duration", 10); 
		io.set("log level", 2);
		io.set('close timeout', 60); 
	});
}else{
	io.configure(function() { 
		io.set("log level", 2); 
		io.set("polling duration", 10);
		io.set('close timeout', 5); 
	});
}


server.listen(app.get('port'), function(){ console.log('Express server listening on port ' + app.get('port')); });

var games = [];
setEventHandlers();

function setEventHandlers() {
	io.sockets.on('connection', onSocketConnection);
}

/*
 * Game Logic
 */
function onSocketConnection(socket) {
	socket.on('addme', function(username) {
		if(username === null){
			console.log(username + ' is null');
			socket.disconnect();
			//re-pool
		}
		socket.player = new Player(socket, username);
		console.log(socket.player.username + ' Connected'.green)

		if( games.length === 0 ){
			games.push( new Game( socket.player ) );
		} else {
			if( games[games.length - 1].isfull() ) {
				console.log(games[ games.length - 1 ].getID().green + ' is Full');
				games.push( new Game( socket.player ) );
				printGameIds();
			} else {
				games[games.length - 1].addplayer( socket.player );
			}
		}

		socket.emit('chat', 'SERVER', 'You have connected');
		socket.broadcast.emit('chat', 'SERVER', socket.player.username + ' joined game ' + games[ games.length - 1 ].getID() );
	});

	socket.on('choosecard', function(data){
		if(typeof socket.player == 'undifined' ){socket.disconnect(); return;}
		var game = getGameByID(socket.player.gameid);
		var gamestate = game.getGameState();
		if(data.choosecard == 'yes') {
			gamestate.trump = gamestate.topcard.charAt(1);
			console.log('trump: ' + gamestate.trump);
			game.setTeamCalled(socket.player);
			game.dealerChoose();
		} else {
			socket.player.haspassed = true;
			// console.log(socket.player.username + ' has passed (' + socket.player.haspassed + ')');
			game.emitbroadcast('pass', socket.player.username);

			var nextplayer = game.getNext(socket.player.seatpos);
			if(!nextplayer.haspassed){
				nextplayer.socket.emit('choosecard', {dealer: game.dealerName()});
			} else {
				console.log(nextplayer.username + ' now chooseing suit');
				nextplayer.socket.emit('choosesuit', {dealer: game.dealerName()});
				gamestate.topcard = 'null';
			}
		}
	});

	socket.on('choosesuit', function(data){
		if(typeof socket.player == 'undifined' ){socket.disconnect(); return;}
		var game = getGameByID(socket.player.gameid);
		var gamestate = game.getGameState();
		switch(data.suit){
			case 'H':
				gamestate.trump = 'H';
				break;
			case 'C':
				gamestate.trump = 'C';
				break;
			case 'S':
				gamestate.trump = 'S';
				break;
			case 'D':
				gamestate.trump = 'D';
				break;
			case 'P':
				socket.player.haspassedsuit = true;
				game.emitbroadcast('pass', socket.player.username);

				var nextplayer = game.getNext(socket.player.seatpos);
				if(!nextplayer.haspassedsuit && nextplayer.isdealer){
					nextplayer.socket.emit('forcesuit');
				} else if (!nextplayer.haspassedsuit) {
					nextplayer.socket.emit('choosesuit');
				} else {
					console.log('Shouldnt happen'.red);
				}
				return;

				break;
			default:
				console.log('Didnt get a suit'.red);
		}
		game.setTeamCalled(socket.player);
		console.log(gamestate);
		game.emitbroadcast('trumpfound', gamestate.trump);
	});

	socket.on('loner', function(data){
		if(typeof socket.player == 'undifined' ){socket.disconnect(); return;}

		var game = getGameByID(socket.player.gameid);

		game.addPlayerLoner({player: socket.player, call: data.loner});


		if(game.isLoner() === true){
			return;
		}

		if(data.loner === 'yes' && game.isLoner() === false){
			game.setIsLoner(true);
			game.emitbroadcast('lonerfound', {username: socket.player.username});
			game.startLonerRound(socket.player);
		}

		console.log(game.getPlayerLonerSize() + ' ' + game.isLoner() + ' ' + socket.player.username);

		if(game.getPlayerLonerSize() === 4){
			if(game.isLoner() === false){
				console.log('starting round');
				game.startround();
			}else{
				console.log('weird things happened'.red)
			}
		}
	});

	socket.on('removecard', function(data){
		if(typeof socket.player == 'undifined' ){socket.disconnect(); return;}
		var game = getGameByID(socket.player.gameid);
		var card = data.card;
		var hand = socket.player.hand;
		for(var i =0; i<hand.length; i++){
			if(hand[i] === card){
				hand.remove(i);
				console.log('removed ' + card + ' from ' + socket.player.username);
				socket.emit('hand', hand);
				break;
			}
		}
		gamestate = game.getGameState();
		game.emitbroadcast('trumpfound', gamestate.trump);
	});

	socket.on('cardplayed', function(data){
		if(typeof socket.player == 'undifined' ){socket.disconnect(); return;}
		console.log((socket.player.username + ' played ' + data.card).cyan);
		var game = getGameByID(socket.player.gameid);
		game.emitbroadcast('cardplayed', {username: socket.player.username, cardplayed: data.card});
		game.nextcard(socket.player, data.card);
	});

	socket.on('nextHand', function(){
		if(typeof socket.player == 'undifined' ){socket.disconnect(); return;}
		var game = getGameByID(socket.player.gameid);
		game.deal();
	});

	socket.on('sendchat', function(data) {
		if(typeof socket.player == 'undifined' ){socket.disconnect(); return;}
		console.log( 'From: '.rainbow + socket.player.username + ' Game: ' + socket.player.gameid);
		var game = getGameByID(socket.player.gameid);
		game.broadcast('chat', data, socket.player);
	});

	socket.on('disconnect', function() {
		if(typeof socket.player == 'undifined' ){socket.disconnect(); return;}
		if(socket.player === undefined){
			io.sockets.emit('chat', 'SERVER', 'undefined has left the building'.red);
		} else {
			console.log((socket.player.username + ' has disconnected'));
			var game = getGameByID(socket.player.gameid);
			if(typeof game == 'undefined') { console.log( socket.player.username + '\'s game was undifined')}
			if(!game.isdeleted()){ 
				if(game.isrunning()){
					console.log(('Disconnecting game ' + game.getID()).red);
					var index = games.indexOf(game);
					game.disconnect(socket);
					console.log('index ' + index);
					games.remove(index);
					printGameIds();
				}else{
					game.removeplayer(socket.player);
					game.broadcast('chat', 'disonnected', socket.player);
					if(game.getNumPlayers() === 0){
						var index = games.indexOf(game);
						games.remove(index);
					}
				}
			}
		}
		console.log('num games: ' + games.length);
	});
}

function getGameByID( id ) {
	for(var i = 0; i < games.length; i++){
		if(games[i].getID() == id){
			return games[i];
		}
	}
}

function removeGameByID( id ) {
	for(var i = 0; i < games.length; i++){
		if(games[i].getID() == id){
			return games[i];
		}
	}
}

function printGameIds(){
	for(var i = 0; i < games.length; i++){
		console.log(('ID: ' + games[i].getID() + ' len:' + games[i].getNumPlayers()).cyan);
	}
}

database = new Schema(mongoose, bcrypt);
auth = new Auth(passport, LocalStrategy);


app.get('/', function(req, res){
	res.render('index');
});

// app.get('/euchre', auth.ensureAuthenticated, function(req, res){
// 	console.log('euchre user: ' + req.user.username);
// 	res.render('euchre', {username: req.user.username});
// });
app.get('/euchre', function(req, res){
	res.render('euchre');
});

// Sign Up
app.get('/sign-up', function(req, res){
	res.render('sign-up');
});

app.post('/sign-up', function(req, res){
	console.log(req.body);
	database.saveUser(req, res, req.body);
});

// Login
app.get('/login', function(req, res){
	res.render('login');
});

app.post('/login', function(req, res, next) {
	auth.authenticate(req, res, next);
});

Array.prototype.remove = function(from, to) {
	var rest = this.slice((to || from) + 1 || this.length);
	this.length = from < 0 ? this.length + from : from;
	return this.push.apply(this, rest);
};

function printObj(obj){
	console.log(JSON.stringify(obj));
}
