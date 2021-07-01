const mysql = require('mysql');
const express = require('express');
const bodyparser = require('body-parser');
const { query } = require('express');
const jwt = require('jsonwebtoken');

// Secret key for API
// In production this would be kept hidden and secure
const api_secret_key = 'secretkeystring';

var app = express();
app.use(bodyparser.json());

// Parameters for connecting to the 'phonebook' MySQL Database
var mysqlConnection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'phonebook',
    port: '3306',
    multipleStatements: true
});

// Attempt to connect to the 'phonebook' MySQL Database
mysqlConnection.connect((err) => {
    if (!err) {
        console.log('Connection successfully established...');
    } else {
        console.log('Connection failed to establish; ' + JSON.stringify(err, undefined, 2));
    }
});

// Begin listening for requests on port 8080
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`App listening on port: ${port}...`));

// Route to login to API
// In this application there is only one account
// Username: Admin, password: password
// When these details are inputted an API token is returned
app.post('/contacts/login', (req, res) => {
    let login_details = req.body;
    if (login_details.username == "Admin" && login_details.password == "password") {
        // The correct login details have been added
        // Create a JWT API Token using the account username, password and API secret key
        // Can set an expiry time of 2 hours by including {expiresIn: '2h'}
        jwt.sign({username: login_details.username, password: login_details.password}, api_secret_key, (err, token) => {
            if (!err) {
                res.json({
                    token
                });
            } else {
                console.log(err);
            }
        });
    } else {
        // The inputted username & password combination is incorrect
        res.send("Incorrect login...");
    }
});
