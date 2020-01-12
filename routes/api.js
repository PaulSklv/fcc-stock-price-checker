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
const isIpAlreadyExists = (result, adress) => {
  if (result === null) return false;
  else if (
    "ipAdresses" in result === false ||
    result.ipAdresses.indexOf(adress) === -1
  )
    return false;
  else return true;
};

const setter = (req, isIpAlreadyExists, response, result) => {
  let adress = req.header("X-Forwarded-For").split(",")[0];
  const { symbol, latestPrice } = JSON.parse(response);
  let setter = {};

  if (
    "like" in req.body === false ||
    req.body.like !== "true" ||
    isIpAlreadyExists(result, adress)
  ) {
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
  return setter;
};

const collection = (client) => {
  return client.db("test").collection("priceChecker");
}
module.exports = function(app) {
  app.route("/api/stock-prices").post((req, res) => {
    if(typeof req.body.stock === "string") {
      rp(
        "https://repeated-alpaca.glitch.me/v1/stock/" + req.body.stock + "/quote"
      )
        .then(response => {
          connection.then(client => {
            collection(client)
              .findOne({ stock: req.body.stock.toUpperCase() })
              .then(result => {
                connection.then(client => {
                  collection(client)
                    .findOneAndUpdate(
                      { stock: req.body.stock.toUpperCase() },
                      setter(req, isIpAlreadyExists, response, result),
                      {
                        upsert: true,
                        returnOriginal: false
                      }
                    )
                    .then(result => {
                      const { _id, ...rest } = result.value;
                      res.send({ stockData: rest });
                      console.log(result.value);
                    });
                });
              });
          });
        })
        .catch(error => {
          console.log(error);
          return res.send("Something went wrong!");
        });
    } else if(typeof req.body.stock === "object") {
      const { stock } = req.body;
      rp("https://repeated-alpaca.glitch.me/v1/stock/" + stock[0] + "/quote").then(stock_1 => {
        rp("https://repeated-alpaca.glitch.me/v1/stock/" + stock[1] + "/quote").then(stock_2 => {
          console.log(JSON.parse(stock_1));
          console.log(JSON.parse(stock_2));
          connection.thne(client => {
            collection(client).findOne({})
          })
        })
      })
    }
  });
  
};
