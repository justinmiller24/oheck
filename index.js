
//Import dependencies
var socket = require('socket.io');
var express = require('express');
var http = require('http');
var app = express();

// Import game libraries
var util = require("./util.js");
var game2 = require("./game.js");


// Create server
var port = util.isProduction() ? 80 : 3000;
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
var game = {};
var users = [];


io.sockets.on('connection', function(socket) {
  console.log('User connected with socketId: ' + socket.id);

  // Initialization
  socket.emit('init', {users: users, game: game, history: util.history});


  // Disconnect
  // This event fires when internet is lost or when user reloads the page
  socket.on('disconnect', function(){
    var userId = util.getUserBySocketId(users, socket.id);

    if (users[userId - 1]){
      console.log('UserId ' + userId + ' (' + users[userId - 1].name + ') lost connection with socketId: ' + socket.id);
      users[userId - 1].active = false;
    }
    // This could happen after node server is restarted
    else {
      console.log('User with userId: ' + userId + ' could not be found.');
    }
    console.log(users);
    console.log();
    console.log();

    // Send data to all other clients in room except sender
    socket.to('game').emit('userDisconnect', {userId: userId, users: users});
  });


  // Force Reload All
  socket.on('forceReloadAll', function(){
    console.log('Force Reload All');
    // Clear history
    //util.history = [];
    // Send data to all clients including sender
    io.in('game').emit('forceReloadAll', 'Force Reload All');
  });


  /*
   * USER FUNCTIONS
   */
  socket.on('userLogin', function(data){
    data.user.id = users.length + 1;    // Set to next available userId
    data.user.active = true;
    data.user.socketId = socket.id;
    users.push(data.user);
    console.log('UserId ' + data.user.id + ' (' + data.user.name + ') has logged in.');
    console.log({name: data.user.name, userId: data.user.id, active: data.user.active, socketId: data.user.socketId});
    console.log(users);

    // Send data to user that just logged in
    socket.emit('myUserLogin', {userId: data.user.id, users: users});

    // Joins the game room
    socket.join('game');

    // Send data to all other clients in room except sender
    socket.to('game').emit('userJoined', {userId: data.user.id, users: users});
  });

  // This event fires when internet is reestablished or after user reloads the page
  socket.on('userJoined', function(data){
    data.user.active = true;
    data.user.socketId = socket.id;
    users[data.user.id - 1] = data.user;
    console.log('UserId ' + data.user.id + ' (' + data.user.name + ') has returned.');
    console.log(users);
    console.log();
    console.log();

    // Send data to user that just logged in
    socket.emit('myUserLogin', {userId: data.user.id, users: users});

    // Join the game room
    socket.join('game');

    // Send data to all clients including sender
    io.in('game').emit('userJoined', {userId: data.user.id, users: users});
  });

  socket.on('userLogout', function(data){

    // Prevent error if socket server had been restarted
    if (users[data.userId - 1]){
      users[data.userId - 1].active = false;
      console.log('UserId: ' + data.userId + ' (' + users[data.userId - 1].name + ') logged out. There are ' + util.getNumActiveUsers(users) + ' active users online');
      console.log(users);
      console.log();
      console.log();

      // Broadcast event to users
      socket.to('game').emit('userDisconnect', {userId: data.userId, users: users});
    }
  });


  /*
   * GAME FUNCTIONS
   */

  // Start Game event
 	// This event fires when the first player creates a new game
  socket.on('startGame', function(){
    game = game2.startGame(users);
    console.log(game);
    console.log();
    console.log();

    // Broadcast event to users
    util.broadcastEvents(io, [{
      op: 'startGame',
      game: game
    },{
      op: 'showDealButton',
      playerId: game.round.dealerId
    }]);
  });


  // Deal Hand event
 	// This event fires when the dealer presses "deal" at the beginning of each round
  socket.on('dealHand', function(){
    game.currentRoundId++
    game = game2.dealHand(game);
    console.log(game);
    console.log();
    console.log();

    // Broadcast event to users
    util.broadcastEvents(io, [{
      op: 'dealHand',
      game: game
    },{
      op: 'startBid',
      playerId: util.getNextPlayerId(game.round.dealerId, game.players.length)
    }]);
  });


  // Redeal Hand event
 	// This event fires when the admin user presses "redeal" during a round
  socket.on('redealHand', function(){
    console.log('Redeal Hand...');
    game = game2.dealHand(game);
    console.log(game);
    console.log();
    console.log();

    // Send data to all clients including sender
    util.broadcastEvents(io, [{
      op: 'dealHand',
      game: game
    },{
      op: 'startBid',
      playerId: util.getNextPlayerId(game.round.dealerId, game.players.length)
    }]);
  });


  // Bid event
 	// This event fires when each user submits their bid at the beginning of each round
  socket.on('bid', function(data){
    console.log('PlayerId: ' + data.playerId + ' attempting to bid: ' + data.bid);
    //var playerId = data.playerId;
    //var currentBid = data.bid;

    // Check if round is currently in bidding status
    if (game.round.bids >= game.players.length){
      console.log('ERROR: PlayerID: ' + data.playerId + ' attempted to bid');
      socket.emit('showMessage', {message: 'It is not your turn to bid!'});
      return;
    }

    // Check for player turn to bid
    if (game.currentPlayerId !== data.playerId){
      console.log('ERROR: playerId: ' + data.playerId + ' attempted to bid');
      socket.emit('showMessage', {message: 'It is not your turn to bid!'});
      return;
    }

    game = game2.playerBid(socket, game, data);

    // Broadcast event to users
    util.broadcastEvents(io, [{
      op: 'bid',
      playerId: data.playerId,
      bid: data.bid,
      game: game
    }]);


    // Check if all players have bid
    if (game.round.bids < game.players.length){
      util.broadcastEvents(io, [{
        op: 'startBid',
        playerId: game.currentPlayerId
      }]);
    }

    // This was the last player to bid
    else{
      game.round.currentTrickId = 1;
      game.round.currentTrickPlayed = [];
      util.broadcastEvents(io, [{
        op: 'startPlay',
        playerId: game.currentPlayerId
      }]);
    }
    console.log(game);
    console.log();
    console.log();
  });


  // Play Card event
 	// This event fires when each user plays a card during each trick
  socket.on('playCard', function(data){
    console.log('PlayerId: ' + data.playerId + ' attempting to play card: ' + data.card);
    //var card = data.card;
    //var playerId = data.playerId;

    // Make sure we're not bidding
    if (game.round.currentTrickId < 1){
      console.log('PlayerId: ' + data.playerId + ' played while we are still bidding');
      socket.emit('showMessage', {message: 'It is not your turn!'});
      return;
    }

    // Make sure it is user turn to play
    if (game.currentPlayerId != data.playerId){
      console.log('PlayerId: ' + data.playerId + ' played out of turn');
      socket.emit('showMessage', {message: 'It is not your turn!'});
      return;
    }

    // Make sure user is holding the card played
    var cardPos = game.players[data.playerId].currentHand.indexOf(data.card);
    if (cardPos == -1){
      console.log('PlayerId: ' + data.playerId + ' played a card they were not holding: ' + data.card);
      socket.emit('showMessage', {message: 'You played a card not in your hand!'});
      return;
    }

    // Make sure user is following suit
    if (game.round.currentTrickPlayed.length > 0 && game.round.currentTrickPlayed[0].substring(0,1) != data.card.substring(0,1)){
      var leadingCardSuit = game.round.currentTrickPlayed[0].substring(0,1);
      // Loop through player hand to determine if they have any cards that have to follow suit
      for (var i in game.players[data.playerId].currentHand){
        if (leadingCardSuit === game.players[data.playerId].currentHand[i].substring(0,1)){
          console.log('PlayerId: ' + data.playerId + ' played a card not following suit: ' + data.card);
          socket.emit('showMessage', {message: 'You must follow suit!'});
          return;
        }
      }
    }

    // Play Card event
    console.log('PlayerId: ' + data.playerId + ' played valid card: ' + data.card);
    game = game2.playCard(io, game, data);
    console.log(game);
    console.log();
    console.log();
  });

});
