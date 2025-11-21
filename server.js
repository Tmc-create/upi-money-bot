const express = require('express');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const app = express();
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.log('❌ MongoDB Connection Error:', err.message));

// User Schema
const userSchema = new mongoose.Schema({
  user_id: { type: Number, unique: true },
  name: String,
  balance: { type: Number, default: 0 },
  upi_id: String,
  referral_code: String,
  referred_by: String,
  total_earned: { type: Number, default: 0 },
  tasks_completed: [String],
  join_date: { type: Date, default: Date.now }
});

const withdrawalSchema = new mongoose.Schema({
  user_id: Number,
  amount: Number,
  upi_id: String,
  status: { type: String, default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

// Telegram Bot with Webhook
const bot = new TelegramBot(process.env.BOT_TOKEN);

// Webhook setup
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

console.log('🚀 UPI Money Bot Starting with Webhooks...');

// ==================== BOT COMMANDS ====================

// Start Command
bot.onText(/\/start/, async (msg) => {
  try {
    const userId = msg.from.id;
    const refCode = msg.text.split(' ')[1];

    let user = await User.findOne({ user_id: userId });

    if (!user) {
      user = new User({
        user_id: userId,
        name: msg.from.first_name,
        balance: 0,
        referral_code: `REF${userId}`,
        referred_by: refCode || null
      });
      await user.save();

      if (refCode) {
        const referrer = await User.findOne({ referral_code: refCode });
        if (referrer) {
          referrer.balance += 10;
          referrer.total_earned += 10;
          await referrer.save();
          bot.sendMessage(referrer.user_id, `🎉 Referral joined! ₹10 added!`);
        }
      }

      bot.sendMessage(msg.chat.id, 
        `🎉 Welcome to UPI MONEY BOT!\n💰 Balance: ₹0\n📱 Referral: ${user.referral_code}\n\n/tasks - Earn Money!`);
    } else {
      bot.sendMessage(msg.chat.id, `Welcome back! Balance: ₹${user.balance}`);
    }
  } catch (error) {
    console.log('Start error:', error);
  }
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
  user.total_earned += 20;
  await user.save();
  bot.sendMessage(msg.chat.id, `✅ ₹20 Added! Balance: ₹${user.balance}`);
});

// Balance Command
bot.onText(/\/balance/, async (msg) => {
  const user = await User.findOne({ user_id: msg.from.id });
  bot.sendMessage(msg.chat.id, `💰 Balance: ₹${user.balance}`);
});

// Set webhook after deployment
const setWebhook = async () => {
  try {
    const webhookUrl = `${process.env.RENDER_URL}/webhook`;
    await bot.setWebHook(webhookUrl);
    console.log('✅ Webhook set successfully:', webhookUrl);
  } catch (error) {
    console.log('❌ Webhook error:', error);
  }
};

// Keep server alive
app.get('/', (req, res) => {
  res.send('🚀 UPI Money Bot Running with Webhooks!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`✅ Server running on port ${PORT}`);
  await setWebhook();
});
