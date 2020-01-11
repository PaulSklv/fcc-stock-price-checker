/*
 *
 *
 *       Complete the API routing below
 *
 *
 */

"use strict";

var expect = require("chai").expect;
var MongoClient = require("mongodb").MongoClient;
const rp = require("request-promise");

const connection = MongoClient.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

module.exports = function(app) {
  app.route('/api/stock-prices').post((req, res) => {
    console.log(req.body)
    rp("https://repeated-alpaca.glitch.me/v1/stock/" + req.body.stock + "/quote")
      .then(response => {
      let json = JSON.parse(response);
      res.send(json);
    });
  });
};
