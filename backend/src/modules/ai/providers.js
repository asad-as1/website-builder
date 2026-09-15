const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const OpenAI = require('openai');

// xKiro models with model-specific max_tokens
const xKiroModels = [
  ['qwen-coder', 'qwen/qwen3-coder-plus:free', 32000],      // 1M context, 65K output
  ['deepseek-v4-pro', 'deepseek/deepseek-v4-pro', 32000],   // 1M context, 384K output
  ['mistral-large', 'mistralai/mistral-large-2512', 16000], // 262K context
  ['codestral', 'mistralai/codestral-2508', 16000],         // 256K context
  ['devstral', 'mistralai/devstral-medium', 8000],          // 128K context
];

const createXKiroProvider = ([name, model, maxTokens]) => ({
  name: `xkiro/${name}`,
  client: new OpenAI({
    baseURL: 'https://api.xkiro.com/v1',
    apiKey: process.env.XKIRO_API_KEY,
  }),
  model,
  generate: async (client, prompt) => {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content || '';
  },
});

const providers = [
  {
    name: 'gemini',
    client: new GoogleGenerativeAI(process.env.GEMINI_API_KEY),
    model: 'gemini-3.6-flash',
    dailyLimit: 1500,
    generate: async (client, prompt) => {
      const model = client.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const result = await model.generateContent(prompt);
      return result.response.text();
    },
  },
  ...(process.env.XKIRO_API_KEY ? xKiroModels.map(createXKiroProvider) : []),
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
        max_tokens: 16000,
      });
      return response.choices[0]?.message?.content || '';
    },
  },
  // ✅ DeepSeek last
  {
    name: 'deepseek',
    client: new OpenAI({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY,
    }),
    model: 'deepseek-chat',
    generate: async (client, prompt) => {
      const response = await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 16000,
      });
      return response.choices[0]?.message?.content || '';
    },
  },
];

module.exports = providers;