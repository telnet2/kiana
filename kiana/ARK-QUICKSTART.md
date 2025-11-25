# 🚀 ARK Quick Start Guide (5 minutes)

Get Kiana Agent working with ARK models in just 5 minutes!

## Step 1: Get ARK API Key (2 minutes)

1. Go to [ARK Platform](https://ark.bytedance.com/)
2. Sign up / Log in
3. Create a new application
4. Copy your **API Key**
5. Note your **Base URL** (usually `https://ark.cn-beijing.volces.com/api/v3`)

## Step 2: Configure Environment (1 minute)

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your credentials
nano .env
```

Add these lines to `.env`:
```env
ARK_API_KEY=your-actual-api-key-here
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL_ID=doubao-pro-32k
```

## Step 3: Validate Setup (1 minute)

```bash
# Test your configuration
node examples/validate-ark-setup.js

# Should see: "🎉 All validation tests passed!"
```

## Step 4: Try It Out (1 minute)

```bash
# Simple test
node examples/ark-usage-example.js

# Interactive mode
node bin/memsh --instruction "List files in current directory"

# With streaming
node bin/memsh --instruction "Show me the code" --stream
```

## 🎯 That's It!

You should now see ARK responses in your terminal. The validation script will tell you if anything needs fixing.

## 📋 Common Models to Try

| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| `doubao-lite-4k` | 🚀 Fastest | 💰 Cheapest | Quick tasks |
| `doubao-lite-32k` | ⚡ Fast | 💰 Cheap | Most tasks |
| `doubao-pro-32k` | 🐢 Slower | 💰 Expensive | Complex reasoning |

## 🔧 Need Help?

If validation fails:

1. **Check API Key**: Make sure you copied it correctly
2. **Check Region**: Try US endpoint if China doesn't work:
   ```env
   ARK_BASE_URL=https://ark.us-east-1.volces.com/api/v3
   ```
3. **Check Model**: Try a different model ID
4. **Run validation again**: `node examples/validate-ark-setup.js`

## 📚 Next Steps

- **Full Guide**: See [ARK-SETUP.md](./ARK-SETUP.md) for detailed configuration
- **Examples**: Check out `examples/ark-usage-example.js` for more usage patterns
- **Interactive Mode**: Use `node bin/memsh` for conversational interface

---

**🎉 Enjoy using Kiana Agent with ARK models!**