var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();
var gcm = require('node-gcm-service');
var mysql = require('mysql');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('env', 'development');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use('/', routes);
app.use('/users', users);

var connection = mysql.createConnection({
        host  :  'localhost',
        user  :  'chatapp',
        password : '',
        database  : 'db'
});

var regId;

app.post('/login', function(req, res) {
    res.json({statusCode: '200'});
});

app.post('/registration', function(req, res) {
    regId = req.body.regId;

    var info = req.body;
    var username = info.username;
    var token = info.regId;

    //If username does not already exist in the table, add it
    console.log("Username: " + username + " GCM token: " + token);
    var recordExists = -1;
    connection.query('SELECT COUNT(*) AS recordExists FROM users WHERE username=\"' + username + '\";', function(err, results, fields)
    {
        if(err) console.log(err);
        recordExists = results[0].recordExists;

        if( recordExists > 0 )
        {
            console.log('Existing user - updating in database');
//User is existing user
            //Update the row with the received gcm Id
            connection.query('UPDATE users SET gcmId=\"' + token + '\" WHERE username=\"' + username + '\";');
            connection.query('SELECT id AS userId FROM users WHERE username=\"' + username + '\";', function(err, results, fields)
            {
                if(err) console.log(err);
                res.json({statusCode: '200', gcmId: token, userId: results[0].userId});
            });
        }
        else
        {
            console.log('New user - inserting into database');
            //New user - insert into database with gcm token
            connection.query('INSERT INTO users (username, gcmId) VALUES (\"' + username + '\", \"' + token + '\");', function(err, results, fields)
            {
                if(err) console.log(err);
                console.log("userId of new user: " + results.insertId);
                res.json({statusCode: '200', gcmId: token, userId: results.insertId});
            });
        }
    });
});

app.post('/addUserId', function(req, res) {
    var username = req.body.username;
    //Search db for existing users
    connection.query('SELECT COUNT(*) AS recordExists FROM users WHERE username=\"' + username + '\";', function(err, results, fields)
    {
        if(err) console.log(err);
        var recordExists = results[0].recordExists;

        if(recordExists > 0)
        {
            connection.query('SELECT * FROM users WHERE username=\"' + username + '\";', function(err, results, fields)
            {
                var id = results[0].id;
                var gcmId = results[0].gcmId;
                if(err) console.log(err);
                //User exists - Send a response with userId
                res.json({exists: true, id: id, username: username, gcmId: gcmId });
            });
        }
        else
        {
           res.json({exists: false});
        }
   });
});


app.post('/messages', function(req, res)
{
    var registrationTokens = [];
    var message = req.body;
    var userToSendTo_Id = message.toId;
    //Insert message in database and get message ID
    connection.query('INSERT INTO messages (username, message, time, toId, isread) VALUES (\"'+message.username+'\",\"'+message.message+'\",\"'+message.timestamp+'\",\"'+message.toId+'\",\"'+message.read+'\");', function(err, results, fields)
    {
        if (err) console.log(err);
		 message.id = results.insertId;
        res.json({success: 200, id: results.insertId});

        console.log(message.id);

        var gcmMessage = new gcm.Message();
        gcmMessage.setDataWithObject({id: message.id, username: message.username, message: message.message, timestamp: message.timestamp, toId: message.toId});

        gcmMessage.setCollapseKey('chatMessage');

        gcmMessage.setDryRun(false);

        gcmMessage.setDelayWhileIdle(true);

        var sender = new gcm.Sender();
        sender.setAPIKey('AIzaSyAE199rj6cQdyjFBmpd_bsTktF_fr4moM4');
        console.log(gcmMessage);

        console.log("Receiver's ID: " + message.toId);

        connection.query('SELECT * FROM users WHERE id=\"' + userToSendTo_Id + '\";', function(err, results, fields)
        {
            if(err) console.log(err);
            console.log(results[0].gcmId);
            registrationTokens.push(results[0].gcmId);
            sender.sendMessage(gcmMessage.toJSON(), registration_ids = [ registrationTokens ],  true, function(err, data)
            {
                if(err) console.log(err);
                else console.log("Sent push notification to devices with username " + results[0].username);
                console.log(data);
            });
        });
    });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
