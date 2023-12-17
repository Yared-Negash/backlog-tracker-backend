# Getting Started with backlog (backend)

## Available Scripts

In the project root, you can run: `node .\app.js`  
The backend portion of this app is designed to run on port specified in the `.env` file.

### `Secret Configuration`
Create a file called `.env` in the project root, and add the following values (values not stored in readme for obv reasons):

* DB_STRING
* OMDB_KEY
* ORIGIN
* SALT_ROUNDS
* SECRET
* SESSION_STORE
* PORT

### `Cert Configuration`
Create a folder called `sslcert`and create the following files:
* server.crt
* server.key

If you forget the values, use the followign command to generate new ones: `sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt`
