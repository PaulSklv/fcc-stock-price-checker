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

const newSetter = req => {
  let setter = [];
  let like = "like" in req.body ? true : false;
  if (typeof req.body.stock === "object") {
    req.body.stock.map(el => {
      setter = [...setter, { stock: el, like }];
    });
  } else setter = [{ stock: req.body.stock, like }];
  return setter;
};

const addData = (req, res, stocks) => {
  connection.then(client => {
    let adress = req.header("X-Forwarded-For").split(",")[0];
    collection(client).createIndex({ stock: 1 }, { unique: true });
    collection(client)
      .bulkWrite(
        newSetter(req).map((obj, i, arr) => {
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
module.exports = function(app) {
  app.route("/api/stock-prices").post((req, res) => {
    if (typeof req.body.stock === "string") {
      rp(
        "https://repeated-alpaca.glitch.me/v1/stock/" +
          req.body.stock +
          "/quote"
      )
        .then(response => {
          const stocks = [response];
          addData(req, res, stocks);
          connection.then(client => {
            collection(client)
              .find({ stock: req.body.stock.toUpperCase() })
              .toArray()
              .then(result => {
                const { _id, idAdresses, ...rest } = result[0];
                res.send({sotckData: rest});
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
          const stocks = [stock_1, stock_2];
          addData(req, res, stocks);
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
                console.log(result);
              });
          });
        });
      });
    }
  });
};
// connection.then(client => {
//             collection(client)
//               .findOne({ stock: req.body.stock.toUpperCase() })
//               .then(result => {
//                 connection.then(client => {
//                   collection(client)
//                     .findOneAndUpdate(
//                       { stock: req.body.stock.toUpperCase() },
//                       setter(req, isIpAlreadyExists, response, result),
//                       {
//                         upsert: true,
//                         returnOriginal: false
//                       }
//                     )
//                     .then(result => {
//                       const { _id, ...rest } = result.value;
//                       res.send({ stockData: rest });
//                       console.log(result.value);
//                     });
//                 });
//               });
//           });
