const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const SERVER_LINK = "https://topg.org/cs-servers/server-676666"; 

const SERVER_OWNER_NAME = "FireZM";

let lastKnownTotalVotes = 0;

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
 * تم تحديثها لتكون أكثر مرونة في استخلاص الرقم الذي يتبع كلمة "Score" مباشرةً.
 */
function extractScoreFromHtml(html) {
    const searchString = "Score";
    const startIndex = html.indexOf(searchString);

    if (startIndex !== -1) {
        // نأخذ مقطعاً كبيراً بعد كلمة 'Score' للبحث عن الرقم
        // حوالي 100 حرف كافية لتجاوز أي وسوم غير ضرورية
        const snippet = html.substring(startIndex, startIndex + 100);
        
        // تعبير منتظم (Regex) جديد وأكثر مرونة:
        // 1. يجد كلمة Score (بشكل اختياري)
        // 2. يبحث عن أي رقم صحيح (\d+) بعد الكلمة
        // 3. يتجاهل أي مسافات أو علامات HTML بين الكلمة والرقم
        const scoreMatch = snippet.match(/(\d+)/); 

        if (scoreMatch && scoreMatch[1]) {
            const score = parseInt(scoreMatch[1], 10);
            console.log(`[Scraping] Successfully extracted score: ${score}`);
            return score;
        }
    }
    console.warn("[Scraping] Could not find the Score number in the HTML content.");
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
            // إذا كان Score = 0، فهناك خطأ في الاستخلاص (Scraping)
            console.error("❌ Failed to extract score from TopG page HTML. Scraping logic may be broken or score is 0.");
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