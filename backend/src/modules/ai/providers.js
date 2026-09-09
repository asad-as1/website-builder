const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const OpenAI = require('openai');

// Provider configurations
const providers = [
  {
    name: 'gemini',
    client: new GoogleGenerativeAI(process.env.GEMINI_API_KEY),
    model: 'gemini-3.6-flash',
    dailyLimit: 1500,
    generate: async (client, prompt) => {
      const model = client.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    }
  },
  {
    name: 'groq',
    client: new Groq({ apiKey: process.env.GROQ_API_KEY }),
    model: 'openai/gpt-oss-120b',
    dailyLimit: 14400,
    generate: async (client, prompt) => {
      const response = await client.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      });
      return response.choices[0].message.content;
    }
  },
  {
    name: 'openrouter',
    client: new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    }),
    model: 'google/gemma-4-31b-it:free',
    dailyLimit: 50,
    generate: async (client, prompt) => {
      const response = await client.chat.completions.create({
        model: 'google/gemma-4-31b-it:free',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      });
      return response.choices[0].message.content;
    }
  },
  {
    name: 'deepseek',
    client: new OpenAI({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY,
    }),
    model: 'deepseek-chat',
    dailyLimit: 5000000, // tokens
    generate: async (client, prompt) => {
      const response = await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      });
      return response.choices[0].message.content;
    }
  }
];

module.exports = providers;