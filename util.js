
/**
 * UTIL FUNCTIONS
 */

var _history = [];


module.exports = {

  // Broadcast events to users
  broadcastEvents: function(io, arr){
    io.in('game').emit('event', arr);

    // Save event to game history
    this._history = this._history.concat(arr);
  },

  // Get maximum number of cards to deal
  // Deal as many cards as we can but no more than 12 due to space
  getMaxCardsToDeal: function(){
    return this.isProduction() ? 12 : 6;
  },

  // Get next playerId (mod number of players)
  getNextPlayerId: function(playerId, numPlayers){
    return (playerId + 1) % numPlayers;
  },

  // Get number of active users
  getNumActiveUsers: function(users){
    var numActiveUsers = 0;
    for (var i in users){
      if (users[i].active) numActiveUsers++;
    }
    return numActiveUsers;
  },

  // Get playerId (mod number of players)
  getPlayerId: function(playerId, numPlayers){
    return (playerId + numPlayers) % numPlayers;
  },

  // Get random Id, inclusive of the min and the max
  getRandomId: function(min, max){
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
  },

  // Get userId from socketId
  getUserBySocketId: function(users, socketId){
    for (var i in users){
      if (users[i].socketId === socketId) return users[i].id;
    }
    return null;
  },

  // Get playerId of player who played the winning card in the trick
  getWinningTrickPlayerId: function(game){
    var firstCard = game.round.currentTrickPlayed[0];
    var highCardSeat = game.currentPlayerId;
    var highCardSuit = firstCard.substring(0, 1);
    var highCardVal = parseInt(firstCard.substring(1), 10);

    // Start with trick leader and loop through playes to determine highest card
    for (var i = 0; i < game.round.currentTrickPlayed.length; i++){
      var thisCard = game.round.currentTrickPlayed[i];
      var thisCardSeat = util.getPlayerId(game.currentPlayerId + i, game.players.length);
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

    console.log('PlayerId: ' + highCardSeat + ' wins trick with the ' + highCardSuit + highCardVal + ' and has taken ' + game.players[highCardSeat].tricksTaken + ' trick(s)');
    return highCardSeat;
  },

  // Game history
  history: this._history;

  // Determine if environment is development or production
  isProduction: function(){
    return __dirname !== '/Users/justinmiller/Sites/oheck';
  },

  // Get NASCAR score gap
  nascarScoreGap: 3,

  // Trump suits
  trumpArray: ['D', 'C', 'H', 'S']
};
