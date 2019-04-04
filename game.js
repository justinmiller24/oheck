
// Import game libraries
var util = require("./util.js");


/**
 * GAME FUNCTIONS
 */
module.exports = {

  // Start Game
  // First person who joined the game bids first
  // Last person who joined the game deals first
  startGame: function(io, users){
    console.log('Start Game');

    // Set game defaults
    var game = {
      active: true,
      currentPlayerId: 0,
      currentRoundId: 0,
      // Number of decks
      decks: 1,
      // Nascar scoring = 3 rounds before final for games of 10+
      nascar: false,
      oheck: {},
      // Array of players
      players: [],
      // Current round
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
      },
      // Number of rounds in game
      rounds: util.isProduction ? 10 : 3,
      // Set to "false" to allow trumpless hands
      trump: true
    };
    for (var i in users){
      var user = users[i];
      var playerId = user.id - 1;
      game.players.push({
        id: playerId,
        name: user.name,
        bid: null,
        currentHand: [],
        hand: [],
//      pictureHand: [],
        score: 0,
        tricksTaken: 0
      });
    }

    // Set current dealerId and playerId
    game.currentPlayerId = game.round.dealerId = util.getPlayerId(-1, game.players.length);

    // Broadcast event to users
    util.broadcastEvents(io, [{
      op: 'startGame',
      game: game
    }]);

    return game;
  },


  // Deal Hand
  // This happens when dealer presses "deal" or after owner presses "restartHand"
  dealHand: function(io, game){
    console.log('Deal Hand!');

    // Create new round and reset all variables
    game.round = {
      // How many players have bid so far in this round
      bids: 0,
      // Current trick number in this round
      currentTrickId: 0,
      // Array of cards played
      currentTrickPlayed: [],
      // Current bid
      currentBid: 0,
      // Set dealer ID based on round
      dealerId: util.getPlayerId(game.currentRoundId + game.players.length - 2, game.players.length),
      // Number of cards to deal
      numTricks: Math.min(Math.floor(52 * game.decks / game.players.length), util.getMaxCardsToDeal()),
      // Trump suits can be "C", "S", "H", "D", or N (no trump)
      trump: game.trump ? util.trumpArray[util.getRandomId(0,3)] : 'N'
    };

    // Set currentPlayer to the player after dealer
    game.currentPlayerId = util.getNextPlayerId(game.round.dealerId, game.players.length);

    // Create array of cards
    var cards = [];
    for (var i = 0; i < game.decks; i++){
      for (var j = 2; j <= 14; j++){
        for (var k in util.trumpArray){
          cards.push(util.trumpArray[k] + j);
        }
      }
    }

    // Deal cards
    for (var playerId = 0; playerId < game.players.length; playerId++){
      var playerCards = [];
      for (var i = 0; i < game.round.numTricks; i++){

        // Pick a random card from remaining cards and assign to player
        var random = util.getRandomId(0, cards.length - 1);
        playerCards.push(cards[random]);
        cards.splice(random, 1);
      }

      // Save player hand
      game.players[playerId].bid = null;
      game.players[playerId].hand = game.players[playerId].currentHand = playerCards;
      game.players[playerId].tricksTaken = 0;
      //game.players[playerId].pictureHand = [];
    }

    // Broadcast event to users
    util.broadcastEvents(io, [{
      op: 'dealHand',
      game: game
    }]);

    return game;
  },

  doNascar: function(game){
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
    console.log('PlayerId: ' + pScores[0].id + ' is leading and score remains unchanged at: ' + pScores[0].score);
    for (var i = 1; i < pScores.length; i++){
      // Current points behind
      var pointsBehind = pScores[i-1].score - pScores[i].score;
      // Bump player score so it is no more than X points behind previous player
      pScores[i].newScore = pScores[i-1].newScore - Math.min(pointsBehind, util.nascarScoreGap());
      // Save new score
      console.log('PlayerId: ' + pScores[i].id + ' score increasing from ' + pScores[i].score + ' to ' + pScores[i].newScore);
      game.players[pScores[i].id].score = pScores[i].newScore;
    }

    return game;
  },

  playerBid: function(socket, game, data){
    // Update player bid
    var player = game.players[data.playerId];
    player.bid = data.bid;
    player.tricksTaken = 0;
//    player.pictureHand = [];

    // Update total bids in round
    game.round.bids++;
    game.round.currentBid += data.bid;

    // Advance player
    game.currentPlayerId = util.getNextPlayerId(game.currentPlayerId, game.players.length);

    return game;
  },


  // User played valid card
  playCard: function(io, game, users, data){

    // Update current trick and remove card from player hand
    game.round.currentTrickPlayed.push(data.card);
    var cardPos = game.players[data.playerId].currentHand.indexOf(data.card);
    game.players[data.playerId].currentHand.splice(cardPos, 1);

    // Advance player ID
    game.currentPlayerId = util.getNextPlayerId(game.currentPlayerId, game.players.length);

    // Broadcast event to users
    util.broadcastEvents(io, [{
      op: 'playCard',
      playerId: data.playerId,
      cardShortName: data.card,
      game: game
    }]);

    // Exit unless this is the last card in the trick
    if (game.round.currentTrickPlayed.length < game.players.length) return game;

    // Determine next playerId based on winner of current trick
    var winningTrickPlayerId = util.getWinningTrickPlayerId(game);

    // Update number of tricks taken by winning player
    game.players[winningTrickPlayerId].tricksTaken++;

    // Winner starts next trick
    game.currentPlayerId = winningTrickPlayerId;

    // Clear current trick
    game.round.currentTrickPlayed = [];

    // Check if this is the last trick in round
    if (game.round.currentTrickId < game.round.numTricks){

      // Advance trick ID
      game.round.currentTrickId++;

      // Broadcast event to users
      util.broadcastEvents(io, [{
        op: 'takeTrick',
        playerId: winningTrickPlayerId,
        game: game
      }]);

      return game;
    }

    // This is the last trick in round
    // Update scores
    console.log('End of round, update scores');
    for (var i = 0; i < game.players.length; i++){

      // All players gets points for the number of tricks they take
      game.players[i].score += game.players[i].tricksTaken;

      // Players who make their bid also get a 10 point bonus
      if (game.players[i].tricksTaken === game.players[i].bid){
        game.players[i].score += 10;
      }
      console.log({playerId: i, bid: game.players[i].bid, tricks: game.players[i].tricksTaken, score: game.players[i].score});
    }

    // Check if NASCAR is enabled, game has at least 6 rounds, and we are 3 rounds from the end
    if (game.nascar && (game.rounds >= 6) && (game.currentRoundId + 3 === game.rounds)){
      game = this.doNascar(game);
    }

    // Broadcast event to users
    util.broadcastEvents(io, [{
      op: 'takeTrick',
      playerId: winningTrickPlayerId,
      game: game
    },{
      op: 'finishRound',
      game: game
    },{
      op: 'showScoreboard'
    }]);

    // Check if this is the last round in game
    // Do not advance round ID here, instead wait until the DEAL button is pressed
    if (game.currentRoundId < game.rounds){
      // Show deal button to next dealer
      var nextDealerId = util.getPlayerId(game.currentRoundId + game.players.length - 1, game.players.length);

      // Send "showDealButton" event to dealer only
      io.to(users[nextDealerId].socketId).emit('event', [{
        op: 'showDealButton'
      }]);

      return game;
    }

    // This is the last round in game
    // Determine winning player ID based on top score
    var pScores = [];
    for (var i = 0; i < game.players.length; i++){
      pScores.push({id: i, score: game.players[i].score});
    }

    // Sort players by score DESC
    pScores.sort(function(a,b){
      return parseInt(b.score) - parseInt(a.score)
    });

    // Check for tie at the end of all rounds
    if (pScores[0].score === pScores[1].score){
      console.log('There is a tie for the lead! We need to do one more round.');
      socket.emit('showMessage', {message: 'There is a tie for the lead!'});

      // Extend game by one round so we can break the tiebreaker
      game.rounds++;

      return game;
    }

    // Not a tie at the end of all rounds
    // Determine winning player and end game
    console.log('PlayerId: ' + pScores[0].id + ' wins with score: ' + pScores[0].score);
    socket.emit('showMessage', {message: game.players[pScores[0].id].name + ' wins!'});
    game.active = false;

    // Broadcast event to users
    util.broadcastEvents(io, [{
      op: 'endGame',
      playerId: pScores[0].id
    }]);

    return game;
  }
};
