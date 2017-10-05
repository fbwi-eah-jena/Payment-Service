var express = require('express');
var router = express.Router();

// OWN MODULES
var url = require('url'); // used to parse the URL
var mysql = require('mysql'); // used to execute querys on db
var Paypal = require('paypal-express-checkout'); // used for executing the payment process
var mqtt = require('mqtt');
var conf = require('../configdb.json');

/* GET home page. */
// THIS IS THE HOMEPAGE THAT WILL LOAD ON DEFAULT - SAME AS /START
router.get('/', function(req, res, next) {
  res.render('start', { title: 'START PAGE' });
});

/* GET start page. */
// THIS IS THE HOMEPAGE THAT WILL LOAD ON /START
router.get('/start', function(req, res, next) {
  res.render('start', { title: 'START PAGE' });
});

/* GET payment. */
// THIS IS THE PAGE WHERE YOU CAN CHECK YOUR ORDER START THE PAYING PROCESS
router.get('/payment', function(req, res, next) {

  // PARSE URL
  var orderid = url.parse(req.url, true).query.orderid;
  var name = url.parse(req.url, true).query.name;
  var mail = url.parse(req.url, true).query.mail;
  var firstname = url.parse(req.url, true).query.firstname;
  var lastname = url.parse(req.url, true).query.lastname;
  var street = url.parse(req.url, true).query.street;
  var city = url.parse(req.url, true).query.city;
  var citycode = url.parse(req.url, true).query.citycode;

  // DEFINE FUNCTION FOR SQL QUERY
  // NEEDS TO BE IN ITS OWN MODULE IN THE FUTURE
  function sqlquery(callback){

    // CREATE DATABASE CONNECTION
    var db = mysql.createConnection({
        host: conf.paymentdb.host,
        user: conf.paymentdb.user,
        password: conf.paymentdb.password,
        database: conf.paymentdb.db
      });

    // WRITING PARSED ORDERID INTO VARIABLE
    var sqlorderid = orderid;
    // COMPLETE SQL QUERY WITH MYSQL.ESCAPE TO PREVENT SQL-INJECTIONS
    var sqlquery = "SELECT price, status, json FROM orders WHERE orderid = " + mysql.escape(sqlorderid);
    // EXCECUTE QUERY ON DATABASE
    var query = db.query({
      sql: sqlquery})

      // BEHAVIOUR WHEN EVERSTHING GOES FINE
      query
        .on('error', function(){
          console.log('');
          console.log('--- DATABASE CONNECTION COULD NOT BE ESTABLISHED ---');
          console.log('');
        })

        .on('result', function(rows){
          if(rows.status == 0){

            // THIS NEEDS TO BE READ FROM JSON
            // ONCE IT HAS BEEN ADDED
            // IN THE ORDERMANAGERS' MQTT MESSAGE
            var juice = {name: 'Banenensaft', price: '2 EUR'};
            var puree = {name: 'Erdbeepüree', price: '2 EUR'};
            var pieces= {name: 'Banenenstücke', price: '1 EUR'};

            res.render('payment', {
              id: orderid,
              firstname: firstname,
              pricetotal: rows.price,
              pricejuice: juice.price,
              pricepuree: puree.price,
              pricepieces: pieces.price,
              juice: juice.name,
              puree: puree.name,
              pieces: pieces.name
            });
            // WRITE ADDITIONAL INFORMATION INTO DB
            var sqlquerydata = "UPDATE orders SET " +
            "firstname = " + mysql.escape(firstname) + ", "+
            "lastname = " + mysql.escape(lastname) + ", "+
            "street = " + mysql.escape(street) + ", "+
            "city = " + mysql.escape(city) + ", "+
            "citycode = " + mysql.escape(citycode) +
            " WHERE orderid = " + mysql.escape(sqlorderid);

            db.query(sqlquerydata, function(err, result){
              if(err){
                console.log(err);
              }
              console.log('');
              console.log('--- DATA HAS BEEN PUSHED TO DATABASE ---');
              console.log('');
            });
            }

          else{
            if(rows.status == 1)
            {
              res.render('alreadypaid');
              console.log('');
              console.log('--- THIS ID HAS BEEN PAID ALREADY');
              console.log('');
              res.end();
            }
            else{
              // THIS IS SOMEHOW NOT WORKING - NEEDS TO BE CHECKED LATER
              console.log('DB ENTRY NOT FOUND');
              }
            }
          })

          .on('end', function(){
            console.log('');
            console.log('--- CLOSING DATABASE CONNECTION ---');
            console.log('');
          })
      }

  // USING THE DEFINED FUNCTION SQLQUERY
  sqlquery(function(){
  // HERE COULD BE ADDITIONAL CODE IF NEEDED
  });
});

