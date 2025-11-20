const express = require('express');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');

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

// Withdrawal Schema
const withdrawalSchema = new mongoose.Schema({
  user_id: Number,
  amount: Number,
  upi_id: String,
  status: { type: String, default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

// Telegram Bot - USE ENVIRONMENT VARIABLE ONLY
const bot = new TelegramBot(process.env.BOT_TOKEN, { 
  polling: true 
});

console.log('🚀 UPI Money Bot Starting...');

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

      // Reward referrer
      if (refCode) {
        const referrer = await User.findOne({ referral_code: refCode });
        if (referrer) {
          referrer.balance += 10;
          referrer.total_earned += 10;
          await referrer.save();
          bot.sendMessage(referrer.user_id, `🎉 Referral joined! ₹10 added to your balance!`);
        }
      }

      bot.sendMessage(msg.chat.id, 
        `🎉 Welcome to UPI MONEY BOT!\n\n💰 Current Balance: ₹0\n📱 Your Referral Code: ${user.referral_code}\n\n💸 Complete tasks & earn money!\n👥 Refer friends & earn ₹10 each!\n\nUse /tasks to start earning!`);
    } else {
      bot.sendMessage(msg.chat.id, 
        `Welcome back ${user.name}!\n\n💰 Balance: ₹${user.balance}\n📱 Your Referral: ${user.referral_code}\n\nUse /tasks to earn more!`);
    }
  } catch (error) {
    console.log('Start command error:', error);
  }
});

// Tasks Command
bot.onText(/\/tasks/, (msg) => {
  const tasks = `📋 DAILY TASKS:\n\n` +
    `🎥 Watch Video & Submit - ₹20\n` +
    `📢 Join Telegram Channel - ₹15\n` +
    `📱 Download App & Review - ₹25\n` +
    `👥 Refer Friends - ₹10 each\n\n` +
    `Type /complete_video to start earning!`;

  bot.sendMessage(msg.chat.id, tasks);
});

// Complete Video Task
bot.onText(/\/complete_video/, async (msg) => {
  try {
    const user = await User.findOne({ user_id: msg.from.id });
    
    // Check if already completed today
    const today = new Date().toDateString();
    if (user.tasks_completed.includes('video_' + today)) {
      return bot.sendMessage(msg.chat.id, '❌ You already completed video task today! Try tomorrow.');
    }

    user.balance += 20;
    user.total_earned += 20;
    user.tasks_completed.push('video_' + today);
    await user.save();

    bot.sendMessage(msg.chat.id, 
      `✅ VIDEO TASK COMPLETED!\n\n💰 ₹20 Added to Balance!\n💳 New Balance: ₹${user.balance}\n\nUse /withdraw UPI_ID to withdraw money!`);
  } catch (error) {
    console.log('Video task error:', error);
  }
});

// Withdrawal Command
bot.onText(/\/withdraw (.+)/, async (msg, match) => {
  try {
    const upiId = match[1];
    const user = await User.findOne({ user_id: msg.from.id });

    if (user.balance < 10) {
      return bot.sendMessage(msg.chat.id, '❌ Minimum ₹10 required for withdrawal! Complete more tasks.');
    }

    const withdrawal = new Withdrawal({
      user_id: msg.from.id,
      amount: user.balance,
      upi_id: upiId
    });
    await withdrawal.save();

    // Reset user balance after withdrawal request
    const oldBalance = user.balance;
    user.balance = 0;
    await user.save();

    bot.sendMessage(msg.chat.id,
      `✅ WITHDRAWAL REQUESTED!\n\n💳 Amount: ₹${oldBalance}\n📱 UPI ID: ${upiId}\n⏳ Status: PENDING\n\nWe will process within 24 hours!`);
  } catch (error) {
    console.log('Withdrawal error:', error);
  }
});

// Balance Command
bot.onText(/\/balance/, async (msg) => {
  try {
    const user = await User.findOne({ user_id: msg.from.id });
    bot.sendMessage(msg.chat.id,
      `💰 YOUR BALANCE\n\n` +
      `Current Balance: ₹${user.balance}\n` +
      `Total Earned: ₹${user.total_earned}\n` +
      `Your Referral: ${user.referral_code}\n\n` +
      `Minimum Withdrawal: ₹10`);
  } catch (error) {
    console.log('Balance error:', error);
  }
});

// Referral Command
bot.onText(/\/refer/, async (msg) => {
  try {
    const user = await User.findOne({ user_id: msg.from.id });
    const botUsername = (await bot.getMe()).username;
    const referralLink = `https://t.me/${botUsername}?start=${user.referral_code}`;
    
    bot.sendMessage(msg.chat.id,
      `👥 REFER & EARN!\n\n` +
      `Your Referral Code: ${user.referral_code}\n` +
      `Earn ₹10 for each friend who joins!\n\n` +
      `Share this link:\n${referralLink}\n\n` +
      `Or share your code: ${user.referral_code}`);
  } catch (error) {
    console.log('Referral error:', error);
  }
});

// Admin Commands
bot.onText(/\/admin (.+)/, async (msg, match) => {
  try {
    // Check if admin
    if (msg.from.id !== parseInt(process.env.ADMIN_ID)) {
      return bot.sendMessage(msg.chat.id, '❌ Access Denied!');
    }

    const command = match[1];

    if (command === 'stats') {
      const totalUsers = await User.countDocuments();
      const totalWithdrawals = await Withdrawal.countDocuments();
      const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
      
      bot.sendMessage(msg.chat.id,
        `📊 BOT STATISTICS\n\n` +
        `Total Users: ${totalUsers}\n` +
        `Total Withdrawals: ${totalWithdrawals}\n` +
        `Pending Withdrawals: ${pendingWithdrawals}`);
    }

    if (command.startsWith('approve ')) {
      const withdrawalId = command.split(' ')[1];
      const withdrawal = await Withdrawal.findById(withdrawalId);
      
      if (withdrawal) {
        withdrawal.status = 'approved';
        await withdrawal.save();
        
        bot.sendMessage(withdrawal.user_id,
          `🎉 WITHDRAWAL APPROVED!\n\n` +
          `Amount: ₹${withdrawal.amount}\n` +
          `UPI: ${withdrawal.upi_id}\n` +
          `Status: ✅ APPROVED\n\n` +
          `Money will be sent within 2 hours!`);
        
        bot.sendMessage(msg.chat.id, `✅ Withdrawal ${withdrawalId} approved!`);
      }
    }
  } catch (error) {
    console.log('Admin command error:', error);
  }
});

// Keep server alive
app.get('/', (req, res) => {
  res.send('🚀 UPI Money Bot is Running Successfully!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log('✅ Bot should be working now!');
});

// Error handling
bot.on('error', (error) => {
  console.log('Bot error:', error);
});
