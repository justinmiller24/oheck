/*
 * OH HECK - Card Game
 * Created by Justin Miller on 9.1.2017
 * Updated by Justin Miller on 6.15.2018
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
	VERTICAL_MARGIN: 96,	// PLAYER HEIGHT (68) + PLAYER LABEL (18) HORIZONTAL PADDING (10)
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

var SHOW_ADMIN_BTNS = true;
var SNACKBAR_TIMEOUT = 1000;

var g = {
	game: {},
	history: [],
  oheck: {},
	queue: [],
  socket: null,
  user: {
    id: null,
    name: null,
    games: 0,
    wins: 0
  },
  users: [],
	waiting: false
}


$(window).on('load', function(){

  /**
   * SOCKET.IO EVENTS
   */

  // Connect to Socket.IO
  g.socket = io();


	// This event fires on socket connection
	// socket.emit('init', {users: users, game: game});
  g.socket.on('init', function(data){
//    console.log(data);
    g.users = data.users;
    g.game = data.game;

		// Check if user is already logged in
		if (Cookies.getJSON(COOKIE_NAME)){

			// Broadcast to other users
			// This also triggers the socket joining the "game" room
			g.socket.emit('userJoined', {user: g.user});

			// Send user to game if game is in progress
			if (g.game.isActive){
				console.log('User is logged in and game is in progress, send user to game');
				$('#content-section, #welcome, #game-board').slideToggle();

				// Call this AFTER DOM manipulation so card positioning is correct
				loadGameBoard();

				// Call this AFTER loadGameBoard() so "players" DIV exists
				highlightCurrentPlayer();
      }
			// Send user to lobby if game is not in progress
			else{
				console.log('User is logged in but game is not in progress, send user to lobby');
				updateUsersInLobby();
				$('#content-section, #welcome, #lobby').slideToggle();
			}
    }
  });


	// This event fires after user logs in
  g.socket.on('myUserLogin', function(data){
		g.user.id = data.userId;
    g.users = data.users;
//		g.history = data.history;
//		console.log(g.history);
    // Save to cookie
    Cookies.set(COOKIE_NAME, g.user);
    updateUsersInLobby();
  });

	// Alert individual user
	g.socket.on('showMessage', function(data){
		document.querySelector('#snackbar-message')
			.MaterialSnackbar.showSnackbar({
				message: data.message,
				timeout: SNACKBAR_TIMEOUT
		});
	});

	// This event fires when user joins
	// io.in('game').emit('userJoined', {userId: data.user.id, users: users});
  g.socket.on('userJoined', function(data){
    g.users = data.users;
    if (g.users[data.userId - 1] && g.users[data.userId - 1].name){
      var loggedInUserName = g.users[data.userId - 1].name;
      console.log('New user ' + loggedInUserName + ' has arrived');
      updateUsersInLobby();
    }
  });

	// This event fires when user logs out
  // socket.to('game').emit('userLogout', {userId: data.userId, users: users});
	g.socket.on('userLogout', function(data){
    if (g.users[data.userId - 1] && g.users[data.userId - 1].name){
      var loggedOutUser = g.users[data.userId - 1].name;
      console.log(loggedOutUser + ' logged out');
    }
    g.users = data.users;
    updateUsersInLobby();
  });

	// This event fires when admin user forces reload
	// io.in('game').emit('forceReloadAll', 'Force Reload All');
  g.socket.on('forceReloadAll', function(data){
    console.log('Reloading...');
		window.location.reload();
  });


	/*
	 * This event fires when any game event occurs
	 * "data" is an array of one or more events to fire
	 */
	g.socket.on('event', function(data){
		console.log('Received event packet from server');

		// Loop through one or more "op" (operation) events and add to queue
		for (var i = 0; i < data.length; i++){
			console.log('Received event ' + data[i].op + ' from server');
			addQueueEvent(data[i]);
		}

		// Trigger next event in queue
		runQueueEvent();
	});

	// Add event to queue
	function addQueueEvent(evt){
		g.history.push(evt);
		g.queue.push(evt);
	}

	// Run event from queue
	function runQueueEvent(){

		// Exit if another event is already in progress
		if (g.waiting){
			console.log('Another queue event is already running');
			return;
		}

		// Exit if queue is empty
		if (g.queue.length === 0){
			console.log('No queue events exit');
			return;
		}

		// Set waiting status
		g.waiting = true;

		// Pop next event from top of queue
		var data = g.queue.pop();

		// Trigger event
		switch (data.op){
			case 'bid':
				bid(data);
				break;
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
			case 'restartHand':
				restartHand(data);
				break;
			case 'showDealButton':
				showDealButton(data);
				break;
			case 'showScoreboard':
				showScoreboard(data);
				break;
			case 'startGame':
				startGame(data);
				break;
			case 'takeTrick':
				takeTrick(data);
				break;
			default:
				break;
		}

		// Complete waiting status
		g.waiting = false;

		// Run next event
		runQueueEvent();
	}



	/*
	 * GAME EVENTS
	 */

	// Bid event
	// This event is broadcast after a player bids
	// io.in('game').emit('bid', {playerId: data.playerId, bid: currentBid, game: game});
	function bid(data){
    updateData(data);
		// Update player display bid
		$('#' + g.oheck.players[data.playerId].id + ' small').append(' (' + data.bid + ')');
		// Update stats board
		updateStats();

    // This was my bid
    if (data.playerId === g.game.playerId){
      g.oheck.bid(g.human, data.bid);
    }
    else {
      g.oheck.bid(g.oheck.players[data.playerId], data.bid);
    }

    // Need to bid
    if (g.game.round.bids < g.game.players.length){
      g.oheck.beforeBid();
    }
  }

	// Deal Hand event
	// This event fires when the dealer presses "deal" at the beginning of each round
	// io.in('game').emit('dealHand', {game: game});
	function dealHand(data){
    updateData(data);
		updateStats();
    g.oheck.dealCards();
    g.oheck.beforeBid();
  }


	// End Game event
	// This event is broadcast after the last round if there is no tie
	// io.in('game').emit('endGame', {playerId: winnerPlayerId});
	function endGame(data){
    console.log('Ending Game');
		//alert(g.game.players[data.playerId].name + ' wins with ' + g.game.players[data.playerId].score + ' points!');
		setTimeout("window.location.reload();", 15000);
  }


	// Finish Round event
	// This event is broadcast after the last trick in a round is played
	// io.in('game').emit('finishRound', {game: game});
	function finishRound(data){
		updateData(data);
		g.oheck.afterRound();
		updateScoreboard();
	}


	// Play Card event
	// This event is broadcast after a player plays a card in the current trick
	// io.in('game').emit('playCard', {playerId: data.playerId, cardShortName: data.card, game: game});
	function playCard(data){
    updateData(data);

    // Find card in my hand
    var player = g.oheck.players[data.playerId];
    for (var pos = 0; pos < player.hand.length; pos++){
      if (player.hand[pos].shortName == data.cardShortName){
//        console.log(player.name + ' played the ' + player.hand[pos].longName);
        g.oheck.playCard(player, player.hand[pos]);
        break;
      }
    }
  }


	// Restart Hand event
 	// This event fires when the admin user presses "restart" during a round
	// io.in('game').emit(restartHand');
	function restartHand(data){
    console.log('Restarting Hand...');
//		window.location.reload();
  }


	// Show Deal Button event
	// This event is broadcast after the last card in a round is played
	// io.in('game').emit('showDealButton', {playerId: nextDealerId});
	function showDealButton(data){
		if (data.playerId === g.game.playerId){
			$('#deal').show();
		}
	}


	// Show Scoreboard event
	// This event is broadcast after the last trick in a round is played
	// io.in('game').emit('showScoreboard');
	function showScoreboard(data){
		console.log('Show scoreboard');
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
		// Call this AFTER loadGameBoard() so "players" DIV exists
		highlightCurrentPlayer();
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
		console.log('PlayerId ' + winnerIndex + ' wins trick #' + g.oheck.hand);

		// Not end of round
		g.oheck.hand++;
		g.oheck.renderEvent('taketrick', function (){}, { trick: oldPile });
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
    g.socket.emit('startGame', {
			ownerId: g.user.id,
			decks: parseInt($('#create-game-form input[name=decks]').val(), 10),
			nascar: (parseInt($('#create-game-form input[name=nascar]').val(), 10) === 1),
			rounds: parseInt($('#create-game-form select[name=rounds]').val(), 10),
			trump: (parseInt($('#create-game-form input[name=trump]').val(), 10) === 1),
		});
  });


  /**
   * GAME FUNCTIONS
   */
  function init(){

    // Check if user is already logged in
    if (Cookies.getJSON(COOKIE_NAME)){

			// If user is logged in, grab user info from cookie, delete login form, and show logout button
      g.user = Cookies.getJSON(COOKIE_NAME);
			showAdminButtons();
      $('#login').remove();
			$('#show-logout').show();
    }
    else {

      // If user is not logged in, trigger login dialog on button click
      $('#get-started-button-action').click(function(e){
        e.preventDefault();
        $('#login-dialog').modal();
      });
    }
  }

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
      p = (i === 0) ? new HumanPlayer(thisPlayer.name) : new ComputerPlayer(thisPlayer.name);
      p.id = 'player-position-' + i;
      p.position = PLAYER_POSITIONS[g.game.players.length][i];  // top, bottom, left, right, etc
      p.top = PLAYER_SETUP[p.position].top;
      p.left = PLAYER_SETUP[p.position].left;
      p.align = PLAYER_SETUP[p.position].align;
      if (i === 0){
        g.human = p;
      }
      players.push(p);

      // Add player name and avatar
			$('#' + p.id + ' div').addClass('player-' + ((g.game.playerId + i) % g.game.players.length + 1));
      $('#' + p.id + ' small').text(thisPlayer.name);
    }

    // Do this separately because we want YOUR player to be added first (bottom of screen)
		// This means all players needed to be added to "players" array (above) before then can be added to the g.oheck object
    for (var i = 0; i < g.game.players.length; i++){
      var playerId = (players.length + i - g.game.playerId) % players.length;
      g.oheck.addPlayer(players[playerId]);
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

		// Show admin buttons
		showAdminButtons();

		// Show scoreboard button
		$('#show-scoreboard').show();

    // Setup event renderers
    for (var name in g.oheck.renderers){
      g.oheck.setEventRenderer(name, function(e){
        e.callback();
      });
    }
		g.oheck.setEventRenderer('bid', webRenderer.bid);
    g.oheck.setEventRenderer('dealcard', webRenderer.dealCard);
    g.oheck.setEventRenderer('play', webRenderer.play);
    g.oheck.setEventRenderer('sorthand', webRenderer.sortHand);
		g.oheck.setEventRenderer('taketrick', webRenderer.takeTrick);

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

    // Create players
    createPlayers();

    // Create scoreboard
    updateScoreboard();


    // Create game
    // First person who joined the game bids first
    // Last person who joined the game deals first
    //g.oheck.rounds = g.game.numRounds;
    g.oheck.dealerIndex = g.game.players.length - 1;
    g.oheck.nextPlayerToDealTo = g.oheck.nextIndex(g.oheck.dealerIndex);
    //g.oheck.currentPlayerIndex = g.oheck.nextIndex(g.oheck.dealerIndex);
    g.oheck.bidPlayerIndex = g.oheck.nextIndex(g.oheck.dealerIndex);
//    console.log('Dealer index (-1): ' + g.oheck.dealerIndex);
//    console.log('Player index (-1): ' + g.oheck.currentPlayerIndex);
//    console.log('Player ID: ' + g.game.playerId);
  }

	// Show "admin" buttons for first user
	function showAdminButtons(){
		if (SHOW_ADMIN_BTNS && g.user.id === 1 && g.user.name === 'Justin'){

			// Force Reload All
			$('#show-force-reload-all')
				.show()
				.click(function(e){
					g.socket.emit('forceReloadAll', 'Force reload for all clients');
				});

			// Restart Hand
			$('#show-restart-hand')
				.show()
				.click(function(e){
					g.socket.emit('restartHand', 'Restart current hand for all users');
				});
		}
	}

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
		pScores.sort(function(a,b){ return parseInt(b.score) - parseInt(a.score) } );
    // Create HTML
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

	// Update stats board
	function updateStats(){
		$('#quickStats #round span').text(g.game.currentRoundId + ' / ' + g.game.options.rounds);
		$('#quickStats #bids span').text(g.game.round.currentBid + ' / ' + g.game.round.numTricks);
		$('#quickStats #trump span').text(g.game.round.trump);
	}

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

    // Show "create game" button to 1st user when there are 2-6 users waiting
		if (g.user.id === 1){
			var usersOnline = $('#usersOnline li').length;
	    if (usersOnline >= 2 && usersOnline <= 6){
	      $('#create-game-button').removeAttr('disabled', 'disabled');
	      $('#create-game-button-link').attr('href', '/html/create-game.html').attr('rel', 'modal:open');
	    }
	    else {
	      $('#create-game-button').attr('disabled', 'disabled');
	      $('#create-game-button-link').attr('href', '#').removeAttr('rel', 'modal:open').attr('onclick', 'javascript:return false;');
	    }
		}
  }

  init();

});
