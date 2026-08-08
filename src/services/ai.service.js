const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SYSTEM_CONTEXT = `You are WasteBot, the AI assistant for WasteScheduler Nigeria — a modern waste management platform serving Nigerian communities.

Your role:
- Help residents understand waste disposal methods
- Guide users on recycling best practices in Nigeria
- Answer questions about pickup schedules and zones
- Explain the waste fee / billing system
- Encourage proper waste management and environmental responsibility
- Provide information about Nigerian waste management authorities (LAWMA, PSP, RECCIMA)
- Answer questions about waste categories: Plastic, Paper, Glass, Metal, Organic, E-Waste, Hazardous Waste

Tone: Friendly, helpful, and encouraging. Use simple English. Occasionally use Nigerian expressions warmly.
Always respond in 2-4 short paragraphs maximum. Be concise and practical.
When you don't know something specific to the user's local area, tell them to contact their local waste management authority.

Currency: Always use Nigerian Naira (₦) when discussing prices.
Do NOT discuss topics unrelated to waste management, recycling, or the WasteScheduler platform.`;

async function chatWithGemini(userMessage, conversationHistory = []) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build conversation history for context
    const history = conversationHistory.slice(-6).map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: SYSTEM_CONTEXT }] },
        { role: 'model', parts: [{ text: "Understood! I'm WasteBot, ready to help with all waste management questions for WasteScheduler Nigeria. How can I assist you today?" }] },
        ...history,
      ],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    return { success: true, message: response.text() };
  } catch (err) {
    console.error('[AI] Gemini error:', err.message);

    // Fallback rule-based responses when AI is unavailable
    return { success: true, message: getFallbackResponse(userMessage) };
  }
}

function getFallbackResponse(message) {
  const msg = message.toLowerCase();

  if (msg.includes('plastic')) {
    return "Plastic waste should be placed in the Blue Bin. Make sure to rinse containers before recycling. Plastic bottles, bags, and containers are collected every Tuesday in most zones. ♻️";
  }
  if (msg.includes('organic') || msg.includes('food') || msg.includes('compost')) {
    return "Organic waste like food scraps and garden waste goes in the Brown Bin. It's collected every Monday. Avoid putting meat or dairy in your home compost. 🌱";
  }
  if (msg.includes('schedule') || msg.includes('pickup') || msg.includes('collection')) {
    return "You can view your collection schedule on the Schedule page or Calendar. Your zone's pickup dates are listed there. You'll also receive email reminders before each pickup day. 📅";
  }
  if (msg.includes('fee') || msg.includes('bill') || msg.includes('payment') || msg.includes('naira')) {
    return "Waste fees are calculated monthly or by weight (₦50/kg). Monthly flat rate is ₦2,000 for residential accounts. Pay via bank transfer to our account and upload your proof in the Billing section. 💳";
  }
  if (msg.includes('recycle') || msg.includes('recycling')) {
    return "Great question! Recycling reduces landfill waste and helps the environment. Use the Waste Guide to search for any item and learn the correct disposal method. Find recycling centers near you on the Map page. 🗺️";
  }
  if (msg.includes('report') || msg.includes('missed') || msg.includes('dumping')) {
    return "You can report missed pickups or illegal dumping on the Reports page. Include a description, location, and optionally a photo. Our team will review and respond within 24-48 hours. 🚨";
  }
  if (msg.includes('e-waste') || msg.includes('electronic') || msg.includes('phone') || msg.includes('laptop')) {
    return "Electronic waste (phones, laptops, batteries) should NEVER go in regular bins. They contain harmful chemicals. Take them to designated e-waste collection centers — check the Map page for locations near you. 💻";
  }
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('help')) {
    return "Hello! I'm WasteBot 👋 I'm here to help you with waste disposal, recycling tips, schedules, and billing. What would you like to know today?";
  }

  return "I'm here to help with waste management questions! You can ask me about waste disposal methods, pickup schedules, recycling tips, billing, or how to use WasteScheduler. What would you like to know? ♻️";
}

module.exports = { chatWithGemini };
