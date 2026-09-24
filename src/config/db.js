const mongoose = require('mongoose');
const config = require('./env');

// Transactions need a replica set. MongoDB Atlas (including the free tier) is one.
async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri);
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
