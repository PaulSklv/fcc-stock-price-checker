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

const collection = client => {
  return client.db("test").collection("priceChecker");
};

const newSetter = sendedData => {
  console.log(sendedData)
  let setter = [];
  let like = "like" in sendedData ? true : false;
  if (typeof sendedData.stock === "object") {
    sendedData.stock.map(el => {
      setter = [...setter, { stock: el, like }];
    });
  } else setter = [{ stock: sendedData.stock, like }];
  return setter;
};

const addData = (req, res, stocks, sendedData) => {
  connection.then(client => {
    let adress = req.header("X-Forwarded-For").split(",")[0];
    collection(client).createIndex({ stock: 1 }, { unique: true });
    collection(client)
      .bulkWrite(
        newSetter(sendedData).map((obj, i, arr) => {
          return obj.like === true
            ? {
                updateOne: {
                  filter: {
                    $and: [
                      {
                        $or: [
                          { price: { $ne: JSON.parse(stocks[i]).latestPrice } },
                          {
                            $or: [
                              { ipAdresses: { $exists: false } },
                              {
                                ipAdresses: {
                                  $not: { $elemMatch: { $eq: adress } }
                                }
                              }
                            ]
                          }
                        ]
                      },
                      { stock: obj.stock.toUpperCase() }
                    ]
                  },
                  update: {
                    $set: { price: JSON.parse(stocks[i]).latestPrice },
                    $inc: { likes: 1 },
                    $addToSet: { ipAdresses: adress },
                    $setOnInsert: { stock: obj.stock.toUpperCase() }
                  },
                  upsert: true
                }
              }
            : {
                updateOne: {
                  filter: { stock: obj.stock.toUpperCase() },
                  update: {
                    $set: { price: JSON.parse(stocks[i]).latestPrice },
                    $setOnInsert: { stock: obj.stock.toUpperCase(), likes: 0 }
                  },
                  upsert: true
                }
              };
        })
      )
      .catch(error => {
        return console.log("something went wrong!", error);
      });
  });
};

const request = (sendedData, req, res) => {
  if (typeof sendedData.stock === "string") {
    rp(
      "https://repeated-alpaca.glitch.me/v1/stock/" + sendedData.stock + "/quote"
    )
      .then(response => {
        const stocks = [response];
        addData(req, res, stocks, sendedData);
        connection.then(client => {
          collection(client)
            .find({ stock: sendedData.stock.toUpperCase() })
            .toArray()
            .then(result => {
              const { _id, ipAdresses, ...rest } = result[0];
              res.send({ sotckData: rest });
            });
        });
      })
      .catch(error => {
        return res.send("Something went wrong!");
      });
  } else if (typeof sendedData.stock === "object") {
    const { stock } = sendedData;
    rp(
      "https://repeated-alpaca.glitch.me/v1/stock/" + stock[0] + "/quote"
    ).then(stock_1 => {
      rp(
        "https://repeated-alpaca.glitch.me/v1/stock/" + stock[1] + "/quote"
      ).then(stock_2 => {
        const stocks = [stock_1, stock_2];
        addData(req, res, stocks, sendedData);
        connection.then(client => {
          collection(client)
            .find({
              $or: [
                { stock: stock[0].toUpperCase() },
                { stock: stock[1].toUpperCase() }
              ]
            })
            .toArray()
            .then(result => {
              const rel_likes = result[0].likes - result[1].likes;
              res.send({
                stockData: result.map((obj, i, array) => {
                  const { stock, price } = obj;
                  return {
                    stock,
                    price,
                    rel_likes: rel_likes
                  };
                })
              });
            });
        });
      });
    });
  }
};

module.exports = function(app) {
  app.route("/api/stock-prices").post((req, res) => {
    request(req.body, req, res);
  }).get((req, res) => {
    request(req.query, req, res);
  });
};
