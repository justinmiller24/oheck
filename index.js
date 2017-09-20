
//Import dependencies
var socket = require('socket.io');
var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app).listen(3000, function(){
  console.log("Express server listening on port " + 3000);
});
var io = socket.listen(server);

// Set our static file directory to public
app.use(express.static(__dirname + '/public'));

/*
 * ROUTES
 */
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/html/index.html');
})


/*
 * GLOBALS
 */
var DEFAULT_ROOM = 'general';
var ROOM_LIST = ['general', 'game'];
var allClients = [];
var users = [{}];
var game = {};
var GAME_DEFAULTS = {
  isActive: false,
  currentPlayerId: 0,
  currentRoundId: 0,
  numRounds: 0,
  oheck: {},
  options: {
    // Number of decks
    decks: 1,
    // Force dealer
    forceDealer: true,
    // Instant bidding = true
    instantBid: false,
    // Do nascar 3 rounds before final round
    nascar: false,
    // Allow hands without trump
    // Set to true to allow "trump-less" hands
    noTrump: false,
    // Change number of cards each round
    upDown: false
  },
  // Array of players
  players: [],
  round: {
    bids: 0,
    // Integer between 1 and numTricks
    currentTrickId: 0,
    // Array of cards played
    currentTrickPlayed: [],
    currentBid: 0,
    dealerId: null,
    numTricks: 0,
    // C, S, H, D, or N
    trump: null
  }
};


/*
// Listen for socket connection
io.sockets.on('connection', function(socket) {

   socket.on('disconnect', function() {
      console.log('User got disconnected!');
      var i = allClients.indexOf(socket);
      allClients.splice(i, 1);

      // Broadcast event to users
      //io.in(DEFAULT_ROOM).emit('userDisconnected');
      socket.to('game').emit('userDisconnected');
   });
});*/


