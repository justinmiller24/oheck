/*
 * OH HECK
 * Written by Justin Miller on 6.10.2012
 */

var oh = {
	ANIMATION_SPEED: 500,
	CARD_PADDING: 18,
	CARD_SIZE: {
		width: 71,
		height: 96
	},
	CARDBACK: {
		x: 0,
		y: -4 * 96	// -4 * this.CARD_SIZE.height
	},
	CONDENSE_COUNT: 6,
	HCARDBACK: {
		x: -8 * 96,	// -8 * this.CARD_SIZE.height
		y: -5 * 96	// -5 * this.CARD_SIZE.height
	},
	HORIZONTAL_MARGIN: 70,	// PLAYER WIDTH (60) + HORIZONTAL PADDING (10)
	OVERLAY_MARGIN: 2,
	PILE_POS: {
		left: 720 * 0.5,			// this.DECK_POS.left + 1.3 * this.CARD_SIZE.width
		top: 620 * 0.5 - 96 * 0.5	// this.DECK_POS.top
	},
	TAKE_TRICK_DELAY: 750,
	VERTICAL_MARGIN: 96,	// PLAYER HEIGHT (68) + PLAYER LABEL (18) HORIZONTAL PADDING (10)
	zIndexCounter: 1
};


function $A(arr) {
	return {
		arr: arr,
		each: function (func) {
			for (var i = 0; i < this.arr.length; i++) {
				func.call(this.arr, this.arr[i]);
			}
		},
		any: function (func) {
			for (var i = 0; i < this.arr.length; i++) {
				if (func.call(this.arr, this.arr[i])) {
					return true;
				}
			}
			return false;
		},
		all: function (func) {
			for (var i = 0; i < this.arr.length; i++) {
				if (!func.call(this.arr, this.arr[i])) {
					return false;
				}
			}
			return true;
		},
		remove: function (item) {
			for (var i = 0; i < this.arr.length; i++) {
				if (this.arr[i] == item) {
					this.arr.splice(i, 1);
					return true;
				}
			}
			return false;
		},
		last: function () {
			if (!this.arr.length) {
				return null;
			}
			return this.arr[this.arr.length - 1];
		}
	};
}

