var express = require('express');
var router = express.Router();

// OWN MODULES AND CONFIGS
var url = require('url'); // used to parse the URL
var mysql = require('mysql'); // used to execute querys on db
var Paypal = require('paypal-express-checkout'); // used for executing the payment process
var mqtt = require('mqtt'); // used to process MQTT messages
var conf = require('../configdb.json'); // contains advanced user data

/* GET home page. */
// THIS IS THE HOMEPAGE THAT WILL LOAD ON DEFAULT - SAME AS /START
router.get('/', function(req, res, next) {
  res.render('start', { title: 'Payment Service' });
});

/* GET start page. */
// THIS IS THE HOMEPAGE THAT WILL LOAD ON /START
router.get('/start', function(req, res, next) {
  res.render('start', { title: 'Payment Service' });
});

/* GET payment. */
// THIS IS THE PAGE WHERE YOU CAN CHECK YOUR ORDER START THE PAYING PROCESS
router.get('/payment', function(req, res, next) {

  // PARSE URL INTO VARIABLES
  var orderid = url.parse(req.url, true).query.orderid;
  var name = url.parse(req.url, true).query.name;
  var mail = url.parse(req.url, true).query.mail;
  var firstname = url.parse(req.url, true).query.firstname;
  var lastname = url.parse(req.url, true).query.lastname;
  var street = url.parse(req.url, true).query.street;
  var city = url.parse(req.url, true).query.city;
  var citycode = url.parse(req.url, true).query.citycode;

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
  var query = db.query({sql: sqlquery})

  query
    .on('error', function(){
    /* BEHAVIOUR WHEN THE DATABASE
    CONNECTION CAN NOT BE ESTABLISHED */
      console.log('--- DATABASE CONNECTION COULD NOT BE ESTABLISHED');
    })

    .on('result', function(rows){
      if(rows.status == 0){
      /* ROWS.STATUS == 0 MEANS THAT
      THE ORDER HAS NOT BEEN PAID YET
      THE PAYMENT PROCESS CAN START */

      /* THIS NEEDS TO BE READ FROM JSON
      ONCE IT HAS BEEN ADDED
      IN THE ORDERMANAGERS' MQTT MESSAGE */
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
          console.log('--- DATA HAS BEEN PUSHED TO DATABASE');
        });
      }

        else{
          if(rows.status == 1){
          /* ROWS.STATUS == 1 MEANS THAT
          THE ORDER HAS BEEN PAID
          THE PAYMENT PROCESS CANNOT START */
            res.render('alreadypaid', { title: 'Payment Service' });
            console.log('--- THIS ID HAS BEEN PAID ALREADY');
            res.end();
          }
          else{
          // BEHAVIOUR WHEN NO DB ENTRY WAS FOUND
            console.log('DB ENTRY NOT FOUND');
          }
        }
    })

    .on('end', function(){
      /* BEHAVIOR WHEN THE DATABASE
      CONNECTION CAN BE TERMINATED */
      console.log('--- CLOSING DATABASE CONNECTION ---');
    })
});

/* GET payment start. */
// THIS PAGE WILL START THE ACTUALLY PROCESS
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
  var sqlorderid = orderid.id;

  // WRITE SQL QUERY FOR LATER USE
  var sqlquery = "SELECT price, currency, description FROM orders WHERE orderid = " + mysql.escape(sqlorderid);

  /* QUERY DATABASE TO GET THE
  NEEDED VALUES FOR THE PAYPAL
  EXPRESS CHECKOUT PROCESS */
  db.query(sqlquery, function (err, result){
    if(err){
      res.render('error', { error: err });
    };

    /* WRITE QUERY RESULT INTO
    VARIABLES FOR USE IN THE
    PAYPAL.PAY METHOD */
    var invoice = orderid.id;
    var price = result[0].price;
    var description = result[0].description;
    var currency = result[0].currency;

    // USE THE METHOD TO START THE PAYMENT PROCESS
    paypal.pay(invoice, price, description, currency, true, function(err, url){
      if(err){
        console.log(err);
        return;
      };
      /* REDIRECT TO THE RETURN OR CANCEL
      URL WHICH ARE DEFINED ABOVE*/
      res.redirect(url);
    });
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

  // CHECK PAYMENT PROCESS
  paypal.detail(token, payerid, function(err, data, invoiceNumber, price){
    if(err){
      console.log(err);
      return;
    }

    // BEHAVIOUR WHEN PAYMENT WAS SUCCESSFULL
    if (data.success){
      console.log(data);

      // WRITE SQL QUERY FOR LATER USE WITH MYSQL.ESCAPE
      sqlquery = 'UPDATE orders SET status = 1 WHERE orderid = ' + mysql.escape(invoiceNumber)

      /* EXECUTE QUERY ON DATABASE
      WHICH SETS THE STATUS TO 1 */
      db.query(sqlquery, function(err, result){
        console.log('--- STATUS FOR INVOICE ' + invoiceNumber + ' HAS BEEN SET TO "PAID"')
      });

      // MQTT PUBLISH WHEN THE ORDER HAS BEEN PAID SUCCESSFULLY
      const mqttClient = mqtt.connect(conf.mqttbroker);
      mqttClient.publish("payment/done", invoiceNumber);
      console.log('')
      console.log('--- DONE, PAYMENT FOR INVOICE ' + invoiceNumber + ' IS COMPLETED');

      // RENDER THE SUCCESSS PAGE
      res.render('paymentsuccess');
    }
    // BEHAVIOUR WHEN PAYMENT WAS NOT SUCCESSFULL
    else {
      console.log('--- SOME PROBLEM WITH' + invoiceNumber + ' ---', data);

      // RENDER THE FAILED PAGE
      res.render('paymentfail');
    }
  })
});

router.get('/test', function(req, res, next) {
  res.render('Testingpage', { title: 'Paymentservice' });
});

/* GET unknown URL */
router.get('*', function(req, res, next) {
  res.render('start', { title: 'Paymentservice' });
});

module.exports = router;

// THE DOCUMENTS SYNTAX HAS BEEN OVERHAULED ON 18.10.17
