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

const connection = MongoClient.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

module.exports = function(app) {
  app.route("/api/stock-prices").get((res, req) => {
    fetch("https://repeated-alpaca.glitch.me/v1/stock/msft/quote")
      .then(response => response.json())
      .then(json => res.send(json));
  });
};
