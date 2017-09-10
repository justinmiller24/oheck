
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
var users = [];
var game = {};
var GAME_DEFAULTS = {
  isActive: false,
  cardsDealt: false,
  currentDealer: null,
  currentPlayerId: 0,
  currentRound: 0,
  numPlayers: 0,
  numRounds: 0,
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
    noTrump: false, // Set to "true" to allow trump-less hands
    // Change number of cards each round
    upDown: false
  },
  // User ID that created the game
  ownerId: null,
  // Array of players
  // Each player will have a "currentBid", "numTricksTaken", "hand", "currentHand", and "score"
  players: [],
  round: {
    currentTrick: 0,
    currentBid: 0,
    currentTrump: null,
    numBid: 0,
    numTricks: 0,
    bids: 0,
    dealerId: null,
    trump: null, // C, S, H, D, or N
    status: null, // Bid or Play
    currentHand: 0, // 1 - numHands
    // Array of cards played
    currentTrickPlayed: []
  }
};


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
});


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

    // Create user ID
    var userId = users.length;
    data.id = userId;
    users[userId] = data;
    console.log('A new user joined and has been assigned user ID ' + userId);

    // Send data to user that just logged in
    socket.emit('myUserLogin', {userId: userId, users: users});

    // Joins the game room
    socket.join('game');

    // Send data to all other clients in room except sender
    socket.to('game').emit('userJoined', {userId: userId, users: users});
  });

  socket.on('userJoined', function(data){
    var userId = data.id;
    users[userId] = data;

    // Send data to user that just logged in
    socket.emit('myUserLogin', {userId: userId, users: users});

    console.log('User ' + userId + ' has returned!');

    // Joins the game room
    socket.join('game');

    // Send data to all clients including sender
    io.in('game').emit('userJoined', {userId: userId, users: users});
  });

  socket.on('userLogout', function(data){
    console.log('user logout: ' + data.userId);

    // Remove from user array
    users.splice(data.userId, 1);

    // Broadcast event to users
    socket.to('game').emit('userLogout', {userId: data.userId, users: users});
  });


  /*
   * GAME FUNCTIONS
   */
  socket.on('startGame', function(data){
    console.log(users[data.ownerId].name + ' started the game!');

    // Setup game
    game = GAME_DEFAULTS;
    game.isActive = true;
    game.numPlayers = users.length;
    game.numRounds = data.rounds;
    game.currentRound = 0;
    game.currentDealer = 0;
    game.ownerId = data.ownerId;
    game.players = [];
    for (var i in users){
      game.players.push({
        position: i,
        name: users[i].name,
        avatar: users[i].avatar,
        bid: null,
        tricksTaken: 0,
        hand: [],
        currentHand: [],
        score: 0
      })
    }
    game.currentPlayerId = 1;

    console.log('Game setup and ready for broadcast!');

    // Broadcast event to users
    io.in('game').emit('startGame', {game: game});
  });

  socket.on('dealHand', function(){
/*
  		$gameID = $_REQUEST["gameID"];

  		$sql = "SELECT players, rounds, decks, trump, currentRoundID FROM `game`
  					LEFT JOIN `user` ON user.currentGameID = game.id
  				WHERE user.id = ?
  				AND game.id = ?";
  		$db->query($sql, "ii", $_SESSION["userID"], $gameID);
  		if ($db->numRows() == 1) {
  			$rows = $db->fetchAll();
  			$db->freeResult();

  			# Set active
  			$db->query("UPDATE `game` SET active = NOW() WHERE id = ?", "i", $gameID);

  			$players = $rows[0]["players"];
  			$rounds = $rows[0]["rounds"];
  			$decks = $rows[0]["decks"];
  			$trump = ($rows[0]["trump"] == 1);
  			$currentRoundID = $rows[0]["currentRoundID"];
  			$nextRoundID = $currentRoundID + 1;
  			$nextDealerID = (($currentRoundID - 1) % $players) + 1;
  			if ($nextDealerID == 0) {
  				$nextDealerID = $players;
  			}

  			if ($nextRoundID <= $rounds) {
  				$maxCards = floor(52 * $decks / $players);
  #				$cardsToDeal = $rounds - $nextRoundID + 1;
  				$cardsToDeal = 10;

  				# Can't deal less than 1 card or more than MAX_CARDS
  				$cardsToDeal = max(1, min($maxCards, $cardsToDeal));
  				$trumpArray = array("D","C","H","S","N");
  				$nextTrump = ($trump) ? $trumpArray[rand(0,3)] : $trumpArray[4];

  				# Create round
  				$sql = "INSERT INTO `round` (gameID, roundID, hands, dealerID, trump) VALUES (?,?,?,?,?)";
  				$db->query($sql, "iiiis", $gameID, $nextRoundID, $cardsToDeal, $nextDealerID, $nextTrump);

  				# Update game
  				$nextPlayerID = ($nextDealerID % $players) + 1;
  				$sql = "UPDATE `game` SET currentRoundID = ?, currentPlayerID = ? WHERE id = ?";
  				$db->query($sql, "iii", $nextRoundID, $nextPlayerID, $gameID);

  				$cardArray = array();
  				for ($i=2; $i<=14; $i++) {
  					$cardArray[] = "H" . $i;
  					$cardArray[] = "S" . $i;
  					$cardArray[] = "D" . $i;
  					$cardArray[] = "C" . $i;
  				}

  				# Create deck/cards to deal
  				$cards = array();
  				for ($i=0; $i<$decks; $i++) {
  					foreach ($cardArray as $c) {
  						$cards[] = $c;
  					}
  				}

  				# Deal cards
  				for ($seat=1; $seat<=$players; $seat++) {
  					$playerCards = array();
  					for ($i=0; $i<$cardsToDeal; $i++) {
  						# Pick a random card from remaining cards
  						$random = rand(0, count($cards) - 1);
  						$playerCards[] = $cards[$random];
  						array_splice($cards, $random, 1);
  					}

  					$playerHand = implode(",", $playerCards);
  					$sql = "UPDATE `player` SET currentBid = NULL, hand = ?, currentHand = ?
  							WHERE gameID = ?
  							AND seatID = ?";
  					$db->query($sql, "ssii", $playerHand, $playerHand, $gameID, $seat);
  				}

  				$json = array("has_data" => true, "round" => $nextRoundID);
  			}
  			else {
  				$json = array("has_data" => false, "error" => "Game is complete");
  			}
  		}*/
  });

  socket.on('playerBid', function(data){
/*
    $gameID = $_REQUEST["gameID"];
    $roundID = $_REQUEST["roundID"];
    $bid = $_REQUEST["bid"];

    # Make sure it is the user's turn to bid
    $sql = "SELECT round.dealerID, game.players, game.currentPlayerID, player.*
          FROM `game`
          LEFT JOIN `player` ON (player.gameID = game.id AND player.seatID = game.currentPlayerID)
          LEFT JOIN `round` ON (round.gameID = game.id AND round.roundID = game.currentRoundID)
        WHERE game.id = ?
        AND game.currentRoundID = ?
        AND player.userID = ?";
    $db->query($sql, "iii", $gameID, $roundID, $_SESSION["userID"]);
    if ($db->numRows() == 1) {
      $rows = $db->fetchAll();
      $dealerID = $rows[0]["dealerID"];
      $players = $rows[0]["players"];
      $currentPlayerID = $rows[0]["currentPlayerID"];

      # Update player bid
      $sql = "UPDATE `player` SET currentBid = ? WHERE userID = ? AND seatID = ? AND gameID = ?";
      $db->query($sql, "iiii", $bid, $_SESSION["userID"], $currentPlayerID, $gameID);

      # Update round total bid
      $sql = "UPDATE `round` SET bids = (SELECT SUM(currentBid) FROM `player` WHERE gameID = ? AND roundID = ?)
          WHERE gameID = ?
          AND roundID = ?";
      $db->query($sql, "iiii", $gameID, $roundID, $gameID, $roundID);

      # Update current player
      $nextPlayerID = ($currentPlayerID % $players) + 1;
      $sql = "UPDATE `game` SET currentPlayerID = (currentPlayerID % players + 1) WHERE id = ?";
      $db->query($sql, "i", $gameID);

      # Check for last player to bid
      if ($currentPlayerID == $dealerID) {

        # Update round
        $sql = "UPDATE `round` SET status = 'Play', currentHandID = 1
            WHERE gameID = ?
            AND roundID = ?";
        $db->query($sql, "ii", $gameID, $roundID);
        $json = array("has_data" => true, "hand" => 1);
      }
    }
    else {
      $json = array("has_data" => false, "error" => "Wrong bidding order: " . $db->error);
    }
*/
  });

  socket.on('playCard', function(data){
    var card = data.card;
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
