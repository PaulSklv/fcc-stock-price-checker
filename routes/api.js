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

const collection = client => {
  return client.db("test").collection("priceChecker");
};

const newSetter = (req) => {
  let setter = [];
  let like = "like" in req.body ? true : false;
  if(typeof req.body.stock === 'object') {
    req.body.stock.map(el => {
      setter = [...setter, { stock: el, like }]
    })
  return setter;
  }
}
module.exports = function(app) {
  app.route("/api/stock-prices").post((req, res) => {
    if (typeof req.body.stock === "string") {
      rp(
        "https://repeated-alpaca.glitch.me/v1/stock/" +
          req.body.stock +
          "/quote"
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
    } else if (typeof req.body.stock === "object") {
      const { stock } = req.body;
      rp(
        "https://repeated-alpaca.glitch.me/v1/stock/" + stock[0] + "/quote"
      ).then(stock_1 => {
        rp(
          "https://repeated-alpaca.glitch.me/v1/stock/" + stock[1] + "/quote"
        ).then(stock_2 => {
          console.log(stock[0]);
          let adress = req.header("X-Forwarded-For").split(",")[0];
          const { symbol1, latestPrice1 } = JSON.parse(stock_1);
          const { symbol2, latestPrice2 } = JSON.parse(stock_2);
          const stocks = [stock_1, stock_2];
          connection.then(client => {
            console.log(newSetter(req).map((obj, i, arr) => {
                  return obj.like === true ? {
                    updateOne: {
                      filter: {$or: [{ $and: [{ stock: obj.stock.toUpperCase() }, {$or: [{ipAdresses: {$exists: false}}, {ipAdresses: { $not: { $elemMatch: {$eq: adress }}}}]}]}, {price: { $ne: stock_1.latestPrice}}]},
                      update: { $set: { price: JSON.parse(stocks[i]).latestPrice }, $inc: { likes: 1 }, $addToSet: { ipAdresses: adress }},
                      upsert: true
                    }
                  } : {
                    updateOne: {
                      filter: {stock: obj.stock.toUpperCase()},
                      update: { $set: { price: JSON.parse(stocks[i]).latestPrice }, $setOnInsert: { likes: 0 }},
                      upsert: true
                    }
                  }
                }))
            collection(client)
              .bulkWrite(
              
                newSetter(req).map((obj, i, arr) => {
                  return obj.like === true ? {
                    updateOne: {
                      // filter: {$or: [{ $and: [{ stock: obj.stock.toUpperCase() }, {$or: [{ipAdresses: {$exists: false}}, {ipAdresses: { $not: { $elemMatch: {$eq: adress }}}}]}]}, {price: { $ne: JSON.parse(stocks[i]).latestPrice}}]},
                      filter: {$and : [{$or: [{price: { $ne: JSON.parse(stocks[i]).latestPrice}}, {$or: [{ipAdresses: {$exists: false}}, {ipAdresses: { $not: { $elemMatch: {$eq: adress }}}}]}]}, {stock: obj.stock.toUpperCase()}]},
                      // filter: {stock: obj.stock.toUpperCase()},
                      update: { $set: { price: JSON.parse(stocks[i]).latestPrice }, $inc: { likes: 1 }, $addToSet: { ipAdresses: adress }, $setOnInsert: { stock: obj.stock.toUpperCase() }},
                      upsert: true
                    }
                  } : {
                    updateOne: {
                      filter: {stock: obj.stock.toUpperCase()},
                      update: { $set: {  price: JSON.parse(stocks[i]).latestPrice }, $setOnInsert: { stock: obj.stock.toUpperCase(), likes: 0 }},
                      upsert: true
                    }
                  }
                })
                
            )
              .then(result => {
                
              });
          });
        });
      });
    }
  });
};
// {
                //   updateOne: {
                //     filter: {stock: stock[0].toUpperCase()},
                //     // filter: {$or: [{ $and: [{ stock: stock[0] }, {$or: [{ipAdresses: {$exists: false}}, {ipAdresses: { $not: { $elemMatch: {$eq: adress }}}}]}]}, {price: { $ne: stock_1.latestPrice}}]},
                //     update: { $set: { price: JSON.parse(stock_1).latestPrice }, $inc: { likes: 1 }, $addToSet: { ipAdresses: adress }},
                //     upsert: true
                //   }
                // },
                // {
                //   updateOne: {
                //     filter: {stock: stock[1].toUpperCase()},
                //     // filter: {$or: [{ $and: [{ stock: stock[1] }, {$or: [{ipAdresses: {$exists: false}}, {ipAdresses: { $not: { $elemMatch: {$eq: adress }}}}]}]}, {price: { $ne: stock_2.latestPrice}}]},
                //     update: { $set: { price: JSON.parse(stock_2).latestPrice }, $inc: { likes: 1 }, $addToSet: { ipAdresses: adress }},
                //     upsert: true
                //   }
                // }
// updateMany({$and: [{$or:[ { stock: stock[0].toUpperCase() }, { stock: stock[1].toUpperCase()}]}, {$or: [{ipAdresses: false}, {ipAdresses: { $not: { $elemMatch: {$eq: adress }}}}]}]},
 