function Card(suit, rank) {
	this.init(suit, rank);
}
Card.prototype = {
	init: function (suit, rank) {
		this.suit = suit;
		this.rank = parseInt(rank,10);
		var sorts = {
			D: 'diamonds',
			C: 'clubs',
			H: 'hearts',
			S: 'spades'
		};
		var specialCards = {
			11: 'jack',
			12: 'queen',
			13: 'king',
			14: 'ace'
		}
		if (specialCards[rank]) {
			this.longName = specialCards[rank] + ' of ' + sorts[suit];
		} else {
			this.longName = rank + ' of ' + sorts[suit];
		}
		this.shortName = this.suit + this.rank;
	},
	
	hideCard: function (position) {
		if (!position) {
			position = 'bottom';
		}
		var h = $(this.guiCard).height(),
			w = $(this.guiCard).width();
		if (position == 'top' || position == 'topLeft' || position == 'topRight' || position == 'bottom' || position == 'bottomLeft' || position == 'bottomRight') {
			$(this.guiCard).setBackground(oh.CARDBACK.x + 'px', oh.CARDBACK.y + 'px');
			if (w > h) {
				$(this.guiCard).height(w).width(h);
			}
		} else {
			$(this.guiCard).setBackground(oh.HCARDBACK.x + 'px', oh.HCARDBACK.y + 'px');
			if (h > w) {
				$(this.guiCard).height(w).width(h);
			}
		}
		this.rotate(0);
	},
	moveToFront: function () {
		this.guiCard.style.zIndex = oh.zIndexCounter++;
	},
	rankName: function () {
		var names = [null, null, 'a two', 'a three', 'a four', 'a five', 'a six', 'a seven', 'an eight', 'a nine', 'a ten', 'a jack', 'a queen', 'a king', 'an ace'];
		return names[this.rank];
	},
	rotate: function (angle) {
		$(this.guiCard)
			.css('-webkit-transform', 'rotate(' + angle + 'deg)')
			.css('-moz-transform', 'rotate(' + angle + 'deg)')
			.css('-ms-transform', 'rotate(' + angle + 'deg)')
			.css('transform', 'rotate(' + angle + 'deg)')
			.css('-o-transform', 'rotate(' + angle + 'deg)');
	},
	shortRankName: function () {
		var names = [null, null, 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace'];
		return names[this.rank];
	},
	showCard: function (position) {
		var offsets = {
			C: 0,
			D: 1,
			H: 2,
			S: 3
		};
		var xpos, ypos;
		if (!position) {
			position = 'bottom';
		}
		var h = $(this.guiCard).height(),
			w = $(this.guiCard).width();
		if (position == 'top' || position == 'bottom') {
			xpos = (2 - this.rank) * oh.CARD_SIZE.width;
			ypos = -offsets[this.suit] * oh.CARD_SIZE.height;
			if (position == 'top' && this.rank > 10) {
				xpos -= 4 * oh.CARD_SIZE.width;
			}
			if (w > h) {
				$(this.guiCard).height(w).width(h);
			}
			this.rotate(0);
		} else {
			ypos = -5 * oh.CARD_SIZE.height;
			if (this.rank <= 10) {
				ypos -= (this.rank - 2) * oh.CARD_SIZE.width;
				xpos = -offsets[this.suit] * oh.CARD_SIZE.height;
			} else {
				xpos = -4 * oh.CARD_SIZE.height - offsets[this.suit] * oh.CARD_SIZE.height;
				if (position == 'left') {
					ypos -= (this.rank - 7) * oh.CARD_SIZE.width;
				} else {
					ypos -= (this.rank - 11) * oh.CARD_SIZE.width;
				}
			}
			if (h > w) {
				$(this.guiCard).height(w).width(h);
			}
			this.rotate(0);
		}
		$(this.guiCard).setBackground(xpos + 'px', ypos + 'px');
	},
	suitName: function () {
		var sorts = {
			D: 'diamond',
			C: 'club',
			H: 'heart',
			S: 'spade'
		};
		return sorts[this.suit];
	},
};


function OhHeck() {
	this.init();
}
OhHeck.prototype = {
	makeRenderFunc: function (format) {
		return function (e) {
			with(e) {
				var msg = eval(format.replace(/@(\w+(\.\w+)*)/g, "'+$1+'").replace(/(.*)/, "'$1'"));
				doLog(msg);
			}
			e.game.callbackQueue.push(e);
		};
	},
	init: function () {
		this.callbackQueue = [];
		this.renderers = {};
		this.renderers['dealcard'] = this.makeRenderFunc('dealcard - @card - @player.name - hand: @player.hand');
		this.renderers['start'] = this.makeRenderFunc('start');
		this.renderers['play'] = this.makeRenderFunc('play - @player.name played @cards - hand: @player.hand');
//		this.renderers['win'] = this.makeRenderFunc('win - @player.name');
		this.renderers['sorthand'] = this.makeRenderFunc('sorthand - @player.name - @player.hand');
		this.renderers['taketrick'] = this.makeRenderFunc('taketrick - @player.name takes the trick');
		this.renderers['bid'] = this.makeRenderFunc('bid - @player.name bids @bid');
	},
	
	addPlayer: function (player) {
		player.game = this;
		player.pos = this.players.length;
		this.players.push(player);
	},
	afterDealing: function () {
		this.message('Sorting Hand...');
		for (var i = 0; i < this.players.length; i++) {
			var p = this.players[i];
			if (p.isHuman && !p.handSorted) {
				return this.sortHand(p, this.afterDealing);
			}
		}
		for (var i = 0; i < this.players.length; i++) {
//			doLog('Clear tricks, bid value for player ' + i);
			var p = this.players[i];
			p.tricks = [];
			p.bidValue = -1;
			webRenderer._adjustHand(p, function(){}, 50, true, g.game.cardCount);
		}
	},
	afterPlayCards: function () {
		// Not end of trick/hand
		if (this.pile.length < this.players.length) {
			var player = this.players[this.currentPlayerIndex];
			this.currentPlayerIndex = this.nextIndex(this.currentPlayerIndex);
			this.playerStartTurn();
		}
		
		// End of trick/hand
		else {
			var winner = 0;
			var firstCard = this.pile[0];
			var bestCard = firstCard;
			var firstPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
			for (var i = 1; i < this.pile.length; i++) {
				var card = this.pile[i];
				if (g.game.trump != 'N' && bestCard.suit != g.game.trump && card.suit == g.game.trump) {
					bestCard = card;
					winner = i;
				} else if (card.suit == bestCard.suit && card.rank > bestCard.rank) {
					bestCard = card;
					winner = i;
				}
			}
			var winnerIndex = (firstPlayerIndex + winner) % this.players.length;
			var finished = this.players[0].hand.length == 0;
			this.currentPlayerIndex = winnerIndex;
			this.players[this.currentPlayerIndex].tricks.push(this.pile.slice(0));
			var oldPile = this.pile;
			this.pile = [];
			
			// Update tricks
			g.game.message(g.game.players[winnerIndex].name + ' wins trick #' + g.game.hand);
//			doLog('Waiting: ' + g.waiting);
			
			// Not end of round (end of hand in round)
			if (!finished) {
				g.game.hand++;
				
				// Added in case getRound() was called previous to useCard(),
				// and returns after this JSON response does
//				setTimeout("g.waiting=false; doLog('Reset waiting after 1500');", 1500);
				setTimeout("g.waiting=false;", 2000);
			}
			
			// End of round (last hand in round)
			else {
//				doLog('New round starting');
//				this.round++;
//				this.hand = 0;
				
//				doLog('Just played last card in round');
				g.waiting = true;
//				g.game.cardsDealt = false;
				
				// Clear player bids
				for (var i=0; i<g.game.players.length; i++) {
					var p = g.game.players[i];
					
					// Player made bid
					if (p.tricks.length == p.bidValue) {
						p.score += (10 + p.bidValue);
					}
					else {
						p.score += p.bidValue;
					}
					
					// Reset player hand
					p.bidValue = -1;
					p.tricks = [];
				}
				
				// End of game
//				g.waiting = true;
//				setTimeout("g.waiting=true;", 2000);
				if (this.round == this.rounds) {
					setTimeout("updateStats(); g.game.message('Scoreboard Update!');", 1000);
					setTimeout("g.game.message('Game over -- thanks for playing!');", 3000);
					setTimeout("g.game.message('You will be redirected to lobby in 3 sec');", 11000);
					setTimeout("$('#board').fadeOut();", 14000);
					setTimeout("window.location.reload();", 15000);
				}
				
				// Nascar
				else if (this.round == (this.rounds - 3) && this.rounds > 6) {
//					setTimeout("updateStats(); g.game.message('Scoreboard Update -- NASCAR!');", 1000);
					setTimeout("updateStats(); g.game.nascar();", 1000);
//					setTimeout("g.game.nascar();", 3000);
					setTimeout("g.game.message('Next round will load in 3 sec');", 5000);
					setTimeout("$('#board').fadeOut();", 8000);
					setTimeout("window.location.reload();", 9000);
				}
				
				else {
					setTimeout("updateStats(); g.game.message('Scoreboard Update!');", 1000);
					setTimeout("g.game.message('Next round will load in 2 sec');", 4000);
					setTimeout("$('#board').fadeOut();", 6000);
					setTimeout("window.location.reload();", 7000);
				}
			}
			
			var callback = !finished ? this.playerStartTurn : this.calculateScore;
			this.renderEvent('taketrick', callback, {
				trick: oldPile
			});
		}
	},
	allPlayersBid: function () {
		return ($A(this.players).all(function (p) {
			return p.bidValue >= 0;
		}));
	},
	bid: function (player, bid) {
		player.bidValue = bid;
		this.message(player.name + ' bids ' + player.bidValue);
		$('#' + player.id + ' small').append(' (' + player.bidValue + ')');
		$('#' + player.id + '-bubble p').text('I bid ' + player.bidValue).parent().fadeIn();
		
		// Update total bids
//		g.status.round.bids += bid;
//		updateStats();
		
		if (this.allPlayersBid()) {
			this.renderEvent('start', this.playerStartTurn);
		}
		else {
			this.bidPlayerIndex = this.nextIndex(this.bidPlayerIndex);
		}
	},
	bidPlayerIndex: 0,
	calculateScore: function () {
//		this.message('End of round! Need to calculate score...');
//		doLog('Rotate dealer...');
		g.game.dealerIndex = g.game.nextIndex(g.game.dealerIndex);
		g.game.nextPlayerToDealTo = g.game.nextIndex(g.game.dealerIndex);
		g.game.currentPlayerIndex = g.game.nextIndex(g.game.dealerIndex);
//		doLog('Next dealer: ' + g.game.dealerIndex);
//		doLog('Next first player: ' + g.game.currentPlayerIndex);
	},
	canPlayCard: function (player, card) {
		if (this.pile.length == 0) {
			return true;
		}
		var trickSuit = this.pile[0].suit;
		return card.suit == trickSuit || !$A(player.hand).any(function (c) {
			return c.suit == trickSuit;
		});
	},
	cardCount: 0,
	cardsDealt: false,
	currentPlayerIndex: 0,
	deal: function () {
		if (!this.deck) {
			this.message('Cannot deal... deck is empty!');
		} else {
			this.message('Dealing...');
			this.cardsDealt = true;
			
			if (this.dealtCardCount == this.cardCount * this.players.length) {
				this.bidPlayerIndex = this.currentPlayerIndex;
				this.afterDealing();
				this.hand = 1;
			} else {
				var card = this.deck.pop();
				var player = this.players[this.nextPlayerToDealTo];
				player.hand.push(card);
				this.nextPlayerToDealTo = this.nextIndex(this.nextPlayerToDealTo);
				this.dealtCardCount++;
				this.renderEvent('dealcard', this.deal, {
					player: player,
					cardpos: player.hand.length - 1,
					card: card
				});
			}
		}
	},
	dealerIndex: -1,
	dealtCardCount: 0,
	deck: null,
	hand: 0,
	message: function(msg) {
		$('#messageBox p').html(msg);
	},
	nascar: function() {
		g.game.message('Scoreboard Update -- NASCAR!');
		g.nascar = new ParticleCanvas($('#nascar')[0], {x:50});
		g.nascar.start();
	},
/*	nascar: function() {
		this.message('NASCAR!');
		
		var playerScores = [];
		for (var i=0; i<this.players.length; i++) {
			var p = this.players[i];
			playerScores.push({id:i, score:p.score, newScore:p.score});
		}
		
		// Sort players by score
		playerScores.sort(function(a,b) { return parseInt(b.score) - parseInt(a.score) } );
		
		// Loop through players
		for (var i=1; i<playerScores.length; i++) {
			var pointsBehindNextPlayer = playerScores[i-1].score - playerScores[i].score;
			var newPointsBehindNextPlayer = Math.min(pointsBehindNextPlayer, oh.NASCAR_SCORE_GAP);
			playerScores[i].newScore = playerScores[i-1].newScore - newPointsBehindNextPlayer;
			
			// Bump player score
			this.players[playerScores[i].id].score = playerScores[i].newScore;
		}
		updateStats();
		
/*		getJSON({op:"nascar", gameID:user.currentGameID}, function(data) {
			if (data.has_data) {
				console.log('data');
			}
		});*
	},*/
	newDeck: function () {
		this.deck = [];
		if (g.status.player[1].hand == null || g.status.player[1].hand == '') {
			return false;
		}
		
		// Set trump suit
		this.trump = g.status.round.trump;
		
		var pos = g.game.nextPlayerToDealTo;
		var playersHands = Array();
		for (var i=0; i<g.status.game.players; i++) {
			playersHands.push(g.status.player[((i + pos) % g.status.game.players) + 1].hand.split(","));
		}
		for (var i=0; i<g.status.round.hands; i++) {
			for (var j=0; j<playersHands.length; j++) {
				var cardStr = playersHands[j].shift();
				var suit = cardStr.substring(0,1);
				var num = cardStr.substring(1);
				this.deck.unshift(new Card(suit, num));
			}
		}
		
		// Create cardpile
		var left = ($('#board').width() - 71) / 2;
		var top = ($('#board').height() - 96) / 2;
		for (var i = 0; i < this.deck.length; i++) {
			var card = this.deck[i];
			if ((i + 1) % oh.CONDENSE_COUNT == 0) {
				left -= oh.OVERLAY_MARGIN;
				top -= oh.OVERLAY_MARGIN;
			}
			
			// Create GUI card
			var divCard = $('<div>').addClass('card').css({
				"left": left,
				"top": top
			});
			$('#board').append(divCard[0]);
			card.guiCard = divCard[0];
			divCard[0].card = card;
			card.moveToFront();
			card.hideCard();
		}
	},
	nextIndex: function (index) {
		return (index + 1) % this.players.length;
	},
	nextPlayerToDealTo: -1,
	pile: [],
	playCards: function (player, cards) {
		for (var i = 0; i < cards.length; i++) {
			var card = cards[i];
			this.pile.push(card);
//			card.selected = false;
			player.remove(card);
		}
		player.canPlay = false;
		this.renderEvent('play', this.afterPlayCards, {
			cards: cards
		});
	},
	players: [],
	playerStartTurn: function () {
		this.players[this.currentPlayerIndex].canPlay = true;
	},
	renderEvent: function (name, callback, eventData) {
		if (!eventData) {
			eventData = {};
		}
		if (!eventData.player) {
			eventData.player = this.players[this.currentPlayerIndex];
		}
		eventData.name = name;
		eventData.game = this;
		var game = this;
		eventData.callback = function () {
			callback.call(game);
		};
		this.renderers[name](eventData);
	},
	round: 0,
	rounds: 0,
	setEventRenderer: function (eventName, func) {
		this.renderers[eventName] = func;
	},
//	showDealButton: function () {
//		$('#deal').fadeIn();
//	},
	sortHand: function (player, callback, dontRender) {
		if (!player.hand) {
			return;
		}
		var diff = function (a, b) {
			if (player.handSorted == 'ASC') {
				return b - a;
			}
			return a - b;
		};
		player.hand.sort(function (c1, c2) {
			var suits = {D:0,C:1,H:2,S:3};
			switch (g.status.round.trump) {
				case "D":
					suits = {C:0,H:1,S:2,D:3}; break;
				case "C":
					suits = {H:0,S:1,D:2,C:3}; break;
				case "H":
					suits = {S:0,D:1,C:2,H:3}; break;
				case "S":
				default:
					suits = {D:0,C:1,H:2,S:3};
			}
			if (c1.suit == c2.suit) {
				return diff(c1.rank, c2.rank);
			}
			return diff(suits[c1.suit], suits[c2.suit]);
		});
		player.handSorted = (player.handSorted == 'ASC') ? 'DESC' : 'ASC';
		if (!dontRender) {
			this.renderEvent('sorthand', callback ||
			function () {});
		}
	},
	trump: 'N',
}

function ComputerPlayer(name) {
	this.init(name);
}
ComputerPlayer.prototype = {
	name: null,
	hand: null,
	isHuman: false,
	showCards: false,
	score: 0,
	tricks: [],
	bidValue: -1,
	init: function (name) {
		this.name = name;
		this.hand = [];
	},
	extend: function (type) {
		this.base = {};
		for (var i in type) {
			if (this[i]) {
				this.base[i] = this[i];
			}
			this[i] = type[i];
		}
	},
	hasCard: function (card) {
		for (var i = 0; i < this.hand.length; i++) {
			if (this.hand[i] == card) {
				return true;
			}
		}
		return false;
	},
	remove: function (card) {
		return $A(this.hand).remove(card);
	},
};

function HumanPlayer(name) {
	this.init(name);
}
HumanPlayer.prototype = {
	name: null,
	hand: null,
	isHuman: true,
	showCards: true,
	score: 0,
	tricks: [],
	bidValue: -1,
	
	startBid: function () {
		$('#bid').css('z-index', oh.zIndexCounter + 10000).show();
		this.game.message('Choose how many tricks you think you will take.');
		var isDealer = (this.game.dealerIndex == g.status.seatID - 1);
		var cannotBidIndex = (g.status.round.hands - g.status.round.bids);
		
		$('#bid div').remove();
		for (var i=0; i <= g.status.round.hands; i++) {
			
			// Force dealer
			if (isDealer && (i == cannotBidIndex)) {
				$('<div/>').text(i).addClass('cannotBid').appendTo('#bid').click(function(e) {
					g.game.message('Nice try! Anything but ' + $(this).text());
				}).mouseover(function () {
					g.game.message('Anything but ' + $(this).text());
				}).mouseout(function () {
					g.game.message('');
				});
			}
			else {
				$('<div/>').text(i).appendTo('#bid').click(function(e) {
					var bid = parseInt($(this).text());
					if (g.human.isBidding) {
						g.human.isBidding = false;
						getJSON({op:"bid", gameID:user.currentGameID, roundID:g.status.currentRoundID, bid:bid}, function(data) {
							g.game.bid(g.human, bid);
							g.waiting = false;
						});
					}
					else {
						this.game.message('You cannot bid until your turn.');
					}
					
					$('#bid').hide();
				}).mouseover(function () {
					g.game.message('Bid ' + $(this).text());
				}).mouseout(function () {
					g.game.message('');
				});
			}
		}
		this.isBidding = true;
	},
	useCard: function (card) {
		if (g.waiting) {
			if (this.isBidding) {
				this.game.message('It\'s your turn to bid now. You can\'t play any card while you\'re bidding!');
			} else {
				this.game.message('');
				if (!this.hasCard(card)) {
					this.game.message('You cannot play that card!');
				} else if (!this.canPlay) {
					this.game.message('It\'s not your turn to play!');
				} else if (!this.game.canPlayCard(this, card)) {
					this.game.message('Nice try! You must follow suit by playing a ' + this.game.pile[0].suitName());
				} else {
					this.game.message('Playing the ' + card.longName);
					getJSON({
						op:"playCard",
						gameID:user.currentGameID,
						roundID:g.status.currentRoundID,
						handID:g.status.handID,
						card:card.shortName
					}, function(data) {
						if (data.has_data) {
							g.game.playCards(g.game.players[g.game.currentPlayerIndex], [card]);
							g.waiting = false;
							
							// Added in case getRound() was called previous to useCard(),
							// and returns after this JSON response does
//							setTimeout("g.waiting=false; doLog('Reset waiting after 1500');", 1500);
							setTimeout("g.waiting=false;", 2000);
						}
						else {
							g.game.message('Error: ' + data.error);
						}
					});
				}
			}
		}
		else if (!this.canPlay) {
			this.game.message('It\'s not your turn to play!');
		}
		else {
			this.game.message('Retry after this message updates');
		}
	},
	
	init: ComputerPlayer.prototype.init,
	hasCard: ComputerPlayer.prototype.hasCard,
	remove: ComputerPlayer.prototype.remove
}




jQuery.fn.moveCard = function (top, left, callback, speed) {
	var props = {};
	props['top'] = top;
	props['left'] = left;
	props['queue'] = false;
	this.animate(props, speed || oh.ANIMATION_SPEED, callback);
	return this;
};
jQuery.fn.setBackground = function (x, y) {
	var props = {};
	props['background-position'] = x + ' ' + y;
	this.css(props);
	return this;
};

var webRenderer = {
	_adjustHand: function (player, callback, speed, moveToFront, handLength) {
		for (var i = 0; i < player.hand.length; i++) {
			var card = player.hand[i];
			var props = webRenderer._getCardPos(player, i, handLength);
			var f;
			
			// Last card dealt in hand
			if (i == player.hand.length - 1) {
				f = callback;
			}
			$(card.guiCard).moveCard(props.top, props.left, f, speed);
			if (moveToFront) {
				card.moveToFront();
			}
		}
		if (player.showCards) {
			webRenderer.showCards(player.hand, player.position, speed / 2);
		} else {
			webRenderer.hideCards(player.hand, player.position, speed / 2);
		}
	},
	_getCardPos: function (player, pos, handLength) {
		if (!handLength) {
			handLength = player.hand.length;
		}
		var handWidth = (handLength - 1) * oh.CARD_PADDING + oh.CARD_SIZE.width;
		var props = {};
		if (player.position == 'top' || player.position == 'topLeft' || player.position == 'topRight') {
			props.left = player.left + handWidth / 2 - oh.CARD_SIZE.width - pos * oh.CARD_PADDING;
			props.top = player.top;
		}
		else if (player.position == 'bottom' || player.position == 'bottomLeft' || player.position == 'bottomRight') {
			props.left = player.left - handWidth / 2 + pos * oh.CARD_PADDING;
			props.top = player.top;
		}
		else if (player.position == 'left') {
			props.left = player.left;
			props.top = player.top - handWidth / 2 + pos * oh.CARD_PADDING;
		}
		else if (player.position == 'right') {
			props.left = player.left;
			props.top = player.top + handWidth / 2 - oh.CARD_SIZE.width - pos * oh.CARD_PADDING;
		}
		return props;
	},
	dealCard: function (e) {
		webRenderer._adjustHand(e.player, e.callback, 50, true, e.game.cardCount);
	},
	hideCards: function (cards, position, speed) {
		setTimeout(function () {
			for (var i = 0; i < cards.length; i++) {
				cards[i].hideCard(position);
			}
		}, speed || (oh.ANIMATION_SPEED / 2));
	},
	play: function (e) {
//		oh.PILE_POS.left = (oh.TABLE_SIZE.NORMAL.width - oh.CARD_SIZE.width) / 2;
//		oh.PILE_POS.top = (oh.TABLE_SIZE.NORMAL.height - oh.CARD_SIZE.height) / 2;
/*		oh.PILE_POS.left = ($('#board').width() - oh.CARD_SIZE.width) / 2;
		oh.PILE_POS.top = ($('#board').height() - oh.CARD_SIZE.height) / 2;
		if (e.player.position == 'top') {
			oh.PILE_POS.top -= 60;
		} else if (e.player.position == 'bottom') {
			oh.PILE_POS.top += 10;
		} else if (e.player.position == 'left') {
			oh.PILE_POS.left -= 40;
			oh.PILE_POS.top -= 25;
		} else if (e.player.position == 'right') {
			oh.PILE_POS.left += 40;
			oh.PILE_POS.top -= 25;
		}*/
		var boardCenterX = ($('#board').width() - oh.CARD_SIZE.width) / 2;
		var boardCenterY = ($('#board').height() - oh.CARD_SIZE.height) / 2;
		
		if (e.player.position == 'top') {
			oh.PILE_POS.left = boardCenterX;
			oh.PILE_POS.top = boardCenterY - 60;
		}
		else if (e.player.position == 'topLeft') {
			oh.PILE_POS.left = boardCenterX - 30;
			oh.PILE_POS.top = boardCenterY - 60;
		}
		else if (e.player.position == 'topRight') {
			oh.PILE_POS.left = boardCenterX + 30;
			oh.PILE_POS.top = boardCenterY - 60;
		}
		else if (e.player.position == 'bottom') {
			oh.PILE_POS.left = boardCenterX;
			oh.PILE_POS.top = boardCenterY + 10;
		}
		else if (e.player.position == 'bottomLeft') {
			oh.PILE_POS.left = boardCenterX - 30;
			oh.PILE_POS.top = boardCenterY + 10;
		}
		else if (e.player.position == 'bottomRight') {
			oh.PILE_POS.left = boardCenterX + 30;
			oh.PILE_POS.top = boardCenterY + 10;
		}
		else if (e.player.position == 'left') {
			oh.PILE_POS.left = boardCenterX - 75;
			oh.PILE_POS.top = boardCenterY - 25;
		}
		else if (e.player.position == 'right') {
			oh.PILE_POS.left = boardCenterX + 75;
			oh.PILE_POS.top = boardCenterY - 25;
		}
		
		var beforeCount = e.game.pile.length - e.cards.length;

		function renderCard(i) {
			if (e.cards.length == 0) {
				e.callback();
			} else {
				var zIndexCards = e.player.hand.slice(0);
				$A(e.cards).each(function (c) {
					zIndexCards.push(c);
				});
				zIndexCards.sort(function (c1, c2) {
					return $(c1.guiCard).css('z-index') - $(c2.guiCard).css('z-index');
				});
				for (var i = zIndexCards.length - 1; i >= 0; i--) {
					$(zIndexCards[i].guiCard).css('z-index', oh.zIndexCounter + i + 1);
				}
				oh.zIndexCounter += zIndexCards.length + 3;
				var card = e.cards[0];
				$A(e.cards).remove(e.cards[0]);
				var top = oh.PILE_POS.top - (Math.floor((beforeCount + i) / oh.CONDENSE_COUNT) * oh.OVERLAY_MARGIN);
				var left = oh.PILE_POS.left - (Math.floor((beforeCount + i) / oh.CONDENSE_COUNT) * oh.OVERLAY_MARGIN);
				$(card.guiCard).moveCard(top, left, function () {
					renderCard(i + 1);
				});
				if (e.cards.length == 0) {
					webRenderer._adjustHand(e.player, null, oh.ANIMATION_SPEED, false, e.player.hand.length);
				}
				webRenderer.showCards([card]);
			}
		}
		
		renderCard(0);
	},
	showCards: function (cards, position, speed) {
		setTimeout(function () {
			for (var i = 0; i < cards.length; i++) {
				cards[i].showCard(position);
			}
		}, speed || (oh.ANIMATION_SPEED / 2));
	},
	sortHand: function (e) {
		webRenderer._adjustHand(e.player, e.callback, oh.ANIMATION_SPEED, false, e.player.hand.length);
	},
	takeTrick: function (e) {
		setTimeout(function () {
			$A(e.trick).each(function (c) {
				$(c.guiCard).addClass('trick');
			});
			var props = {};
			var cssClass;
			var trickProps = {};
//			var playerMargin = 2;
			var playerMargin = 5;
			var trickHeight = 45;
			var trickWidth = 33;
			var overlay = 10;
//			var playerSize = 50;
			var playerSizeX = 60;
			var playerSizeY = 90;
			var sidePlayerTop = 265;
			var topEdgeDistance = playerMargin + (playerSizeY - trickHeight) / 2;
			var sideEdgeDistance = playerMargin + (playerSizeX - trickHeight) / 2;
			var cardDistance = ($('#board').width() / 2) + playerSizeX / 2 + e.player.tricks.length * overlay;
			if (e.player.position == 'top') {
//				props['left'] = (($('#board').width() / 2) - (oh.CARD_SIZE.width / 2)) + 'px';
				cssClass = 'verticalTrick';
				trickProps['top'] = topEdgeDistance;
				trickProps['left'] = cardDistance;
				props = trickProps;
			}
			else if (e.player.position == 'topLeft') {
//				props['left'] = (($('#board').width() / 3) - (oh.CARD_SIZE.width / 2)) + 'px';
				cssClass = 'verticalTrick';
				trickProps['top'] = topEdgeDistance;
				trickProps['left'] = (0.3 * $('#board').width()) + (playerSizeX / 2) + e.player.tricks.length * overlay;
				props = trickProps;
			}
			else if (e.player.position == 'topRight') {
//				props['left'] = ((0.3 $('#board').width()) - (oh.CARD_SIZE.width / 2)) + 'px';
				cssClass = 'verticalTrick';
				trickProps['top'] = topEdgeDistance;
				trickProps['left'] = (0.7 * $('#board').width()) + (playerSizeX / 2) + e.player.tricks.length * overlay;
				props = trickProps;
			}
			else if (e.player.position == 'bottom') {
				cssClass = 'verticalTrick';
//				trickProps['bottom'] = playerMargin + 60 - playerSizeY + ((playerSizeY - trickHeight) / 2);
				trickProps['bottom'] = playerMargin + (playerSizeY - trickHeight) / 2;
				trickProps['right'] = cardDistance;
				props['top'] = $('#board').height() - trickProps['bottom'] - oh.CARD_SIZE.height;
				props['left'] = $('#board').width() - trickProps['right'] - oh.CARD_SIZE.width;
			}
			else if (e.player.position == 'bottomLeft') {
				cssClass = 'verticalTrick';
//				trickProps['bottom'] = playerMargin + 60 - playerSizeY + ((playerSizeY - trickHeight) / 2);
				trickProps['bottom'] = playerMargin + (playerSizeY - trickHeight) / 2;
				trickProps['right'] = cardDistance;
				props['top'] = $('#board').height() - trickProps['bottom'] - oh.CARD_SIZE.height;
				props['left'] = $('#board').width() - trickProps['right'] - oh.CARD_SIZE.width;
			}
			else if (e.player.position == 'bottomRight') {
				cssClass = 'verticalTrick';
//				trickProps['bottom'] = playerMargin + 60 - playerSizeY + ((playerSizeY - trickHeight) / 2);
				trickProps['bottom'] = playerMargin + (playerSizeY - trickHeight) / 2;
				trickProps['right'] = cardDistance;
				props['top'] = $('#board').height() - trickProps['bottom'] - oh.CARD_SIZE.height;
				props['left'] = $('#board').width() - trickProps['right'] - oh.CARD_SIZE.width;
			}
			else if (e.player.position == 'left') {
				cssClass = 'horizontalTrick';
				trickProps['bottom'] = $('#board').height() - sidePlayerTop + e.player.tricks.length * overlay;
//				trickProps['left'] = sideEdgeDistance + 1;
				trickProps['left'] = sideEdgeDistance;
				props['top'] = $('#board').height() - trickProps['bottom'] - oh.CARD_SIZE.height;
				props['left'] = trickProps['left'];
			}
			else if (e.player.position == 'right') {
				cssClass = 'horizontalTrick';
//				trickProps['top'] = sidePlayerTop + $('#player-position-1').height() + e.player.tricks.length * overlay;
				trickProps['top'] = sidePlayerTop + playerSizeY + e.player.tricks.length * overlay;
				trickProps['right'] = sideEdgeDistance;
				props['top'] = trickProps['top'];
				props['left'] = $('#board').width() - trickProps['right'] - oh.CARD_SIZE.width;
			}
			for (var i = 0; i < e.trick.length; i++) {
				e.trick[i].moveToFront();
			}
			for (var i = 0; i < e.trick.length - 1; i++) {
				$(e.trick[i].guiCard).animate(props, oh.ANIMATION_SPEED, function () {});
			}
			$(e.trick[e.trick.length - 1].guiCard).animate(props, oh.ANIMATION_SPEED, function () {
				$('.trick').hide();
				$('#board').append($('<div/>').addClass(cssClass).css(trickProps));
				e.callback();
			});
		}, oh.TAKE_TRICK_DELAY);
	},
};


function getRound() {
	
	// Waiting for another player
	if (!g.waiting) {
		if (g.roundLoading == 0) {
			g.roundLoading++;
			getJSON({op:"getRound", gameID:user.currentGameID}, function(data) {
				g.roundLoading = 0;
				g.status = data;
				updateStats();
				
				// Check game status
				
				// Need to deal
				// TODO... check for same round
				if (!g.game.cardsDealt && g.status.player[1].hand == null) {
					
					// Check for end of game
					if (g.game.round == g.game.rounds) {
						g.game.message('Game over -- thanks for playing!');
						g.waiting = true;
					}
					else {
						// Player is next dealer
						if (g.game.dealerIndex + 1 == g.status.seatID) {
							g.game.message('Waiting for you to deal!');
							$('#deal').fadeIn();
							g.waiting = true;
						}
						else {
							g.game.message('Waiting for ' + g.game.players[g.game.dealerIndex].name + ' to deal');
							$('#deal').hide();
							g.waiting = false;
						}
					}
				}
				
				// Just dealt
				else if (!g.game.cardsDealt) {
					g.waiting = false;
					g.game.cardCount = parseInt(g.status.round.hands, 10);
					g.game.newDeck();
					g.game.round++;
					g.game.deal();
				}
				
				// Playing
				else {
					g.waiting = false;
					
					// Update bids
					while (g.game.players[g.game.bidPlayerIndex].bidValue == -1 && g.status.player[g.game.bidPlayerIndex+1].bid != null) {
						g.game.bid(g.game.players[g.game.bidPlayerIndex], g.status.player[g.game.bidPlayerIndex+1].bid);
					}
					
					// Need to bid
					if (g.status.player[g.status.seatID].bid == null) {
						if (g.status.seatID == g.game.bidPlayerIndex + 1) {
							g.waiting = true;
							g.human.startBid();
						}
						
						// Check for other bid updates
						else {
							g.waiting = false;
							g.game.message('Waiting for ' + g.game.players[g.game.bidPlayerIndex].name + ' to bid');
						}
					}
					
					// Waiting for all players to bid -- check if current bidder has already bid
					else if (g.game.players[g.game.bidPlayerIndex].bidValue == -1) {
						g.waiting = false;
						g.game.message('Waiting for ' + g.game.players[g.game.bidPlayerIndex].name + ' to bid');
					}
					
					// Bidding finished
					// Currently in the middle of a round/hand
					else {
						g.waiting = (g.status.seatID == g.game.currentPlayerIndex + 1);
						var numCardsInHand = 0;
						var hand = g.status.player[g.game.currentPlayerIndex+1].currentHand;
						if (hand != null && hand != '') {
							var handArr = hand.split(",");
							numCardsInHand = handArr.length;
						}
						
						// Update next card played
						if (g.game.players[g.game.currentPlayerIndex].hand.length > numCardsInHand) {
							
							// Not end of hand
							if (g.status.hand) {
								var thisCard = g.status.hand[g.game.hand][g.game.currentPlayerIndex+1].card;
								
								// Find card position in player's hand
								var cp = g.game.players[g.game.currentPlayerIndex];
								for (var pos = 0; pos < cp.hand.length; pos++) {
									if (cp.hand[pos].shortName == thisCard) {
										g.game.message(g.game.players[cp.pos].name + ' played the ' + cp.hand[pos].longName);
										g.game.playCards(cp, [cp.hand[pos]]);
										
										// If I played already (game reloaded), and I just played this card, resume checks
										if (g.userPosition == cp.pos+1) {
											g.waiting = false;
										}
										pos = cp.hand.length;
									}
								}
							}
							else {
//								doLog('User hand is null. Probably the end of the round!');
								var cp = g.game.players[g.game.currentPlayerIndex];
								if (cp.hand.length == 1) {
//									doLog('1 card left in hand... let\'s play it');
									g.game.playCards(cp, [cp.hand[0]]);
								}
								else {
									g.game.message('An error occurred -- round is not over but hand is null');
								}
							}
						}
						
						// Need to play
						else if (g.status.seatID == g.game.currentPlayerIndex + 1) {
							g.game.message('Your turn! Select a card to play');
						}
						
						// Check if all players have played
						// Check if pile is full (go to next hand)
						else {
							g.game.message('Waiting for ' + g.game.players[g.game.currentPlayerIndex].name + ' to play');
						}
					}
				}
			});
		}
		else {
			g.roundLoading++;
			
			// Auto-reset timeout
			if (g.roundLoading == 5) {
				g.waiting = true;
				g.roundLoading = 0;
				setTimeout("g.waiting = false;", 5000);
			}
		}
	}
}