io.sockets.on('connection', function(socket) {
  allClients.push(socket);
  console.log('user connected with socket id: ' + socket.id);

  // Initialization
  socket.emit('init', {rooms: ROOM_LIST, users: users, game: game});

  // Force Reload All
  socket.on('forceReloadAll', function(){
    console.log('Force Reload All');

    //TODO: Consider wiping the users array to make users rejoin

    // Send data to all other clients in room except sender
    socket.to('game').emit('forceReloadAll', 'Force Reload All');
  });


  /*
   * USER FUNCTIONS
   */
  socket.on('userLogin', function(data){

    // The first user in the "users" array is null, so no need to increment by 1 here
    data.user.id = users.length;
    users[data.user.id] = data.user;
    console.log('A new user joined and has been assigned user ID: ' + data.user.id);
    console.log('The next user will have ID: ' + users.length);

    // Send data to user that just logged in
    socket.emit('myUserLogin', {userId: data.user.id, users: users});

    // Joins the game room
    socket.join('game');

    // Send data to all other clients in room except sender
    socket.to('game').emit('userJoined', {userId: data.user.id, users: users});
  });

  socket.on('userJoined', function(data){
    users[data.user.id] = data.user;
    console.log('User ' + users[data.user.id].name + ' with ID: ' + data.user.id + ' has returned!');

    // Send data to user that just logged in
    socket.emit('myUserLogin', {userId: data.user.id, users: users});

    // Join the game room
    socket.join('game');

    // Send data to all clients including sender
    io.in('game').emit('userJoined', {userId: data.user.id, users: users});
  });

  socket.on('userLogout', function(data){

    // Prevent error if socket server had been restarted
    if (users[data.userId]){
      console.log('User ' + users[data.userId].name + ' with ID: ' + data.userId + ' has logged out');

      // Remove from user array
      users.splice(data.userId, 1);
      console.log((users.length - 1) + ' users remain online');

      // Broadcast event to users
      socket.to('game').emit('userLogout', {userId: data.userId, users: users});
    }
  });


  /*
   * GAME FUNCTIONS
   */
  socket.on('startGame', function(data){
    console.log(users[data.ownerId].name + ' started the game!');

    // Setup game
    // First person who joined the game bids first
    // Last person who joined the game deals first
    game = GAME_DEFAULTS;
    game.isActive = true;
    game.numRounds = parseInt(data.rounds, 10);
    game.currentRoundId = 0;
    game.currentPlayerId = 1;
    game.players = [];
    for (var i in users){
      if (i && i != "0" && users[i] && users[i].id){
        var playerId = users[i].id;
        game.players.push({
          position: playerId,
          name: users[i].name,
          bid: null,
          tricksTaken: 0,
          hand: [],
          currentHand: [],
          pictureHand: [],
          score: 0
        });
      }
    }
    console.log('players array:');
    console.log(game.players);

    console.log('Game setup and ready for broadcast!');

    // Broadcast event to users
    io.in('game').emit('startGame', {game: game});
  });

  socket.on('dealHand', function(){
    game.currentRoundId++;

    if (game.currentRoundId >= game.numRounds){
      console.log('ERROR - game is complete');
    }

    // Can't deal less than 1 card or more than MAX_CARDS
    var maxCards = Math.floor(52 * game.options.decks / game.players.length);
    var CARDS_TO_DEAL_THIS_ROUND = 10;
    var cardsToDeal = Math.max(1, Math.min(maxCards, CARDS_TO_DEAL_THIS_ROUND));
    var trumpArray = ['D', 'C', 'H', 'S', 'N'];
    var nextTrump = game.options.noTrump ? trumpArray[4] : trumpArray[getRandomInclusive(0,3)];

    // Create new round
    game.round = {
      // Reset how many players have bid
      bids: 0,
      // Reset current trick
      currentTrickId: 0,
      // Clear array of cards played
      currentTrickPlayed: [],
      // Reset current bid
      currentBid: 0,
      // Advance dealer ID based on round
      dealerId: getPlayerPosition(game.currentRoundId - 1),
      // Initialize on each round
      numTricks: cardsToDeal,
      // C, S, H, D, or N
      trump: nextTrump
    };

    // Set current player to person after dealer
    game.currentPlayerId = nextPlayerId(game.round.dealerId);
    console.log('current player id now set to: ' + game.currentPlayerId);

    // Create array of cards
    var cards = [];
    for (var i = 0; i < game.options.decks; i++){
      for (var j = 2; j <= 14; j++){
        cards.push('H' + j);
        cards.push('S' + j);
        cards.push('D' + j);
        cards.push('C' + j);
      }
    }

    // Deal cards
    for (var playerId = 0; playerId < game.players.length; playerId++){
      var playerCards = [];
      for (var i = 0; i < game.round.numTricks; i++){

        // Pick a random card from remaining cards and assign to player
        var random = getRandomInclusive(0, cards.length - 1);
        playerCards.push(cards[random]);
        cards.splice(random, 1);
      }

      // Save player hand
      var player = game.players[playerId];
      player.bid = null;
      player.tricksTaken = 0;
      player.hand = playerCards;
      player.currentHand = playerCards;
      player.pictureHand = [];
    }

    // Broadcast event to users
    console.log(game);
    io.in('game').emit('dealHand', {game: game});
  });

  socket.on('bid', function(data){
    var playerId = data.playerId;
    var currentBid = data.bid;
    console.log('player ' + playerId + ' trying to bid ' + currentBid);

    // Check if round is currently in bidding status
    if (game.round.bids >= game.players.length){
      console.log('ERROR - Player ID ' + playerId + ' tried to bid');
      return;
    }

    // Check for player turn to bid
    if (game.currentPlayerId !== playerId){
      console.log('ERROR - player ' + playerId + ' bid out of turn');
//      io.in('game').emit('error', {msg:'Player bid out of turn'});
      return;
    }

    // Update player bid
    var player = game.players[playerId - 1];
    player.bid = currentBid;
    player.tricksTaken = 0;
    player.pictureHand = [];

    // Update total bids in round
    game.round.bids++;
    game.round.currentBid += currentBid;

    // This was the last player to bid
    if (game.round.bids === game.players.length){
      console.log('last player to bid');
      game.round.currentTrickId = 1;
      game.round.currentTrickPlayed = [];
    }

    // Advance player
    game.currentPlayerId = nextPlayerId(game.currentPlayerId);
    console.log('current player id: ' + game.currentPlayerId);

    // Broadcast event to users
    console.log(game);
    io.in('game').emit('bid', {playerId: data.playerId, bid: currentBid, game: game});

  });

  socket.on('playCard', function(data){
    var card = data.card;
    var playerId = data.playerId;

    // Make sure it is user turn to play
    if (game.currentPlayerId != playerId){
      console.log('PlayerId ' + playerId + ' played out of turn');
      console.log('current player id is ' + game.currentPlayerId);
      return;
    }

    // Make sure user is holding the card played
    var cardPos = game.players[playerId - 1].currentHand.indexOf(card);
    if (cardPos == -1){
      console.log('PlayerId ' + playerId + ' played a card they were not holding: ' + card);
      console.log(card);
      console.log(game.players[playerId - 1].currentHand);
      return;
    }

    // Update card played
    game.round.currentTrickPlayed.push(card);

    // Remove card from player hand
    game.players[playerId - 1].currentHand.splice(cardPos, 1);

    // Check for last card in hand
    if (game.round.currentTrickPlayed.length < game.players.length){
      game.currentPlayerId = nextPlayerId(game.currentPlayerId);
      return;
    }

    // Update hand
    var trickLeaderPlayerId = nextPlayerId(game.currentPlayerId);
    var firstCard = game.round.currentTrickPlayed[0];
    var highCardSeat = trickLeaderPlayerId;
    var highCardSuit = firstCard.substring(0, 1);
    var highCardVal = parseInt(firstCard.substring(1, 2), 10);

    for (var i = 0; i < game.round.currentTrickPlayed.length; i++){
      var thisCard = game.round.currentTrickPlayed[i];
      var thisCardSeat = getPlayerPosition(trickLeaderPlayerId + i - 1);
      var thisCardSuit = thisCard.substring(0, 1);
      var thisCardVal = parseInt(thisCard.substring(1, 2), 10);

      // Trump over no trump
      if (thisCardSuit === game.round.trump && highCardSuit != game.round.trump){
        highCardSeat = thisCardSeat;
        highCardSuit = thisCardSuit;
        highCardVal = thisCardVal;
      }

      // Higher card in same suit
      else if (thisCardSuit === highCardSuit && thisCardVal >= highCardVal) {
        highCardSeat = thisCardSeat;
        highCardSuit = thisCardSuit;
        highCardVal = thisCardVal;
      }
    }

    // Update number of tricks taken by winning player
    game.players[highCardSeat].tricksTaken++;

    // Clear current trick
    game.round.currentTrickPlayed = [];


    // If this is not the last trick in round, then continue
    if (game.round.currentTrickId < game.round.numTricks){
      game.round.currentTrickId++;
      // Winner starts next trick
      game.currentPlayerId = highCardSeat;
      return;
    }

    // Update scores
    for (var i = 0; i < game.players.length; i++){
      var player = game.players[i];
      player.score += (player.tricksTaken === player.bid) ? (player.bid + 10) : player.bid;
    }

    // TODO: check for nascar
    if (game.options.nascar && game.numRounds >= 10 && (game.currentRoundId + 3 === game.numRounds)){
      console.log('Need to do nascar here...');
    }

    // If this is not the last round in game, then continue
    if (game.currentRoundId < game.options.numRounds){
      return;
    }

    // This is the last round in game
    var winningUserId = 1;
    var winningScore = 0;
    for (var i = 0; i < game.players.length; i++){
      var player = game.players[i];
      if (player.score > winningScore){
        winningPlayerId = player.id;
        winningScore = player.score;
      }
    }
    console.log('The winner is ' + game.players[winningPlayerId - 1] + ' with ' + winningScore + ' points!');

    // Broadcast event to users
    io.in('game').emit('playCard', {playerId: data.playerId, cardShortName: data.card, game: game});
  });


  // Log snackbar/console messages to server
  socket.on('snackbarMessage', function(msg) {
    console.log('Snackbar Message from SocketId ' + socket.id + ': ' + msg);
  });

});


/**
 * HELPER FUNCTIONS
 */
function getPlayerPosition(id){
  var position = (id % game.players.length);
/*  if (position === 0){
    position = game.players.length;
  }*/
  return position;
}
function getRandomInclusive(min, max){
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
}

function nextPlayerId(playerId){
  return playerId % game.players.length + 1;
}

function notifyNextPlayer(){
  // Send data to all clients
//  io.in('game').emit('notifyNextPlayer', {game: game, playerId: game.currentPlayerId});
}
