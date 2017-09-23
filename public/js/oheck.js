/*
 * OH HECK - Card Game
 * Created by Justin Miller on 9.1.2017
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
	NASCAR_SCORE_GAP: 2,
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

var SNACKBAR_TIMEOUT = 1000;

var g = {
  user: {
    id: null,
    name: null,
    games: 0,
    wins: 0
  },
  rooms: [],
  users: [],
  game: {},
  oheck: {},
  socket: null
}


//$(document).ready(function() {
$(window).on('load', function() {

  /**
   * SOCKET.IO EVENTS
   */

  // Connect to Socket.IO
  g.socket = io();

  g.socket.on('init', function(data) {
    console.log(data);
    g.rooms = data.rooms;
    g.users = data.users;
    g.game = data.game;

    // Existing game is in progress
    if (g.game.isActive) {
      // If user is logged in, send into existing game
      if (Cookies.getJSON(COOKIE_NAME)) {
        // Broadcast to other users
        // This also triggers the socket joining the "game" room
        g.socket.emit('userJoined', {user: g.user});

				// Send user to existing game
				console.log('Game is already in progress, send user to existing game');
		    $('#welcome, #game-board').slideToggle();
		    loadGameBoard();
      }
    }

		// Send user to lobby
    else {
      updateUsersInLobby();
    }
  });

  g.socket.on('myUserLogin', function(data) {
    g.users = data.users;
    g.user.id = data.userId;
    // Save to cookie
    Cookies.set(COOKIE_NAME, g.user);
    updateUsersInLobby();
  });

  g.socket.on('userJoined', function(data) {
    g.users = data.users;
    if (g.users[data.userId - 1] && g.users[data.userId - 1].name) {
      var loggedInUserName = g.users[data.userId - 1].name;
      console.log('New user ' + loggedInUserName + ' has arrived');
      updateUsersInLobby();
    }
  });

  g.socket.on('userLogout', function(data) {
    if (g.users[data.userId - 1] && g.users[data.userId - 1].name) {
      var loggedOutUser = g.users[data.userId - 1].name;
      console.log(loggedOutUser + ' logged out');
    }
    g.users = data.users;
    updateUsersInLobby();
  });

  g.socket.on('forceReloadAll', function(data) {
    console.log('Reloading...');
		window.location.reload();
  });

  g.socket.on('startGame', function(data) {
    updateData(data);
		$.modal.close();
    $('#lobby, #game-board').slideToggle();
    loadGameBoard();
  });

  g.socket.on('dealHand', function(data) {
    updateData(data);
    g.oheck.dealCards();
    g.oheck.beforeBid();
  });

  g.socket.on('bid', function(data) {
    updateData(data);

    // This was my bid
    if (data.playerId === g.game.playerId) {
      g.oheck.bid(g.human, data.bid);
    }
    else {
      g.oheck.bid(g.oheck.players[data.playerId], data.bid);
    }

    // Need to bid
    if (g.game.round.bids < g.game.players.length) {
      g.oheck.beforeBid();
    }
    else {
      g.oheck.beforePlayCards();
    }
  });

  g.socket.on('playCard', function(data) {
    updateData(data);

    // Find card in my hand
    //var player = g.oheck.players[g.oheck.currentPlayerIndex];
    var player = g.oheck.players[data.playerId];
    for (var pos = 0; pos < player.hand.length; pos++) {
      if (player.hand[pos].shortName == data.cardShortName) {
        (player.name + ' played the ' + player.hand[pos].longName);
        g.oheck.playCards(player, [player.hand[pos]]);
        break;
      }
    }

    // Need to play
    if (g.game.round.numTricksTaken < g.game.round.numTricks) {
      g.oheck.beforePlayCards();
    }
    else {
      //checkForEndOfRound();
    }

  });


  /**
   * Lobby functions
   */

  // Sign in
  // Wait to save cookie until server response via "myUserLogin" socket event
  $('#sign-in-form').submit(function(e) {
    e.preventDefault();
    g.user.name = this.name.value;
    g.socket.emit('userLogin', {user: g.user});
    updateUsersInLobby();
    $.modal.close();
    $('#welcome, #lobby').slideToggle();
  });


  // Logout
  // Have to use a delegated event because the button ID does not exist when document.onReady event fires initially
  // http://api.jquery.com/on/#direct-and-delegated-events
  // http://api.jquery.com/delegate/
  $(document).on('click', '#logout-button', function(e) {
    e.preventDefault();
    g.socket.emit('userLogout', {userId: g.user.id});
    Cookies.remove(COOKIE_NAME);
    location.reload();
  });

  // Force Reload
