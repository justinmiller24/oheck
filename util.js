
/**
 * UTIL FUNCTIONS
 */
var exports = module.exports = {};


// Get maximum number of cards to deal
// Deal as many cards as we can but no more than 12 due to space
exports.getMaxCardsToDeal = function(){
  return this.isProduction() ? 12 : 6;
};

// Get NASCAR score gap
exports.getNascarScoreGap = function(){
  return 3;
};

// Get next playerId (mod number of players)
exports.getNextPlayerId = function(playerId, numPlayers){
  //return (playerId + 1) % game.players.length;
  return (playerId + 1) % numPlayers;
};

// Get number of active users
exports.getNumActiveUsers = function(users){
  var numActiveUsers = 0;
  for (var i in users){
    if (users[i].active) numActiveUsers++;
  }
  return numActiveUsers;
};

// Get playerId (mod number of players)
exports.getPlayerId = function(playerId, numPlayers) {
  return (playerId + numPlayers) % numPlayers;
};

// Get random Id, inclusive of the min and the max
exports.getRandomId = function(min, max){
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
};

// Get userId from socketId
exports.getUserBySocketId = function(users, socketId){
  for (var i in users){
    if (users[i].socketId === socketId) return users[i].id;
  }
  return null;
};

// Determine if environment is development or production
exports.isProduction = function(){
  return __dirname !== '/Users/justinmiller/Sites/oheck';
};
