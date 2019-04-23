/*
 * OH HECK - Card Game
 * Originally written by Justin Miller on 6.10.2012
 * Converted to Node.js by Justin Miller on 9.1.2017
 * Last updated by Justin Miller on 3.30.2019
 */


// Globals
var COOKIE_NAME = 'oheck';

var oh = {
	ANIMATION_SPEED: 500,
	CARD_PADDING: 18,
	CARD_SIZE: {
		width: 71,
		height: 96
	},
	CARDBACK: {
		x: 0,
		y: -4 * 96	// -4 * this.CARD_SIZE.height
	},
	CONDENSE_COUNT: 6,
	HCARDBACK: {
		x: -8 * 96,	// -8 * this.CARD_SIZE.height
		y: -5 * 96	// -5 * this.CARD_SIZE.height
	},
	HORIZONTAL_MARGIN: 70,	// PLAYER WIDTH (60) + HORIZONTAL PADDING (10)
	OVERLAY_MARGIN: 2,
	PILE_POS: {
		left: 720 * 0.5,			// this.DECK_POS.left + 1.3 * this.CARD_SIZE.width
		top: 620 * 0.5 - 96 * 0.5	// this.DECK_POS.top
	},
	TAKE_TRICK_DELAY: 750,
	VERTICAL_MARGIN: 96,	// PLAYER HEIGHT (68) + PLAYER LABEL (18) + HORIZONTAL PADDING (10)
	zIndexCounter: 1
};

var PLAYER_POSITIONS = [
  // 0 players
  [],
  // 1 player
  ['bottom'],
  // 2 players
  ['bottom', 'top'],
  // 3 players
  ['bottom', 'left', 'right'],
  // 4 players
  ['bottom', 'left', 'top', 'right'],
  // 5 players
  ['bottom', 'left', 'topLeft', 'topRight', 'right'],
  // 6 players
  ['bottomLeft', 'left', 'topLeft', 'topRight', 'right', 'bottomRight']
];

var g = {
	game: {},
	history: [],
  oheck: {},
	queue: [],
  socket: null,
  user: {
    id: null,
    name: null,
		socketId: null
  },
  users: [],
	waiting: false
}

// Start Bid event
// This event fires before each player has to bid
// io.in('game').emit('startBid', {game: game, tricks: numTricks, playerId: playerId, isDealer: true/false, cannotBid: numBids});
function startBid(data){
	$('#bid div').remove();
	for (var i = 0; i <= data.tricks; i++){
		// Force dealer
		if (data.isDealer && i === data.cannotBid){
			$('<div/>').text(i).addClass('cannotBid').appendTo('#bid');
		}
		else {
			$('<div/>').text(i).appendTo('#bid').click(function(e){
				g.socket.emit('playerBid', {playerId: data.playerId, bid: parseInt($(this).text())});
				$('#bid').hide();
			});
		}
	}
	$('#bid').fadeIn();
}


