// -------------------
// FILE: app.js
// -------------------
// --- LATEST VERSION - OPTIMIZED FOR VERCEL ---

// --- 1. SETUP ---
const express = require('express');
const axios = require('axios');

// Vercel automatically captures console.log and console.error, so we don't need a file logger.
console.log('--- SCRIPT START ---');

try {
    // Initialize the Express application
    const app = express();
    console.log('Express app initialized.');

    // Use middleware to automatically parse incoming JSON data
    app.use(express.json());
    console.log('JSON middleware configured.');

    // --- Health Check Endpoint ---
    // You can visit your-vercel-url.app/health to confirm the app is running.
    app.get('/health', (req, res) => {
        console.log('Health check endpoint was hit.');
        res.status(200).send('OK');
    });

    // --- THE WEBHOOK ENDPOINT ---
    // This listens for requests at your-vercel-url.app/generate-plan
    app.post('/generate-plan', async (req, res) => {
        console.log("Webhook received at /generate-plan. Processing...");

        try {
            // --- DATA EXTRACTION ---
            const formData = req.body;
            const get = (key) => formData[key] || ''; // Helper to safely get values
            console.log('Received Form Data: ' + JSON.stringify(formData, null, 2));

            // --- MASTER PROMPT CONSTRUCTION ---
            let masterPrompt = `
You are an expert marketing strategist for a company called gibLink Ai. Your task is to generate a comprehensive, actionable AI Marketing Plan based ONLY on the following information provided by the user. The plan should be structured in Markdown format with clear headings and be encouraging and empowering in tone.

**User's Primary Goal:**
${get('primary_marketing_goal')}

---

### 1. Executive Summary
*A brief, high-level overview of the marketing plan, tailored to the user's primary goal.*

---

### 2. Foundational Business Identity
*A summary of the core business details that will inform the marketing strategy.*
- **Business Name:** ${get('business_name')}
- **Vision Statement:** ${get('vision_statement')}
- **Mission Statement:** ${get('mission_statement')}
- **Core Values:** ${get('core_values')}
- **Unique Value Proposition:** Our company is better than our primary competitor, ${get('primary_competitor')}, because ${get('uvp_differentiator')}.

---

### 3. Target Audience Deep Dive
*A detailed look at the customer segments this plan will target.*
`;

            const icpSegments = get('icp_segment_name');
            if (icpSegments && Array.isArray(icpSegments)) {
                icpSegments.forEach((segment, index) => {
                    masterPrompt += `
**Ideal Customer Profile ${index + 1}: ${segment}**
- **Pain Points to Solve:** ${(get('icp_pain_points')[index] || 'N/A')}
- **Where to Find Them (Watering Holes):** ${(get('icp_watering_holes')[index] || 'N/A')}
`;
                });
            }

            masterPrompt += `
---

### 4. Core Messaging & Brand Voice
*How we will communicate. This defines the personality of our marketing.*
- **Brand Voice:** We are ${get('brand_voice_positive_1')} but not ${get('brand_voice_negative_1')}. We are also ${get('brand_voice_positive_2')} but not ${get('brand_voice_negative_2')}.
- **Core Content Pillars:** Our marketing content will revolve around these themes: ${get('content_pillars')}.

---

### 5. Offerings to Promote
*The specific products or services at the center of this marketing plan.*
`;
            const offerings = get('offering_name');
            if (offerings && Array.isArray(offerings)) {
                offerings.forEach((offering, index) => {
                    masterPrompt += `
- **Offering:** ${offering}
- **Key Benefit:** ${(get('key_benefit')[index] || 'N/A')}
`;
                });
            }

            masterPrompt += `
---

### 6. Actionable Channel & Content Strategy
*A step-by-step plan for reaching the target audience, based on their goal and watering holes.*

---

### 7. KPIs & Measuring Success
*How we will track our progress toward the primary goal of "${get('primary_marketing_goal')}".*

---
Now, generate the full marketing plan based on this structure.
`;

            console.log("Master Prompt constructed. Calling OpenAI...");

            // --- OPENAI API CALL ---
            const openaiResponse = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4-turbo-preview',
                    messages: [{ role: 'user', content: masterPrompt }],
                    temperature: 0.7,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const generatedMarketingPlan = openaiResponse.data.choices[0].message.content;
            console.log("Marketing Plan generated successfully.");

            // --- POST TO WORDPRESS "BRIDGE" ENDPOINT ---
            console.log("Posting to WordPress Bridge Endpoint...");
            
            const boardTitle = `AI Marketing Plan for ${get('business_name')}`;
            
            const bridgePayload = {
                title: boardTitle,
                content: generatedMarketingPlan,
                user_id: get('user_id') || null 
            };

            await axios.post(
                process.env.GIBLINK_BRIDGE_URL,
                bridgePayload,
                {
                    headers: {
                        'x-giblink-secret-key': process.env.GIBLINK_BRIDGE_SECRET_KEY,
                        'Content-Type': 'application/json',
                    },
                }
            );

            console.log("Successfully posted to WordPress bridge.");

            // --- SUCCESS RESPONSE ---
            res.status(200).send({ message: 'Plan generated and posted successfully!' });

        } catch (error) {
            // --- ERROR HANDLING ---
            const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
            console.error('!!! An error occurred during webhook processing: ' + errorMessage);
            
            res.status(500).send({ message: 'An error occurred while generating the plan.' });
        }
    });
    
    // Export the app for Vercel's serverless environment
    module.exports = app;

} catch (startupError) {
    // --- CATCH FATAL STARTUP ERRORS ---
    console.error('!!! FATAL STARTUP ERROR: ' + startupError.message);
    console.error('Stack Trace: ' + startupError.stack);
}