/* GET payment start. */
// THIS PAGE WILL ACTUALLY START THE PROCESS
router.get('/paymentstart', function(req, res, next) {
  // CREATE DATABASE CONNECTION
  var db = mysql.createConnection({
      host: conf.paymentdb.host,
      user: conf.paymentdb.user,
      password: conf.paymentdb.password,
      database: conf.paymentdb.db
    });

  // CREATE PAYPAL OBJECT WITH NEEDED VALUES
  var paypal = Paypal.init(
    conf.account.paypal.user,
    conf.account.paypal.pass,
    conf.account.paypal.signature,
    conf.account.paypal.returnurl,
    conf.account.paypal.cancelurl,
    true);

  // PARSE URL
  var urldata = url.parse(req.url, true).query.orderid;
  var orderid = JSON.parse(urldata);

  // DEFINE FUNCTION (THIS MUST BE DONE SOMEWHERE ELSE IN THE FUTURE)
  function sqlquery(callback){

    var sqlorderid = orderid.id;
    var sqlquery = "SELECT price, currency, description FROM orders WHERE orderid = " + mysql.escape(sqlorderid);

    db.query(sqlquery, function (err, result){
      if(err){
        res.render('error', { error: err });
      };

      callback(result);
      var invoice = orderid.id;
      var price = result[0].price;
      var description = result[0].description;
      var currency = result[0].currency;

      paypal.pay(invoice, price, description, currency, true, function(err, url){
        if(err){
          console.log(err);

          return;
        };
        res.redirect(url);
        });

  });
  }
  sqlquery(function(){
 // CODE CAN BE ADDED HERE IF NEEDED
  });
});

/* GET payment successfull. */
router.get('/success' || '/paymentfail', function(req, res, next) {

  //CREATE PAYPAL OBJECT WITH NEEDED VALUES
  var paypal = Paypal.init(
    conf.account.paypal.user,
    conf.account.paypal.pass,
    conf.account.paypal.signature,
    conf.account.paypal.returnurl,
    conf.account.paypal.cancelurl,
    true);

  // CREATE DATABASE CONNECTION
  var db = mysql.createConnection({
      host: conf.paymentdb.host,
      user: conf.paymentdb.user,
      password: conf.paymentdb.password,
      database: conf.paymentdb.db
    });

  // PARSE URL
  var token = url.parse(req.url, true).query.token;
  var payerid = url.parse(req.url, true).query.PayerID;

  // CHECK PAYMENT
  paypal.detail(token, payerid, function(err, data, invoiceNumber, price){
    if(err){
      console.log(err);
      return;
    }
    // WHEN PAYMENT WAS SUCCESSFULL
    // SET STATUS TO ONE FOR THE RELATED ORDER ID
    // DO MQTT PUBLISH TO LET ANYONE KNOW THE PAYMENT WAS SUCCESSFULL
    // REDIRECT TO SUCCESS PAGE
    if (data.success){
      console.log(data);
      sqlquery = 'UPDATE orders SET status = 1 WHERE orderid = ' + mysql.escape(invoiceNumber)

      db.query(sqlquery, function(err, result){
        console.log('--- STATUS FOR INVOICE ' + invoiceNumber + ' HAS BEEN SET TO "PAID"')
      });

      const mqttClient = mqtt.connect(conf.mqttbroker);
      mqttClient.publish("payment/done", invoiceNumber);
      console.log('')
      console.log('--- DONE, PAYMENT FOR INVOICE ' + invoiceNumber + ' IS COMPLETED');

      res.render('paymentsuccess');
    }
    else {
      console.log('--- SOME PROBLEM WITH' + invoiceNumber + ' ---', data);
      res.render('paymentfail');
      }
  })
});

module.exports = router;
