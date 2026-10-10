// @ts-check
// Точка входа Yandex Cloud Function (index.handler).
const { createHandler } = require("./handler");
const { store } = require("./store");

module.exports.handler = createHandler({
  store,
  adminKey: process.env.ADMIN_KEY,
});
