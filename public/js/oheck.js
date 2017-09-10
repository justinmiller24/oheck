/*
 * OH HECK - Card Game
 * Created by Justin Miller on 9.1.2017
 */

// Globals
var COOKIE_NAME = 'oheck';
var SNACKBAR_TIMEOUT = 1200;
var g = {
  rooms: [],
  user: {
    id: null,
    name: null,
    avatar: 0,
    games: 0,
    wins: 0
  },
  users: {},
  game: {}
}


$(document).ready(function(){

  // Set default modal fade duration
  //$.modal.defaults.fadeDuration = 100;

  init();


  /**
   * SOCKET.IO EVENTS
   */

  // Connect to Socket.IO
  var socket = io();

  socket.on('init', function(data){
    console.log(data);
    showMessage('Loading...');
    g.rooms = data.rooms;
    g.users = data.users;
    g.game = data.game;

    //TODO: check for game in progress
    updateUsersInLobby();
  });

  socket.on('myUserLogin', function(data){
    console.log('my user login fn');
    console.log(data);
//    showMessage('My user ' + data.userId + ' logged in');
    g.user.id = data.userId;
    // Save to cookie
    console.log('set cookie:');
    console.log(g.user);
    Cookies.set(COOKIE_NAME, g.user);
    g.users = data.users;
    updateUsersInLobby();
  });

  socket.on('userJoined', function(data){
    console.log('user joined fn');
    console.log(data);
    g.users = data.users;
    var loggedInUser = g.users[data.userId].name;
    showMessage('New user ' + loggedInUser + ' has arrived');
    updateUsersInLobby();
  });

  socket.on('userLogout', function(data){
    console.log('user logout fn');
    console.log(data);
    var loggedOutUser = g.users[data.userId].name;
    showMessage(loggedOutUser + ' logged out');
    g.users = data.users;
    updateUsersInLobby();
  });

  socket.on('forceReloadAll', function(data){
    console.log(data);
    showMessage('Reloading...', function(){
      window.location.reload();
    });
  });

  socket.on('userDisconnected', function(data){
    console.log('Some user disconnected');
    //showMessage('User Disconnected event received');
  });

  socket.on('startGame', function(data){
    console.log(data.game);
    g.game = data.game;

    showMessage('Starting Game!', function(){
      $.modal.close();
      $('#lobby, #game-board').slideToggle(400, function(){
        loadGameBoard();
      });
    });
  });


  /**
   * Login dialogs
   */
  // Enter name
  $('#select-name form').submit(function(){
    g.user.name = this.name.value;
    showMessage('User entered: ' + g.user.name);

    // Update confirmation HTML
    updateConfirmHTML();

    // Simulate click on next tab
    $("#login .mdl-tabs__tab:eq(1) span").click (); //for the second tab (index 1)
    return false;
  })
  // Select avatar
  $('#select-avatar form button').click(function(){
    g.user.avatar = $(this).attr('id');
  });
  $('#select-avatar form').submit(function(){
    showMessage('user selected avatar id: ' + g.user.avatar);
    // Update confirmation HTML
    updateConfirmHTML();
    // Simulate click on next tab
    $("#login .mdl-tabs__tab:eq(2) span").click (); //for the last tab (index 2)
    return false;
  });
  $('#sign-in-button').click(function(event){
    event.preventDefault();

    // Wait to save cookie until server response occurs via "myUserLogin"
    //Cookies.set(COOKIE_NAME, g.user);

    // Broadcast to users
    socket.emit('userLogin', g.user);

    showMessage('Logging In', function(){
      $('#login, #lobby').slideToggle(400, function(){
        updateUsersInLobby();
      });
    });
  });

  // Logout
  // Have to use a delegated event because the button ID does not exist when document.onReady event fires initially
  // http://api.jquery.com/on/#direct-and-delegated-events
  // http://api.jquery.com/delegate/
  $(document).on('click', '#logout-button', function(event){
    event.preventDefault();
    showMessage('Logging out', function(event){
      socket.emit('userLogout', {userId: g.user.id});
      Cookies.remove(COOKIE_NAME);
      location.reload();
    });
  });

  // Force Reload
  $('#force-reload').click(function(){
    socket.emit('forceReloadAll', 'Force Reload All Clients');
    showMessage('Force Reload All', function(){
      location.reload();
    });
  });


  /**
   * LOBBY FUNCTIONS
   */

  // Start Game
  // Have to use a delegated event because the button ID does not exist when document.onReady event fires initially
  // http://api.jquery.com/on/#direct-and-delegated-events
  // http://api.jquery.com/delegate/
  $(document).on('click', '#start-game-button', function(event){
    event.preventDefault();
    showMessage('Starting Game', function(){

      //INSERT INTO `game` (ownerID, players, rounds, decks, trump, instant, nascar, scoring, active)
      socket.emit('startGame', {
        ownerId: g.user.id,
        rounds: $('#create-game-form #rounds').val(),
/*        decks: $('#create-game-form #decks').val()
        trump: $('#create-game-form #trump').val(),
        instantBid: $('#create-game-form #instantBid').val(),
        nascar: $('#create-game-form #nascar').val()*/
      });
    });
  });



  function updateConfirmHTML(){
    $('#show-confirm .confirm-name').text(g.user.name);
    $('#show-confirm .confirm-avatar').text(g.user.avatar);
  }

  // Show snackbar message
  function showMessage(msg, callback){
    //console.log(msg);

    // Log on server console...
    socket.emit('snackbarMessage', msg);

    document.querySelector('#snackbar-message')
      .MaterialSnackbar.showSnackbar({
        message: msg,
        timeout: SNACKBAR_TIMEOUT,
//      actionHandler: function(event){},
//      actionText: 'Undo'
    });
    // Have to do the function callback through "setTimeout" function because
    // the stupid snackbar in MDL doesn't allow a native event callback
    if (typeof callback !== 'undefined'){
      setTimeout(callback, SNACKBAR_TIMEOUT + 250);
    }
  }


  /**
   * GAME FUNCTIONS
   */
  function init(){

    // Check if user is already logged in
    if (Cookies.getJSON(COOKIE_NAME)){
      g.user = Cookies.getJSON(COOKIE_NAME);

      console.log(g.user);
      var myString = 'Welcome back, ' + g.user.name + '!';
      alert(myString);

      // If user is already logged in, we can delete the login form HTML
      $('#login').remove();

      // Check if game is already in progress
      if (g.game && g.game.isActive){
        showMessage('Game is already in progress', function(){
          $('#welcome, #game-board').slideToggle(400, function(){
            loadGameBoard();
          });
        });
      }
      else{
        // If user is already logged in, but no game is in progress,
        // the "get started" button should take them to the lobby
        $('#get-started-button-action').click(function(event){
          event.preventDefault();

          // Broadcast to other users
          // This also triggers the socket joining the "game" room
          socket.emit('userJoined', g.user);

          // Switch to lobby view
          $('#welcome, #lobby').slideToggle();
        });
      }
    }
    else{

      // If user is not logged in, when they click, it should show the login dialog
      $('#get-started-button-action').click(function(event){
        event.preventDefault();

        // Switch to lobby view
        $('#welcome, #login').slideToggle();
      })
    }
  }
  function updateUsersInLobby(){
    console.log('Updating users in lobby.');
    console.log(g.users);
    var usersHtml = '';
    for (var i in g.users){
      // Skip null users
      if (g.users[i]){
        usersHtml += '<li class="mdl-list__item mdl-list__item--two-line">';
        usersHtml += '<span class="mdl-list__item-primary-content">';
        usersHtml += '<i class="material-icons mdl-list__item-avatar">person</i>';
        usersHtml += '<span>' + g.users[i].name + '</span>';
        usersHtml += '<span class="mdl-list__item-sub-title">Subtext here X wins X losses X games</span>';
        usersHtml += '</span></li>';
      }
      else{
        console.log('PROBLEM! server returned userArray which includes userID ' + i + ' which is null!');
      }
    }
    $('#usersOnline').html(usersHtml);
  }

  // Load rules dialog
//        $("#rules-dialog .mdl-dialog__content").load("/html/rules.html");


  function loadGameBoard(){
/*    showMessage('Loading Game Board!', function(){
      //$('#game-board').slideToggle();
    });*/

    showMessage('Load game board!');
    /*	g.game = new OhHeck();

    // Setup event renderers
    for (var name in g.game.renderers) {
      g.game.setEventRenderer(name, function (e) {
        e.callback();
      });
    }
    g.game.setEventRenderer('dealcard', webRenderer.dealCard);
    g.game.setEventRenderer('play', webRenderer.play);
    g.game.setEventRenderer('sorthand', webRenderer.sortHand);

    // Setup deal handler
    $('#deal').click(function(e) {
      $(this).hide();
      g.game.message('Dealing...');

      // Deal hand
      getJSON({"op":"dealHand", "gameID":user.currentGameID}, function(data) {
        g.waiting = false;
        getRound();

        // TODO: update bidIndex, currentPlayerIndex, etc on next round
      });
    });

    // Setup start handler
    g.game.setEventRenderer('start', function (e) {
      $('.card').click(function() {
        g.human.useCard(this.card);
      });
      $('.bubble').fadeOut();
      e.callback();
    });

    // Extra setup
    g.game.setEventRenderer('taketrick', webRenderer.takeTrick);
    g.game.setEventRenderer('bid', webRenderer.bid);

    // Preload images
    var imgs = ['horizontal-trick', 'vertical-trick'];
    var img = new Image();
    for (var i = 0; i < imgs.length; i++) {
      img.src = 'images/' + imgs[i] + '.png';
    }


    // Calculate table positions
    var game = games[user.currentGameID];
    g.userOrder = game.users.split(',');
    for (var j=0; j<g.userOrder.length; j++) {
      if (userID == g.userOrder[j]) {
        g.userPosition = j+1;
        break;
      }
    }
    //	doLog('Total players: ' + games[user.currentGameID].numPlayers);
    //	doLog('My position: ' + g.userPosition);

    // Add players class
    if (games[user.currentGameID].numPlayers > 4) {
      $('#wrapper').addClass('wide');
    }
    $('#board').addClass('players-' + games[user.currentGameID].numPlayers);

    var players = [],
      p = null,
      h = '',
      h2 = '',
      uid = null;

    // Add players blocks
    for (var i=0; i<game.players; i++) {
      h += '<div id="player-position-' + (i+1) + '" class="avatar"><div class="userPic"></div><small></small></div>';
      h2 += '<div id="player-position-' + (i+1) + '-bubble" class="bubble"><p></p></div>';
    }
    $('#playersBlock').html(h);
    $('#playersBidBlock').html(h2);

    switch (games[user.currentGameID].numPlayers) {

      // 2 PLAYER GAME
      case 2:

        // Create player 2 (top center)
        uid = g.userOrder[(g.userPosition + 0) % game.players];
        $('#player-position-1 div').addClass('player-' + uid);
        $('#player-position-1 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = oh.VERTICAL_MARGIN;
        p.left = $('#board').width() / 2;
        p.align = "h";
        p.position = 'top';
        p.id = 'player-position-1';
        players.push(p);

        // Create player 1 (bottom)
        uid = g.userOrder[(g.userPosition + 1) % game.players];
        $('#player-position-2 div').addClass('player-' + uid);
        $('#player-position-2 small').text(users[uid].name);
        g.human = new HumanPlayer(users[uid].name);
        g.human.top = $('#board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN;
        g.human.left = $('#board').width() / 2;
        g.human.align = "h";
        g.human.position = 'bottom';
        g.human.id = 'player-position-2';
        players.push(g.human);

        break;

      // 3 PLAYER GAME
      case 3:

        // Create player 2 (left)
        uid = g.userOrder[(g.userPosition + 0) % game.players];
        $('#player-position-1 div').addClass('player-' + uid);
        $('#player-position-1 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = $('#board').height() / 2;
        p.left = oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'left';
        p.id = 'player-position-1';
        players.push(p);

        // Create player 3 (right)
        uid = g.userOrder[(g.userPosition + 1) % game.players];
        $('#player-position-2 div').addClass('player-' + uid);
        $('#player-position-2 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = $('#board').height() / 2;
        p.left = $('#board').width() - oh.CARD_SIZE.height - oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'right';
        p.id = 'player-position-2';
        players.push(p);

        // Create player 1 (bottom)
        uid = g.userOrder[(g.userPosition + 2) % game.players];
        $('#player-position-3 div').addClass('player-' + uid);
        $('#player-position-3 small').text(users[uid].name);
        g.human = new HumanPlayer(users[uid].name);
        g.human.top = $('#board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN;
        g.human.left = $('#board').width() / 2;
        g.human.align = "h";
        g.human.position = 'bottom';
        g.human.id = 'player-position-3';
        players.push(g.human);

        break;

      // 4 PLAYER GAME
      case 4:

        // Create player 2 (left)
        uid = g.userOrder[(g.userPosition + 0) % game.players];
        $('#player-position-1 div').addClass('player-' + uid);
        $('#player-position-1 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = $('#board').height() / 2;
        p.left = oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'left';
        p.id = 'player-position-1';
        players.push(p);

        // Create player 3 (top center)
        uid = g.userOrder[(g.userPosition + 1) % game.players];
        $('#player-position-2 div').addClass('player-' + uid);
        $('#player-position-2 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = oh.VERTICAL_MARGIN;
        p.left = $('#board').width() / 2;
        p.align = "h";
        p.position = 'top';
        p.id = 'player-position-2';
        players.push(p);

        // Create player 4 (right)
        uid = g.userOrder[(g.userPosition + 2) % game.players];
        $('#player-position-3 div').addClass('player-' + uid);
        $('#player-position-3 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = $('#board').height() / 2;
        p.left = $('#board').width() - oh.CARD_SIZE.height - oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'right';
        p.id = 'player-position-3';
        players.push(p);

        // Create player 1 (bottom)
        uid = g.userOrder[(g.userPosition + 3) % game.players];
        $('#player-position-4 div').addClass('player-' + uid);
        $('#player-position-4 small').text(users[uid].name);
        g.human = new HumanPlayer(users[uid].name);
        g.human.top = $('#board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN;
        g.human.left = $('#board').width() / 2;
        g.human.align = "h";
        g.human.position = 'bottom';
        g.human.id = 'player-position-4';
        players.push(g.human);

        break;

      // 5 PLAYER GAME
      case 5:

        // Create player 2 (left)
        uid = g.userOrder[(g.userPosition + 0) % game.players];
        $('#player-position-1 div').addClass('player-' + uid);
        $('#player-position-1 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = $('#board').height() / 2;
        p.left = oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'left';
        p.id = 'player-position-1';
        players.push(p);

        // Create player 3 (top left)
        uid = g.userOrder[(g.userPosition + 1) % game.players];
        $('#player-position-2 div').addClass('player-' + uid);
        $('#player-position-2 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = oh.VERTICAL_MARGIN;
        p.left = 0.3 * $('#board').width();
        p.align = "h";
        p.position = 'topLeft';
        p.id = 'player-position-2';
        players.push(p);

        // Create player 4 (top right)
        uid = g.userOrder[(g.userPosition + 2) % game.players];
        $('#player-position-3 div').addClass('player-' + uid);
        $('#player-position-3 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = oh.VERTICAL_MARGIN;
        p.left = 0.7 * $('#board').width();
        p.align = "h";
        p.position = 'topRight';
        p.id = 'player-position-3';
        players.push(p);

        // Create player 5 (right)
        uid = g.userOrder[(g.userPosition + 3) % game.players];
        $('#player-position-4 div').addClass('player-' + uid);
        $('#player-position-4 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = $('#board').height() / 2;
        p.left = $('#board').width() - oh.CARD_SIZE.height - oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'right';
        p.id = 'player-position-4';
        players.push(p);

        // Create player 1 (bottom)
        uid = g.userOrder[(g.userPosition + 4) % game.players];
        $('#player-position-5 div').addClass('player-' + uid);
        $('#player-position-5 small').text(users[uid].name);
        g.human = new HumanPlayer(users[uid].name);
        g.human.top = $('#board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN;
        g.human.left = $('#board').width() / 2;
        g.human.align = "h";
        g.human.position = 'bottom';
        g.human.id = 'player-position-5';
        players.push(g.human);

        break;

      // 6 PLAYER GAME
      case 6:
      default:

        // Create player 2 (left)
        uid = g.userOrder[(g.userPosition + 0) % game.players];
        $('#player-position-1 div').addClass('player-' + uid);
        $('#player-position-1 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = $('#board').height() / 2;
        p.left = oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'left';
        p.id = 'player-position-1';
        players.push(p);

        // Create player 3 (top left)
        uid = g.userOrder[(g.userPosition + 1) % game.players];
        $('#player-position-2 div').addClass('player-' + uid);
        $('#player-position-2 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = oh.VERTICAL_MARGIN;
        p.left = 0.3 * $('#board').width();
        p.align = "h";
        p.position = 'topLeft';
        p.id = 'player-position-2';
        players.push(p);

        // Create player 4 (top right)
        uid = g.userOrder[(g.userPosition + 2) % game.players];
        $('#player-position-3 div').addClass('player-' + uid);
        $('#player-position-3 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = oh.VERTICAL_MARGIN;
        p.left = 0.7 * $('#board').width();
        p.align = "h";
        p.position = 'topRight';
        p.id = 'player-position-3';
        players.push(p);

        // Create player 5 (right)
        uid = g.userOrder[(g.userPosition + 3) % game.players];
        $('#player-position-4 div').addClass('player-' + uid);
        $('#player-position-4 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = $('#board').height() / 2;
        p.left = $('#board').width() - oh.CARD_SIZE.height - oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'right';
        p.id = 'player-position-4';
        players.push(p);

        // Create player 5 (bottom right)
        uid = g.userOrder[(g.userPosition + 4) % game.players];
        $('#player-position-5 div').addClass('player-' + uid);
        $('#player-position-5 small').text(users[uid].name);
        p = new ComputerPlayer(users[uid].name);
        p.top = $('#board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN;
        p.left = 0.7 * $('#board').width();
        p.align = "h";
        p.position = 'bottomRight';
        p.id = 'player-position-5';
        players.push(p);

        // Create player 1 (bottom left)
        uid = g.userOrder[(g.userPosition + 5) % game.players];
        $('#player-position-6 div').addClass('player-' + uid);
        $('#player-position-6 small').text(users[uid].name);
        g.human = new HumanPlayer(users[uid].name);
        g.human.top = $('#board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN;
        g.human.left = 0.3 * $('#board').width();
        g.human.align = "h";
        g.human.position = 'bottomLeft';
        g.human.id = 'player-position-6';
        players.push(g.human);

        break;
    }

    // Add players
    for (var i=0; i<games[user.currentGameID].numPlayers; i++) {
      var pos = (players.length + i - g.userPosition) % players.length;
      g.game.addPlayer(players[pos]);
    }


    // Set rounds
    g.game.rounds = g.status.game.rounds;
    //	doLog('# rounds in game: ' + g.game.rounds);

    // Set game to current state (if page was reloaded)
    if (g.status.currentRoundID > 0) {

      // In middle of round
      if (g.status.round != null) {
        g.game.cardCount = parseInt(g.status.round.hands, 10);
    //			doLog('Set card count: ' + g.game.cardCount);
        g.game.round = g.status.currentRoundID;
    //			doLog('Set Round: ' + g.game.round);

        // Set dealer index
        g.game.dealerIndex = (g.status.currentRoundID - 2 + g.game.players.length) % g.game.players.length;;
        g.game.nextPlayerToDealTo = g.game.nextIndex(g.game.dealerIndex);
        g.game.currentPlayerIndex = g.game.nextIndex(g.game.dealerIndex);
        g.game.bidPlayerIndex = g.game.currentPlayerIndex;
    //			doLog('Dealer: ' + g.game.dealerIndex);
    //			doLog('Player: ' + g.game.currentPlayerIndex);

        // If cards were already dealt (page reloaded), go ahead and deal
        if (g.status.player[1].hand != null && g.status.player[1].hand) {
    //				doLog('Cards already dealt... deal!');
          g.game.newDeck();
          g.game.deal();
        }
      }
      // Beginning of round
      else {
        g.game.round = g.status.currentRoundID;
    //			doLog('Set Round: ' + g.game.round);

        // Set dealer index to next round
        g.game.dealerIndex = (g.status.currentRoundID - 1) % g.game.players.length;
        g.game.nextPlayerToDealTo = g.game.nextIndex(g.game.dealerIndex);
        g.game.currentPlayerIndex = g.game.nextIndex(g.game.dealerIndex);
        g.game.bidPlayerIndex = g.game.currentPlayerIndex;
    //			doLog('Dealer: ' + g.game.dealerIndex);
    //			doLog('Player: ' + g.game.currentPlayerIndex);
      }
    }
    // Beginning of game
    else {
    //		doLog('No rounds exist yet!');
      g.game.dealerIndex = g.game.players.length - 1;
      g.game.nextPlayerToDealTo = g.game.nextIndex(g.game.dealerIndex);
      g.game.currentPlayerIndex = g.game.nextIndex(g.game.dealerIndex);
      g.game.bidPlayerIndex = g.game.currentPlayerIndex;
    //		doLog('Dealer: ' + g.game.dealerIndex);
    //		doLog('Player: ' + g.game.currentPlayerIndex);
    }
    //	doLog('Seat: ' + (g.status.seatID-1));
    */
  }

});












