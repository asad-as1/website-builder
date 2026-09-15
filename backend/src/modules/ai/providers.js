const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const OpenAI = require('openai');

const xKiroModels = [
  ['devstral', 'mistralai/devstral-medium'],
  ['qwen-coder', 'qwen/qwen3-coder-plus:free'],
  ['codestral', 'mistralai/codestral-2508'],
  ['deepseek-v4-pro', 'deepseek/deepseek-v4-pro'],
  ['mistral-large', 'mistralai/mistral-large-2512'],
];

const createXKiroProvider = ([name, model]) => ({
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
      max_tokens: 4096,
    });
    return response.choices[0]?.message?.content || '';
  },
});

const providers = [
  ...(process.env.XKIRO_API_KEY ? xKiroModels.map(createXKiroProvider) : []),
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
      return response.choices[0]?.message?.content || '';
    },
  },
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
        max_tokens: 4096,
      });
      return response.choices[0]?.message?.content || '';
    },
  },
];

module.exports = providers;
