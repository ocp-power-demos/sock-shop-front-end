(function (){
  'use strict';

  var async     = require("async")
    , express   = require("express")
    , request   = require("request")
    , endpoints = require("../endpoints")
    , helpers   = require("../../helpers")
    , app       = express()

  app.get("/orders", function (req, res, next) {
    console.log("Request received with body: " + JSON.stringify(req.body));
    var logged_in = req.cookies.logged_in;
    if (!logged_in) {
      throw new Error("User not logged in.");
      return
    }

    var custId = req.session.customerId;
    async.waterfall([
        function (callback) {
          request(endpoints.ordersUrl + "/orders/search/customerId?sort=date&custId=" + custId, function (error, response, body) {
            if (error) {
              return callback(error);
            }
            console.log("Received response: " + JSON.stringify(body));
            if (response.statusCode == 404) {
              console.log("No orders found for user: " + custId);
              return callback(null, []);
            }
            callback(null, JSON.parse(body)._embedded.customerOrders);
          });
        }
    ],
    function (err, result) {
      if (err) {
        return next(err);
      }
      helpers.respondStatusBody(res, 201, JSON.stringify(result));
    });
  });

  app.get("/orders/*", function (req, res, next) {
    var url = endpoints.ordersUrl + req.url.toString();
    request.get(url).pipe(res);
  });

  app.post("/orders", function(req, res, next) {
    console.log("Request received with body: " + JSON.stringify(req.body));
    var logged_in = req.cookies.logged_in;
    if (!logged_in) {
      throw new Error("User not logged in.");
      return
    }

    var custId = req.session.customerId;

    async.waterfall([
        function (callback) {
          request(endpoints.customersUrl + "/" + custId, function (error, response, body) {
            if (error || body.status_code === 500) {
              callback(error);
              return;
            }
            console.log("Received response: " + JSON.stringify(body));
            var jsonBody = JSON.parse(body);
            var customerlink = "http://user/customers/" + jsonBody.id;
            var addressLink = "http://user/addresses/" + jsonBody.id;
            var cardLink = "http://user/cards/" + jsonBody.id;
            var order = {
              "customer": customerlink,
              "address": addressLink,
              "card": cardLink,
              "items": endpoints.cartsUrl + "/" + custId + "/items"
            };
            callback(null, order, addressLink, cardLink);
          });
        },
        function (order, addressLink, cardLink, callback) {
          async.parallel([
              function (callback) {
                console.log("addressLink: GET Request to: " + addressLink);
                var checkIt = "" + addressLink;
                if (checkIt != "undefined" ) {
                  request.get(addressLink, function (error, response, body) {
                    if (error) {
                      callback(error);
                      return;
                    }
                    console.log("Received response: " + JSON.stringify(body));
                    var jsonBody = JSON.parse(body);
                    if (jsonBody.status_code !== 500 && jsonBody._embedded.address[0] != null) {
                      order.address = jsonBody._embedded.address[0]._links.self.href;
                    }
                    callback();
                  });
                }
              },
              function (callback) {
                console.log("cardLink: GET Request to: " + cardLink);
                var checkIt = "" + cardLink;
                if (checkIt != "undefined" ) {
                  request.get(cardLink, function (error, response, body) {
                    if (error) {
                      callback(error);
                      return;
                    }
                    console.log("Received response: " + JSON.stringify(body));
                    var jsonBody = JSON.parse(body);
                    if (jsonBody.status_code !== 500 && jsonBody._embedded.card[0] != null) {
                      order.card = jsonBody._embedded.card[0]._links.self.href;
                    }
                    callback();
                  });
                }
              }
          ], function (err, result) {
            if (err) {
              callback(err);
              return;
            }
            console.log(result);
            callback(null, order);
          });
        },
        function (order, callback) {
          var options = {
            uri: endpoints.ordersUrl + '/orders',
            method: 'POST',
            json: true,
            body: order
          };
          console.log("Posting Order: " + JSON.stringify(order));
          request(options, function (error, response, body) {
            if (error) {
              return callback(error);
            }
            console.log("Order response: " + JSON.stringify(response));
            console.log("Order response: " + JSON.stringify(body));
            callback(null, response.statusCode, body);
          });
        }
    ],
    function (err, status, result) {
      if (err) {
        return next(err);
      }
      helpers.respondStatusBody(res, status, JSON.stringify(result));
    });
  });

  module.exports = app;
}());
