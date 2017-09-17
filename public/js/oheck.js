/*
 * OH HECK - Card Game
 * Created by Justin Miller on 9.1.2017
 */

// Globals
var COOKIE_NAME = 'oheck';
var SNACKBAR_TIMEOUT = 1000;
var g = {
  user: {
    id: null,
    name: null,
    avatar: 0,
    games: 0,
    wins: 0
  },
  rooms: [],
  users: [],
  game: {},
  oheck: {},
  socket: null
}


$(document).ready(function(){

  /**
   * SOCKET.IO EVENTS
   */

  // Connect to Socket.IO
  g.socket = io();

  g.socket.on('init', function(data){
    console.log(data);
    showMessage('Loading...');
    g.rooms = data.rooms;
    g.users = data.users;
    g.game = data.game;

    // Existing game is in progress
    if (g.game.isActive){
      // If user is logged in, send into existing game
      if (Cookies.getJSON(COOKIE_NAME)){
        // Broadcast to other users
        // This also triggers the socket joining the "game" room
        g.socket.emit('userJoined', {user: g.user});
        sendUserToExistingGame();
      }
    }
    else{
      updateUsersInLobby();
    }
  });

  g.socket.on('myUserLogin', function(data){
    g.users = data.users;
    g.user.id = data.userId;

    // Save to cookie
    Cookies.set(COOKIE_NAME, g.user);
    updateUsersInLobby();
  });

  g.socket.on('userJoined', function(data){
    g.users = data.users;

    if (g.users[data.userId] && g.users[data.userId].name){
      var loggedInUserName = g.users[data.userId].name;
      showMessage('New user ' + loggedInUserName + ' has arrived');
      updateUsersInLobby();
    }
  });

  g.socket.on('userLogout', function(data){
    g.users = data.users;

    // Find user
    if (g.users[data.userId] && g.users[data.userId].name){
      var loggedOutUserName = g.users[data.userId].name;
      showMessage(loggedOutUserName + ' logged out');
      updateUsersInLobby();
    }
  });

  g.socket.on('forceReloadAll', function(data){
    showMessage('Reloading...', function(){
      window.location.reload();
    });
  });

/*  g.socket.on('userDisconnected', function(data){
    console.log('Some user disconnected');
    //showMessage('User Disconnected event received');
  });*/

  g.socket.on('startGame', function(data){
//    console.log(data);
    g.game = data.game;
    showMessage('Starting Game!', function(){
      $.modal.close();
      $('#lobby, #game-board').slideToggle();
      loadGameBoard();
    });
  });

  g.socket.on('dealHand', function(data){
//    console.log(data);
    g.game = data.game;
    //g.game.playerId = g.user.id + 1;
    //g.game.playerId = g.user.id;
    dealCards();
    checkForBidding();
  });

  g.socket.on('playerBid', function(data){
    console.log(data);
    g.game = data.game;
    //g.oheck.bid(g.oheck.players[g.oheck.bidPlayerIndex], g.game.players[g.oheck.bidPlayerIndex+1].bid);
    g.oheck.bid(data.playerId, data.bid);

    // Need to bid
    if (g.game.round.bids < g.game.players.length){
      checkForBidding();
    }
    else{
      checkForPlaying();
    }
  });


  /**
   * Login dialogs
   */

  // Enter name
  $('#select-name form').submit(function(e){
    e.preventDefault();
    g.user.name = this.name.value;

    // Update confirmation HTML
    updateConfirmHTML();

    // Simulate click on next tab
    $("#login .mdl-tabs__tab:eq(1) span").click();
  });

  // Select avatar
  $('#select-avatar form button').click(function(){
    g.user.avatar = $(this).attr('id');
  });
  $('#select-avatar form').submit(function(e){
    e.preventDefault();

    // Update confirmation HTML
    updateConfirmHTML();

    // Simulate click on next tab
    $("#login .mdl-tabs__tab:eq(2) span").click();
  });

  // Sign in
  // Wait to save cookie until server response via "myUserLogin" socket event
  $('#sign-in-button').click(function(e){
    e.preventDefault();

    // Broadcast to users
    g.socket.emit('userLogin', {user: g.user});

    showMessage('Logging In', function(){
      updateUsersInLobby();
      $('#login, #lobby').slideToggle();
    });
  });

  // Logout
  // Have to use a delegated event because the button ID does not exist when document.onReady event fires initially
  // http://api.jquery.com/on/#direct-and-delegated-events
  // http://api.jquery.com/delegate/
  $(document).on('click', '#logout-button', function(event){
    event.preventDefault();

    g.socket.emit('userLogout', {userId: g.user.id});
    Cookies.remove(COOKIE_NAME);
    location.reload();
  });

  // Force Reload
  $('#force-reload').click(function(){
    g.socket.emit('forceReloadAll', 'Force Reload All Clients');
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

    //TODO: add options for "decks", "trump", "instantBid", and "nascar"
    g.socket.emit('startGame', {ownerId: g.user.id, rounds: $('#create-game-form #rounds').val() });
  });


  function updateConfirmHTML(){
    $('#show-confirm .confirm-name').text(g.user.name);
    $('#show-confirm .confirm-avatar').text(g.user.avatar);
  }

  // Show snackbar message
  function showMessage(msg, callback){
//    console.log(msg);

    // Log on server console...
//    g.socket.emit('snackbarMessage', msg);

    document.querySelector('#snackbar-message')
      .MaterialSnackbar.showSnackbar({
        message: msg,
        timeout: SNACKBAR_TIMEOUT
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
      console.log('User is already logged in -- ');
      console.log(g.user);
//      var myString = 'Welcome back, ' + g.user.name + '!';
//      alert(myString);

      // Delete login form HTML since user is already logged in
      $('#login').remove();

      // The "get started" button should take user to lobby if no game is in progress
      $('#get-started-button-action').click(function(e){
        e.preventDefault();

        // Broadcast to other users
        // This also triggers the socket joining the "game" room
        g.socket.emit('userJoined', {user: g.user});

        // Switch to lobby view
        $('#welcome, #lobby').slideToggle();
      });
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

  function checkForDealing(){

    // My turn to deal
    //if (g.oheck.dealerIndex == g.game.playerId){
    if (g.game.currentDealerId == g.game.playerId){
      g.oheck.message('Waiting for you to deal!');
      $('#deal').fadeIn();
    }

    // Waiting for another player to deal
    else {
      //g.oheck.message('Waiting for ' + g.oheck.players[g.oheck.dealerIndex-1].name + ' to deal');
      g.oheck.message('Waiting for ' + getPlayerName(g.game.currentDealerId) + ' to deal');
      $('#deal').hide();
    }
  }

  function checkForBidding(){

    // My turn to bid
    if (g.game.currentPlayerId == g.game.playerId){
    //if (g.oheck.currentPlayerIndex == g.game.playerId){
      g.oheck.message('Waiting for you to bid!');
      g.human.startBid();
    }

    // Waiting for another player to bid
    else{
      //g.oheck.message('Waiting for ' + g.oheck.players[g.oheck.currentPlayerIndex-1].name + ' to bid!');
      g.oheck.message('Waiting for ' + getCurrentPlayerName() + ' to bid');
    }
  }

  function checkForPlaying(){
    console.log('Time to play!');
  }

  function createPlayers(){
    var players = [],
      p = null,
      h = '',
      h2 = '',
      thisPlayer = null;

    // Add players blocks
    for (var i = 1; i <= g.game.players.length; i++) {
      h += '<div id="player-position-' + i + '" class="avatar"><div class="userPic"></div><small></small></div>';
      h2 += '<div id="player-position-' + i + '-bubble" class="bubble"><p></p></div>';
    }
    $('#playersBlock').html(h);
    $('#playersBidBlock').html(h2);

    switch (g.game.players.length) {

      // 2 PLAYER GAME
      case 2:

        // Create player 2 (top center)
        thisPlayer = g.game.players[(g.game.playerId + 0) % g.game.players.length];
        $('#player-position-1 div').addClass('player-' + thisPlayer.position);
        $('#player-position-1 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = oh.VERTICAL_MARGIN;
        p.left = $('#game-board').width() / 2;
        p.align = "h";
        p.position = 'top';
        p.id = 'player-position-1';
        players.push(p);

        // Create player 1 (bottom)
        thisPlayer = g.game.players[(g.game.playerId + 1) % g.game.players.length];
        $('#player-position-2 div').addClass('player-' + thisPlayer.position);
        $('#player-position-2 small').text(thisPlayer.name);
        g.human = new HumanPlayer(thisPlayer.name);
        g.human.top = $('#game-board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN;
        g.human.left = $('#game-board').width() / 2;
        g.human.align = "h";
        g.human.position = 'bottom';
        g.human.id = 'player-position-2';
        players.push(g.human);

        break;

      // 3 PLAYER GAME
      case 3:

        // Create player 2 (left)
        thisPlayer = g.game.players[(g.game.playerId + 0) % g.game.players.length];
        $('#player-position-1 div').addClass('player-' + thisPlayer.position);
        $('#player-position-1 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = $('#game-board').height() / 2;
        p.left = oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'left';
        p.id = 'player-position-1';
        players.push(p);

        // Create player 3 (right)
        thisPlayer = g.game.players[(g.game.playerId + 1) % g.game.players.length];
        $('#player-position-2 div').addClass('player-' + thisPlayer.position);
        $('#player-position-2 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = $('#game-board').height() / 2;
        p.left = $('#game-board').width() - oh.CARD_SIZE.height - oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'right';
        p.id = 'player-position-2';
        players.push(p);

        // Create player 1 (bottom)
        thisPlayer = g.game.players[(g.game.playerId + 2) % g.game.players.length];
        $('#player-position-3 div').addClass('player-' + thisPlayer.position);
        $('#player-position-3 small').text(g.users[thisPlayer.position].name);
        g.human = new HumanPlayer(thisPlayer.name);
        g.human.top = $('#game-board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN;
        g.human.left = $('#game-board').width() / 2;
        g.human.align = "h";
        g.human.position = 'bottom';
        g.human.id = 'player-position-3';
        players.push(g.human);

        break;

      // 4 PLAYER GAME
      case 4:

        // Create player 2 (left)
        thisPlayer = g.game.players[(g.game.playerId + 0) % g.game.players.length];
        $('#player-position-1 div').addClass('player-' + thisPlayer.position);
        $('#player-position-1 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = $('#game-board').height() / 2;
        p.left = oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'left';
        p.id = 'player-position-1';
        players.push(p);

        // Create player 3 (top center)
        thisPlayer = g.game.players[(g.game.playerId + 1) % g.game.players.length];
        $('#player-position-2 div').addClass('player-' + thisPlayer.position);
        $('#player-position-2 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = oh.VERTICAL_MARGIN;
        p.left = $('#game-board').width() / 2;
        p.align = "h";
        p.position = 'top';
        p.id = 'player-position-2';
        players.push(p);

        // Create player 4 (right)
        thisPlayer = g.game.players[(g.game.playerId + 2) % g.game.players.length];
        $('#player-position-3 div').addClass('player-' + thisPlayer.position);
        $('#player-position-3 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = $('#game-board').height() / 2;
        p.left = $('#game-board').width() - oh.CARD_SIZE.height - oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'right';
        p.id = 'player-position-3';
        players.push(p);

        // Create player 1 (bottom)
        thisPlayer = g.game.players[(g.game.playerId + 3) % g.game.players.length];
        $('#player-position-4 div').addClass('player-' + thisPlayer.position);
        $('#player-position-4 small').text(thisPlayer.name);
        g.human = new HumanPlayer(thisPlayer.name);
        g.human.top = $('#game-board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN;
        g.human.left = $('#game-board').width() / 2;
        g.human.align = "h";
        g.human.position = 'bottom';
        g.human.id = 'player-position-4';
        players.push(g.human);

        break;

      // 5 PLAYER GAME
      case 5:

        // Create player 2 (left)
        thisPlayer = g.game.players[(g.game.playerId + 0) % g.game.players.length];
        $('#player-position-1 div').addClass('player-' + thisPlayer.position);
        $('#player-position-1 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = $('#game-board').height() / 2;
        p.left = oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'left';
        p.id = 'player-position-1';
        players.push(p);

        // Create player 3 (top left)
        thisPlayer = g.game.players[(g.game.playerId + 1) % g.game.players.length];
        $('#player-position-2 div').addClass('player-' + thisPlayer.position);
        $('#player-position-2 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = oh.VERTICAL_MARGIN;
        p.left = 0.3 * $('#game-board').width();
        p.align = "h";
        p.position = 'topLeft';
        p.id = 'player-position-2';
        players.push(p);

        // Create player 4 (top right)
        thisPlayer = g.game.players[(g.game.playerId + 2) % g.game.players.length];
        $('#player-position-3 div').addClass('player-' + thisPlayer.position);
        $('#player-position-3 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = oh.VERTICAL_MARGIN;
        p.left = 0.7 * $('#game-board').width();
        p.align = "h";
        p.position = 'topRight';
        p.id = 'player-position-3';
        players.push(p);

        // Create player 5 (right)
        thisPlayer = g.game.players[(g.game.playerId + 3) % g.game.players.length];
        $('#player-position-4 div').addClass('player-' + thisPlayer.position);
        $('#player-position-4 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = $('#game-board').height() / 2;
        p.left = $('#game-board').width() - oh.CARD_SIZE.height - oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'right';
        p.id = 'player-position-4';
        players.push(p);

        // Create player 1 (bottom)
        thisPlayer = g.game.players[(g.game.playerId + 4) % g.game.players.length];
        $('#player-position-5 div').addClass('player-' + thisPlayer.position);
        $('#player-position-5 small').text(thisPlayer.name);
        g.human = new HumanPlayer(thisPlayer.name);
        g.human.top = $('#game-board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN;
        g.human.left = $('#game-board').width() / 2;
        g.human.align = "h";
        g.human.position = 'bottom';
        g.human.id = 'player-position-5';
        players.push(g.human);

        break;

      // 6 PLAYER GAME
      case 6:
      default:

        // Create player 2 (left)
        thisPlayer = g.game.players[(g.game.playerId + 0) % g.game.players.length];
        $('#player-position-1 div').addClass('player-' + thisPlayer.position);
        $('#player-position-1 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = $('#game-board').height() / 2;
        p.left = oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'left';
        p.id = 'player-position-1';
        players.push(p);

        // Create player 3 (top left)
        thisPlayer = g.game.players[(g.game.playerId + 1) % g.game.players.length];
        $('#player-position-2 div').addClass('player-' + thisPlayer.position);
        $('#player-position-2 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = oh.VERTICAL_MARGIN;
        p.left = 0.3 * $('#game-board').width();
        p.align = "h";
        p.position = 'topLeft';
        p.id = 'player-position-2';
        players.push(p);

        // Create player 4 (top right)
        thisPlayer = g.game.players[(g.game.playerId + 2) % g.game.players.length];
        $('#player-position-3 div').addClass('player-' + thisPlayer.position);
        $('#player-position-3 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = oh.VERTICAL_MARGIN;
        p.left = 0.7 * $('#game-board').width();
        p.align = "h";
        p.position = 'topRight';
        p.id = 'player-position-3';
        players.push(p);

        // Create player 5 (right)
        thisPlayer = g.game.players[(g.game.playerId + 3) % g.game.players.length];
        $('#player-position-4 div').addClass('player-' + thisPlayer.position);
        $('#player-position-4 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = $('#game-board').height() / 2;
        p.left = $('#game-board').width() - oh.CARD_SIZE.height - oh.HORIZONTAL_MARGIN;
        p.align = "v";
        p.position = 'right';
        p.id = 'player-position-4';
        players.push(p);

        // Create player 5 (bottom right)
        thisPlayer = g.game.players[(g.game.playerId + 4) % g.game.players.length];
        $('#player-position-5 div').addClass('player-' + thisPlayer.position);
        $('#player-position-5 small').text(thisPlayer.name);
        p = new ComputerPlayer(thisPlayer.name);
        p.top = $('#game-board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN;
        p.left = 0.7 * $('#game-board').width();
        p.align = "h";
        p.position = 'bottomRight';
        p.id = 'player-position-5';
        players.push(p);

        // Create player 1 (bottom left)
        thisPlayer = g.game.players[(g.game.playerId + 5) % g.game.players.length];
        $('#player-position-6 div').addClass('player-' + thisPlayer.position);
        $('#player-position-6 small').text(thisPlayer.name);
        g.human = new HumanPlayer(thisPlayer.name);
        g.human.top = $('#game-board').height() - oh.CARD_SIZE.height - oh.VERTICAL_MARGIN;
        g.human.left = 0.3 * $('#game-board').width();
        g.human.align = "h";
        g.human.position = 'bottomLeft';
        g.human.id = 'player-position-6';
        players.push(g.human);

        break;
    }

    // Add players
    console.log('adding players...');
    for (var i = 0; i < g.game.players.length; i++){
      var position = (players.length + i - g.game.playerId) % players.length;
      console.log('adding player in position: ' + position);
      g.oheck.addPlayer(players[position]);
    }

  }

  function dealCards(){
    g.oheck.newDeck();
    g.oheck.deal();
    g.oheck.cardCount = g.game.round.numTricks;
    g.oheck.round = g.game.currentRoundId;
  }

  function getCurrentPlayerName(){
    return getPlayerName(g.game.currentPlayerId);
  }

  function getPlayerName(id){
    return g.game.players[id].name;
  }

  function loadGameBoard(){
  	g.oheck = new OHeck();

    // Setup event renderers
    for (var name in g.oheck.renderers){
      g.oheck.setEventRenderer(name, function(e) {
        e.callback();
      });
    }
    g.oheck.setEventRenderer('dealcard', webRenderer.dealCard);
    g.oheck.setEventRenderer('play', webRenderer.play);
    g.oheck.setEventRenderer('sorthand', webRenderer.sortHand);

    // Setup deal handler
    $('#deal').click(function(e) {
      $(this).hide();

      // Deal hand
      g.socket.emit('dealHand');

      //TODO: update bidIndex, currentPlayerIndex, etc on next round
    });

    // Setup start handler
    g.oheck.setEventRenderer('start', function(e){
      $('.card').click(function() {
        g.human.useCard(this.card);
      });
      $('.bubble').fadeOut();
      e.callback();
    });

    // Extra setup
    g.oheck.setEventRenderer('taketrick', webRenderer.takeTrick);
    g.oheck.setEventRenderer('bid', webRenderer.bid);

    // Preload images
    var imgs = ['horizontal-trick', 'vertical-trick'];
    var img = new Image();
    for (var i = 0; i < imgs.length; i++) {
      img.src = 'img/' + imgs[i] + '.png';
    }

    // Seat assignment
    g.game.playerId = g.user.id;
    showMessage('My position: ' + g.game.playerId + '/' + g.game.players.length);
    console.log('Players Array:');
    for (var i = 0; i < g.game.players.length; i++){
      console.log(g.game.players[i]);
    }

    // Setup game board
    if (g.game.players.length > 4){
      $('#wrapper').addClass('wide');
    }
    $('#game-board').addClass('players-' + g.game.players.length);

    // Create players
    createPlayers();

    // Create game
    // First person who joined the game bids first
    // Last person who joined the game deals first
    g.oheck.rounds = g.game.numRounds;
    g.oheck.dealerIndex = g.game.currentDealerId;
    g.oheck.nextPlayerToDealTo = g.oheck.nextIndex(g.oheck.dealerIndex);
    g.oheck.currentPlayerIndex = g.oheck.nextIndex(g.oheck.dealerIndex);
    g.oheck.bidPlayerIndex = g.oheck.currentPlayerIndex;
    console.log('No rounds exist yet!');
    console.log('Dealer: ' + g.oheck.dealerIndex);
    console.log('Player: ' + g.oheck.currentPlayerIndex);
    console.log('PlayerId: ' + g.game.playerId);

    // Need to deal
    if (!g.game.players[1].hand.length){
      checkForDealing();
      return;
    }

    // Deal
    dealCards();

    // Need to bid
    if (g.game.round.bids < g.game.players.length){
      checkForBidding();
      return;
    }

    // Need to play
    checkForPlaying();
  }

  function sendUserToExistingGame(){
    showMessage('Game is already in progress', function(){
      $('#welcome, #game-board').slideToggle();
      loadGameBoard();
    });
  }

  function updateUsersInLobby(){
    var usersHtml = '';
    for (var i in g.users){
      // Skip null users
      if (g.users[i]){
        usersHtml += '<li class="mdl-list__item mdl-list__item--two-line">';
        usersHtml += '<span class="mdl-list__item-primary-content">';
        usersHtml += '<i class="material-icons mdl-list__item-avatar">person</i>';
        usersHtml += '<span>' + g.users[i].name + '</span>';
        usersHtml += '<span class="mdl-list__item-sub-title">' + g.users[i].wins + ' wins / ' + g.users[i].games + ' games</span>';
        usersHtml += '</span></li>';
      }
    }
    $('#usersOnline').html(usersHtml);

    // Only show "create game" button if there are 2-6 users waiting
    var usersOnline = $('#usersOnline li').length;
    console.log('users online: ' + usersOnline);
    if (usersOnline >= 2 && usersOnline <= 6){
      $('#create-game-button').removeAttr('disabled', 'disabled');
      $('#create-game-button-link').attr('href', '/html/create-game.html').attr('rel', 'modal:open');
    }
    else{
      $('#create-game-button').attr('disabled', 'disabled');
      $('#create-game-button-link').attr('href', '#').removeAttr('rel', 'modal:open').attr('onclick', 'javascript:return false;');
    }
  }

  // Initialize
  init();

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
	var leader = g.oheck.players[0];
	var scoreboardHTML = '';
	for (var i=0; i<g.oheck.players.length; i++) {
		var p = g.oheck.players[i];

		// Waiting
		var c = (g.oheck.currentPlayerIndex == i) ? ' current' : '';
		scoreboardHTML += '<div class="row' + c + '">';
		scoreboardHTML += '<div class="player-' + g.status.player[i+1].userID + '"></div>';
		scoreboardHTML += '<span>' + p.name;

		// Check for dealer
		if (g.oheck.dealerIndex == i) {
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
