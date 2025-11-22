const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// المتغيرات من Render
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1441836792352477195/4pHUr4LybQMt0DxXOk6T30T3L-PUCeT_YwchAYDcFBs96VaDCseo_o-AVdei_HHmnsRt";
// رابط السيرفر الخاص بك
const SERVER_LINK = "https://topg.org/cs-servers/server-676666";

// متغير لحفظ عدد الأصوات اليومية
// ملاحظة: في استضافة Render المجانية، هذا العداد قد يصفر إذا السيرفر نام أو عمل ريستارت
let dailyVotes = 0;

app.get('/', (req, res) => {
    res.send(`Server is Running. Today's votes: ${dailyVotes}`);
});

// --- الجزء الأول: استقبال التصويت وإرسال رسالة فورية ---
app.get('/vote', async (req, res) => {
    const voter_ip = req.query.p_resp || "Unknown IP";
    
    // زيادة العداد
    dailyVotes++;
    console.log(`New vote! Total today: ${dailyVotes}`);

    if (DISCORD_WEBHOOK_URL) {
        try {
            await axios.post(DISCORD_WEBHOOK_URL, {
                embeds: [
                    {
                        title: "✅ New Vote Received!",
                        description: "**Thank you for voting for our server!**",
                        color: 3066993, // لون أخضر
                        fields: [
                            {
                                name: "Voter IP",
                                value: `||${voter_ip}||`,
                                inline: true
                            },
                            {
                                name: "Reminder",
                                value: "You can vote again every **5 or 6 hours**.",
                                inline: false
                            }
                        ],
                        footer: {
                            text: `Total votes today: ${dailyVotes}`
                        },
                        timestamp: new Date()
                    }
                ]
            });
        } catch (error) {
            console.error("Error sending webhook:", error.message);
        }
    }

    res.send('Vote Received');
});

// --- الجزء الثاني: التقرير اليومي (كل 24 ساعة) ---
// هذا الكود يعمل كل يوم الساعة 12:00 منتصف الليل
cron.schedule('0 0 * * *', async () => {
    console.log("Sending daily report...");
    
    if (DISCORD_WEBHOOK_URL) {
        try {
            await axios.post(DISCORD_WEBHOOK_URL, {
                embeds: [
                    {
                        title: "📊 Daily Vote Statistics",
                        description: "Here is the summary of votes received in the last 24 hours.",
                        color: 15105570, // لون برتقالي
                        fields: [
                            {
                                name: "Total Votes Today",
                                value: `**${dailyVotes}** Votes`,
                                inline: false
                            },
                            {
                                name: "Support Us",
                                value: `[Click here to Vote now!](${SERVER_LINK})`,
                                inline: false
                            }
                        ],
                        footer: {
                            text: "The counter has been reset for the new day."
                        },
                        timestamp: new Date()
                    }
                ]
            });
        } catch (error) {
            console.error("Error sending daily report:", error.message);
        }
    }

    // تصفير العداد لليوم الجديد
    dailyVotes = 0;
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});