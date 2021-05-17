require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const crypto = require('crypto');
const https = require('https');
const passportLocalMongoose = require('passport-local-mongoose'); //note passport-local is already used as a dependecy for this
const LocalStrategy = require('passport-local').Strategy;
const passwordUtils = require('./utility/passwordUtil');
const genPassword = passwordUtils.genPassword;
const MongoStore = require('connect-mongo');

const app = express();
const origin = process.env.ORIGIN || 'http://localhost:3001'
const port = process.env.PORT || 3000;
const baseOMDBLink = "https://www.omdbapi.com/?apikey=" + process.env.OMDB_KEY;

//app setup with cors to get requets from front end and various req.body inits
app.use(cors({ origin: origin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log(`cors origin (Front-end): ${origin}`);
console.log(`OMDB URL: ${baseOMDBLink}`);

//configures session data
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    },
    store: MongoStore.create({ mongoUrl: process.env.SESSION_STORE })
}))
/**
 * Connect to MongoDB Server using the connection string in the `.env` file.  To implement this, place the following
 * string into the `.env` file
 * 
 * DB_STRING=mongodb://<user>:<password>@localhost:27017/database_name
 */

const conn = process.env.DB_STRING;

const connection = mongoose.createConnection(conn, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});


connection.on('connecting', () => {
    console.log('connected');
});

// Creates simple schema for a User.  The hash and salt are derived from the user's given password when they register
const UserSchema = new mongoose.Schema({
    username: String,
    hash: String,
    salt: String
});


const User = connection.model('User', UserSchema);

const backLog = new mongoose.Schema({
    userId: String,
    logId: String,
    logTitle: String,
    logPoster: String
});
const BackLog = connection.model('BackLog', backLog);


/**
 * This function is called when the `passport.authenticate()` method is called.
 * 
 * If a user is found an validated, a callback is called (`cb(null, user)`) with the user
 * object.  The user object is then serialized with `passport.serializeUser()` and added to the 
 * `req.session.passport` object. 
 */
passport.use(new LocalStrategy(
    { // or whatever you want to use
        usernameField: 'emailAddress',    // define the parameter in req.body that passport can use as username and password
        passwordField: 'userPassword'
    },
    function (username, password, cb) {
        User.findOne({ username: username })
            .then((user) => {

                if (!user) { return cb(null, false) }

                // Function defined at bottom of app.js
                const isValid = passwordUtils.validPassword(password, user.hash, user.salt);

                if (isValid) {
                    return cb(null, user);
                } else {
                    return cb(null, false);
                }
            })
            .catch((err) => {
                cb(err);
            });
    }));

/**
 * This function is used in conjunction with the `passport.authenticate()` method.  See comments in
 * `passport.use()` above ^^ for explanation
 */
passport.serializeUser(function (user, cb) {
    cb(null, user.id);
});

/**
 * This function is used in conjunction with the `app.use(passport.session())` middleware defined below.
 * Scroll down and read the comments in the PASSPORT AUTHENTICATION section to learn how this works.
 * 
 * In summary, this method is "set" on the passport object and is passed the user ID stored in the `req.session.passport`
 * object later on.
 */
passport.deserializeUser(function (id, cb) {
    User.findById(id, function (err, user) {
        if (err) { return cb(err); }
        cb(null, user);
    });
});


/**
 * -------------- SESSION SETUP ----------------
 */

/**
 * The MongoStore is used to store session data.  We will learn more about this in the post.
 * 
 * Note that the `connection` used for the MongoStore is the same connection that we are using above
 */
const sessionStore = new MongoStore({ mongooseConnection: connection, collection: 'sessions', mongoUrl: process.env.SESSION_STORE })

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    console.log(req.session);
    console.log(req.user);
    next();
})


//home page
app.get('/', (req, res) => {
    console.log("Here is the api key" + process.env.OMDB_KEY);
    res.sendFile(__dirname + '/index.html')
    console.log("Here is the api key" + process.env.OMDB_KEY);
});

//When user tries to search for media, it is fowarded to this endpoint. 
app.get('/findLog', (req, res) => {
    const logTitle = req.query.searchedLog;
    let body = "";
    console.log(`${logTitle} is the searched string`)
    const request = https.request(baseOMDBLink + "&s=" + logTitle, (response) => {
        console.log(res.statusCode);
        console.log(res.header);

        response.on("data", (data) => {
            body += data;
        })
        response.on('end', () => {
            const logJSON = JSON.parse(body);
            const logArray = logJSON.Search;
            if (!logArray) {
                console.log(`${logTitle} was not found`);
                res.send([]);
                return;
            }
            let updatedLogArray = [];
            console.log(logJSON);

            logArray.map(element => {
                updatedLogArray.push({
                    logTitle: element.Title,
                    logPlot: "test",
                    logReleaseDate: element.Year,
                    logPoster: element.Poster,
                    logID: element.imdbID,
                    logType: element.Type
                });
            })
            res.send(updatedLogArray);

        }).on('error', (error) => {
            console.error(error.message);
        });
    })

    request.end();
});

app.post("/addLog", (req, res) => {

    if(!req.user)
        return;
    const userInfo = req.user;
    console.log(`test ${userInfo.username}`);
    const newLog = {
        userID: userInfo.id,
        logId: req.body.logId,
        logTitle: req.body.logTitle,
        logPoster: req.body.logPoster
    }

    const newBackLog = new BackLog(newLog);
    newBackLog.save()
    .then((log) => {
        console.log(`${log} successfuly added to backLog`);
        //res.send({ "registerStatus": true })
    })
    .catch((err) => {
        console.log(`error occured ${err}`);
        //res.send({ "registerStatus": false })
    })
    //res.send(newLog);
})

app.post("/register", (req, res) => {
    const emailAddress = req.body.emailAddress
    const userPassword = req.body.userPassword;
    const dateAdded = Date.now();
    console.log(`Creating account for ${emailAddress}`);

    const saltHash = genPassword(userPassword);

    const salt = saltHash.salt;
    const hash = saltHash.hash;

    const newUser = new User({
        username: emailAddress,
        hash: hash,
        salt: salt
    });

    //save new user into database with generated hash and salt
    newUser.save()
        .then((user) => {
            console.log(`${user} successfuly registerd`);
            res.send({ "registerStatus": true })
        })
        .catch((err) => {
            console.log(`error occured ${err}`);
            res.send({ "registerStatus": false })
        })
});
// Since we are using the passport.authenticate() method, we should be redirected no matter what 
app.post('/login',
    passport.authenticate('local', {
        successRedirect: '/loginSuccess',
        failureRedirect: '/loginFailure'
    }));

app.get("/loginSuccess", (req, res) => {
    res.send({ "loginStatus": true })
})
app.get("/loginFailure", (req, res) => {
    res.send({ "loginStatus": false })
});

app.listen(port, () => {
    if (origin.includes("localhost"))
        console.log(`Lumberjacks are awaiting your orders at http://localhost:${port}`)
    else
        console.log(`Lumberjacks are awaiting your order on port ${port} (prod)`);
})
