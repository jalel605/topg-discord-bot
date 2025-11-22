/**
 * Express Node.js application to track votes and send notifications to Discord.
 * Integrates with TopG.org using their Webhook system.
 * * Dependencies:
 * - express: To create the web server
 * - axios: To send HTTP requests (to Discord Webhook)
 * - node-cron: To schedule recurring tasks (daily report)
 */
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const app = express();

// Express setup for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================================================
//                  Configuration Variables
// =========================================================

// Discord Webhook URL (must be set as an environment variable)
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
// Your server link on TopG, used in vote buttons and reports
const SERVER_LINK = "https://topg.org/cs-servers/server-676666"; 

// Variable to store the daily vote count
let dailyVotes = 0;

// =========================================================
//                   Discord Webhook Functions
// =========================================================

/**
 * Function to send a message when the server starts successfully.
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
                    title: "🟢 Bot is Online & Ready!",
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
                            value: "You can vote every **6 hours**.\nDaily stats will be sent at midnight (UTC).",
                            inline: false
                        }
                    ],
                    footer: {
                        text: "System Powered by GlaD"
                    },
                    timestamp: new Date().toISOString() // Use ISOString format
                }
            ]
        });
        console.log("Startup message sent successfully.");
    } catch (error) {
        console.error("Error sending startup message:", error.message);
    }
}

/**
 * Function to send a daily report with the total number of votes.
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
//                         Express Routes
// =========================================================

// Root Path (Health Check)
app.get('/', (req, res) => {
    res.status(200).send(`Server is Running. Today's votes: ${dailyVotes}`);
});

/**
 * 2. Vote Receiving Endpoint (Webhook Endpoint)
 * TopG sends a GET request here upon a successful vote.
 * It expects a query parameter named 'p_resp' containing the voter's IP address.
 */
app.get('/vote', async (req, res) => {
    // Extract the voter IP from the 'p_resp' query parameter
    const voter_ip = req.query.p_resp || "Unknown IP (No p_resp provided)";
    
    // Increment the daily vote count
    dailyVotes++;
    
    console.log(`✅ New vote received from: ${voter_ip}. Daily total: ${dailyVotes}`);

    if (DISCORD_WEBHOOK_URL) {
        try {
            await axios.post(DISCORD_WEBHOOK_URL, {
                embeds: [
                    {
                        title: "✅ New Vote Received!",
                        description: "**Thank you for supporting our server!**",
                        color: 3447003, // Blue color
                        fields: [
                            // Use || around the IP to hide it as a Discord spoiler
                            { name: "Voter IP", value: `||${voter_ip}||`, inline: true },
                            { name: "Total Today", value: `${dailyVotes}`, inline: true }
                        ],
                        timestamp: new Date().toISOString()
                    }
                ]
            });
        } catch (error) { 
            console.error("Error sending vote notification:", error.message); 
        }
    }
    
    // Always send a quick response to the Webhook
    res.status(200).send('Vote Received');
});

// =========================================================
//                         Scheduling (Cron Job)
// =========================================================

/**
 * 3. Schedule: Send daily report and reset the counter (12:00 AM UTC)
 * Format: 'minute hour day_of_month month day_of_week'
 * '0 0 * * *' means 0 minutes, 0 hours (midnight) every day.
 */
cron.schedule('0 0 * * *', async () => {
    console.log("--- Running daily report job ---");
    
    // 1. Send the report first
    await sendDailyReport(); 
    
    // 2. Reset the daily vote counter
    dailyVotes = 0;
    console.log("Daily vote counter has been reset.");
}, {
    timezone: "UTC" // Recommended to specify timezone for consistency
});


// =========================================================
//                   Server Startup
// =========================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server started successfully on port: ${PORT}`);
    
    // Call the startup message function when the server starts
    sendStartupMessage();
});