/*  $('#force-reload').click(function() {
    g.socket.emit('forceReloadAll', 'Force Reload All Clients');
    showMessage('Force Reload All', function() {
      location.reload();
    });
  });*/


  /**
   * LOBBY FUNCTIONS
   */

  // Start Game
  // Have to use a delegated event because the button ID does not exist when document.onReady event fires initially
  // http://api.jquery.com/on/#direct-and-delegated-events
  // http://api.jquery.com/delegate/
  $(document).on('click', '#start-game-button', function(e) {
    e.preventDefault();
    g.socket.emit('startGame', {ownerId: g.user.id, rounds: $('#create-game-form #rounds').val() });
  });


  /**
   * GAME FUNCTIONS
   */
  function init() {

    // Check if user is already logged in
    if (Cookies.getJSON(COOKIE_NAME)) {
      g.user = Cookies.getJSON(COOKIE_NAME);
      console.log('User is already logged in');
      console.log(g.user);

      // Delete login form HTML since user is already logged in
      $('#login').remove();

      // The "get started" button should take user to lobby if no game is in progress
      $('#get-started-button-action').click(function(e) {
        e.preventDefault();

        // Broadcast to other users
        // This also triggers the socket joining the "game" room
        g.socket.emit('userJoined', {user: g.user});

        // Switch to lobby view
        $('#welcome, #lobby').slideToggle();
      });
    }
    else {

      // If user is not logged in, when they click, it should show the login dialog
      $('#get-started-button-action').click(function(e) {
        e.preventDefault();
        $('#login-dialog').modal();
      })
    }
  }

  function createPlayers() {
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


    // Add players blocks
    for (var i = 0; i < g.game.players.length; i++) {
      h += '<div id="player-position-' + i + '" class="avatar"><div class="userPic"></div><small></small></div>';
    }
    $('#playersBlock').html(h);


    // Create players on game board
    for (var i = 0; i < g.game.players.length; i++) {
      thisPlayer = g.game.players[(g.game.playerId + i) % g.game.players.length];
      p = (i === 0) ? new HumanPlayer(thisPlayer.name) : new ComputerPlayer(thisPlayer.name);
      p.id = 'player-position-' + i;
      p.position = PLAYER_POSITIONS[g.game.players.length][i];  // top, bottom, left, right, etc
      p.top = PLAYER_SETUP[p.position].top;
      p.left = PLAYER_SETUP[p.position].left;
      p.align = PLAYER_SETUP[p.position].align;
      if (i === 0) {
        g.human = p;
      }
      players.push(p);

      // Add player name and avatar
			$('#' + p.id + ' div').addClass('player-' + ((g.game.playerId + i) % g.game.players.length + 1));
      $('#' + p.id + ' small').text(thisPlayer.name);
    }

    // Do this separately because we want YOUR player to be added first (bottom of screen)
    for (var i = 0; i < g.game.players.length; i++) {
      var playerId = (players.length + i - g.game.playerId) % players.length;
      g.oheck.addPlayer(players[playerId]);
    }
  }

  function loadGameBoard() {
  	g.oheck = new OHeck();
		g.oheck.message('Loading Game!');

    // Setup event renderers
    for (var name in g.oheck.renderers) {
      g.oheck.setEventRenderer(name, function(e) {
        e.callback();
      });
    }
		g.oheck.setEventRenderer('bid', webRenderer.bid);
    g.oheck.setEventRenderer('dealcard', webRenderer.dealCard);
    g.oheck.setEventRenderer('play', webRenderer.play);
    g.oheck.setEventRenderer('sorthand', webRenderer.sortHand);
		g.oheck.setEventRenderer('taketrick', webRenderer.takeTrick);

    // Setup deal handler
    $('#deal').click(function(e) {
      $(this).hide();
      g.socket.emit('dealHand');
    });

    // Setup start handler
    g.oheck.setEventRenderer('start', function(e) {
      $('.card').click(function() {
        g.human.useCard(this.card);
      });
      e.callback();
    });

    // Preload images
    var imgs = ['horizontal-trick', 'vertical-trick'];
    var img = new Image();
    for (var i = 0; i < imgs.length; i++) {
      img.src = 'img/' + imgs[i] + '.png';
    }

		// Setup game board
    if (g.game.players.length > 4) {
      $('#wrapper').addClass('wide');
    }
    $('#game-board').addClass('players-' + g.game.players.length);

    // Setup seats and players
    g.game.playerId = g.user.id - 1;
    console.log('My position: ' + (g.game.playerId + 1) + '/' + g.game.players.length);
    console.log('Players Array:');
    for (var i = 0; i < g.game.players.length; i++) {
      console.log('Player ' + i);
      console.log(g.game.players[i]);
    }

    // Create players
    createPlayers();

    // Create scoreboard
    g.oheck.updateScoreboard();


    // Create game
    // First person who joined the game bids first
    // Last person who joined the game deals first
    g.oheck.rounds = g.game.numRounds;
    g.oheck.dealerIndex = g.game.players.length - 1;
    g.oheck.nextPlayerToDealTo = g.oheck.nextIndex(g.oheck.dealerIndex);
    //g.oheck.currentPlayerIndex = g.oheck.nextIndex(g.oheck.dealerIndex);
    g.oheck.bidPlayerIndex = g.oheck.nextIndex(g.oheck.dealerIndex);
    console.log('No rounds exist yet!');
    console.log('OH Dealer index (-1): ' + g.oheck.dealerIndex);
    console.log('OH Player index (-1): ' + g.oheck.currentPlayerIndex);
    console.log('PlayerId: ' + g.game.playerId);

    // Need to deal
    if (!g.game.players[0].hand.length) {
      g.oheck.beforeDeal();
      return;
    }

    // Deal
    g.oheck.dealCards();

    // Update existing bids
    var firstPlayerToBidThisHand = g.oheck.nextIndex(g.oheck.dealerIndex);
    for (var i = 0; i < g.game.round.bids; i++) {
      var pos = (firstPlayerToBidThisHand + i) % g.game.players.length;
        var thisBid = g.game.players[pos].bid;

        // This was my bid
        if (pos === g.game.playerId) {
          g.oheck.bid(g.human, thisBid);
        }
        else {
          g.oheck.bid(g.oheck.players[pos], thisBid);
        }
    }

    // Need to bid
    if (g.game.round.bids < g.game.players.length) {
      g.oheck.beforeBid();
      return;
    }

    // Need to play
    if (g.game.round.currentTrickId < g.game.round.numTricks) {

      //TODO: Show tricks won in current round

      // Show cards played in current trick
      var numberOfCardsPlayedInCurrentTrick = g.game.round.currentTrickPlayed.length;
      if (numberOfCardsPlayedInCurrentTrick) {

        // Determine who played the first card in current trick
        var playerId = (g.game.currentPlayerId - g.game.round.currentTrickPlayed.length + g.game.players.length) % g.game.players.length;
        if (playerId === 0) {
          playerId = g.game.players.length;
        }
        // Simulate cards in current trick already played
        for (var i = 0; i < numberOfCardsPlayedInCurrentTrick; i++) {
          var player = g.oheck.players[(playerId + i) % g.oheck.players.length];
          console.log(player.name + ' played the ' + g.game.round.currentTrickPlayed[i].longName);
          g.oheck.playCards(player, [g.game.round.currentTrickPlayed[i]]);
        }
      }

      g.oheck.beforePlayCards();
      return;
    }
  }

  function updateData(data) {
    console.log(data);
    g.game = data.game;
    g.game.playerId = g.user.id - 1;
  }

  function updateUsersInLobby() {
    var thisUser,
        usersHtml = '';
    for (var i in g.users) {
      var user = g.users[i];
      thisUser = g.users[i];
      usersHtml += '<li class="mdl-list__item mdl-list__item--two-line">';
      usersHtml += '<span class="mdl-list__item-primary-content">';
      usersHtml += '<span class="player-avatar player-' + user.id + '"></span>';
      usersHtml += '<span>' + user.name + '</span>';
      usersHtml += '<span class="mdl-list__item-sub-title">User #' + user.id + '</span>';
      usersHtml += '<span class="mdl-list__item-sub-title">' + user.wins + ' wins / ' + user.games + ' games</span>';
      usersHtml += '</span></li>';
    }
    $('#usersOnline').html(usersHtml);

    // Only show "create game" button if there are 2-6 users waiting
    var usersOnline = $('#usersOnline li').length;
    if (usersOnline >= 2 && usersOnline <= 6) {
      $('#create-game-button').removeAttr('disabled', 'disabled');
      $('#create-game-button-link').attr('href', '/html/create-game.html').attr('rel', 'modal:open');
    }
    else {
      $('#create-game-button').attr('disabled', 'disabled');
      $('#create-game-button-link').attr('href', '#').removeAttr('rel', 'modal:open').attr('onclick', 'javascript:return false;');
    }
  }

  init();

});
