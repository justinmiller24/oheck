
// Import game libraries
var util = require("./util.js");


/**
 * GAME FUNCTIONS
 */
module.exports = {

  // Start Game
  // First person who joined the game bids first
  // Last person who joined the game deals first
  startGame: function(users){
    console.log('Start Game');

    // Set game defaults
    var game = {
      currentPlayerId: 0,
      currentRoundId: 0,
      isActive: true,
      oheck: {},
      options: {
        decks: 1,                             // Number of decks to use
        nascar: false,                        // Nascar scoring = 3 rounds before final for games of 10+
        rounds: util.isProduction ? 10 : 3,   // Number of rounds in game
        trump: true                           // Set to "false" to allow "trump-less" hands
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

    return game;
  },


  // Deal Hand
  // This happens when dealer presses "deal" or after owner presses "restartHand"
  dealHand: function(game){
    console.log('Deal Hand!');

    // Create new round and reset all variables
    var trumpArray = ['D', 'C', 'H', 'S'];
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
      numTricks: Math.min(Math.floor(52 * game.options.decks / game.players.length), util.getMaxCardsToDeal()),
      // Trump suits can be "C", "S", "H", "D", or N (no trump)
      trump: game.options.trump ? trumpArray[util.getRandomId(0,3)] : 'N'
    };

    // Set currentPlayer to the player after dealer
    game.currentPlayerId = util.getNextPlayerId(game.round.dealerId, game.players.length);

    // Create array of cards
    var cards = [];
    for (var i = 0; i < game.options.decks; i++){
      for (var j = 2; j <= 14; j++){
        for (var k in trumpArray){
          cards.push(trumpArray[k] + j);
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

    return game;
  }
};