$(window).on('load', function(){

  /**
   * SOCKET.IO EVENTS
   */

  // Connect to Socket.IO
  g.socket = io();


	// This event fires on socket connection
	// socket.emit('init', {users: users, game: game, history: history});
  g.socket.on('init', function(data){
    g.users = data.users;
    g.game = data.game;
		g.history = data.history;

		// Check if user is already logged in
		if (Cookies.getJSON(COOKIE_NAME)){

			// Broadcast to other users
			// This also triggers the socket joining the "game" room
			g.socket.emit('userJoined', {user: g.user});

			// Send user to game if game is in progress
			if (g.game.active){
				$('#content-section, #welcome, #game-board').slideToggle();
				// Call this AFTER DOM manipulation so card positioning is correct
				loadGameBoard();
      }
			// Send user to lobby if game is not in progress
			else{
				updateUsersInLobby();
				$('#content-section, #welcome, #lobby').slideToggle();
			}
    }
  });


	// This event fires after user logs in
	// socket.emit('myUserLogin', {userId: data.user.id, users: users});
  g.socket.on('myUserLogin', function(data){
		g.user.id = data.userId;
    g.users = data.users;

    // Save to cookie
    Cookies.set(COOKIE_NAME, g.user);
    updateUsersInLobby();
  });

	// Alert individual user
	g.socket.on('showMessage', function(data){
		document.querySelector('#snackbar-message')
			.MaterialSnackbar.showSnackbar({
				message: data.message,
				timeout: 1500
		});
	});

	// This event fires when user joins
	// io.in('game').emit('userJoined', {userId: data.user.id, users: users});
  g.socket.on('userJoined', function(data){
    g.users = data.users;
    if (g.users[data.userId - 1]){
      console.log('UserId ' + data.userId + ' (' + g.users[data.userId - 1].name + ') has joined');
    }
		updateUsersInLobby();
  });

	// This event fires when user logs out or disconnects
	// socket.to('game').emit('userDisconnect', {userId: userId, users: users});
	g.socket.on('userDisconnect', function(data){
    if (g.users[data.userId - 1] && g.users[data.userId - 1].name){
      console.log('UserId ' + data.userId + ' (' + g.users[data.userId - 1].name + ') disconnected');
    }
    g.users = data.users;
    updateUsersInLobby();
  });

	// This event fires when admin user forces reload
	// io.in('game').emit('forceReloadAll', 'Force Reload All');
  g.socket.on('forceReloadAll', function(data){
    console.log('Force Reload All');
		window.location.reload();
  });


	/*
	 * This event fires when any game event occurs
	 * "data" is an array of one or more events to fire
	 */
	g.socket.on('event', function(data){

		// Loop through one or more events and add each event to queue
		for (var i = 0; i < data.length; i++){
			console.log('Received event ' + data[i].op + ' from server');
			g.history.push(data[i]);
			g.queue.push(data[i]);
//			addQueueEvent(data[i]);
		}

		// Trigger next event in queue
		runQueueEvent();
	});

/*	// Add event to queue
	function addQueueEvent(evt){
		g.history.push(evt);
		g.queue.push(evt);
	}*/

	// Run event from queue
	function runQueueEvent(){

		// Exit if another event is already in progress or if queue is empty
		if (g.waiting || g.queue.length === 0) return;

		// Set waiting status
		var opsList = [];
		for (var i = 0; i < g.queue.length; i++){
			opsList.push(g.queue[i].op);
		}
		g.waiting = true;

		// Pop next event from top of queue
		var data = g.queue.shift();

		// Trigger event
		switch (data.op){
			case 'dealHand':
				dealHand(data);
				break;
			case 'endGame':
				endGame(data);
				break;
			case 'finishRound':
				finishRound(data);
				break;
			case 'playCard':
				playCard(data);
				break;
			case 'playerBid':
				playerBid(data);
				break;
			case 'showDealButton':
				showDealButton(data);
				break;
			case 'showScoreboard':
				showScoreboard(data);
				break;
			case 'startBid':
				startBid(data);
				break;
			case 'startGame':
				startGame(data);
				break;
			case 'startPlay':
				startPlay(data);
				break;
			case 'takeTrick':
				takeTrick(data);
				break;
			default:
				break;
		}

		// Ready for next event
		g.waiting = false;
		runQueueEvent();
	}



	/*
	 * GAME EVENTS
	 */

	// Deal Hand event
	// This event fires when the dealer presses "deal" at the beginning of each round
	// io.in('game').emit('dealHand', {game: game});
	function dealHand(data){
    updateData(data);
		updateGameStats();

		// Hide scoreboard
		$.modal.close();

		// Remove cards from previous hand
		$('#game-board div.card, #game-board div.verticalTrick, #game-board div.horizontalTrick').remove();

		// Create new deck
		var deck = [];

 		// Set position / seat arrangement
 		var pos = g.oheck.nextPlayerToDealTo;
 		var playersHands = Array();
 		for (var i = 0; i < g.oheck.players.length; i++){
 			var tPlayerId = (i + pos) % g.oheck.players.length;
 			var thisHand = g.game.players[tPlayerId].hand;
 			playersHands.push(thisHand);
 		}

 		// Round robin cards from players hands to sort deck
 		// This allows us to distribute in reverse order
 		for (var i = 0; i < g.game.round.numTricks; i++){
 			for (var j = 0; j < playersHands.length; j++){
 				var cardStr = playersHands[j].shift();
 				var suit = cardStr.substring(0,1);
 				var num = cardStr.substring(1);
 				deck.unshift(new Card(suit, num));
 			}
 		}

 		// Create cardpile
 		var left = ($('#game-board').width() - 71) / 2;
 		var top = ($('#game-board').height() - 96) / 2;
 		for (var i = 0; i < deck.length; i++){
 			var card = deck[i];
 			if ((i + 1) % oh.CONDENSE_COUNT == 0){
 				left -= oh.OVERLAY_MARGIN;
 				top -= oh.OVERLAY_MARGIN;
 			}

 			// Create GUI card
 			var divCard = $('<div>').addClass('card').css({
 				"left": left,
 				"top": top
 			});
 			$('#game-board').append(divCard[0]);
 			card.guiCard = divCard[0];
 			divCard[0].card = card;
 			card.moveToFront();
 			card.hideCard('bottom');
 		}

 		// Deal next card
		var numCards = deck.length;
		for (var i = 0; i < numCards; i++){
	 		var card = deck.pop();
	 		var player = g.oheck.players[g.oheck.nextPlayerToDealTo];
	 		player.hand.push(card);
	 		g.oheck.nextPlayerToDealTo = g.oheck.nextIndex(g.oheck.nextPlayerToDealTo);
			player._adjustHand(function(){}, 50, true, g.game.round.numTricks);
		}

		g.oheck.afterDealing();
  }


	// End Game event
	// This event is broadcast after the last round if there is no tie
	// io.in('game').emit('endGame', {playerId: winnerPlayerId});
	function endGame(data){
    console.log('EndGame');
		setTimeout("window.location.reload();", 15000);
  }


	// Finish Round event
	// This event is broadcast after the last trick in a round is played
	// io.in('game').emit('finishRound', {game: game});
	function finishRound(data){
		updateData(data);
		g.oheck.pile = [];
		g.oheck.dealerIndex = g.oheck.nextIndex(g.oheck.dealerIndex);
		g.oheck.nextPlayerToDealTo = g.oheck.nextIndex(g.oheck.dealerIndex);
		g.oheck.currentPlayerIndex = g.oheck.nextIndex(g.oheck.dealerIndex);

		// Update players for next round
		for (var i = 0; i < g.oheck.players.length; i++){
			var p = g.oheck.players[i];

			// Clear player hand and bid
			var name = $('#' + p.id + ' small').text().split(" (");
			$('#' + p.id + ' small').text(name[0]);
			p.tricks = [];
			p.handSorted = false;
		}

		updateScoreboard();
	}


	// Play Card event
	// This event is broadcast after a player plays a card in the current trick
	// io.in('game').emit('playCard', {playerId: data.playerId, card: data.card, game: game});
	function playCard(data){
    updateData(data);

    // Find card in my hand
    var player = g.oheck.players[data.playerId];
    for (var i = 0; i < player.hand.length; i++){
      if (data.card == (player.hand[i].suit + player.hand[i].rank)){
        g.oheck.playCard(player, player.hand[i]);
        break;
      }
    }
  }


	// PlayerBid event
	// This event is broadcast after a player bids
	// io.in('game').emit('playerBid', {playerId: data.playerId, bid: currentBid, game: game, players: numPlayers});
	function playerBid(data){
    updateData(data);
		updateGameStats();
		// Determine table position based on my playerId
		var positionId = (data.players + data.playerId - g.user.id + 1) % data.players;
		$('#player-position-' + positionId + ' small').append(' (' + data.bid + ')');
  }


	// Show Deal Button event
	// This event is broadcast at the beginning of the game and after the last card in each round
	// io.in('game').emit('showDealButton');
	function showDealButton(data){
		$('#deal').show();
	}


	// Show Scoreboard event
	// This event is broadcast after the last trick in a round is played
	// io.in('game').emit('showScoreboard');
	function showScoreboard(data){
		$('#scoreboard-dialog').modal();
		setTimeout("$.modal.close()", 10000);
	}


	// Start Game event
 	// This event fires when the first player creates a new game
	// io.in('game').emit('startGame', {game: game});
	function startGame(data){
		updateData(data);
		$.modal.close();
    $('#lobby, #game-board').slideToggle();
		// Call this AFTER DOM manipulation so card positioning is correct
		loadGameBoard();
  }

	// Start Play event
 	// This event fires after the last person bids
	// io.in('game').emit('startPlay', {});
	function startPlay(data){
		$('.card').click(function(){
			g.socket.emit('playCard', {playerId: g.game.playerId, card: (this.card.suit + this.card.rank)});
		});
  }

	// Take Trick event
	// This event is broadcast after the last card in a trick is played
	// io.in('game').emit('takeTrick', {playerId: highCardSeat, game: game});
	function takeTrick(data){
		updateData(data);
		var winnerIndex = data.playerId;
		g.oheck.currentPlayerIndex = winnerIndex;
		g.oheck.players[g.oheck.currentPlayerIndex].tricks.push(g.oheck.pile.slice(0));
		var oldPile = g.oheck.pile;
		g.oheck.pile = [];
		console.log('PlayerId ' + winnerIndex + ' wins trick');
		g.oheck.renderEvent('taketrick', { trick: oldPile }, function (){});
	}



  /**
   * Lobby functions
   */

  // Sign in
  // Wait to save cookie until server response via "myUserLogin" socket event
  $('#sign-in-form').submit(function(e){
    e.preventDefault();
    g.user.name = this.name.value;
    g.socket.emit('userLogin', {user: g.user});
    updateUsersInLobby();
    $.modal.close();

		// Delete login form and show logout button now that user is logged in
		$('#login').remove();
		$('#show-logout').show();

    // Show lobby
		$('#content-section, #welcome, #lobby').slideToggle();
  });


  // Logout
  // Have to use a delegated event because the button ID does not exist when document.onReady event fires initially
  // http://api.jquery.com/on/#direct-and-delegated-events
  // http://api.jquery.com/delegate/
  $(document).on('click', '#logout-button', function(e){
    e.preventDefault();
    g.socket.emit('userLogout', {userId: g.user.id});
    Cookies.remove(COOKIE_NAME);
    location.reload();
  });


  // Start Game
  // Have to use a delegated event because the button ID does not exist when document.onReady event fires initially
  // http://api.jquery.com/on/#direct-and-delegated-events
  // http://api.jquery.com/delegate/
  $(document).on('click', '#start-game-button', function(e){
    e.preventDefault();
    g.socket.emit('startGame');
  });


  /**
   * GAME FUNCTIONS
   */

  function createPlayers(){
    var players = [],
      p = null,
      h = '',
      thisPlayer = null,
      PLAYER_SETUP = {
        top: {
          top: oh.VERTICAL_MARGIN,
          left: $('#game-board').width() / 2,
          align: 'h'
        },
        topLeft: {
          top: oh.VERTICAL_MARGIN,
          left: $('#game-board').width() * 0.3,
          align: 'h'
        },
        topRight: {
          top: oh.VERTICAL_MARGIN,
          left: $('#game-board').width() * 0.7,
          align: 'h'
        },
        left: {
          top: $('#game-board').height() / 2,
          left: oh.HORIZONTAL_MARGIN,
          align: 'v'
        },
        right: {
          top: $('#game-board').height() / 2,
          left: $('#game-board').width() - oh.CARD_SIZE.height - oh.HORIZONTAL_MARGIN,
          align: 'v'
        },
        bottom: {
          top: $('#game-board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN,
          left: $('#game-board').width() / 2,
          align: 'h'
        },
        bottomLeft: {
          top: $('#game-board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN,
          left: $('#game-board').width() * 0.3,
          align: 'h'
        },
        bottomRight: {
          top: $('#game-board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN,
          left: $('#game-board').width() * 0.7,
          align: 'h'
        }
      };


    // Add HTML blocks for each player
    for (var i = 0; i < g.game.players.length; i++){
      h += '<div id="player-position-' + i + '" class="avatar">';
			h += '<div class="userPic"></div>';
			h += '<small></small>';
			h += '</div>';
    }
    $('#playersBlock').html(h);


    // Create players on game board
    for (var i = 0; i < g.game.players.length; i++){
      thisPlayer = g.game.players[(g.game.playerId + i) % g.game.players.length];

			// Create new player, and only show cards if playerId is zero
			p = new Player(i === 0);
      p.id = 'player-position-' + i;
      p.position = PLAYER_POSITIONS[g.game.players.length][i];  // top, bottom, left, right, etc
      p.top = PLAYER_SETUP[p.position].top;
      p.left = PLAYER_SETUP[p.position].left;
      p.align = PLAYER_SETUP[p.position].align;
      players.push(p);

      // Add player name and avatar
			$('#' + p.id + ' div').addClass('player-' + ((g.game.playerId + i) % g.game.players.length + 1));
      $('#' + p.id + ' small').text(thisPlayer.name);
    }

    // Do this separately because we want YOUR player to be added first (bottom of screen)
		// This means all players needed to be added to "players" array (above) before then can be added to the g.oheck object
    for (var i = 0; i < g.game.players.length; i++){
      var playerId = (players.length + i - g.game.playerId) % players.length;
			g.oheck.players.push(players[playerId]);
    }
  }

	// Highlight current player's turn
	function highlightCurrentPlayer(){
		// Determine what "positionId" playerId (g.game.currentPlayerId) is in, so we can "highlight" their turn
		var playerPositionToHighlight = (g.game.players.length + g.game.currentPlayerId - g.game.playerId) % g.game.players.length;
		$('.avatar').removeClass('active');
		$('#player-position-' + playerPositionToHighlight).addClass('active');
	}

  function loadGameBoard(){
  	g.oheck = new OHeck();
		showAdminButtons();
		showScoreboardButton();

    // Setup event renderers
		g.oheck.renderers['play'] = webRenderer.play;
		g.oheck.renderers['sorthand'] = webRenderer.sortHand;
		g.oheck.renderers['taketrick'] = webRenderer.takeTrick;

    // Setup deal handler
    $('#deal').click(function(e){
      $(this).hide();
      g.socket.emit('dealHand');
    });

    // Preload images
    var imgs = ['horizontal-trick', 'vertical-trick'];
    var img = new Image();
    for (var i = 0; i < imgs.length; i++){
      img.src = 'img/' + imgs[i] + '.png';
    }

		// Setup game board
    if (g.game.players.length > 4){
      $('#wrapper').addClass('wide');
    }
    $('#game-board').addClass('players-' + g.game.players.length);

    // Setup seats and players
    g.game.playerId = g.user.id - 1;
    console.log('My position: ' + (g.game.playerId + 1) + '/' + g.game.players.length);

    // Create players, scoreboard, and game
		// First person who joined the game bids first
    // Last person who joined the game deals first
    createPlayers();
    updateScoreboard();
    g.oheck.dealerIndex = g.game.players.length - 1;
    g.oheck.nextPlayerToDealTo = g.oheck.nextIndex(g.oheck.dealerIndex);

		// Highlight current player
		highlightCurrentPlayer();
  }

	// Show "admin" buttons for first user
	function showAdminButtons(){
		if (g.user.id !== 1) return;

		// Force Reload All
		$('#show-force-reload-all')
			.show()
			.click(function(e){
				e.preventDefault();
				g.socket.emit('forceReloadAll', 'Force reload for all clients');
			});
	}

	// Show "scoreboard" button
	function showScoreboardButton(){
		$('#show-scoreboard').show();
	}

	// Show "start game" button to first user when there are 2-6 users waiting
	function showStartGameButton(){
		if (g.user.id !== 1) return;

		var usersOnline = $('#usersOnline li').length;
    if (usersOnline >= 2 && usersOnline <= 6){
      $('#start-game-button').removeAttr('disabled', 'disabled');
    }
    else {
      $('#start-game-button').attr('disabled', 'disabled');
    }
	}

	// Update game data from backend server
  function updateData(data){
    g.game = data.game;
    g.game.playerId = g.user.id - 1;
		highlightCurrentPlayer();
  }

	// Update scoreboard
	function updateScoreboard(){

		// Get player scores
    var pScores = [];
		for (var i = 0; i < g.game.players.length; i++){
			pScores.push({id: i, name: g.game.players[i].name, score: g.game.players[i].score});
		}

    // Sort players by score DESC
		pScores.sort(function(a,b){ return parseInt(b.score) - parseInt(a.score) });

		// Build and show HTML
    var scoreboardHTML = '';
    for (var i = 0; i < pScores.length; i++){
      var pSorted = pScores[i];
      scoreboardHTML += '<tr>';
      scoreboardHTML += '<td class="mdl-data-table__cell--non-numeric">' + pSorted.name + '</td>';
      scoreboardHTML += '<td class="mdl-data-table__cell--non-numeric">' + pSorted.score + '</td>';
      scoreboardHTML += '</tr>';
    }
    $('#scoreboard-dialog table tbody').html(scoreboardHTML);
	}

	// Update game stats board
	function updateGameStats(){
		$('#quickStats #round').text(g.game.currentRoundId);
		$('#quickStats #bids').text(g.game.round.currentBid);
		$('#quickStats #trump').removeClass().addClass('suit-' + g.game.round.trump);
	}

	// Update users in lobby
  function updateUsersInLobby(){
		showAdminButtons();

    var usersHtml = '';
    for (var i in g.users){
      var user = g.users[i];
			if (user !== null){
	      usersHtml += '<li class="mdl-list__item mdl-list__item--two-line">';
	      usersHtml += '<span class="mdl-list__item-primary-content">';
	      usersHtml += '<span class="player-avatar player-' + user.id + '"></span>';
	      usersHtml += '<span>' + user.name + '</span>';
	      usersHtml += '<span class="mdl-list__item-sub-title"> </span>';
	      usersHtml += '<span class="mdl-list__item-sub-title">User ID: ' + user.id + '</span>';
	      usersHtml += '</span></li>';
			}
    }
    $('#usersOnline').html(usersHtml);

		showStartGameButton();
  }

	// If user is logged in, grab user info from cookie, delete login form, and show logout button
	if (Cookies.getJSON(COOKIE_NAME)){
		g.user = Cookies.getJSON(COOKIE_NAME);
		showAdminButtons();
		$('#login').remove();
		$('#show-logout').show();
	}

	// If user is not logged in, trigger login dialog on button click
	else {
		$('#get-started-button-action').click(function(e){
			e.preventDefault();
			$('#login-dialog').modal();
		});
	}

});




/**
 * This section originally copied from game.js
 */
 /*
  * OH HECK
  * Written by Justin Miller on 6.10.2012
  */


 function $A(arr){
 	return {
 		arr: arr,
 		each: function (func){
 			for (var i = 0; i < this.arr.length; i++){
 				func.call(this.arr, this.arr[i]);
 			}
 		},
 		remove: function (item){
 			for (var i = 0; i < this.arr.length; i++){
 				if (this.arr[i] == item){
 					this.arr.splice(i, 1);
 					return true;
 				}
 			}
 			return false;
 		}
 	};
 }

 function Card(suit, rank){
 	this.init(suit, rank);
 }
 Card.prototype = {
 	init: function (suit, rank){
 		this.suit = suit;
 		this.rank = parseInt(rank,10);
 	},
 	hideCard: function (position){
 		var h = $(this.guiCard).height(),
 			w = $(this.guiCard).width();
 		if (position == 'top' || position == 'topLeft' || position == 'topRight' || position == 'bottom' || position == 'bottomLeft' || position == 'bottomRight'){
 			$(this.guiCard).setBackground(oh.CARDBACK.x + 'px', oh.CARDBACK.y + 'px');
 			if (w > h){
 				$(this.guiCard).height(w).width(h);
 			}
 		} else {
 			$(this.guiCard).setBackground(oh.HCARDBACK.x + 'px', oh.HCARDBACK.y + 'px');
 			if (h > w){
 				$(this.guiCard).height(w).width(h);
 			}
 		}
 		this.rotate();
 	},
 	moveToFront: function (){
 		this.guiCard.style.zIndex = oh.zIndexCounter++;
 	},
 	rotate: function (){
 		$(this.guiCard)
 			.css('-webkit-transform', 'rotate(0deg)')
 			.css('-moz-transform', 'rotate(0deg)')
 			.css('-ms-transform', 'rotate(0deg)')
 			.css('transform', 'rotate(0deg)')
 			.css('-o-transform', 'rotate(0deg)');
 	},
 	showCard: function (position){
 		var offsets = {
 			C: 0,
 			D: 1,
 			H: 2,
 			S: 3
 		};
 		var xpos, ypos;
 		if (!position){
 			position = 'bottom';
 		}
 		var h = $(this.guiCard).height(),
 			w = $(this.guiCard).width();
 		if (position == 'top' || position == 'bottom'){
 			xpos = (2 - this.rank) * oh.CARD_SIZE.width;
 			ypos = -offsets[this.suit] * oh.CARD_SIZE.height;
 			if (position == 'top' && this.rank > 10){
 				xpos -= 4 * oh.CARD_SIZE.width;
 			}
 			if (w > h){
 				$(this.guiCard).height(w).width(h);
 			}
 			this.rotate();
 		} else {
 			ypos = -5 * oh.CARD_SIZE.height;
 			if (this.rank <= 10){
 				ypos -= (this.rank - 2) * oh.CARD_SIZE.width;
 				xpos = -offsets[this.suit] * oh.CARD_SIZE.height;
 			} else {
 				xpos = -4 * oh.CARD_SIZE.height - offsets[this.suit] * oh.CARD_SIZE.height;
 				if (position == 'left'){
 					ypos -= (this.rank - 7) * oh.CARD_SIZE.width;
 				} else {
 					ypos -= (this.rank - 11) * oh.CARD_SIZE.width;
 				}
 			}
 			if (h > w){
 				$(this.guiCard).height(w).width(h);
 			}
 			this.rotate();
 		}
 		$(this.guiCard).setBackground(xpos + 'px', ypos + 'px');
 	},
 };


	function OHeck(){}
	OHeck.prototype = {
		afterDealing: function (){
			for (var i = 0; i < this.players.length; i++){
				var p = this.players[i];
				if (p.showCards && !p.handSorted){
					return this.sortHand(p, this.afterDealing);
				}
			}
			for (var i = 0; i < this.players.length; i++){
				var p = this.players[i];
				p.tricks = [];
				p._adjustHand(function(){}, 50, true, g.game.round.numTricks);
			}
		},
		currentPlayerIndex: 0,
		dealerIndex: -1,
		hand: 0,
		nextIndex: function (index){
			return (index + 1) % this.players.length;
		},
		nextPlayerToDealTo: -1,
		pile: [],
		playCard: function (player, card){
			this.pile.push(card);
			player.remove(card);
			this.renderEvent('play', {cards: [card]}, function(){});
			this.currentPlayerIndex = this.nextIndex(this.currentPlayerIndex);
		},
		players: [],
		renderers: {},
		renderEvent: function (name, eventData, callback){
			if (!eventData.player){
				eventData.player = this.players[this.currentPlayerIndex];
			}
			eventData.name = name;
			eventData.game = this;
			var game = this;
			eventData.callback = function (){
				callback.call(game);
			};
			this.renderers[name](eventData);
		},
		sortHand: function (player, callback){
			if (!player.hand){
				return;
			}
			var diff = function (a, b){
				return a - b;
			};
			player.hand.sort(function (c1, c2){
				var suits = {D:0,C:1,H:2,S:3};
				switch (g.game.round.trump){
					case "D":
						suits = {C:0,H:1,S:2,D:3}; break;
					case "C":
						suits = {H:0,S:1,D:2,C:3}; break;
					case "H":
						suits = {S:0,D:1,C:2,H:3}; break;
					case "S":
					default:
						suits = {D:0,C:1,H:2,S:3};
				}
				if (c1.suit == c2.suit){
					return diff(c1.rank, c2.rank);
				}
				return diff(suits[c1.suit], suits[c2.suit]);
			});
			player.handSorted = true;
			this.renderEvent('sorthand', {}, callback);
		}
	}

	function Player(name, showCards){
		this.init(name, showCards);
	}
	Player.prototype = {
		init: function (showCards){
	 	 this.hand = [];
	 	 this.showCards = showCards;
	  },
		_adjustHand: function(callback, speed, moveToFront, handLength){
	 		for (var i = 0; i < this.hand.length; i++){
	 			var card = this.hand[i];
	 			var props = this._getCardPos(i, handLength);
	 			var f;

	 			// Last card dealt in hand
	 			if (i == this.hand.length - 1){
	 				f = callback;
	 			}
	 			$(card.guiCard).moveCard(props.top, props.left, speed, f);
	 			if (moveToFront){
	 				card.moveToFront();
	 			}
	 		}
			// Show cards
	 		if (this.showCards){
	 			webRenderer.showCards(this.hand, this.position);
	 		}
			// Hide cards
			else {
				for (var i = 0; i < this.hand.length; i++){
					this.hand[i].hideCard(this.position);
				}
	 		}
	 	},
	 	_getCardPos: function(pos, handLength){
	 		var handWidth = (handLength - 1) * oh.CARD_PADDING + oh.CARD_SIZE.width;
	 		var props = {};
	 		if (this.position == 'top' || this.position == 'topLeft' || this.position == 'topRight'){
	 			props.left = this.left + handWidth / 2 - oh.CARD_SIZE.width - pos * oh.CARD_PADDING;
	 			props.top = this.top;
	 		}
	 		else if (this.position == 'bottom' || this.position == 'bottomLeft' || this.position == 'bottomRight'){
	 			props.left = this.left - handWidth / 2 + pos * oh.CARD_PADDING;
	 			props.top = this.top;
	 		}
	 		else if (this.position == 'left'){
	 			props.left = this.left;
	 			props.top = this.top - handWidth / 2 + pos * oh.CARD_PADDING;
	 		}
	 		else if (this.position == 'right'){
	 			props.left = this.left;
	 			props.top = this.top + handWidth / 2 - oh.CARD_SIZE.width - pos * oh.CARD_PADDING;
	 		}
	 		return props;
	 	},
		hand: [],
		tricks: [],
		remove: function (card){
			return $A(this.hand).remove(card);
		},
	};

	jQuery.fn.moveCard = function (top, left, speed, callback){
		this.animate({
			'top': top,
			'left': left,
			'queue': false
		}, speed, callback);
		return this;
	};

	jQuery.fn.setBackground = function (x, y){
		this.css({
			'background-position': x + ' ' + y
		});
		return this;
	};

 var webRenderer = {
 	play: function (e){
 		var boardCenterX = ($('#game-board').width() - oh.CARD_SIZE.width) / 2;
 		var boardCenterY = ($('#game-board').height() - oh.CARD_SIZE.height) / 2;

 		if (e.player.position == 'top'){
 			oh.PILE_POS.left = boardCenterX;
 			oh.PILE_POS.top = boardCenterY - 60;
 		}
 		else if (e.player.position == 'topLeft'){
 			oh.PILE_POS.left = boardCenterX - 30;
 			oh.PILE_POS.top = boardCenterY - 60;
 		}
 		else if (e.player.position == 'topRight'){
 			oh.PILE_POS.left = boardCenterX + 30;
 			oh.PILE_POS.top = boardCenterY - 60;
 		}
 		else if (e.player.position == 'bottom'){
 			oh.PILE_POS.left = boardCenterX;
 			oh.PILE_POS.top = boardCenterY + 10;
 		}
 		else if (e.player.position == 'bottomLeft'){
 			oh.PILE_POS.left = boardCenterX - 30;
 			oh.PILE_POS.top = boardCenterY + 10;
 		}
 		else if (e.player.position == 'bottomRight'){
 			oh.PILE_POS.left = boardCenterX + 30;
 			oh.PILE_POS.top = boardCenterY + 10;
 		}
 		else if (e.player.position == 'left'){
 			oh.PILE_POS.left = boardCenterX - 75;
 			oh.PILE_POS.top = boardCenterY - 25;
 		}
 		else if (e.player.position == 'right'){
 			oh.PILE_POS.left = boardCenterX + 75;
 			oh.PILE_POS.top = boardCenterY - 25;
 		}

 		var beforeCount = e.game.pile.length - e.cards.length;

 		function renderCard(i){
 			if (e.cards.length == 0){
 				e.callback();
 			} else {
 				var zIndexCards = e.player.hand.slice(0);
 				$A(e.cards).each(function (c){
 					zIndexCards.push(c);
 				});
 				zIndexCards.sort(function (c1, c2){
 					return $(c1.guiCard).css('z-index') - $(c2.guiCard).css('z-index');
 				});
 				for (var i = zIndexCards.length - 1; i >= 0; i--){
 					$(zIndexCards[i].guiCard).css('z-index', oh.zIndexCounter + i + 1);
 				}
 				oh.zIndexCounter += zIndexCards.length + 3;
 				var card = e.cards[0];
 				$A(e.cards).remove(e.cards[0]);
 				var top = oh.PILE_POS.top - (Math.floor((beforeCount + i) / oh.CONDENSE_COUNT) * oh.OVERLAY_MARGIN);
 				var left = oh.PILE_POS.left - (Math.floor((beforeCount + i) / oh.CONDENSE_COUNT) * oh.OVERLAY_MARGIN);
 				$(card.guiCard).moveCard(top, left, oh.ANIMATION_SPEED, function (){
 					renderCard(i + 1);
 				});
 				if (e.cards.length == 0){
 					e.player._adjustHand(null, oh.ANIMATION_SPEED, false, e.player.hand.length);
 				}
 				webRenderer.showCards([card]);
 			}
 		}

 		renderCard(0);
 	},
 	showCards: function (cards, position){
		for (var i = 0; i < cards.length; i++){
			cards[i].showCard(position);
		}
 	},
 	sortHand: function (e){
 		e.player._adjustHand(e.callback, oh.ANIMATION_SPEED, false, e.player.hand.length);
 	},
 	takeTrick: function (e){
 		setTimeout(function (){
 			$A(e.trick).each(function (c){
 				$(c.guiCard).addClass('trick');
 			});
 			var props = {};
 			var cssClass;
 			var trickProps = {};
 			var playerMargin = 5;
 			var trickHeight = 45;
 			var trickWidth = 33;
 			var overlay = 10;
 			var playerSizeX = 60;
 			var playerSizeY = 90;
 			var sidePlayerTop = 265;
 			var topEdgeDistance = playerMargin + (playerSizeY - trickHeight) / 2;
 			var sideEdgeDistance = playerMargin + (playerSizeX - trickHeight) / 2;
 			var cardDistance = ($('#game-board').width() / 2) + playerSizeX / 2 + e.player.tricks.length * overlay;
 			if (e.player.position == 'top'){
 				cssClass = 'verticalTrick';
 				trickProps['top'] = topEdgeDistance;
 				trickProps['left'] = cardDistance;
 				props = trickProps;
 			}
 			else if (e.player.position == 'topLeft'){
 				cssClass = 'verticalTrick';
 				trickProps['top'] = topEdgeDistance;
 				trickProps['left'] = (0.3 * $('#game-board').width()) + (playerSizeX / 2) + e.player.tricks.length * overlay;
 				props = trickProps;
 			}
 			else if (e.player.position == 'topRight'){
 				cssClass = 'verticalTrick';
 				trickProps['top'] = topEdgeDistance;
 				trickProps['left'] = (0.7 * $('#game-board').width()) + (playerSizeX / 2) + e.player.tricks.length * overlay;
 				props = trickProps;
 			}
 			else if (e.player.position == 'bottom'){
 				cssClass = 'verticalTrick';
 				trickProps['bottom'] = playerMargin + (playerSizeY - trickHeight) / 2;
 				trickProps['right'] = cardDistance;
 				props['top'] = $('#game-board').height() - trickProps['bottom'] - oh.CARD_SIZE.height;
 				props['left'] = $('#game-board').width() - trickProps['right'] - oh.CARD_SIZE.width;
 			}
 			else if (e.player.position == 'bottomLeft'){
 				cssClass = 'verticalTrick';
 				trickProps['bottom'] = playerMargin + (playerSizeY - trickHeight) / 2;
 				trickProps['right'] = cardDistance;
 				props['top'] = $('#game-board').height() - trickProps['bottom'] - oh.CARD_SIZE.height;
 				props['left'] = $('#game-board').width() - trickProps['right'] - oh.CARD_SIZE.width;
 			}
 			else if (e.player.position == 'bottomRight'){
 				cssClass = 'verticalTrick';
 				trickProps['bottom'] = playerMargin + (playerSizeY - trickHeight) / 2;
 				trickProps['right'] = cardDistance;
 				props['top'] = $('#game-board').height() - trickProps['bottom'] - oh.CARD_SIZE.height;
 				props['left'] = $('#game-board').width() - trickProps['right'] - oh.CARD_SIZE.width;
 			}
 			else if (e.player.position == 'left'){
 				cssClass = 'horizontalTrick';
 				trickProps['bottom'] = $('#game-board').height() - sidePlayerTop + e.player.tricks.length * overlay;
 				trickProps['left'] = sideEdgeDistance;
 				props['top'] = $('#game-board').height() - trickProps['bottom'] - oh.CARD_SIZE.height;
 				props['left'] = trickProps['left'];
 			}
 			else if (e.player.position == 'right'){
 				cssClass = 'horizontalTrick';
 				trickProps['top'] = sidePlayerTop + playerSizeY + e.player.tricks.length * overlay;
 				trickProps['right'] = sideEdgeDistance;
 				props['top'] = trickProps['top'];
 				props['left'] = $('#game-board').width() - trickProps['right'] - oh.CARD_SIZE.width;
 			}
 			for (var i = 0; i < e.trick.length; i++){
 				e.trick[i].moveToFront();
 			}
 			for (var i = 0; i < e.trick.length - 1; i++){
 				$(e.trick[i].guiCard).animate(props, oh.ANIMATION_SPEED, function (){});
 			}
 			$(e.trick[e.trick.length - 1].guiCard).animate(props, oh.ANIMATION_SPEED, function (){
 				$('.trick').hide();
 				$('#game-board').append($('<div/>').addClass(cssClass).css(trickProps));
 				e.callback();
 			});
 		}, oh.TAKE_TRICK_DELAY);
 	},
};