/***** COPIED FROM OLD GAME *****/
/*
var g = {
	timeout: {
		user: null,
		users: null,
		game: null,
		games: null
	},
	status: {},
	currentRoundID: 0,
	inLobby: true,
	game: null,
	human: null,
	nascar: null,
	cardsDealt: false,
	roundLoading: 0,
	waiting: false,
	userOrder: [],
	userPosition: 0
};

$(document).ready(function() {

	setActiveUser();
	g.timeout.user = setInterval("setActiveUser();", 60000);
	getUsers();
	g.timeout.users = setInterval("getUsers();", 5000);
	getGames();
	g.timeout.games = setInterval("getGames();", 5000);

	// Create game
	$("#create-game").click(function() {
		$("#create-game-form-dialog").dialog({
			height: 300,
			width: 420,
			modal: true,
			buttons: {
				"Create Game": function() {
					var str = $("#create-game-form").serialize() + "&op=createGame";
					getJSON(str, function(data) {
						document.location.reload();
					});
				},
				"Cancel": function() {
					$(this).dialog('destroy');
				}
			}
		});
	});
});

function setActiveUser() {
	if (g.inLobby) {
		getJSON({op:"setActiveUser"}, function(data) {});
	}
}

function getUsers() {
	if (g.inLobby) {
		getJSON({op:"getUsers"}, function(data) {
			users = data.users;
			if (users != {} && users != []) {
				var h = '';

				// Show active users
				for (var i in users) {
					var u = users[i];
					if (u.isActive) {
						h += '<div class="row">';
						h += '<div class="player-' + i + '"></div>';
						h += '<span>' + u.name + '<br />';
						h += 'Games: ' + u.games + '<br />';
						h += 'Wins: ' + u.wins + '</span></div>';
					}
				}
				$('#playersOnline').html(h);
			}
		});
	}
}

function getGames() {
	if (g.inLobby) {
		getJSON({op:"getGames"}, function(data) {
			if (data.has_data && data.numGames > 0) {
				games = data.games;

				var h = '';
				h += '<table>';
				h += '<thead>';
				h += '<tr>';
				h += '<th>Game</th>';
				h += '<th>Seats</th>';
				h += '<th>Players</th>';
				h += '<th>Status</th>';
				h += '</tr>';
				h += '</thead>';
				h += '<tbody>';
				for (var i in games) {
					var ga = games[i];

					// User is in this game
					if (user.currentGameID == ga.id) {

						// Load game
						if (ga.status == 'Play') {

							// Lower timeouts
							g.inLobby = false;
							clearInterval(g.timeout.user);
							clearInterval(g.timeout.users);
							clearInterval(g.timeout.games);

							// User is owner
							if (ga.ownerID == userID) {
								$('#delete').show();
							}

							// Fade out to game board
							$('#lobby-page, .lobby').hide();
							$('#nav').addClass('play');
							$('#board, #nav ul, .play').fadeIn();

							// Load initial data
							getJSON({op:"getRound", gameID:user.currentGameID}, function(data) {
								g.status = data;
								loadGameBoard();
								updateStats();

								// At this point, we don't know if cards have already been dealt or not
								// Delay updates until we *know* dealing is finished (if cards were already dealt)
								g.timeout.game = setInterval("getRound();", 1500);

								// Check if cards are being dealt
								if (g.game.cardsDealt) {
									g.waiting = true;
									setTimeout("g.waiting = false;", 5000);
								}
								else {
									getRound();
								}
							});
						}
					}

					h += '<tr id="game-' + ga.id + '" class="game">';
					h += '<td>GAME #' + ga.id + '</td>';
					h += '<td>' + ga.players + '</td>';

					// Get HTML for users
					h += '<td class="gamesRow">';
					var userOrder = ga.users.split(',');
					for (var i=0; i<userOrder.length; i++) {
						h += '<span class="player-' + userOrder[i] + '"></span>';
					}
					h += '</td>';

					// Game loading
					if (ga.status == 'Wait') {

						// Owner
						if (ga.ownerID == userID) {
							// Update game
							getJSON({op:"setActiveGame", "gameID":user.currentGameID}, function() {});

							// All players are here
							if (ga.numPlayers == ga.players) {
								h += '<td><button id="start-game">Start game</button></td>';
							}
							else {
								h += '<td><button id="delete-game">Delete game</button></td>';
							}
						}

						// Not owner
						else {
							// Game not full
							if (ga.numPlayers < ga.players) {
								if (ga.id != user.currentGameID) {
									h += '<td><button id="join-game">Join game</button></td>';
								}
								else {
									h += '<td><button id="leave-game">Leave game</button></td>';
								}
							}
							// Game full
							else if (ga.id != user.currentGameID) {
								h += '<td>Game Full</td>';
							}
							else {
								h += '<td>Waiting</td>';
							}
						}
					}
					else if (ga.status == 'Play') {
						h += '<td>In Progress</td>';
					}
					h += '</tr>';
				}
				h += '</tbody>';
				h += '</table>';
				$('#activeGames').html(h);

				// Join game
				$('#join-game')
					.click(function () {
						var gameID = $(this).parent().parent().attr('id').substr(5);
						if (confirm('You are about to join game #' + gameID + '. Are you sure?'))
							getJSON({"op":"joinGame", "gameID":gameID}, function(data) {
								document.location.reload();
							});
					});

				// Leave game
				$('#leave-game')
					.click(function () {
						var gameID = $(this).parent().parent().attr('id').substr(5);
						if (confirm('You are about to leave game #' + gameID + '. Are you sure?'))
							getJSON({"op":"leaveGame", "gameID":gameID}, function(data) {
								document.location.reload();
							});
					});

				// Delete game
				$('#delete-game')
					.click(function () {
						var gameID = $(this).parent().parent().attr('id').substr(5);
						if (confirm('This will erase all game data. Are you sure?'))
							getJSON({"op":"deleteGame", "gameID":gameID}, function(data) {
								document.location.reload();
							});
					});

				// Start game
				$("#start-game")
					.click(function() {
						var gameID = $(this).parent().parent().attr('id').substr(5);
						if (confirm('You are about to start game #' + gameID + '. Are you sure?'))
							getJSON({"op":"startGame", "gameID":gameID}, function(data) {
								getGames();
							});
					});
			}
			else {
				$('#activeGames').html('<p>No active games.');
			}
		});
	}
}

function updateStats() {

	// Quick stats (nav bar)
	var trumpSuits = {
		S: "spades",
		H: "hearts",
		D: "diamonds",
		C: "clubs",
		N: ""
	};
	$('#round span').text(g.status.game.currentRoundID + '/' + g.status.game.rounds);
	var bids = '-';
	var trump = 'N';

	if (g.status.round != null) {
		if (g.status.round.bids > g.status.round.hands) {
			var ou = '+' + (g.status.round.bids - g.status.round.hands);
			bids = g.status.round.bids + '/' + g.status.round.hands + ' ' + '<font color="green">(' + ou + ')</font>';
		}
		else if (g.status.round.bids < g.status.round.hands) {
			var ou = '-' + (g.status.round.hands - g.status.round.bids);
			bids = g.status.round.bids + '/' + g.status.round.hands + ' ' + '<font color="red">(' + ou + ')</font>';
		}
		else {
			var ou = 0;
			bids = g.status.round.bids + '/' + g.status.round.hands;
		}
		trump = g.status.round.trump;
	}
	$('#bids span').html(bids);
	$('#trump span').removeClass().addClass(trumpSuits[trump]);

	// Update scoreboard (right sidebar)
	var leader = g.game.players[0];
	var scoreboardHTML = '';
	for (var i=0; i<g.game.players.length; i++) {
		var p = g.game.players[i];

		// Waiting
		var c = (g.game.currentPlayerIndex == i) ? ' current' : '';
		scoreboardHTML += '<div class="row' + c + '">';
		scoreboardHTML += '<div class="player-' + g.status.player[i+1].userID + '"></div>';
		scoreboardHTML += '<span>' + p.name;

		// Check for dealer
		if (g.game.dealerIndex == i) {
			scoreboardHTML += ' - DEALER';
		}
		scoreboardHTML += '<br />';

		// Update player score
		if (g.status.player[i+1].score != p.score) {
			p.score = g.status.player[i+1].score;
		}
		scoreboardHTML += 'Score: ' + p.score;

		scoreboardHTML += '<br />';
		var cb = (p.bidValue < 0) ? '-' : (p.tricks.length + ' / ' + p.bidValue);
		scoreboardHTML += 'Tricks: ' + cb + '</span></div>';
		if (p.score > leader.score) {
			leader = p;
		}
	}
	$('#leader span').text(leader.name + ' (' + leader.score + ')');
	$('#scoreboard').html(scoreboardHTML);
}
*/
