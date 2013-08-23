var Player = function (socket, username) {
	this.socket = socket;
	this.username = username;
	this.gameid = null;
	this.isdealer = false;
	this.seatpos = -1;
	this.hand = [];
	this.haspassed = false;
	this.haspassedsuit = false;
	this.loner = false;

	this.toObj = function () {
		return {
			username: this.username,
			isdealer: this.isdealer,
			seatpos: this.seatpos,
		}
	};
}

exports.Player = Player;