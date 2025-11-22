/**
 * تطبيق Express Node.js لتتبع التصويتات وإرسال الإشعارات إلى Discord.
 * **الآلية:** يستخدم نظام الفحص الدوري (Polling/Scraping) لصفحة TopG بدلاً من الـ Webhook.
 * * الميزة: يتتبع عدد الأصوات (Score) على الصفحة ويرسل إشعاراً عند ارتفاعه.
 * * * الاعتمادات:
 * - express: لإنشاء خادم الويب
 * - axios: لجلب محتوى صفحة TopG وإرسال رسائل Discord.
 * - node-cron: لجدولة وظيفة الفحص كل 5 دقائق.
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
// رابط سيرفرك على TopG (للفحص)
const SERVER_LINK = "https://topg.org/cs-servers/server-676666"; 

// اسم المالك/السيرفر (يُستخدم في رسالة الشكر الشخصية)
const SERVER_OWNER_NAME = "FireZM";

// متغير لتخزين آخر عدد أصوات (Score) معروف. يستخدم لتحديد ما إذا كان هناك تصويت جديد.
let lastKnownTotalVotes = 0;

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
                    title: "🟢 [FireZM] Bot is Online & Ready! (Polling Mode)",
                    description: "The TopG vote tracking system is now active. Checking for new votes every 5 minutes.",
                    color: 5763719, // Green color
                    fields: [
                        {
                            name: "🌍 Server Status",
                            value: "Polling TopG score...",
                            inline: true
                        },
                        {
                            name: "🔗 Check Link",
                            value: `[TopG Server Page](${SERVER_LINK})`,
                            inline: true
                        },
                        {
                            name: "⚠️ Reliability Note",
                            value: "Votes may be delayed up to 5 minutes. Total votes lost on server restart.",
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
 * دالة لإرسال إشعار بالتصويت الجديد (في نظام الفحص الدوري، لا نعرف اسم المصوت).
 * @param {number} currentTotalVotes - إجمالي عدد الأصوات الحالي.
 */
async function sendNewVoteNotification(currentTotalVotes) {
    if (!DISCORD_WEBHOOK_URL) return;

    try {
        console.log(`Sending new vote notification. New total: ${currentTotalVotes}.`);
        await axios.post(DISCORD_WEBHOOK_URL, {
            embeds: [
                {
                    title: `🌟 New Vote Received! (Score: ${currentTotalVotes})`,
                    
                    // رسالة الشكر المحدثة (نستخدم الاسم الافتراضي لأننا لا نعرف هوية المصوّت)
                    description: `**${SERVER_OWNER_NAME} thanks a dedicated supporter for voting on TopG!**`,
                    
                    color: 3447003, // Blue color
                    fields: [
                        { name: "Total Score", value: `${currentTotalVotes}`, inline: true },
                        { name: "Vote Again", value: `[Link](${SERVER_LINK})`, inline: true }, 
                    ],
                    timestamp: new Date().toISOString()
                }
            ]
        });
        console.log(`✅ Discord notification sent successfully for new vote.`);

    } catch (error) { 
        console.error(`❌ FAILED to send Discord notification for new vote.`);
        console.error(`Error details: ${error.message}`);
    }
}


// =========================================================
//                         مسارات Express
// =========================================================

// المسار الرئيسي (Health Check) - الوحيد المتبقي
app.get('/', (req, res) => {
    res.status(200).send(`Server is Running. Last known score: ${lastKnownTotalVotes}`);
});

// =========================================================
//                   وظائف الفحص الدوري (Polling)
// =========================================================

/**
 * دالة لاستخراج Score من محتوى HTML لصفحة TopG.
 * تعتمد على العثور على العدد الذي يلي كلمة "Score" في الشيفرة.
 * * ملاحظة: هذه الطريقة هشة وقد تفشل إذا تغير تصميم TopG.
 */
function extractScoreFromHtml(html) {
    // محاولة إيجاد النص الذي يحتوي على 'Score' والرقم
    const searchString = "Score";
    const startIndex = html.indexOf(searchString);

    if (startIndex !== -1) {
        // نأخذ مقطعاً كبيراً بعد كلمة 'Score' للبحث عن الرقم
        const snippet = html.substring(startIndex, startIndex + 300);
        
        // استخدام تعبير منتظم (Regex) للبحث عن أول رقم صحيح يظهر بعد 'Score'
        // نبحث عن أي رقم داخل وسم HTML مثل <div>40</div> أو <p>40</p>
        const scoreMatch = snippet.match(/>\s*(\d+)\s*<\//); 

        if (scoreMatch && scoreMatch[1]) {
            return parseInt(scoreMatch[1], 10);
        }
    }
    // إذا لم يتم العثور على النتيجة، نرجع صفر.
    return 0;
}

/**
 * دالة فحص TopG: يتم تشغيلها بشكل دوري كل 5 دقائق.
 */
async function checkTopGVotes() {
    console.log(`--- Running TopG poll job at ${new Date().toLocaleTimeString()} ---`);
    let currentScore = 0;

    try {
        // 1. جلب محتوى HTML
        const response = await axios.get(SERVER_LINK);
        const html = response.data;
        
        // 2. استخراج Score
        currentScore = extractScoreFromHtml(html);

        if (currentScore > 0) {
            // المعالجة عند التشغيل الأول: فقط سجل النتيجة ولا ترسل إشعار.
            if (lastKnownTotalVotes === 0) {
                lastKnownTotalVotes = currentScore;
                console.log(`[Polling] Initial score set to ${currentScore}. No notification sent.`);
                return;
            }

            // 3. مقارنة النتيجة الجديدة بالنتيجة الأخيرة
            if (currentScore > lastKnownTotalVotes) {
                const newVotes = currentScore - lastKnownTotalVotes;
                console.log(`🎉 New votes detected! Count: ${newVotes}.`);
                
                // إرسال إشعار واحد لكل تصويت جديد (نكرر الرسالة لعدد الأصوات الجديدة)
                for (let i = 0; i < newVotes; i++) {
                    await sendNewVoteNotification(currentScore);
                }

                // 4. تحديث آخر نتيجة معروفة
                lastKnownTotalVotes = currentScore;
            } else if (currentScore < lastKnownTotalVotes) {
                // حالة نادرة (عادةً تحدث عند إعادة تشغيل العداد الشهري أو الخادم)
                console.warn(`[Polling] Score decreased (from ${lastKnownTotalVotes} to ${currentScore}). Resetting last known score.`);
                lastKnownTotalVotes = currentScore;
            } else {
                console.log("[Polling] No new votes detected. Score unchanged.");
            }
        } else {
            console.error("❌ Failed to extract score from TopG page HTML. Scraping logic may be broken.");
        }

    } catch (error) {
        console.error("❌ Error during TopG polling:", error.message);
    }
}

// =========================================================
//                         جدولة المهام (Cron Job)
// =========================================================

/**
 * الجدولة: فحص صفحة TopG كل 5 دقائق
 * '*/5 * * * *' = كل 5 دقائق
 */
cron.schedule('*/5 * * * *', checkTopGVotes, {
    timezone: "UTC"
});


// =========================================================
//                   بدء تشغيل السيرفر
// =========================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server started successfully on port: ${PORT}`);
    
    // 1. استدعاء دالة رسالة التشغيل
    sendStartupMessage();
    
    // 2. تشغيل الفحص الأولي فوراً عند بدء التشغيل
    checkTopGVotes();
});