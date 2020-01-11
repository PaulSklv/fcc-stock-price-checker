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
        
        connection.then(client => {
          client.db("test").collection("priceChecker").findOne({ stock: req.body.stock.toUpperCase() }).then(result => {
            let adress = req.header("X-Forwarded-For");
            const { symbol, latestPrice } = JSON.parse(response);
            let setter = { };
            const isIpAlreadyExists = (result, adress) => {
              if(result === null) return false;
              else if("ipAdresses" in result === false || result.ipAdresses.indexOf(adress) === -1) return false;
              else return true;
            }
            console.log(isIpAlreadyExists(result, adress))
            if ("like" in req.body === false || req.body.like !== "true" || isIpAlreadyExists(result, adress)) {
              setter = {
                $set: { price: latestPrice },
                $setOnInsert: { stock: symbol, likes: 0, ipAdresses: [] }
              };
            } else if (req.body.like === "true" && !isIpAlreadyExists(result, adress)) {
              setter = {
                $set: { price: latestPrice },
                $inc: { likes: 1 },
                $setOnInsert: { stock: symbol },
                $addToSet: { ipAdresses: adress }
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
                  console.log(result.value)
                });
            });
          })
        })
        
      })
      .catch(error => {
      console.log(error)
        return res.send("Something went wrong!");
      });
  });
};
