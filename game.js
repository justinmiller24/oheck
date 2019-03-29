
/**
 * GAME FUNCTIONS
 */
var exports = module.exports = {};


// Get GAME_DEFAULTS
exports.getDefaults = function(){
  return {
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
};
