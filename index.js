
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
  cardsDealt: false,
  currentDealerId: null,
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
  // User ID that created the game
  ownerId: null,
  // Array of players
  players: [],
  round: {
    bids: 0,
    // Integer between 1 and numTricks
    currentTrick: 0,
    // Array of cards played
    currentTrickPlayed: [],
    currentBid: 0,
    dealerId: null,
    numTricks: 0,
    // Deal, Bid, or Play
    status: null,
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
    // The first user in the "users" array is null, so we need to decrement by 1 here
    game.currentDealerId = users.length - 1;
    game.currentPlayerId = 1;
    game.ownerId = data.ownerId;
    game.players = [];
    for (var i in users){
      if (i && i != "0" && users[i] && users[i].id){
        var playerId = users[i].id;
        game.players.push({
          position: playerId,
          name: users[i].name,
          avatar: users[i].avatar,
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
    game.round.status = 'Deal';

    console.log('Game setup and ready for broadcast!');

    // Broadcast event to users
    io.in('game').emit('startGame', {game: game});
  });

  socket.on('dealHand', function(){

    game.currentRoundId++;
    //game.currentDealerId = game.currentRoundId % game.players.length;

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
      // Reset current trick
      currentTrick: 0,
      // Reset current bid
      currentBid: 0,
      // Initialize on each round
      numTricks: cardsToDeal,
      // Reset how many players have bid
      bids: 0,
      // Advance dealer ID based on round
      dealerId: (game.currentRoundId + game.players.length - 1) % game.players.length,
      // C, S, H, D, or N
      trump: nextTrump,
      // Bid or Play
      status: 'Bid',
      // Clear array of cards played
      currentTrickPlayed: []
    };

    // Set current player to person after dealer
    game.currentPlayerId = nextPlayerId(game.round.dealerId);

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
//      var playerHand = playerCards.join();
      player.currentBid = null;
      player.tricksTaken = 0;
      player.hand = playerCards; //playerHand;
      player.currentHand = playerCards; // playerHand;
    }

    // Broadcast event to users
    io.in('game').emit('dealHand', {game: game});
  });

  socket.on('bid', function(data){

    var playerId = data.playerId;
    var currentBid = data.bid;

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
    //if (game.currentPlayerId === game.round.dealerId)
    if (game.round.bids == game.players.length){
      game.round.currentTrick = 1;
      game.round.currentTrickPlayed = [];
//      game.round.numTricks = 10;
      game.round.status = 'Play';
    }

    // Advance player
    game.currentPlayerId = nextPlayerId(game.currentPlayerId);

    // Broadcast event to users
    io.in('game').emit('bid', {playerId: data.playerId, bid: currentBid, game: game});

  });

  socket.on('playCard', function(data){
    var card = data.card;

    // Broadcast event to users
    io.in('game').emit('playCard', {playerId: data.playerId, cardShortName: data.card, game: game});
/*
		$gameID = $_REQUEST["gameID"];
		$roundID = $_REQUEST["roundID"];
		$handID = $_REQUEST["handID"];
		$card = $_REQUEST["card"];

		# Make sure it is the user's turn to play
		$sql = "SELECT game.players, game.rounds, game.currentPlayerID, game.nascar,
						round.trump, round.hands, round.dealerID,
						player.userID, player.currentHand
					FROM `game`
					LEFT JOIN `player` ON (player.gameID = game.id AND player.seatID = game.currentPlayerID)
					LEFT JOIN `round` ON (round.gameID = game.id AND round.roundID = game.currentRoundID)
				WHERE game.id = ?
				AND game.currentRoundID = ?
				AND round.currentHandID = ?
				AND player.userID = ?";
		$db->query($sql, "iiii", $gameID, $roundID, $handID, $_SESSION["userID"]);
		$rows = $db->fetchAll();
		$db->freeResult();
		$players = intval($rows[0]["players"]);
		$rounds = intval($rows[0]["rounds"]);
		$currentPlayerID = intval($rows[0]["currentPlayerID"]);
		$nascar = ($rows[0]["nascar"] == 1);
		$trump = $rows[0]["trump"];
		$hands = intval($rows[0]["hands"]);
		$dealerID = intval($rows[0]["dealerID"]);
		$currentUserID = intval($rows[0]["userID"]);
		$currentHand = explode(",", $rows[0]["currentHand"]);

		# Correct bidding order
		if ($currentUserID == $_SESSION["userID"]) {

			# Make sure user has this card in their hand
			if (in_array($card, $currentHand)) {
				$cardPos = array_search($card, $currentHand);

				# Update card played
				$sql = "INSERT INTO `hand` (gameID, roundID, handID, seatID, card) VALUES (?,?,?,?,?)";
				$db->query($sql, "iiiis", $gameID, $roundID, $handID, $currentPlayerID, $card);

				# Update player hand
				array_splice($currentHand, $cardPos, 1);
				$newHand = implode(",", $currentHand);
				$sql = "UPDATE `player` SET currentHand = ? WHERE gameID = ? AND userID = ?";
				$db->query($sql, "sii", $newHand, $gameID, $_SESSION["userID"]);

				# Update current player
				$nextPlayerID = ($currentPlayerID % $players) + 1;
				$db->query("UPDATE `game` SET currentPlayerID = ? WHERE id = ?", "ii", $nextPlayerID, $gameID);

				$json = array("has_data" => true, "currentPlayerID" => $nextPlayerID);

				# Check for last card in hand
				$sql = "SELECT COUNT(*) AS total FROM `hand` WHERE gameID = ? AND roundID = ? AND handID = ?";
				$db->query($sql, "iii", $gameID, $roundID, $handID);
				$rows = $db->fetchAll();
				$db->freeResult();
				if ($rows[0]["total"] == $players) {

					# Update hand
					$sql = "SELECT seatID, card FROM `hand` WHERE gameID = ? AND roundID = ? AND handID = ? ORDER BY active";
					$db->query($sql, "iii", $gameID, $roundID, $handID);
					$cardsPlayed = $db->fetchAll();
					$firstCard = $cardsPlayed[0];
					$highestCardSeat = $firstCard["seatID"];
					$highestCardSuit = substr($firstCard["card"], 0, 1);
					$highestCardVal = intval(substr($firstCard["card"], 1));

					foreach ($cardsPlayed as $card) {
						$thisCard = $card["card"];
						$thisCardSeat = $card["seatID"];
						$thisCardSuit = substr($thisCard, 0, 1);
						$thisCardVal = intval(substr($thisCard, 1));
						$out[] = "this card: " . $thisCard;
						$out[] = "this card seat: " . $thisCardSeat;
						$out[] = "this card val: " . $thisCardVal;
						$out[] = "this card suit: " . $thisCardSuit;

						# Trump over no trump
						if ($thisCardSuit == $trump && $highestCardSuit != $trump) {
							$highestCardSeat = $thisCardSeat;
							$highestCardSuit = $thisCardSuit;
							$highestCardVal = $thisCardVal;
							$out[] = "this card is now highest because of trump";
						}
						# Higher card in same suit
						elseif ($thisCardSuit == $highestCardSuit && $thisCardVal >= $highestCardVal) {
							$highestCardSeat = $thisCardSeat;
							$highestCardSuit = $thisCardSuit;
							$highestCardVal = $thisCardVal;
							$out[] = "this card is now highest because of val";
						}
					}
					$out[] = "highest card seat is: " . $highestCardSeat;

					# Update trick
					$sql = "UPDATE `hand` SET trick = 1 WHERE gameID = ? AND roundID = ? AND handID = ? AND seatID = ?";
					$db->query($sql, "iiii", $gameID, $roundID, $handID, $highestCardSeat);

					# Update current player
					# Trick winner leads next hand
					$nextPlayerID = $highestCardSeat;
					$sql = "UPDATE `game` SET currentPlayerID = ? WHERE id = ?";
					$db->query($sql, "ii", $nextPlayerID, $gameID);

					# Update round -- this is not the last hand in round
					if ($handID < $hands) {
						$nextHandID = $handID + 1;
						$sql = "UPDATE `round` SET currentHandID = currentHandID + 1 WHERE gameID = ? AND roundID = ?";
						$db->query($sql, "ii", $gameID, $roundID);

						$json = array("has_data" => true, "currentHandID" => $nextHandID, "currentPlayerID" => $nextPlayerID, "out" => $out);
					}

					# Check for last hand in round
					else {

						# Update score
						$sql = "SELECT player.userID, player.currentBid, SUM(hand.trick) AS tricks
								FROM `player`
								LEFT JOIN `hand` ON (hand.gameID = player.gameID AND hand.seatID = player.seatID)
								WHERE hand.gameID = ?
								AND hand.roundID = ?
								GROUP BY player.userID";
						$db->query($sql, "ii", $gameID, $roundID);
						$rows = $db->fetchAll();
						$db->freeResult();

						$usersMadeBid = 0;
						foreach ($rows as $row) {

							# User made bid
							if ($row["currentBid"] == $row["tricks"]) {
								$usersMadeBid++;
								$points = $row["tricks"] + 10;
							}
							else {
								$points = $row["tricks"];
							}
							$sql = "UPDATE `player` SET
										score = score + ?,
										hand = NULL,
										currentHand = NULL
									WHERE gameID = ?
									AND userID = ?";
							$db->query($sql, "iii", $points, $gameID, $row["userID"]);
						}

						# Update round
						$sql = "UPDATE `round` SET status = 'Complete', winningPlayers = ? WHERE gameID = ? AND roundID = ?";
						$db->query($sql, "iii", $usersMadeBid, $gameID, $roundID);

						# Update game
						$nextDealerID = ($dealerID % $players) + 1;
						$nextPlayerID = $nextDealerID;
						$nextRoundID = $roundID + 1;
						$json = array(
							"has_data" => true,
							"currentRoundID" => $nextRoundID,
							"currentHandID" => 1,
							"currentPlayerID" => $nextPlayerID
						);

						# Check for last round in game
						if ($roundID == $rounds) {

							# Calculate winner
							$sql = "SELECT userID
									FROM `player`
									WHERE gameID = ?
									ORDER BY score DESC, seatID ASC
									LIMIT 1";
							$db->query($sql, "i", $gameID);
							$rows = $db->fetchAll();
							$winningUserID = $rows[0]["userID"];
							$db->freeResult();

							# Update game
							$sql = "UPDATE `game` SET status = 'Complete', winningUserID = ? WHERE id = ?";
							$db->query($sql, "ii", $winningUserID, $gameID);

							# Update all users
							$sql = "UPDATE `user` SET games = games + 1 WHERE currentGameID = ?";
							$db->query($sql, "i", $gameID);

							# Update winning user
							$sql = "UPDATE `user` SET wins = wins + 1 WHERE id = ?";
							$db->query($sql, "i", $winningUserID);

							$json = array("has_data" => true, "finished" => true, "winningUserID" => $winningUserID);
						}

						# Check for nascar
						else if ($roundID == ($rounds - 3) && $rounds > 6) {

							# Calculate scores
							$sql = "SELECT userID, score, score AS newScore
										FROM `player`
									WHERE gameID = ?
									ORDER BY score DESC, seatID ASC";
							$db->query($sql, "i", $gameID);
							$rows = $db->fetchAll();
							$db->freeResult();

							# Update scores
							for ($i=1; $i<count($rows); $i++) {
								$pointsBehindNextPlayer = $rows[$i-1]["score"] - $rows[$i]["score"];
								$newPointsBehindNextPlayer = min($pointsBehindNextPlayer, 2);
								$rows[$i]["newScore"] = $rows[$i-1]["newScore"] - $newPointsBehindNextPlayer;

								$sql = "UPDATE `player` SET score = ? WHERE gameID = ? AND userID = ? LIMIT 1";
								$db->query($sql, "iii", $rows[$i]["newScore"], $gameID, $rows[$i]["userID"]);
							}
						}
					}
				}
			}
			# User played illegal card
			else {
				$json = array("has_data" => false, "error" => "User played illegal card.", "json" => $rows);
			}
		}
		# Wrong playing order
		else {
			$json = array("has_data" => false, "error" => "User played out of turn.", "json" => $rows);
		}*/
  });


  // Log snackbar/console messages to server
  socket.on('snackbarMessage', function(msg) {
    console.log('Snackbar Message from SocketId ' + socket.id + ': ' + msg);
  });

});


/**
 * HELPER FUNCTIONS
 */
function getRandomInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
}

function nextPlayerId(playerId){
  return (playerId % game.players.length) + 1;
}

function notifyNextPlayer(){
  // Send data to all clients
//  io.in('game').emit('notifyNextPlayer', {game: game, playerId: game.currentPlayerId});
}
