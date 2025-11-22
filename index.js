/**
 * تطبيق Express Node.js لتتبع التصويتات وإرسال الإشعارات إلى Discord.
 * يتكامل مع TopG.org باستخدام نظام الـ Webhook الخاص بهم.
 * * الميزة: يتتبع ويعرض اسم المصوّت إذا تم تقديمه في الرابط.
 * * * الاعتمادات:
 * - express: لإنشاء خادم الويب
 * - axios: لإرسال طلبات HTTP (إلى Discord Webhook)
 * - node-cron: لجدولة المهام المتكررة (التقرير اليومي)
 */
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const app = express();

// إعداد Express لتحليل الـ JSON والبيانات المُرسلة عبر URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================================================
//                  المتغيرات الأساسية (Configuration)
// =========================================================

// رابط Discord Webhook (يجب تعيينه كمتغير بيئة)
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
// رابط سيرفرك على TopG
const SERVER_LINK = "https://topg.org/cs-servers/server-676666"; 

// اسم المالك/السيرفر (يُستخدم في رسالة الشكر الشخصية)
const SERVER_OWNER_NAME = "FireZM";

// متغير لحفظ عدد الأصوات اليومية
let dailyVotes = 0;

// =========================================================
//                   وظائف Discord Webhook
// =========================================================

/**
 * دالة لإرسال رسالة عند تشغيل السيرفر بنجاح.
 */
async function sendStartupMessage() {
    if (!DISCORD_WEBHOOK_URL) {
        console.warn("⚠️ Warning: DISCORD_WEBHOOK_URL environment variable is not set. Discord notifications will be disabled.");
        return;
    }

    try {
        console.log("Sending Startup Message to Discord...");
        await axios.post(DISCORD_WEBHOOK_URL, {
            embeds: [
                {
                    title: "🟢 [FireZM] Bot is Online & Ready!",
                    description: "The TopG vote tracking system is now working successfully.",
                    color: 5763719, // Green color
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
                            value: "To get a shoutout, use the customized vote link (see instructions below).\nDaily stats will be sent at midnight (UTC).",
                            inline: false
                        }
                    ],
                    footer: {
                        text: "System Powered by GlaD"
                    },
                    timestamp: new Date().toISOString()
                }
            ]
        });
        console.log("Startup message sent successfully.");
    } catch (error) {
        console.error("Error sending startup message:", error.message);
    }
}

/**
 * دالة لإرسال تقرير يومي بعدد الأصوات.
 */
async function sendDailyReport() {
    if (!DISCORD_WEBHOOK_URL) return;

    try {
        console.log(`Sending daily report with ${dailyVotes} votes.`);
        await axios.post(DISCORD_WEBHOOK_URL, {
            embeds: [
                {
                    title: "📊 Daily Vote Report",
                    description: `We received **${dailyVotes}** votes today!`,
                    color: 15105570, // Orange color
                    fields: [
                        { name: "Vote Again", value: `[Link](${SERVER_LINK})` }
                    ],
                    timestamp: new Date().toISOString()
                }
            ]
        });
        console.log("Daily report sent successfully.");
    } catch (error) {
        console.error("Error sending daily report:", error.message);
    }
}


// =========================================================
//                         مسارات Express
// =========================================================

// المسار الرئيسي (Health Check)
app.get('/', (req, res) => {
    res.status(200).send(`Server is Running. Today's votes: ${dailyVotes}`);
});

/**
 * 2. مسار استقبال التصويت (Webhook Endpoint)
 * يستقبل 'p_resp' (IP) من TopG و 'voter_name' من الرابط المخصص.
 */
