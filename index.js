
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
var history = [];
var users = [];


io.sockets.on('connection', function(socket) {
  console.log('User connected with socketId: ' + socket.id);

  // Initialization
  socket.emit('init', {users: users, game: game, history: history});


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
    //game.history = [];
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
    broadcastEvents([{
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
    broadcastEvents([{
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
    // Broadcast event to users
    broadcastEvents([{
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
//    game = game2.playerBid(socket, game, data);
    var playerId = data.playerId;
    var currentBid = data.bid;


    // Check if round is currently in bidding status
    if (game.round.bids >= game.players.length){
      console.log('ERROR: PlayerID: ' + playerId + ' attempted to bid');
      socket.emit('showMessage', {message: 'It is not your turn to bid!'});
      return;
    }

    // Check for player turn to bid
    if (game.currentPlayerId !== playerId){
      console.log('ERROR: PlayerID: ' + playerId + ' attempted to bid');
      console.log([game.currentPlayerId, playerId]);
      socket.emit('showMessage', {message: 'It is not your turn to bid!'});
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

    // Advance player
    game.currentPlayerId = util.getNextPlayerId(game.currentPlayerId, game.players.length);

    // Check if all players have bid
    if (game.round.bids < game.players.length){

      // Broadcast event to users
      broadcastEvents([{
        op: 'bid',
        playerId: data.playerId,
        bid: currentBid,
        game: game
      },{
        op: 'startBid',
        playerId: game.currentPlayerId
      }]);
      // Nothing else to do here
      return;
    }

    // This was the last player to bid
    game.round.currentTrickId = 1;
    game.round.currentTrickPlayed = [];

    //    console.log(game);
    //    console.log();
    //    console.log();


    // Broadcast event to users
    broadcastEvents([{
      op: 'bid',
      playerId: data.playerId,
      bid: currentBid,
      game: game
    },{
      op: 'startPlay',
      playerId: game.currentPlayerId
    }]);
  });


  // Play Card event
 	// This event fires when each user plays a card during each trick
  socket.on('playCard', function(data){
    var card = data.card;
    var playerId = data.playerId;
//    console.log('PlayerId: ' + playerId + ' attempting to play card: ' + card);

    // Make sure we're not bidding
    if (game.round.currentTrickId < 1){
      console.log('PlayerId: ' + playerId + ' played while we are still bidding');
      socket.emit('showMessage', {message: 'It is not your turn!'});
      return;
    }

    // Make sure it is user turn to play
    if (game.currentPlayerId != playerId){
      console.log('PlayerId: ' + playerId + ' played out of turn');
      socket.emit('showMessage', {message: 'It is not your turn!'});
      return;
    }

    // Make sure user is holding the card played
    var cardPos = game.players[playerId].currentHand.indexOf(card);
    if (cardPos == -1){
      console.log('PlayerId: ' + playerId + ' played a card they were not holding: ' + card);
      socket.emit('showMessage', {message: 'You played a card not in your hand!'});
      return;
    }

    // Make sure user is following suit
    if (game.round.currentTrickPlayed.length > 0 && game.round.currentTrickPlayed[0].substring(0,1) != card.substring(0,1)){
      var leadingCardSuit = game.round.currentTrickPlayed[0].substring(0,1);
      // Loop through player hand to determine if they have any cards that have to follow suit
      for (var i in game.players[playerId].currentHand){
        if (leadingCardSuit === game.players[playerId].currentHand[i].substring(0,1)){
          console.log('PlayerId: ' + playerId + ' played a card not following suit: ' + card);
          socket.emit('showMessage', {message: 'You must follow suit!'});
          return;
        }
      }
    }

    // Player used a valid card
    // Update card played
    console.log('PlayerId: ' + playerId + ' played a valid card: ' + card);

    // Update current trick and remove card from player hand
    game.round.currentTrickPlayed.push(card);
    game.players[playerId].currentHand.splice(cardPos, 1);
//    console.log('Player ' + playerId + ' hand remaining is now:');
//    console.log(game.players[playerId].currentHand);

    // Check if this is the last card in trick
    if (game.round.currentTrickPlayed.length < game.players.length){
      // Advance player ID
      game.currentPlayerId = util.getNextPlayerId(game.currentPlayerId, game.players.length);
      // Broadcast event to users
      broadcastEvents([{
        op: 'playCard',
        playerId: data.playerId,
        cardShortName: data.card,
        game: game
      }]);
      // Nothing else to do here
      return;
    }

    // This is the last card in trick
    // Determine next player ID based on winner of current trick

    // Determine winner of current trick
    // Start with trick leader and loop through playes to determine highest card
    var trickLeaderPlayerId = util.getNextPlayerId(game.currentPlayerId, game.players.length);

    // Set initial card
    var firstCard = game.round.currentTrickPlayed[0];
    var highCardSeat = trickLeaderPlayerId;
    var highCardSuit = firstCard.substring(0, 1);
    var highCardVal = parseInt(firstCard.substring(1), 10);

    // Loop through card pile
    for (var i = 0; i < game.round.currentTrickPlayed.length; i++){
      var thisCard = game.round.currentTrickPlayed[i];
      var thisCardSeat = util.getPlayerId(trickLeaderPlayerId + i, game.players.length);
      var thisCardSuit = thisCard.substring(0, 1);
      var thisCardVal = parseInt(thisCard.substring(1), 10);

      // Trump over no trump
      if (thisCardSuit === game.round.trump && highCardSuit != game.round.trump){
        highCardSeat = thisCardSeat;
        highCardSuit = thisCardSuit;
        highCardVal = thisCardVal;
      }

      // Higher card in same suit
      else if (thisCardSuit === highCardSuit && thisCardVal >= highCardVal){
        highCardSeat = thisCardSeat;
        highCardSuit = thisCardSuit;
        highCardVal = thisCardVal;
      }
    }

    // Update number of tricks taken by winning player
    console.log('PlayerId: ' + highCardSeat + ' wins trick with the ' + highCardSuit + highCardVal);
    // Update number of tricks taken by trick winner
    game.players[highCardSeat].tricksTaken++;
    console.log('PlayerId: ' + highCardSeat + ' has won ' + game.players[highCardSeat].tricksTaken + ' trick(s)');
    // Winner starts next trick
    game.currentPlayerId = highCardSeat;
    // Clear current trick
    game.round.currentTrickPlayed = [];

    // Check if this is the last trick in round
    if (game.round.currentTrickId < game.round.numTricks){
      // Advance trick ID
      game.round.currentTrickId++;
      // Broadcast event to users
      broadcastEvents([{
        op: 'playCard',
        playerId: data.playerId,
        cardShortName: data.card,
        game: game
      },{
        op: 'takeTrick',
        playerId: highCardSeat,
        game: game
      }]);
      // Nothing else to do here
      return;
    }


    // This is the last trick in round
    // Update scores (and check for NASCAR)
    // Determine next player ID based on deal rotation

    // Update scores
    for (var i = 0; i < game.players.length; i++){
      var player = game.players[i];
      game.players[i].score += (player.tricksTaken === player.bid) ? (player.tricksTaken + 10) : player.tricksTaken;
      console.log({playerId: i, bid: player.bid, tricks: player.tricksTaken, score: game.players[i].score});
    }

    // Check for NASCAR
    // Game must have at least 6 rounds
    // NASCAR happens 3 rounds before end of game
    if (game.options.nascar && (game.options.rounds >= 6) && (game.currentRoundId + 3 === game.options.rounds)){
      console.log('NASCAR!');

      // Get player scores
      var pScores = [];
      for (var i = 0; i < game.players.length; i++){
        pScores.push({id: i, score: game.players[i].score, newScore: game.players[i].score});
      }

      // Sort players by score DESC
      pScores.sort(function(a,b){
        return parseInt(b.score) - parseInt(a.score)
      });

      // Adjust scores
      console.log('PlayerId: ' + pScores[0].id + ' is the leader and score remains unchanged at ' + pScores[0].score);
      for (var i = 1; i < pScores.length; i++){
        // Current points behind
        var pointsBehind = pScores[i-1].score - pScores[i].score;
        // Bump player score so it is no more than X points behind previous player
        pScores[i].newScore = pScores[i-1].newScore - Math.min(pointsBehind, util.getNascarScoreGap());
        // Save new score
        console.log('PlayerId: ' + pScores[i].id + ' score increasing from ' + pScores[i].score + ' to ' + pScores[i].newScore);
        game.players[pScores[i].id].score = pScores[i].newScore;
      }
    }

    // Broadcast event to users
    broadcastEvents([{
      op: 'playCard',
      playerId: data.playerId,
      cardShortName: data.card,
      game: game
    },{
      op: 'takeTrick',
      playerId: highCardSeat,
      game: game
    },{
      op: 'finishRound',
      game: game
    },{
      op: 'showScoreboard'
    }]);


    // Check if this is the last round in game
    // Do not advance round ID here, instead wait until the DEAL button is pressed
    if (game.currentRoundId < game.options.rounds){
      // Show deal button to next dealer
      var nextDealerId = util.getPlayerId(game.currentRoundId + game.players.length - 1, game.players.length);
      // Broadcast event to users
      broadcastEvents([{
        op: 'showDealButton',
        playerId: nextDealerId
      }]);
      // Nothing else to do here
      return;
    }

    // This is the last round in game
    // Determine winning player ID based on top score

    // Get player scores
    var pScores = [];
    for (var i = 0; i < game.players.length; i++){
      pScores.push({id: i, score: game.players[i].score});
    }

    // Sort players by score DESC
    pScores.sort(function(a,b){
      return parseInt(b.score) - parseInt(a.score)
    });

    // Check for tie
    if (pScores[0].score === pScores[1].score){
      console.log('There is a tie for the lead! We need to do one more round.');
      socket.emit('showMessage', {message: 'There is a tie for the lead!'});

      //TODO: extend game by one more round
      // Delete the following 2 lines when game is extended
      game.isActive = false;
      broadcastEvents([{
        op: 'endGame',
        playerId: winnerPlayerId
      }]);
      // Nothing else to do here
      return;
    }

    // Determine winning player
    var winnerPlayerId = pScores[0].id;
    console.log('PlayerId: ' + winnerPlayerId + ' wins with score: ' + pScores[0].score);
    socket.emit('showMessage', {message: game.players[pScores[0].id].name + ' wins!'});

    // End game
    game.isActive = false;

    // Broadcast event to users
    broadcastEvents([{
      op: 'endGame',
      playerId: winnerPlayerId
    }]);
  });

});


function broadcastEvents(arr){
  // Add events to game history
  history = history.concat(arr);
  // Broadcast new events to user
  io.in('game').emit('event', arr);
}
