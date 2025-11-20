const express = require('express');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');

const app = express();

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  user_id: Number,
  name: String,
  balance: { type: Number, default: 0 },
  referral_code: String
});

const User = mongoose.model('User', userSchema);

// Telegram Bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log('🚀 UPI Money Bot Started!');

// Start Command
bot.onText(/\/start/, async (msg) => {
  let user = await User.findOne({ user_id: msg.from.id });
  
  if (!user) {
    user = new User({
      user_id: msg.from.id,
      name: msg.from.first_name,
      balance: 0,
      referral_code: `REF${msg.from.id}`
    });
    await user.save();
  }
  
  bot.sendMessage(msg.chat.id, 
    `🎉 UPI MONEY BOT!\n💰 Balance: ₹${user.balance}\n📱 Refer: ${user.referral_code}\n\n/tasks - Earn Money!`);
});

// Tasks Command
bot.onText(/\/tasks/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📋 TASKS:\n🎥 Watch Video - ₹20\nType /complete_video`);
});

// Complete Video Task
bot.onText(/\/complete_video/, async (msg) => {
  const user = await User.findOne({ user_id: msg.from.id });
  user.balance += 20;
  await user.save();
  bot.sendMessage(msg.chat.id, `✅ ₹20 Added! Balance: ₹${user.balance}`);
});

// Keep server running
app.get('/', (req, res) => res.send('UPI Money Bot Running!'));
app.listen(3000, () => console.log('✅ Server running on port 3000'));
