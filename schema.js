var Schema = function( mongoose, bcrypt ){
	var mongoose = mongoose
		, bcrypt = bcrypt
		, SALT_WORK_FACTOR = 10;

	// Connect to Mongo
	var uristring = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost/euchre';
	mongoose.connect(uristring, function (err, res) {
		if (err) { 
			console.log ('ERROR connecting to: ' + uristring + '. ' + err);
		} else {
			console.log ('Succeeded connected to: ' + uristring);
		}
	});
	var db = mongoose.connection;
	db.on('error', console.error.bind(console, 'connection error:'));
	db.once('open', function () {
		console.log("connected to db");
	});

	// Set up User Schema
	var userSchema = mongoose.Schema({
		username: { type: String, required: true, unique: true },
		email: { type: String, required: true, unique: true },
		password: { type: String, required: true},
		type: {type:String, default:'normal'},
	});
	userSchema.pre('save', function(next) {
		var user = this;

		if(!user.isModified('password')) return next();

		bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
			if(err) return next(err);

			bcrypt.hash(user.password, salt, function(err, hash) {
				if(err) return next(err);
				user.password = hash;
				next();
			});
		});
	});

	userSchema.methods.comparePassword = function(candidatePassword, cb) {
		bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
			if(err) return cb(err);
			cb(null, isMatch);
		});
	};

	User = mongoose.model('User', userSchema);

	// Helper functions

	var saveUser = function( req, res, userObj ){
		var newUser = new User(userObj);
		newUser.save(function(err, newUser){
			if(err) console.log(err);
			console.log("new user: " + newUser.username);
			res.render('index');
			//somehow sign this guy in
		});
	};

	return {
		saveUser: saveUser,
	}
}

exports.Schema = Schema;