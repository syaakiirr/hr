# AI Insights Setup Guide

## Overview
The AI Insights feature uses OpenAI's API to provide intelligent analytics, recommendations, and answer questions about your engagement data.

## Prerequisites
- OpenAI API account
- API key with access to GPT-4 or GPT-3.5-turbo

## Setup Steps

### 1. Get OpenAI API Key
1. Go to https://platform.openai.com/
2. Sign up or log in to your account
3. Navigate to **API Keys** section
4. Click **Create new secret key**
5. Copy the API key (it will only be shown once!)

### 2. Configure appsettings.json
Add the OpenAI configuration section to your `appsettings.json`:

```json
{
  "OpenAI": {
    "ApiKey": "sk-your-api-key-here",
    "Model": "gpt-4",
    "MaxTokens": 1000
  }
}
```

**Note:** Never commit your API key to git! Use environment variables or user secrets in production.

### 3. Using Environment Variables (Recommended for Production)
Instead of hardcoding the API key, use environment variables:

**Windows (PowerShell):**
```powershell
$env:OpenAI__ApiKey = "sk-your-api-key-here"
```

**Linux/Mac:**
```bash
export OpenAI__ApiKey="sk-your-api-key-here"
```

**Docker:**
```yaml
environment:
  - OpenAI__ApiKey=sk-your-api-key-here
```

### 4. Using User Secrets (Development)
For local development, use .NET User Secrets:

```bash
cd socihr-backend
dotnet user-secrets init
dotnet user-secrets set "OpenAI:ApiKey" "sk-your-api-key-here"
```

### 5. Verify Configuration
The application will throw an error on startup if the API key is missing:
```
InvalidOperationException: OpenAI API key is not configured
```

## Configuration Options

### Model Selection
- **gpt-4** (recommended): Best quality, slower, more expensive
- **gpt-3.5-turbo**: Fast, cheaper, good quality
- **gpt-4-turbo**: Balance between cost and quality

### MaxTokens
Controls response length:
- **500-1000**: Good for insights and recommendations
- **100-300**: Good for short answers
- **1500-2000**: For detailed analysis (higher cost)

## API Endpoints

### 1. Dashboard Insights
```
GET /api/aiinsights/dashboard-insights?fromDate=2026-01-01&toDate=2026-01-31
```
Generates comprehensive insights about current performance.

### 2. Ask Question
```
POST /api/aiinsights/ask
Body: {
  "question": "Which department needs the most support?",
  "fromDate": "2026-01-01",
  "toDate": "2026-01-31"
}
```
Ask specific questions about your data.

### 3. Detect Anomalies
```
GET /api/aiinsights/anomalies
```
Compares current month vs last month and identifies significant changes.

### 4. Get Recommendations
```
GET /api/aiinsights/recommendations
```
Returns 5 actionable recommendations to improve performance.

## Cost Estimation

### Pricing (as of 2026)
- GPT-4: ~$0.03 per 1K tokens
- GPT-3.5-turbo: ~$0.002 per 1K tokens

### Estimated Costs
- Dashboard insights: $0.10-0.30 per call
- Ask question: $0.05-0.15 per call
- Anomaly detection: $0.05-0.10 per call
- Recommendations: $0.05-0.15 per call

### Monthly Estimate (100 insights)
- GPT-4: $10-30/month
- GPT-3.5-turbo: $1-3/month

## Optimization Tips

1. **Cache responses**: Store insights for a few hours to avoid duplicate calls
2. **Rate limiting**: Implement rate limiting to control costs
3. **Use GPT-3.5-turbo**: For simple queries where GPT-4 isn't necessary
4. **Batch requests**: Combine multiple questions into one API call

## Troubleshooting

### Error: "OpenAI API key is not configured"
- Check that `OpenAI:ApiKey` is set in appsettings.json or environment variables
- Verify the configuration key format matches exactly

### Error: "Failed to generate insights: Unauthorized"
- API key is invalid or expired
- Check for extra spaces or newlines in the API key
- Verify your OpenAI account has API access enabled

### Error: "Rate limit exceeded"
- You've exceeded OpenAI's rate limit
- Wait a few seconds and retry
- Consider implementing exponential backoff

### Error: "Insufficient quota"
- Your OpenAI account has run out of credits
- Add payment method or purchase more credits at https://platform.openai.com/account/billing

## Security Best Practices

1. **Never commit API keys** to version control
2. Use **environment variables** or **Azure Key Vault** in production
3. Implement **rate limiting** to prevent abuse
4. Monitor **usage and costs** regularly via OpenAI dashboard
5. Rotate API keys periodically

## Alternative: Run Without AI Insights

If you don't want to use AI Insights, the feature is optional. The system will work fine without it. Simply don't configure the OpenAI API key, and avoid accessing the AI Insights page.

To completely disable the feature:
1. Remove the `AIInsightsService` registration from `Program.cs`
2. Remove the AI Insights navigation item from the frontend

## Support

- OpenAI Documentation: https://platform.openai.com/docs
- OpenAI API Status: https://status.openai.com/
- Pricing: https://openai.com/pricing
