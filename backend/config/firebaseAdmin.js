// var admin = require("firebase-admin");

// // var serviceAccount = require("../config/firebaseServiceKey.json");

// const serviceAccount = require("/etc/secrets/firebaseServiceKey.json");

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// module.exports = admin;

const admin = require("firebase-admin");

// Read the secret file created by Render
// const serviceAccount = require("/etc/secrets/firebaseServiceKey.json");
var serviceAccount = require("../config/firebaseServiceKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
