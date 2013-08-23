var Auth = function( passport, LocalStrategy){
	var passport = passport;

	passport.serializeUser(function(user, done) {
		done(null, user.id);
	});

	passport.deserializeUser(function(id, done) {
		User.findById(id, function (err, user) {
			done(err, user);
		});
	});

	passport.use(new LocalStrategy(function(username, password, done) {
		User.findOne({ username: username }, function(err, user) {
			console.log(user);
			if (err) { return done(err); }
			if (!user) { return done(null, false, { message: 'Unknown user ' + username, err: 'unknown user' }); }
			user.comparePassword(password, function(err, isMatch) {
				if (err) return done(err);
				if(isMatch) {
					return done(null, user);
				} else {
					return done(null, false, { message: 'Invalid password' });
				}
			});
		});
	}));

	var ensureAuthenticated = function(req, res, next) {
		if (req.isAuthenticated()) { return next(); }
		res.render('error/403');
	}

	var authenticate = function(req, res, next){
		passport.authenticate('local', function(err, user, info) {
			if (err) { return next(err) }
			if (!user) {
				console.log('Auth: ' + info.message);
				if(req.session === undefined) { 
					console.log('session is undefined');
					return res.render('login', {message: info.message});
				}
				req.session.messages =  [info.message];
				return res.redirect('/');
			}
			req.logIn(user, function(err) {
				if (err) { return next(err); }
					return res.redirect('/');
			});
		})(req, res, next);
	}


	return {
		ensureAuthenticated: ensureAuthenticated,
		authenticate: authenticate,
	}

}

exports.Auth = Auth;