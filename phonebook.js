const mysql = require('mysql');
const express = require('express');
const bodyparser = require('body-parser');
const { query } = require('express');
const jwt = require('jsonwebtoken');
const e = require('express');

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
var server = app.listen(port, () => console.log(`App listening on port: ${port}...`));

// Module exports
module.exports = {
    mysqlConnection,
    server
}

// Route to login to API
// In this application there is only one account
// Username: Admin, password: password
// When these details are inputted an API token is returned
app.post('/contacts/login', (req, res) => {
    let login_details = req.body;
    if (login_details.username == "Admin" && login_details.password == "password") {
        // The correct login details have been added
        // Create a JWT API Token using the account username, password and API secret key
        // Can set an expiry time of 2 hours by including {expiresIn: '2h'} as a parameter
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

// Function to verify the API token
// Used as middleware to authorise requests made to the API
function verifyAPIToken(req, res, next) {
    const api_token = req.headers['token'];

    if (typeof api_token == 'undefined') {
        // No API token has been passed in the request header
        res.send("No authorisation token passed...");
    } else {
        // Check if the API token passed with the request is valid
        jwt.verify(api_token, api_secret_key, (err) => {
            if (err) {
                // API token is invalid
                res.send("Unable to authorise...");
            } else {
                // API token is valid
                // Continue with request
                next();
            }
        });
    }
}

// Route to display the phonebook contacts
// Contacts will only be displayed if API token is valid
app.get('/contacts', verifyAPIToken, (req, res) => {
    let query_details = req.body;

    if (!query_details.sort_attribute) {
        // If no attribute has been passed to sort by then set to default: contact_id
        query_details.sort_attribute = 'contact_id';
    } else {
        // Escape user entered sorting attribute
        query_details.sort_attribute = mysql.escapeId(query_details.sort_attribute);
    }

    // If the inputted sorting method is neither DESC or ASC then set to default ASC
    if (query_details.sort_method != 'DESC' && query_details.sort_method != 'ASC') {
        query_details.sort_method = 'ASC';
    }

    // Initialise the pagination section of SQL query to empty string
    // If no page number is passed with the request this remains empty
    var page_sql = '';
    if (query_details.page) {
        if (!query_details.display_limit) {
            // No display limit (contacts per page) has been passed
            // Set to default of 2 contacts
            query_details.display_limit = 2;
        }

        // Calculate offset for use in SQL query
        var offset = (query_details.page - 1) * (query_details.display_limit);
        
        // Build pagination SQL query
        page_sql = ' LIMIT ' + mysql.escape(query_details.display_limit) + ' OFFSET ' + mysql.escape(offset);
    }

    // Build query string to order the contacts table
    var contacts_query = 'SELECT * FROM contacts ORDER BY ' + query_details.sort_attribute + ' ' + query_details.sort_method + page_sql;

    // Execute SELECT query
    mysqlConnection.query(contacts_query, (err, rows, fields) => {
        if (!err) {
            // Query was successful, return the rows
            res.send(rows);
        } else {
            // Query failed, log error message
            console.log(err);
        }
    });
});

// Route to view one contact in the phonebook
app.get('/contacts/:id', verifyAPIToken, (req, res) => {
    var contact_id = req.params.id;

    // Check the entered ID is an integer numeric value
    if (is_val_num(contact_id)) {
        // ID is a numeric value
        // Initialise SELECT query string with blank ID value
        var contact_query = "SELECT * FROM contacts WHERE contact_id = ?";
        // Execute SELECT query
        mysqlConnection.query(contact_query, [contact_id], (err, rows, fields) => {
            if (!err) {
                // Contact successfully retrieved from database
                res.send(rows);
            } else {
                // Query failed, log error message
                console.log(err);
            }
        });
    } else {
        res.send("ID must be in integer format...");
    }
});

// Route to create a contact in the phonebook
// The request will only be accepted if the API token is valid
// Missing values are treated as NULL
app.post('/contacts/create', verifyAPIToken, (req, res) => {
    let contact = req.body;

    // Create the INSERT query for the new contact with blank values
    var insert_query = 'INSERT INTO contacts(first_name, last_name, work_phone, home_phone, mobile_phone, other_phone, email, mailing_address)' +
    ' VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

    // Execute INSERT query
    mysqlConnection.query(insert_query,
        [contact.first_name, contact.last_name, contact.work_phone, contact.home_phone, contact.mobile_phone,
        contact.other_phone, contact.email, contact.mailing_address],
        (err, rows, fields) => {
            if (!err) {
                // Contact successfully added to database
                res.send("Contact added to the phonebook...");
            } else {
                // Query failed, log error message
                console.log(err);
            }
        });
});

// Route to update a contact in the phonebook by contact_id
// The request will only be accepted if the API token is valid
app.post('/contacts/update/:id', verifyAPIToken, (req, res) => {
    let contact = req.body;

    // Get contact_id of the contact to be updated
    var contact_id = req.params.id;

    // Check the entered ID is an integer numeric value
    if (is_val_num(contact_id)) {
        // ID is numeric value
        // Set query string for the UPDATE query with blank values
        var update_query = 'UPDATE contacts SET first_name = ?, last_name = ?, work_phone = ?, ' +
        'home_phone = ?, mobile_phone = ?, other_phone = ?, email = ?, mailing_address = ? WHERE contact_id = ?';

        // Execute UPDATE query using request values
        mysqlConnection.query(update_query, [contact.first_name, contact.last_name, contact.work_phone, contact.home_phone, contact.mobile_phone,
            contact.other_phone, contact.email, contact.mailing_address, contact_id],
            (err, rows, fields) => {
                if (!err) {
                    // Contact successfully updated
                    res.send("Contact updated...");
                } else {
                    // Query failed, log error message
                    console.log(err);
                }
            });
    } else {
        res.send("ID must be in integer format...");
    }
});

// Route to delete a contact by contact_id
app.delete('/contacts/delete/:id', verifyAPIToken, (req, res) => {
    // Get contact_id of the contact to be deleted
    var contact_id = req.params.id;

    // Check the entered ID is an integer numeric value
    if (is_val_num(contact_id)) {
        // ID is numeric value
        // Initialise DELETE query string with blank id value
        var delete_query = 'DELETE FROM contacts WHERE contact_id = ?';
        mysqlConnection.query(delete_query, [contact_id], (err, rows, fields) => {
            if (!err) {
                // Contact successfully deleted
                res.send("Contact deleted...");
            } else {
                // Query failed, log error message
                console.log(err);
            }
        });
    } else {
        res.send("ID must be in integer format...");
    }
});

// Returns true if val is numeric, false if val is not numeric
function is_val_num(val) {
    return /^\d+$/.test(val);
}
