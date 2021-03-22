require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const https = require('https');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose'); //note passport-local is already used as a dependecy for this

const app = express();
const origin = process.env.ORIGIN || 'http://localhost:3001'
const port = process.env.PORT || 3000;
const baseOMDBLink = "https://www.omdbapi.com/?apikey=" + process.env.OMDB_KEY;

//app setup with cors to get requets from front end and various req.body inits
app.use(cors({ origin: origin }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

console.log(`cors origin (Front-end): ${origin}`);
console.log(`OMDB URL: ${baseOMDBLink}`);

app.use(session({
    secret: "thisisatempstringshouldbeinenv",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

//mongoDB connection with USER schema
mongoose.connect('mongodb://localhost:27017/userDB', { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set('useCreateIndex', true);
const userSchema = new mongoose.Schema({
    emailAddress: String,
    userPassword: String,
    dateAdded: Date
});
userSchema.plugin(passportLocalMongoose);
const User = mongoose.model('User', userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

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
                updatedLogArray.push({ logTitle: element.Title, logPlot: "test", logReleaseDate: element.Year, logPoster: element.Poster });
            })
            res.send(updatedLogArray);

        }).on('error', (error) => {
            console.error(error.message);
        });
    })

    request.end();
});

function checkAuthenticated() {
    console.log(`inside`);
    if (req.isAuthenticated()) {
        console.log(`user is authenticated`);
        res.send(` successfully registered into the db`);
    }
    else {
        console.log("user not found, redirecting to login");
        res.redirect("/Login")
    }
};
app.post("/register", (req, res) => {
    const emailAddress = req.body.emailAddress
    const userPassword = req.body.userPassword;
    const dateAdded = Date.now();
    console.log(`Creating account for ${emailAddress}`);
    User.register({ username: emailAddress, dateAdded: dateAdded }, userPassword, (err, user) => {
        if (err) {
            console.log(`Error registering ${emailAddress} into the db: ${err}`);
            res.send(`Error registering ${emailAddress} into the db: ${err}`);
        }
        else {
            passport.authenticate('local'),null,
                function (req, res) {
                    // If this function gets called, authentication was successful.
                    // `req.user` contains the authenticated user.
                    console.log(`inside`);
                    if (req.isAuthenticated()) {
                        console.log(`user is authenticated`);
                        res.send(` successfully registered into the db`);
                    }
                    else {
                        console.log("user not found, redirecting to login");
                        res.redirect("/Login")
                    }
                }
        }
    });
});
app.post("/login", (req, res) => {
    const emailAddress = req.body.emailAddress;
    const userPassword = req.body.userPassword;
    console.log("test");
    const user = new User({
        username: emailAddress,
        password: userPassword
    });

    passport.authenticate("local", (req, res, () => {
        // If this function gets called, authentication was successful.
        // `req.user` contains the authenticated user.
        res.send(`${emailAddress} was found in the system`);
    }));
})

app.listen(port, () => {
    if (origin.includes("localhost"))
        console.log(`Lumberjacks are awaiting your orders at http://localhost:${port}`)
    else
        console.log(`Lumberjacks are awaiting your order on port ${port} (prod)`);
})