app.get('/vote', async (req, res) => {
    // استخراج IP من معلمة Webhook الخاصة بـ TopG
    const voter_ip = req.query.p_resp || "Unknown IP (No p_resp provided)";
    
    // استخراج معلمة الاسم المخصصة (على سبيل المثال، من '?voter_name=glad')
    // القيمة الافتراضية الآن هي "A Player"
    const voter_name = req.query.voter_name || "A Player"; 
    
    // زيادة عدد الأصوات اليومية
    dailyVotes++;
    
    console.log(`✅ New vote received from: ${voter_name} (${voter_ip}). Daily total: ${dailyVotes}`);

    if (DISCORD_WEBHOOK_URL) {
        try {
            await axios.post(DISCORD_WEBHOOK_URL, {
                embeds: [
                    {
                        title: `🌟 New Vote Received by ${voter_name}!`,
                        
                        // رسالة الشكر المحدثة
                        description: `**${SERVER_OWNER_NAME} thanks ${voter_name} for supporting the server by voting on TopG!**`,
                        
                        color: 3447003, // Blue color
                        fields: [
                            { name: "Voter Name", value: `${voter_name}`, inline: true },
                            { name: "Total Today", value: `${dailyVotes}`, inline: true },
                            // يتم إخفاء الـ IP كـ spoiler للخصوصية
                            { name: "Voter IP", value: `||${voter_ip}||`, inline: false }, 
                        ],
                        timestamp: new Date().toISOString()
                    }
                ]
            });
            console.log(`✅ Discord notification sent successfully for ${voter_name}.`);

        } catch (error) { 
            // ❌ تسجيل خطأ الإرسال ببساطة (تبسيط بناء على طلبك)
            console.error(`❌ FAILED to send Discord notification for ${voter_name}.`);
            console.error(`Error details (Check Webhook URL and Discord settings): ${error.message}`);
        }
    } else {
        // ❌ تسجيل واضح في حال عدم تعيين الرابط
        console.error("❌ FAILED: DISCORD_WEBHOOK_URL is NOT configured. Notification skipped.");
    }
    
    // يجب دائمًا إرسال استجابة سريعة للـ Webhook
    res.status(200).send('Vote Received');
});

// =========================================================
//                         جدولة المهام (Cron Job)
// =========================================================

/**
 * 3. الجدولة: إرسال التقرير اليومي وتصفير العداد (الساعة 12:00 صباحًا بتوقيت UTC)
 */
cron.schedule('0 0 * * *', async () => {
    console.log("--- Running daily report job ---");
    
    // إرسال التقرير أولاً
    await sendDailyReport(); 
    
    // تصفير عداد الأصوات اليومية
    dailyVotes = 0;
    console.log("Daily vote counter has been reset.");
}, {
    timezone: "UTC"
});


// =========================================================
//                 Keep-Alive / Self-Pinging
// =========================================================

/**
 * دالة Keep-Alive: لإبقاء الخادم نشطًا ومنع دخوله في وضع السكون (Idle Mode).
 * يُرسل طلبًا إلى المسار الرئيسي للخادم كل 5 دقائق.
 * * ملاحظة: يجب أن تستخدم الرابط العام للخادم عند التشغيل الفعلي.
 */
function startKeepAlive() {
    const keepAliveInterval = 5 * 60 * 1000; // 5 دقائق بالمللي ثانية

    setInterval(async () => {
        try {
            // بما أن هذا الكود يعمل داخل خادم الويب نفسه، نستخدم المسار المحلي.
            // في بيئة الإنتاج مثل Render، يقوم هذا الإجراء بإبقاء الخادم نشطاً.
            await axios.get(`http://localhost:${PORT}/`); 
            console.log(`[Keep-Alive] Self-ping successful at ${new Date().toLocaleTimeString()}.`);
        } catch (error) {
            // لا نسجل خطأ Network/Timeout لأن هذا متوقع أحياناً في بيئات معينة.
            // نكتفي بتسجيل محاولة الإيقاظ.
             console.log(`[Keep-Alive] Attempted self-ping at ${new Date().toLocaleTimeString()}.`);
        }
    }, keepAliveInterval);
}

// =========================================================
//                   بدء تشغيل السيرفر
// =========================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server started successfully on port: ${PORT}`);
    
    // 1. استدعاء دالة رسالة التشغيل
    sendStartupMessage();
    
    // 2. بدء وظيفة Keep-Alive بعد تشغيل الخادم
    startKeepAlive();
});