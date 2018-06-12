
//Import dependencies
var socket = require('socket.io');
var express = require('express');
var http = require('http');
var app = express();
// Set port to 80 for production
// Set port to 3000 (or something else) for local development
var port = 80;
//var port = 3000;

var server = http.createServer(app).listen(port, function(){
  console.log("Express server listening on port " + port);
});
var io = socket.listen(server);

// Set our static file directory to public
app.use(express.static(__dirname + '/public'));

/*
 * ROUTES
 */
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/html/index.html');
})


/*
 * GLOBALS
 */
var DEFAULT_ROOM = 'general';
var ROOM_LIST = ['general', 'game'];
var allClients = [];
var users = [];
var game = {};
var history = [];
var GAME_DEFAULTS = {
  isActive: false,
  currentPlayerId: 0,
  currentRoundId: 0,
  oheck: {},
  options: {
    decks: 1,           // Number of decks to use
//  forceDealer: true,  // Force dealer (total bids cannot equal total cards)
//  instantBid: false,  // Set to "true" to force instant bidding
    nascar: false,      // Nascar scoring = 3 rounds before final for games of 10+
    rounds: 0,          // Number of rounds in game
    trump: true,        // Set to "false" to allow "trump-less" hands
//  upDown: false       // Change number of cards each round
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
    history.push({
     op: 'disconnect',
     data: {userId: allClients.indexOf(socket)}
  });

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
  console.log('User connected with Socket ID: ' + socket.id);

  // Initialization
  socket.emit('init', {users: users, game: game});


  // Disconnect
  socket.on('disconnect', function(){
    console.log('User lost socket connection with Socket ID: ' + socket.id);

    //TODO: broadcast to other users?
    // Send update to all other clients
    //socket.to('game').emit('socketDisconnected', socket.id);
  });


  // Force Reload All
  socket.on('forceReloadAll', function(){
    history.push({
      op: 'forceReloadAll'
    });

    console.log('Force Reload All');

    // Send data to all clients including sender
    io.in('game').emit('forceReloadAll', 'Force Reload All');
  });


  /*
   * USER FUNCTIONS
   */
  socket.on('userLogin', function(data){
    history.push({
      op: 'userLogin',
      data: data
    });

    // Set next userId
    data.user.id = users.length + 1;
    users.push(data.user);
    console.log('The following user has joined:');
//    console.log('A new user joined and has been assigned user ID: ' + data.user.id);
//    console.log('User Name: ' + users[data.user.id - 1].name);
    console.log('User Name: ' + data.user.name);
    console.log('User ID: ' + data.user.id);
    console.log('Socket ID: ' + socket.id);

    // Send data to user that just logged in
    socket.emit('myUserLogin', {userId: data.user.id, users: users, history: history});

    // Joins the game room
    socket.join('game');

    // Send data to all other clients in room except sender
    socket.to('game').emit('userJoined', {userId: data.user.id, users: users});
  });

  socket.on('userJoined', function(data){
    history.push({
      op: 'userJoined',
      data: data
    });

    users[data.user.id - 1] = data.user;
    console.log('The following user has returned:');
//    console.log('User with ID: ' + data.user.id + ' (' + users[data.user.id - 1].name + ') has returned!');
    console.log('User Name: ' + users[data.user.id - 1].name);
    console.log('User ID: ' + data.user.id);
    console.log('Socket ID: ' + socket.id);

    // Send data to user that just logged in
    socket.emit('myUserLogin', {userId: data.user.id, users: users, history: history});

    // Join the game room
    socket.join('game');

    // Send data to all clients including sender
    io.in('game').emit('userJoined', {userId: data.user.id, users: users});
  });

  socket.on('userLogout', function(data){
    history.push({
      op: 'userLogout',
      data: data
    });

    // Prevent error if socket server had been restarted
    if (users[data.userId - 1]){
      console.log('User with ID: ' + data.userId + ' (' + users[data.userId - 1].name + ') has logged out');

      // Remove from user array
      users.splice(data.userId - 1, 1);
      console.log('There are now ' + users.length + ' users online');

      // Broadcast event to users
      socket.to('game').emit('userLogout', {userId: data.userId, users: users});
    }
  });


  /*
   * GAME FUNCTIONS
   */
  socket.on('startGame', function(data){
    history.push({
      op: 'startGame',
      data: data
    });

    console.log(users[data.ownerId - 1].name + ' started the game!');

    // Setup game
    // First person who joined the game bids first
    // Last person who joined the game deals first
    game = GAME_DEFAULTS;
    game.isActive = true;
    game.options = {
      decks: data.decks,
      nascar: data.nascar,
      rounds: data.rounds,
      trump: data.trump
    }
    game.currentRoundId = 0;
    game.currentPlayerId = -1;
    game.players = [];
    for (var i in users){
      var user = users[i];
      var playerId = user.id - 1;
      game.players.push({
        id: playerId,
        name: user.name,
        bid: null,
        tricksTaken: 0,
        hand: [],
        currentHand: [],
//        pictureHand: [],
        score: 0
      });
    }
    // Set current player ID to last player ID to start
    game.currentPlayerId += game.players.length;
    console.log('Game Created!');
    console.log(game);

    // Broadcast event to users
    io.in('game').emit('startGame', {game: game});
  });

  socket.on('dealHand', function(){
    history.push({
      op: 'dealHand'
    });

    game.currentRoundId++;

    // Deal as many cards as we can but no more than 12 due to space
    var maxCards = Math.floor(52 * game.options.decks / game.players.length);
    var cardsToDeal = Math.min(maxCards, 12);

    // Can't deal less than 1 card or more than MAX_CARDS
    //var CARDS_TO_DEAL_THIS_ROUND = 12;
    //var cardsToDeal = Math.max(1, Math.min(maxCards, CARDS_TO_DEAL_THIS_ROUND));
    var trumpArray = ['D', 'C', 'H', 'S'];
    var nextTrump = game.options.trump ? trumpArray[getRandomInclusive(0,3)] : 'N';

    // Create new round and reset all variables
    game.round = {
      bids: 0,                  // How many players have bid
      currentTrickId: 0,        // Current trick
      currentTrickPlayed: [],   // Array of cards played
      currentBid: 0,            // Current bid
      // Advance dealer ID based on round
      dealerId: getPlayerId(game.currentRoundId + game.players.length - 2),
      numTricks: cardsToDeal,  // Initialize on each round
      trump: nextTrump          // C, S, H, D, or N
    };

    // Set current player to person after dealer
    game.currentPlayerId = nextPlayerId(game.round.dealerId);
    console.log('Current Dealer ID: ' + game.round.dealerId);
    console.log('Current Player ID: ' + game.currentPlayerId);

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
//      player.pictureHand = [];
    }

    // Broadcast event to users
    console.log(game);
    io.in('game').emit('dealHand', {game: game});
  });

  // Restart Hand
  socket.on('restartHand', function(){
    history.push({
      op: 'restartHand'
    });

    console.log('Restart Hand...');

    // Send data to all clients including sender
    io.in('game').emit('restartHand', 'Restart Hand');
  });

  socket.on('bid', function(data){
    history.push({
      op: 'bid',
      data: data
    });

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
    var player = game.players[playerId];
    player.bid = currentBid;
    player.tricksTaken = 0;
//    player.pictureHand = [];

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
    history.push({
      op: 'playCard',
      data: data
    });

    var card = data.card;
    var playerId = data.playerId;
    console.log('PlayerId: ' + playerId + ' attempting to play card: ' + card);

    // Make sure we're not bidding
    if (game.round.currentTrickId < 0){
      console.log('PlayerId ' + playerId + ' played while we are still bidding');
      socket.emit('showMessage', {message: 'It is not your turn!'});
      return;
    }

    // Make sure it is user turn to play
    if (game.currentPlayerId != playerId){
      console.log('PlayerId ' + playerId + ' played out of turn');
      console.log('current player id is ' + game.currentPlayerId);
      socket.emit('showMessage', {message: 'It is not your turn!'});
      return;
    }

    // Make sure user is holding the card played
    var cardPos = game.players[playerId].currentHand.indexOf(card);
    if (cardPos == -1){
      console.log('PlayerId ' + playerId + ' played a card they were not holding: ' + card);
      console.log(game.players[playerId].currentHand);
      socket.emit('showMessage', {message: 'You played a card not in your hand!'});
      return;
    }

    // Make sure user is following suit
    if (game.round.currentTrickPlayed.length > 0 && game.round.currentTrickPlayed[0].substring(0,1) != card.substring(0,1)){
      var leadingCardSuit = game.round.currentTrickPlayed[0].substring(0,1);
      // Loop through player hand to determine if they have any cards that have to follow suit
      for (var i in game.players[playerId].currentHand){
        if (leadingCardSuit === game.players[playerId].currentHand[i].substring(0,1)){
          console.log('PlayerId ' + playerId + ' played a card not following suit: ' + card);
          console.log('Leading trick played: ' + game.round.currentTrickPlayed[0]);
          socket.emit('showMessage', {message: 'You must follow suit!'});
          return;
        }
      }
    }

    // Update card played
    game.round.currentTrickPlayed.push(card);
    console.log('Current Trick Played is now:');
    console.log(game.round.currentTrickPlayed);

    // Remove card from player hand
    game.players[playerId].currentHand.splice(cardPos, 1);
    console.log('Player ' + playerId + ' hand remaining is now:');
    console.log(game.players[playerId].currentHand);

    // Not last card in trick
    // Advance player ID and broadcast event to users
    if (game.round.currentTrickPlayed.length < game.players.length){
      game.currentPlayerId = nextPlayerId(game.currentPlayerId);
      io.in('game').emit('playCard', {playerId: data.playerId, cardShortName: data.card, game: game});
    }

    // Last card in trick
    // Determine next player ID based on who wins trick and broadcast event to users
    else{

      // Determine winner of current trick
      var trickLeaderPlayerId = nextPlayerId(game.currentPlayerId);
      console.log('set trick leader player id: ' + trickLeaderPlayerId);
      var firstCard = game.round.currentTrickPlayed[0];
      var highCardSeat = trickLeaderPlayerId;
      var highCardSuit = firstCard.substring(0, 1);
      var highCardVal = parseInt(firstCard.substring(1), 10);

      for (var i = 0; i < game.round.currentTrickPlayed.length; i++){
        var thisCard = game.round.currentTrickPlayed[i];
        var thisCardSeat = getPlayerId(trickLeaderPlayerId + i);
        var thisCardSuit = thisCard.substring(0, 1);
        var thisCardVal = parseInt(thisCard.substring(1), 10);

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
      console.log('highest card from player in seat: ' + highCardSeat + ' with card: ' + highCardVal + highCardSuit);
      game.players[highCardSeat].tricksTaken++;
      console.log('playerId ' + highCardSeat + ' now has ' + game.players[highCardSeat].tricksTaken + ' tricks');

      // Clear current trick
      game.round.currentTrickPlayed = [];

      // If this is not the last trick in round, then continue
      if (game.round.currentTrickId < game.round.numTricks){
        game.round.currentTrickId++;
        // Winner starts next trick
        console.log('set current player to winner of last round: ' + highCardSeat);
        game.currentPlayerId = highCardSeat;
        io.in('game').emit('playCard', {playerId: data.playerId, cardShortName: data.card, game: game});

        // Broadcast event to users
//        io.in('game').emit('takeTrick', {playerId: highCardSeat, game: game});
      }

      else{

        // Broadcast event to users
        io.in('game').emit('playCard', {playerId: data.playerId, cardShortName: data.card, game: game});
//        io.in('game').emit('takeTrick', {playerId: highCardSeat, game: game});

        // Update scores
        for (var i = 0; i < game.players.length; i++){
          var player = game.players[i];
          console.log('player ' + i + ' tricks taken: ' + player.tricksTaken);
          console.log('player ' + i + ' bid: ' + player.bid);
          game.players[i].score += (player.tricksTaken === player.bid) ? (player.tricksTaken + 10) : player.tricksTaken;
        }

        // Update scoreboard
//        io.in('game').emit('updateScoreboard', {game: game});

        // Check for nascar
        if (game.options.nascar && game.options.rounds >= 10 && (game.currentRoundId + 3 === game.options.rounds)){
          // TODO: DO NASCAR HERE
          console.log('Need to do nascar here...');
        }

        // This is the last round in the game
        if (game.currentRoundId === game.options.rounds){

          // This is the last round in game
          var winningPlayerId = 0;
          var winningScore = 0;
          for (var i = 0; i < game.players.length; i++){
            var player = game.players[i];
            if (player.score > winningScore){
              winningPlayerId = player.id;
              winningScore = player.score;
            }
          }
          console.log('The winner is player ' + winningPlayerId + ' - ' + game.players[winningPlayerId].name + ' with ' + winningScore + ' points!');
          console.log('Winning playerId: ' + winningPlayerId);

          game.isActive = false;

          //TODO: update wins for each player

        }
      }
    }

  });


});


/**
 * HELPER FUNCTIONS
 */
function getPlayerId(playerId){
  return playerId % game.players.length;
}
function getRandomInclusive(min, max){
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
}

function nextPlayerId(playerId){
  return (playerId + 1) % game.players.length;
}
