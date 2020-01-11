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
  app.route("/api/stock-prices").post((req, res) => {
    rp(
      "https://repeated-alpaca.glitch.me/v1/stock/" + req.body.stock + "/quote"
    )
      .then(response => {
        console.log(response);
        let setter = {};
        const { symbol, latestPrice } = JSON.parse(response);
        if ("like" in req.body === false || req.body.like !== "true") {
          setter = {
            $set: { price: latestPrice },
            $setOnInsert: { stock: symbol, likes: 0 }
          };
        } else if (req.body.like === "true") {
          setter = {
            $set: { price: latestPrice },
            $inc: { likes: 1 },
            $setOnInsert: { stock: symbol }
          };
        }
        connection.then(client => {
          client
            .db("test")
            .collection("priceChecker")
            .findOneAndUpdate({ stock: req.body.stock.toUpperCase() }, setter, {
              upsert: true,
              returnOriginal: false
            })
            .then(result => {
              const { _id, ...rest } = result.value;
              res.send({ stockData: rest });
            });
        });
      })
      .catch(error => {
        return res.send("Something went wrong!");
      });
  });
};
