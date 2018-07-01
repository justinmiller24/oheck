
//Import dependencies
var socket = require('socket.io');
var express = require('express');
var http = require('http');
var app = express();

// Production
var isProduction = __dirname !== '/Users/justinmiller/Sites/oheck';
var port = isProduction ? 80 : 3000;

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
var users = [];
var game = {};
var history = [];
var MAX_CARDS_TO_DEAL = isProduction ? 12 : 3;
var NASCAR_SCORE_GAP = 3;
var GAME_DEFAULTS = {
  currentPlayerId: 0,
  currentRoundId: 0,
  isActive: false,
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
    dealerId: -1,
    numTricks: 0,
    // C, S, H, D, or N
    trump: null
  }
};


io.sockets.on('connection', function(socket) {
  console.log('User connected with Socket ID: ' + socket.id);

  // Initialization
  socket.emit('init', {users: users, game: game, history: history});


  // Disconnect
  socket.on('disconnect', function(){
    console.log('User lost socket connection with Socket ID: ' + socket.id);

    //TODO: broadcast to other users?
    // Send update to all other clients
    //socket.to('game').emit('socketDisconnected', socket.id);
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
    // Set next userId
    data.user.id = users.length + 1;
    users.push(data.user);
    console.log('The following user has joined:');
    console.log({name: data.user.name, userId: data.user.id, socketId: socket.id});

    // Send data to user that just logged in
    socket.emit('myUserLogin', {userId: data.user.id, users: users});

    // Joins the game room
    socket.join('game');

    // Send data to all other clients in room except sender
    socket.to('game').emit('userJoined', {userId: data.user.id, users: users});
  });

  socket.on('userJoined', function(data){
    users[data.user.id - 1] = data.user;
    console.log('The following user has returned:');
    console.log({name: users[data.user.id - 1].name, userId: data.user.id, socketId: socket.id});

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

  // Start Game event
 	// This event fires when the first player creates a new game
  socket.on('startGame', function(data){
    console.log('Start Game!');
//    console.log(users[data.ownerId - 1].name + ' started the game!');

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
    game.players = [];
    for (var i in users){
      var user = users[i];
      var playerId = user.id - 1;
      game.players.push({
        id: playerId,
        name: user.name,
        bid: null,
        currentHand: [],
        hand: [],
//        pictureHand: [],
        score: 0,
        tricksTaken: 0
      });
    }
    // Set current dealer ID to last player ID to start
    game.round.dealerId = game.players.length - 1;
    // Set current player ID to last player ID to start
    game.currentPlayerId = game.players.length - 1;
//    console.log('Current DealerId: ' + game.currentPlayerId);
//    console.log('Current PlayerId: ' + game.currentPlayerId);
//    console.log('Game Created!');
//    console.log(game);

    // Broadcast event to users
    console.log('Broadcast Events');
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
    console.log('Deal Hand!');

    game.currentRoundId++;

    // Deal as many cards as we can but no more than 12 due to space
    var maxCards = Math.floor(52 * game.options.decks / game.players.length);
    var cardsToDeal = Math.min(maxCards, MAX_CARDS_TO_DEAL);

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
//    console.log('Dealer ID: ' + game.round.dealerId);
//    console.log('Player ID: ' + game.currentPlayerId);

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
    broadcastEvents([{
      op: 'dealHand',
      game: game
    },{
      op: 'startBid',
      playerId: nextPlayerId(game.round.dealerId)
    }]);
  });


  // Restart Hand event
 	// This event fires when the admin user presses "restart" during a round
  socket.on('restartHand', function(){
    console.log('Restart Hand...');


    // Send data to all clients including sender
    broadcastEvents([{
      op: 'restartHand'
    }]);
  });


  // Bid event
 	// This event fires when each user submits their bid at the beginning of each round
  socket.on('bid', function(data){
    var playerId = data.playerId;
    var currentBid = data.bid;
    console.log('PlayerId: ' + playerId + ' attempting to bid: ' + currentBid);

    // Check if round is currently in bidding status
    if (game.round.bids >= game.players.length){
      console.log('ERROR: PlayerID: ' + playerId + ' attempted to bid');
      socket.emit('showMessage', {message: 'It is not your turn to bid!'});
      return;
    }

    // Check for player turn to bid
    if (game.currentPlayerId !== playerId){
      console.log('ERROR: PlayerID: ' + playerId + ' attempted to bid');
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
    game.currentPlayerId = nextPlayerId(game.currentPlayerId);

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
//      console.log([playerId, game.currentPlayerId]);
      socket.emit('showMessage', {message: 'It is not your turn!'});
      return;
    }

    // Make sure user is holding the card played
    var cardPos = game.players[playerId].currentHand.indexOf(card);
    if (cardPos == -1){
      console.log('PlayerId: ' + playerId + ' played a card they were not holding: ' + card);
//      console.log([card, game.players[playerId].currentHand]);
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
//          console.log([game.round.currentTrickPlayed[0].substring(0,1), card.substring(0,1)]);
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
      game.currentPlayerId = nextPlayerId(game.currentPlayerId);
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
    var trickLeaderPlayerId = nextPlayerId(game.currentPlayerId);

    // Set initial card
    var firstCard = game.round.currentTrickPlayed[0];
    var highCardSeat = trickLeaderPlayerId;
    var highCardSuit = firstCard.substring(0, 1);
    var highCardVal = parseInt(firstCard.substring(1), 10);

    // Loop through card pile
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
        // Bump player score so it is no more than NASCAR_SCORE_GAP points behind previous player
        pScores[i].newScore = pScores[i-1].newScore - Math.min(pointsBehind, NASCAR_SCORE_GAP);
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
      var nextDealerId = getPlayerId(game.currentRoundId + game.players.length - 1);
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


/**
 * HELPER FUNCTIONS
 */
function broadcastEvents(arr){
  // Add events to game history
  history = history.concat(arr);
  // Broadcast new events to user
  io.in('game').emit('event', arr);
}
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
