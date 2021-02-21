require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const https = require('https');
const app = express();

const origin = process.env.origin || 'http://localhost:3001'
console.log(`origin: ${origin}`);
app.use(cors({
    origin: origin
}));


const port = process.env.port || 3000;
const baseOMDBLink = "https://www.omdbapi.com/?apikey=" + process.env.OMDB_KEY;

console.log(baseOMDBLink);
app.use(bodyParser.urlencoded({ extended: true }));

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
            if(!logArray){
                console.log(`${logTitle} was not found`);
                res.send([]);
                return;
            }
            let updatedLogArray = [];
            console.log(logJSON);
            
            logArray.map(element =>{
                updatedLogArray.push({ logTitle: element.Title, logPlot: "test", logReleaseDate: element.Year, logPoster: element.Poster });
            })
            res.send(updatedLogArray);

        }).on('error', (error) => {
            console.error(error.message);
        });
    })

    request.end();
});
app.listen(port, () => {
    if(origin.includes("localhost"))
        console.log(`Lumberjacks are awaiting your orders at http://localhost:${port}`)
    else
        console.log(`Lumberjacks are awaiting your order on port ${port} (prod)`);
})
