const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// المتغيرات
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
// ضع رابط سيرفرك هنا
const SERVER_LINK = "https://topg.org/cs-servers/server-676666"; 

// متغير لحفظ عدد الأصوات اليومية
let dailyVotes = 0;

// 1. دالة لإرسال رسالة عند تشغيل السيرفر
async function sendStartupMessage() {
    if (DISCORD_WEBHOOK_URL) {
        try {
            console.log("Sending Startup Message to Discord...");
            await axios.post(DISCORD_WEBHOOK_URL, {
                embeds: [
                    {
                        title: "🟢 Bot is Online & Ready!",
                        description: "نظام التتبع الخاص بـ TopG يعمل الآن بنجاح.",
                        color: 5763719, // لون أخضر
                        fields: [
                            {
                                name: "🌍 Server Status",
                                value: "Listening for votes...",
                                inline: true
                            },
                            {
                                name: "🔗 Vote Link",
                                value: `[Click Here to Vote](${SERVER_LINK})`,
                                inline: true
                            },
                            {
                                name: "ℹ️ Info",
                                value: "You can vote every **6 hours**.\nDaily stats will be sent at midnight.",
                                inline: false
                            }
                        ],
                        footer: {
                            text: "System Powered by Render"
                        },
                        timestamp: new Date()
                    }
                ]
            });
        } catch (error) {
            console.error("Error sending startup message:", error.message);
        }
    }
}

app.get('/', (req, res) => {
    res.send(`Server is Running. Today's votes: ${dailyVotes}`);
});

// 2. استقبال التصويت
app.get('/vote', async (req, res) => {
    const voter_ip = req.query.p_resp || "Unknown IP";
    dailyVotes++;
    
    if (DISCORD_WEBHOOK_URL) {
        try {
            await axios.post(DISCORD_WEBHOOK_URL, {
                embeds: [
                    {
                        title: "✅ New Vote Received!",
                        description: "**Thank you for supporting our server!**",
                        color: 3447003, // أزرق
                        fields: [
                            { name: "Voter IP", value: `||${voter_ip}||`, inline: true },
                            { name: "Total Today", value: `${dailyVotes}`, inline: true }
                        ],
                        timestamp: new Date()
                    }
                ]
            });
        } catch (error) { console.error(error); }
    }
    res.send('Vote Received');
});

// 3. التقرير اليومي (الساعة 12 ليلاً)
cron.schedule('0 0 * * *', async () => {
    if (DISCORD_WEBHOOK_URL) {
        try {
            await axios.post(DISCORD_WEBHOOK_URL, {
                embeds: [
                    {
                        title: "📊 Daily Vote Report",
                        description: `We received **${dailyVotes}** votes today!`,
                        color: 15105570, // برتقالي
                        fields: [
                            { name: "Vote Again", value: `[Link](${SERVER_LINK})` }
                        ],
                        timestamp: new Date()
                    }
                ]
            });
        } catch (error) { console.error(error); }
    }
    dailyVotes = 0;
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
    
    // هنا نستدعي دالة رسالة التشغيل
    sendStartupMessage();
});