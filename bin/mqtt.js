const mysql = require('mysql');
const conf = require('../configdb.json');
const nodemailer = require('nodemailer');

function start(){

  var db = mysql.createConnection({
      host: conf.paymentdb.host,
      user: conf.paymentdb.user,
      password: conf.paymentdb.password,
      database: conf.paymentdb.db
  });

  // CHECK IF DATABASE CONNECTION CAN BE ESTABLISHED
  db.connect(function(err){
    if(err){
      console.log("--- DATABASE CONNECTION COULD NOT BE ESTABLISHED");
    }
    else{
      console.log("--- DATABASE CONNECTION ESTABLISHED");
    }
  });

  // CONNECT TO MQTT BROKER
  const mqtt = require('mqtt');
  console.log('');
  console.log("--- CONNECTING TO MQTT BROKER AT " + conf.mqttbroker);
  const mqttClient = mqtt.connect(conf.mqttbroker);

  // SUBSCRIBE TO MQTT BROKER
  mqttClient.on('connect', () => {
    console.log('--- CONNECTED TO MQTT BROKER');
    console.log('');
    mqttClient.subscribe('order/accept');
    mqttClient.subscribe('payment/done');
  });

  // BEHAVIOUR ON MESSAGE WITH TOPIC ORDER/ACCEPT
  mqttClient.on('message', (topic, message) => {
    console.log('');
    console.log("--- MQTT MESSAGE RECEIVED, TOPIC IS: " + topic);
    console.log("--- MQTT MESSAGE : " + message.toString());
    if(topic == "order/accept"){

      var jsondata = JSON.parse(message.toString());
      // PARSE EMAIL HERE WHEN IMPLEMENTED IN ORDERSERVICE
      /*
      var email = jsondata.email;
      */
      var email = 'kontakt@michaelmaisel.de';
      var token = jsondata.token;
      var id = jsondata.orderId;
      // PARSE COMPONENTS HERE WHEN IMPLIMENTED IN ORDERSERVICE
      /*
      var component = jsondata.___.___
      */
      var orderdata = {"id":null, "json":message.toString(), "status":0, "token":token, "orderid":id};
      /* WRITING IN DATABASE:
          ID: AUTO INCREMENT
          JSON: COMPLETE JSON FILE THAT WAS PUBLISHED
          STATUS: 0 (NOT PAID)
          TOKEN FROM JSON
          ORDER ID */
      db.query('INSERT INTO orders SET?', orderdata, function(err, result){
        if (err){
          throw err;
          console.log("--- SOMETHING WENT TERRIBLE WRONG")
        }
        else {
          console.log("--- DATA PUSHED TO DATABASE");
        }
      });

      // CREATE TRANSPORTER TO SEND MAIL
      var transporter = nodemailer.createTransport({
          host: conf.account.email.host,
          port: conf.account.email.port,
          secure: conf.account.email.secure,
          auth: {
            user: conf.account.email.auth.user,
            pass: conf.account.email.auth.pass
          }
      });

        // SEND EMAIL TO CLIENT
      var mailoptions = {
        from: 'dev@michaelmaisel.de',
        // EMAIL ADRESS FROM JSON NEEDS TO BE INSERTED HERE
        /*
        to: email,
        */
        to: 'kontakt@michaelmaisel.de',
        subject: 'Your I4.0 Order',
        html:
          '<p>Hallo Nutzer, deine Order mit der Order ID ' + id + ' wurde akzeptiert.</p>' +
          '<p>Um zu bezahlen klicke <a href=localhost:3000/start>hier</a></p>'
      };

      transporter.sendMail(mailoptions, function(err, info){
        if (err){
          console.log(err);
          console.log('--- ERROR WHILE SENDING MAIL');
        }
        else {
          console.log('--- EMAIL SENT TO ' + email);
        }
      });
    };
  });
}
exports.start = start;

// THE DOCUMENTS SYNTAX HAS BEEN OVERHAULED ON 18.10.17
