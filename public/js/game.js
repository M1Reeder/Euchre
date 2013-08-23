$(document).ready( function() {
	var name;
	var counter;
	$('#loner').hide();
	var socket = io.connect(window.location.hostname);

	socket.on('connect', function() {
		$('#hand').empty();
		$('#turn-input').empty();
		$('#score').html(0);
		$('#trick').html(0);
		$('#trump').empty();
		$('#loner').hide();

		$('#turn-input').empty();
		name = $('#name').html().trim();
		//if(name === ''){
			name = prompt('Who are you?','name');
		//}
		$('#name').html(name);
		socket.emit('addme', name);
	});

	socket.on('chat',function(username, data) {
		var p = document.createElement('p');
		p.innerHTML = '> ' + username + ': ' + data;
		$('#output').prepend(p);
	});

	socket.on('gameready', function( data ){
		console.log( data.usernames );
	});

	socket.on('hand', function( hand ){
		$('#hand').empty();
		$('#hand').append( 'HAND: <br>');
		$.each(hand, function(index, value){
			if(value.charAt(1) === 'H' || value.charAt(1) === 'D'){
				$('#hand').append('<button class="card alert" disabled>' + value + '</button>');
			}else{
				$('#hand').append('<button class="card" disabled>' + value + '</button>');
			}
		});
		console.log( hand );
	});

	var topcard = null;
	var dealer = null;
	socket.on('dealend', function( data ){
		topcard = data.topcard;
		dealer = data.dealer;
		console.log(data);
		var p = document.createElement('p');
		p.innerHTML = 'DEAL COMPLETE top Card: <b>' + data.topcard + '</b><br> DEALER: <b>' + data.dealer + '</b>';
		$('#output').prepend(p);
	});

	socket.on('choosecard', function(data){
		$('#turn-input').append('<p> have <b>' + dealer + '</b> pick up <b>' + topcard + '</b> and make <b>' + getSuite(topcard) + '</b> trump?</p>');
		$('#turn-input').append('<button id="yes-card">Yes</button> <button id="no-card">No</button>');
	});

	function getSuite(card){
		return card.charAt(1);
	}

	socket.on('trumpfound', function(trump){
		$('#output').prepend('<p>Trump found: ' + trump + '</p>');
		$('#trump').empty();
		$('#trump').html("trump: " + trump);
		var count = 10;
		counter = setInterval(timer, 500); //1000 will  run it every 1 second
		$('#loner').show();
		$('#loner').css('background', 'red');
		$('#turn-input').append('<button id="loner-btn">GO ALONE?</button>');
		function timer() {
			count=count-1;
			if (count <= 0){
				$('#loner').css({'width':  ((count*10).toString() + 'px')});
				$('#loner').css({'height':  '10px'});
				clearInterval(counter);
				$('#loner').hide();
				$('#turn-input').empty();
				socket.emit('loner', {loner: 'no'});
			} else {
				$('#loner').css({'width':  ((count*10).toString() + 'px')}).css({'height':  '10px'});
			}
		}

	});

	socket.on('pass', function( username ){
		$('#output').prepend('<p>' + username + ' passed</p>');
	});

	socket.on('choosesuit', function(){
		$('#turn-input').append('<button id="H-call">Hearts</button> <button id="S-call">Spades</button> <button id="D-call">Dimonds</button> <button id="C-call">Clubs</button> <button id="P-call">PASS</button>');
	});

	socket.on('forcesuit', function(){
		$('#turn-input').append('<button id="H-call">Hearts</button> <button id="S-call">Spades</button> <button id="D-call">Dimonds</button> <button id="C-call">Clubs</button>');
	});

	socket.on('playcard', function(){
		$('.card').prop('disabled', false);
	});

	socket.on('init-board', function(teamdata){
		var curname = $('#name').html();
		var players = [ teamdata.player11,
						teamdata.player12,
						teamdata.player21,
						teamdata.player22 ];
		var curplayer;
		
		if( players[0].username === curname ){
			curplayer = players[0].username;
			place(2, players[1].username);
			place(1, players[2].username);
			place(3, players[3].username);
		} else if( players[1].username === curname ){
			curplayer = players[1].username;
			place(2, players[0].username);
			place(1, players[2].username);
			place(3, players[3].username);			
		} else if( players[2].username === curname ){
			curplayer = players[2].username;
			place(2, players[3].username);
			place(1, players[0].username);
			place(3, players[1].username);
		} else if( players[3].username === curname ){
			curplayer = players[3].username;
			place(2, players[2].username);
			place(1, players[0].username);
			place(3, players[1].username);
		}

		console.log(curplayer);
	});

	function place(seatn, string){
		$('#seat-'+seatn).empty();
		$('#seat-'+seatn).html(string);
	}

	var firstcard = false;
	socket.on('cardplayed', function(data){
		$('#output').prepend('<p><b>' + data.cardplayed + '</b> played ' + data.username + '</p>');
		if(firstcard){
			$('#board').empty();
			firstcard = false;
		}
		writeBoard(data.cardplayed);
	});

	socket.on('endround', function(data) {
		//$('#output').prepend('<p> End of round: ' + data.round + '</p>');
	});

	socket.on('trickwon', function(data) {
		$('#output').prepend('<p><b>' + data.username + '</b> won trick with <b>' + data.hand + '</b> : ' + data.team + '</p>');
		$('#board').html('');
		writeBoard(data.username + ' won with <b>' + data.hand + '</b>');
		firstcard = true;
	});

	function writeBoard(string){
		$('#board').html($('#board').html() + ' ' + string);
	}

	socket.on('teamwontrick', function(data) {
		$('#tricks').empty();
		$('#tricks').html(data.score);
	});

	socket.on('handover', function(){
		//data.teamscore
		$('#tricks').empty();
		$('#tricks').html(0);

		$('#output').prepend('<p> Hand Over </p>');
	});

	// socket.on('gamedropped', function(name){
	// 	//alert(name + ' disconnected, re-pooling you');
	// 	location.reload();
	// });

	socket.on('disconnect', function(data){
		console.log('youve been disconnected');
		location.reload();
	});

	socket.on('teamwonhand', function(data){
		$('#output').prepend('<p>Your team won that trick</p>');
		$('#score').empty();
		$('#score').html(data.score);
		$('#trump').empty();
	});

	socket.on('endgame', function(data){
		$('#output').prepend('<p>' + data.winner + ' won the game</p>');
	});

	socket.on('lonerfound', function(data){
		$('#output').prepend('<p>' + data.username + ' is going alone</p>');
		clearInterval(counter);
		$('#loner').hide();
		$('#turn-input').empty();
		socket.emit('loner', {loner: 'no'});
	});

	socket.on('euchred', function(data){
		$('#output').prepend('<p>' + data.team + 'got euchred</p>');
		writeBoard(data.team + ' got <b>EUCHRED</b>');
	});

	socket.on('swept', function(data){
		printOutput(data.team + ' was swpet.');
	});

	socket.on('pick', function(hand){
		$('#hand').empty();
		$.each(hand, function(index, value){
			if(value.charAt(1) === 'H' || value.charAt(1) === 'D'){
				$('#hand').append('<button class="card-to-pick alert">' + value + '</button>');
			}else{
				$('#hand').append('<button class="card-to-pick">' + value + '</button>');
			}
		});
		printOutput('<b>Choose a card to discard</b>');
	});

	$('.card-to-pick').live('click', function(){
		$('.card-to-pick').prop('disabled', true);
		socket.emit('removecard', {card: $(this).text()});
	});
	$('.card').live('click', function(usename){
		socket.emit('cardplayed', {card: $(this).text()});
		$(this).remove();
		$('.card').prop('disabled', true);
	});
	$('#H-call').live('click', function(){
		$('#turn-input').empty();
		socket.emit('choosesuit', {suit: 'H'});
	});
	$('#S-call').live('click', function(){
		$('#turn-input').empty();
		socket.emit('choosesuit', {suit: 'S'});
	});
	$('#C-call').live('click', function(){
		$('#turn-input').empty();
		socket.emit('choosesuit', {suit: 'C'});
	});
	$('#D-call').live('click', function(){
		$('#turn-input').empty();
		socket.emit('choosesuit', {suit: 'D'});
	});
	$('#P-call').live('click', function(){
		$('#turn-input').empty();
		socket.emit('choosesuit', {suit: 'P'});
	});

	$('#yes-card').live('click', function(){
		socket.emit('choosecard', {choosecard: 'yes'});
		$('#turn-input').empty();
	});
	$('#no-card').live('click', function(){
		socket.emit('choosecard', {choosecard: 'no'});
		$('#turn-input').empty();
	});

	$('#loner-btn').live('click', function(){
		socket.emit('loner', {loner: 'yes'});
		$('#loner').hide();
		$('#turn-input').empty();
	});

	$('#sendtext').click( function() {
		var text = $('#data').val();
		socket.emit('sendchat', text);
		$('#data').val('');
	});

	function printOutput(message){
		$('#output').prepend('<p> ' + ' </p>')
	}
});