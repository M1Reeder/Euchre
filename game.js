var TABLE_SIZE = 4;

var Game = function ( player ) {
	var isloner = false;
	var playerLoner = [];
	var alonePlayer;
	var teamwhocalled;
	var gameready = false;
	var wasdeleted = false;

	var players = [],
		id = makeid(),
		seatcounter = 0,
		isFull,
		trickTeam1 = 0,
		trickTeam2 = 0,
		scoreTeam1 = 0,
		scoreTeam2 = 0,
		cardcounter = 0;


	var POINT_LIMIT = 3;

	var gamestate = {
		dealer: -1,
		partners: { team11: {teamscore: trickTeam1}, team12: {teamscore: trickTeam1}, team21: {teamscore: trickTeam2}, team22: {teamscore: trickTeam2} },
		topcard: null,
		round: 1,
		hand: 0,
		last_hand: [],
		hand1: [],
		hand2: [],
		hand3: [],
		hand4: [],
		hand5: [],
		handhistory: [],
	}

	var deck;
	createNewDeck();


	// var that = this;

	console.log('Creating game: ' + id);

	var addplayer = function ( player ) {
		players.push(player);
		player.gameid = id;
		if(seatcounter > 4){
			player.seatpos = findOpenSeat(player);
		}else{
			player.seatpos = seatcounter;
		}
		console.log('Player ' + player.username + ' joined ' + id + ' seat: ' + player.seatpos);
		seatcounter++;
		if ( players.length < TABLE_SIZE ) {
			isFull = false;
		} else {
			console.log(('Game ' + id + ' is ready').green);
			this.broadcast('chat', 'game '+ id + ' ready.', {username: 'SERVER'});
			gameready = true;
			isFull = true;
			startGame();
		}
	};

	function findOpenSeat( player ){
		var seats = [0,1,2,3];
		for(var i = 0; i<players.length; i++){
			for(var j = 0; j<seats.length; j++){
				if(players[i] === seats[i]){
					seats.remove(i);
					break;
				}
			}
		}
		console.log('seats: ' + seats);
		if(seats.length === 1){
			return seats[0];
		}
	}


	

	var removeplayer = function ( player ) {
		var player = getPlayerByUsername(player.username);
		var index = players.indexOf(player);
		players.remove(index);
		seatcounter--;
	};

	var isfull = function () {
		return isFull;
	};

	var getID = function () {
		return id;
	};

	var broadcast = function (emit, data , player) {
		for(var i=0; i<players.length; i++){
			players[i].socket.emit(emit, player.username, data);
		}
	}

	var emitbroadcast = function (emit, obj){
		for(var i=0; i<players.length; i++){
			players[i].socket.emit(emit, obj);
		}
	}

	var deal = function() {
		gamestate.hand++;
		createNewDeck();
		console.log('hand: ' + gamestate.hand);
		var next;
		var dealerpos = gamestate.dealer;
		
		if(dealerpos == 3)
			next = 0;
		else
			next = dealerpos + 1;

		var player, 
			first = next;
		
		while( next !== dealerpos ){
			player = getPlayerBySeat(next);
			console.log(player.username + ' is being delt & is ' + (player.afterdealer ? 'after dealer': 'not after dealer'));
			player.hand = getHand();
			player.socket.emit('hand', player.hand);
			player.numcards = 5;

			if(next == 3)
				next = 0;
			else
				next++;
		}
		player = getPlayerBySeat(dealerpos);
		player.hand = getHand();
		console.log(player.username + ' is being delt & is dealer');
		player.socket.emit('hand', player.hand);
		player.numcards = 5;

		console.log('top card:' + deck[0]);
		emitbroadcast('dealend', { topcard: deck[0], dealer: player.username });
		gamestate.topcard = deck[0];
		getNext(player.seatpos).socket.emit('choosecard', {dealer: getPlayerBySeat(gamestate.dealer).username});

	}

	function getHand(){
		var hand = [];
		var card, count = 0;
		while( count < 5 ){
			card = deck[Math.floor(Math.random()*deck.length)];
			hand.push(card);
			var index = deck.indexOf(card);
			deck.splice(index, 1);
			count++;
		}
		return hand;
	}

	var getGameState = function () {
		return gamestate;
	}

	var getNext = function( pos ){
		if(pos == 3)
			pos = 0;
		else
			pos++;

		return getPlayerBySeat(pos);
	}
	var startround = function () {
		console.log('Dealer: ' + gamestate.dealer);
		var lead = getNext(gamestate.dealer);
		console.log('Lead: ' + lead.username);
		lead.socket.emit('playcard');
		cardcounter++;
	}

	var startLonerRound = function( player ){
		alonePlayer = player;
		console.log('Dealer: ' + gamestate.dealer + ' (L)');
		console.log(player.username + ' is going alone');
		var lead = getNext(gamestate.dealer);
		var partnerpos = getPartner(player).seatpos;
		while(getNext(lead) === partnerpos){
			console.log('skipped: ' + getPlayerBySeat(partnerpos).username );
			lead = getNext(lead);
		}
		console.log('Lead: ' + lead.username);
		lead.socket.emit('playcard');
		cardcounter++;
	}

	var trickwinnerloner = [];
	function nextcardLoner(player, lastcardplayed){
		if(cardcounter < 3){
			var nextplay = getNext(player.seatpos);
			while(nextplay === getPartner(alonePlayer)){
				nextplay = getNext(nextplay.seatpos);
			}
			nextplay.socket.emit('playcard');
			cardcounter++;
		} else {
			emitbroadcast('endround', {round: gamestate.round});
			var winninghand = findTrickWinner(gamestate.last_hand);
			gamestate.handhistory.push(winninghand);
			console.log(('winning card: ' + winninghand.cardplayed + ' playedby: ' + winninghand.username).green);

			var trickwinner = getPlayerByUsername(winninghand.username);
			trickwinnerloner.push(trickwinner);
			var winningteam = getWinningTeam(winninghand.username);
			console.log('Winning team: ' + winningteam);
			//console.log(gamestate.hand_data);
			emitbroadcast('trickwon', {
				username: trickwinner.username, 
				team: winningteam, 
				hand: winninghand.cardplayed 
			});
			trickwinner.socket.emit('playcard');
			cardcounter = 1;

			gamestate.round++;
			if(gamestate.round === 6){
				isloner = false;
				playerLoner = [];

				var swept = true;

				for(var i = 0; i < trickwinnerloner.length; i++){
					if(alonePlayer.username !== trickwinnerloner[i].username){
						console.log('swept: ' + swept);
						swept = false;
					}
				}

				if(trickTeam1 > trickTeam2){
					if(swept && teamwhocalled === getTeam(alonePlayer)){
						scoreTeam1 = scoreTeam1 + 4;
						emitbroadcast('swept', {team: 'Team1'});
					}else{
						calculateScore(1);
					}
					emitTeamWon(1);
				}else{
					if(swept && teamwhocalled === getTeam(alonePlayer)){
						scoreTeam2 = scoreTeam2 + 4;
						emitbroadcast('swept', {team: 'Team2'});
					}else{
						calculateScore(2);
					}
					emitTeamWon(2);
				}


				trickwinnerloner = [];
				if(scoreTeam1 >= POINT_LIMIT || scoreTeam2 >= POINT_LIMIT){
					if(scoreTeam1 > scoreTeam2){
						console.log('Team 1 wins'.green);
						emitbroadcast('endgame', {winner: 'Team 1'});
					}else{
						console.log('Team 2 wins'.green);
						emitbroadcast('endgame', {winner: 'Team 2'});
					}
				}else{
					if(gamestate.dealer === 3)
						gamestate.dealer = 0;
					else
						gamestate.dealer++;
					gamestate.round = 1;
					console.log(gamestate.handhistory);
					gamestate.handhistory = [];
					emitbroadcast('handover');
					trickTeam1 = 0;
					trickTeam2 = 0;
					cardcounter = 0;
					deal();
				}
			}
			gamestate.last_hand = [];
		}
	}

	var nextcard = function( player, lastcardplayed ){
		gamestate.last_hand.push({username: player.username, cardplayed: lastcardplayed});

		if(isloner){
			nextcardLoner(player, lastcardplayed);
			return;
		}

		if(cardcounter < 4){
			var nextplay = getNext(player.seatpos);
			nextplay.socket.emit('playcard');
			cardcounter++;
		} else {

			emitbroadcast('endround', {round: gamestate.round});
			var winninghand = findTrickWinner(gamestate.last_hand);
			gamestate.handhistory.push(winninghand);
			console.log(('winning card: ' + winninghand.cardplayed + ' playedby: ' + winninghand.username).green);

			var trickwinner = getPlayerByUsername(winninghand.username);
			var winningteam = getWinningTeam(winninghand.username);
			console.log('Winning team: ' + winningteam);
			//console.log(gamestate.hand_data);
			emitbroadcast('trickwon', {
				username: trickwinner.username, 
				team: winningteam, 
				hand: winninghand.cardplayed 
			});
			trickwinner.socket.emit('playcard');
			cardcounter = 1;

			gamestate.round++;
			if(gamestate.round === 6){
				isloner = false;
				playerLoner = [];


				if(trickTeam1 > trickTeam2){
					calculateScore(1);
					emitTeamWon(1);
				}else{
					calculateScore(2);
					emitTeamWon(2);
				}

				if(scoreTeam1 >= POINT_LIMIT || scoreTeam2 >= POINT_LIMIT){
					if(scoreTeam1 > scoreTeam2){
						console.log('Team 1 wins'.green);
						emitbroadcast('endgame', {winner: 'Team 1'});
					}else{
						console.log('Team 2 wins'.green);
						emitbroadcast('endgame', {winner: 'Team 2'});
					}
				}else{
					if(gamestate.dealer === 3)
						gamestate.dealer = 0;
					else
						gamestate.dealer++;
					gamestate.round = 1;
					console.log(gamestate.handhistory);
					gamestate.handhistory = [];
					emitbroadcast('handover');
					trickTeam1 = 0;
					trickTeam2 = 0;
					cardcounter = 0;
					deal();
				}
			}
			gamestate.last_hand = [];
		}
	}

	function calculateScore( winningTeam ){

		if(trickTeam1 > trickTeam2){
			if(teamwhocalled === winningTeam){
				scoreTeam1 = scoreTeam1 + getAll5(gamestate.handhistory);
			}else{
				console.log('Team ' + teamwhocalled + ' got euchred');
				emitbroadcast('euchred', {team: 'Team'+teamwhocalled})
				scoreTeam1 = scoreTeam1 + 2;
			}
		}else{
			if(teamwhocalled === winningTeam){
				scoreTeam2 = scoreTeam2 + getAll5(gamestate.handhistory);
			}else{
				console.log('Team ' + teamwhocalled + ' got euchred');
				emitbroadcast('euchred', {team: 'Team'+teamwhocalled})
				scoreTeam2 = scoreTeam2 + 2;
			}
		}
		console.log('Team 1++ ' + scoreTeam1);
		console.log('Team 2++ ' + scoreTeam2);
	}

	function getAll5(hand){
		var usernames = [];
		for(var i = 0; i < hand.length; i++){
			usernames.push(hand[i].username);
		}
		var team = getTeam(getPlayerByUsername(usernames[0]));
		var gotall = true;
		for(var i = 0; i < usernames.length; i++){
			if(getTeam(getPlayerByUsername(usernames[i])) !== team){
				gotall = false;
			}
		}

		if(gotall){
			return 2;
		}else{
			return 1;
		}
	}

	var disconnect = function( deadsocket ){
		//emitbroadcast('gamedropped', deadsocket.player.username);
		wasdeleted = true;
		var i = players.indexOf(deadsocket.player);
		players.remove(i);
		players.forEach(function(player) {
			console.log('kicking: ' + player.username);
			player.socket.disconnect();
		});
	}

	var isLoner = function(){
		return isloner;
	}

	var getPlayerLonerSize = function(){
		return playerLoner.length;
	}

	var setIsLoner = function( set ){
		isloner = set;
	}

	var addPlayerLoner = function( obj ){
		playerLoner.push(obj);
	}

	var setTeamCalled = function( player ){
 		if(gamestate.partners.team11.username === player.username || gamestate.partners.team12.username === player.username){
 			teamwhocalled = 1;
 		}else{
 			teamwhocalled = 2;
 		}
 		console.log('Team ' + teamwhocalled + ' called it.');
	}

	var dealerChoose = function(){
		var dealer = getPlayerBySeat(gamestate.dealer);
		console.log('dealer choose: ' + dealer.username);
		dealer.hand.push(gamestate.topcard);
		dealer.socket.emit('pick', dealer.hand);
	}

	var isrunning = function(){
		return gameready;
	}

	var getNumPlayers = function(){
		return players.length;
	}

	var isdeleted = function(){
		return wasdeleted;
	}

	var dealerName = function(){
		return getPlayerByUsername(gamestate.dealer); 
	}

	addplayer( player );

	return {
		addplayer: addplayer,
		getID: getID,
		isfull: isfull,
		broadcast: broadcast,
		emitbroadcast: emitbroadcast,
		getUserNames: getUserNames,
		deal: deal,
		getGameState: getGameState,
		getNext: getNext,
		startround: startround,
		nextcard: nextcard,
		disconnect: disconnect,
		isLoner: isLoner,
		getPlayerLonerSize: getPlayerLonerSize,
		setIsLoner: setIsLoner,
		addPlayerLoner: addPlayerLoner,
		startLonerRound: startLonerRound,
		setTeamCalled: setTeamCalled,
		dealerChoose: dealerChoose,
		removeplayer: removeplayer,
		isrunning: isrunning,
		getNumPlayers: getNumPlayers,
		isdeleted: isdeleted,
		dealerName: dealerName,
	}

/*
 * Helper funcitons
 */

 	function getTeam(player){
 		if(gamestate.partners.team11.username === player.username || gamestate.partners.team12.username === player.username){
 			return 1;
 		}else{
 			return 2;
 		}
 	}

 	function getPartner(player){
 		if(gamestate.partners.team11.username === player.username){
 			return getPlayerByUsername(gamestate.partners.team12.username);
 		}else if(gamestate.partners.team12.username === player.username){
 			return getPlayerByUsername(gamestate.partners.team11.username);
 		}else if(gamestate.partners.team21.username === player.username){
 			return getPlayerByUsername(gamestate.partners.team22.username);
 		}else{
 			return getPlayerByUsername(gamestate.partners.team21.username);
 		}
 	}

 	function emitTeamWon(teamnum){
 		if(teamnum === 1){
 			var player1 = getPlayerByUsername(gamestate.partners.team11.username);
 			var player2 = getPlayerByUsername(gamestate.partners.team12.username);
 			console.log('Team 1 won the hand'.cyan);
 			player1.socket.emit('teamwonhand', {score: scoreTeam1});
 			player2.socket.emit('teamwonhand', {score: scoreTeam1});
 		}else{
 			var player1 = getPlayerByUsername(gamestate.partners.team21.username);
 			var player2 = getPlayerByUsername(gamestate.partners.team22.username);
 			console.log('Team 2 won the hand'.cyan);
 			player1.socket.emit('teamwonhand', {score: scoreTeam2});
 			player2.socket.emit('teamwonhand', {score: scoreTeam2});
 		}
  	}

 	function getWinningTeam(username){
 		if(username === gamestate.partners.team11.username || username === gamestate.partners.team12.username){
 			var player1 = getPlayerByUsername(gamestate.partners.team11.username);
 			var player2 = getPlayerByUsername(gamestate.partners.team12.username);
 			player1.socket.emit('teamwontrick', {score: ++trickTeam1});
 			player2.socket.emit('teamwontrick', {score: trickTeam1});
 			return 'Team1';
 		} else if (username === gamestate.partners.team21.username || username === gamestate.partners.team22.username){
 			var player1 = getPlayerByUsername(gamestate.partners.team21.username);
 			var player2 = getPlayerByUsername(gamestate.partners.team22.username);
 			player1.socket.emit('teamwontrick', {score: ++trickTeam2});
 			player2.socket.emit('teamwontrick', {score: trickTeam2});
 			return 'Team2';
 		} else {
 			console.log('username not in any game'.red);
 		}
 	}

	function findTrickWinner( roundkeep ){
		gamestate.hand_data = gamestate.last_hand;
		var leadsuit = gamestate.hand_data[0].cardplayed.charAt(1);
		var trump = gamestate.trump;

		var leading = gamestate.hand_data[0].cardplayed;
		var tempcard = null;
		for(var i = 0; i < gamestate.hand_data.length; i++){
			var card = gamestate.hand_data[i].cardplayed;
			if(checkRight(card)){
				tempcard = card;
				card = "R" + gamestate.trump;
			}

			if(card.charAt(1) === trump || checkRight(card) ){
				if((leading.charAt(1) !== trump) || checkRight(leading)){
					leading = card;
				} else {
					if(getvalue(card) > getvalue(leading)){
						leading = card;
					}
				}
			} else if (card.charAt(1) === leadsuit){
				if(leading.charAt(1) === leadsuit){
					if(getvalue(card) > getvalue(leading)){
						leading = card;
					}
				} else if( leading.charAt(1) !== trump || checkRight(leading)){
					leading = card;
				}
			}
		}
		if(leading.charAt(0) === 'R'){
			leading = tempcard;
		}
		var winninghand = findOwner(leading, gamestate.hand_data);
		return winninghand;

	}

	function checkRight(jack){
		if( jack.charAt(0) === 'J' && jack.charAt(1) === getOppositeTrump(gamestate.trump)){
			//console.log(jack + ' is the right bower');
			return true;
		}
		return false;
	}

	function getPlayerByUsername(username){
		for(var i = 0; i < players.length; i++){
			if(players[i].username == username){
				return players[i];
			}
		}
	}

	function findOwner(card, hand){
		for(var i = 0; i < hand.length; i++){
			if(hand[i].cardplayed == card){
				return hand[i];
			}
		}
	}

	function getvalue(card){
		switch(card.charAt(0)){
			case '9':
				return 9;
				break;
			case 'T':
				return 10;
				break;
			case 'J':
				if(card.charAt(1) === gamestate.trump){
					return 16;
				} else if (card.charAt(1) === getOppositeTrump( gamestate.trump )){
					return 15;
				} else {
					return 11;
				}
				break;
			case 'Q':
				return 12;
				break;
			case 'K':
				return 13;
				break;
			case 'A':
				return 14;
				break;
			case 'R':
				return 15;
				break;
		}
	}
	function shuffle(array) {
		var currentIndex = array.length
			, temporaryValue
			, randomIndex;

		// While there remain elements to shuffle...
		while (0 !== currentIndex) {

			// Pick a remaining element...
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex -= 1;

			// And swap it with the current element.
			temporaryValue = array[currentIndex];
			array[currentIndex] = array[randomIndex];
			array[randomIndex] = temporaryValue;
		}

		return array;
	}
	function getOppositeTrump(trump) {
		if( trump === 'H' ) return 'D';
		if( trump === 'D' ) return 'H';
		if( trump === 'S' ) return 'C';
		if( trump === 'C' ) return 'S';
	}

	function makeid() {
		var text = "";
		var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

		for( var i=0; i < 5; i++ )
			text += possible.charAt(Math.floor(Math.random() * possible.length));

		return text;
	};

	function getUserNames() {
		var names = []
		for(var i=0; i<players.length; i++){
			names.push(players[i].username);
		}
		return names;
	}

	function startGame() {
		var new_player = players[Math.floor(Math.random()*players.length)];
		new_player.isdealer = true;
		gamestate.dealer = new_player.seatpos;
		//console.log('Dealer pos: ' + new_player.seatpos);

		//set up partners
		switch(new_player.seatpos){
			case 0:
				gamestate.partners.team11 = new_player.toObj();
				gamestate.partners.team12 = getPlayerBySeat(2).toObj();
				gamestate.partners.team21 = getPlayerBySeat(1).toObj();
				gamestate.partners.team22 = getPlayerBySeat(3).toObj();
				break;
			case 1:
				gamestate.partners.team11 = new_player.toObj();
				gamestate.partners.team12 = getPlayerBySeat(3).toObj();
				gamestate.partners.team21 = getPlayerBySeat(0).toObj();
				gamestate.partners.team22 = getPlayerBySeat(2).toObj();
				break;
			case 2:
				gamestate.partners.team11 = new_player.toObj();
				gamestate.partners.team12 = getPlayerBySeat(0).toObj();
				gamestate.partners.team21 = getPlayerBySeat(3).toObj();
				gamestate.partners.team22 = getPlayerBySeat(1).toObj();
				break;
			case 3:
				gamestate.partners.team11 = new_player.toObj();
				gamestate.partners.team12 = getPlayerBySeat(1).toObj();
				gamestate.partners.team21 = getPlayerBySeat(2).toObj();
				gamestate.partners.team22 = getPlayerBySeat(0).toObj();
				break;
		}
		console.log( ('Team 1: ' + gamestate.partners.team11.username + ' & ' + gamestate.partners.team12.username).red + ' gameid' + id);
		console.log( ('Team 2: ' + gamestate.partners.team21.username + ' & ' + gamestate.partners.team22.username).blue + ' gameid' + id);
		var player11 = getPlayerByUsername(gamestate.partners.team11.username);
		var player12 = getPlayerByUsername(gamestate.partners.team12.username);
		var player21 = getPlayerByUsername(gamestate.partners.team21.username);
		var player22 = getPlayerByUsername(gamestate.partners.team22.username);

		emitbroadcast('init-board', {
			player11: {username: player11.username, seatpos: player11.seatpos},
			player12: {username: player12.username, seatpos: player12.seatpos},
			player21: {username: player21.username, seatpos: player21.seatpos},
			player22: {username: player22.username, seatpos: player22.seatpos},
		});
		deal();
	}

	function getPlayerBySeat(pos){
		for(var i=0; i<players.length; i++){
			if(players[i].seatpos == pos){
				return players[i];
			}
		}
		console.log('no one sitting in ' + pos);
	}

	function createNewDeck(){
		deck = ['9H','TH','JH','QH','KH','AH',
					'9D','TD','JD','QD','KD','AD',
					'9S','TS','JS','QS','KS','AS',
					'9C','TC','JC','QC','KC','AC'];

		deck = shuffle(deck);
	}
}

exports.Game = Game;