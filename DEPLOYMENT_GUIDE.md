# 🚀 EcoGuard AI - Deployment Guide

## Prerequisites
- GitHub account
- Your code pushed to GitHub repository: `jeevanelias1-source/EcoGuard-AI`
- API keys ready (OpenWeather, OpenAQ, SMTP, Twilio)

---

## 🎯 Option 1: Render.com (Recommended - Free Tier)

### Why Render?
- ✅ Free tier available
- ✅ Excellent Python/FastAPI support
- ✅ Easy environment variable management
- ✅ Automatic deployments from GitHub
- ✅ Your `render.yaml` is already configured!

### Steps:

#### 1. Fix GitHub Push (if needed)
```bash
# Make sure you're authenticated as the correct user
cd /Users/jeevanmulamoottil/Desktop/ews
git remote set-url origin https://github.com/jeevanelias1-source/EcoGuard-AI.git
git push origin main
```

#### 2. Sign Up on Render
- Go to https://render.com
- Sign up with your GitHub account
- Authorize Render to access your repositories

#### 3. Deploy Using Blueprint
- Click **"New +"** → **"Blueprint"**
- Select your repository: `jeevanelias1-source/EcoGuard-AI`
- Render will automatically detect `render.yaml`
- Click **"Apply"**

#### 4. Add Environment Variables
In the Render dashboard, add these secret environment variables:
- `OPENWEATHER_API_KEY` - Your OpenWeather API key
- `OPENAQ_API_KEY` - Your OpenAQ API key
- `SMTP_USER` - Your Gmail address
- `SMTP_PASS` - Your Gmail app password (not regular password!)
- `TWILIO_ACCOUNT_SID` - Your Twilio SID
- `TWILIO_AUTH_TOKEN` - Your Twilio auth token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number

#### 5. Deploy!
- Click **"Create Web Service"**
- Wait 3-5 minutes for deployment
- Your app will be live at: `https://ews-kerala-safeai.onrender.com`

---

## 🎯 Option 2: Railway.app (Alternative)

### Why Railway?
- ✅ Simple deployment
- ✅ Free tier with $5 monthly credits
- ✅ Good for full-stack apps

### Steps:

#### 1. Sign Up on Railway
- Go to https://railway.app
- Sign up with GitHub

#### 2. Create New Project
- Click **"New Project"**
- Select **"Deploy from GitHub repo"**
- Choose `jeevanelias1-source/EcoGuard-AI`

#### 3. Configure
- Railway will auto-detect Python
- Add environment variables in the **Variables** tab
- Set start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

#### 4. Deploy
- Click **"Deploy"**
- Your app will be live in 2-3 minutes

---

## 🎯 Option 3: Heroku (Classic Choice)

### Steps:

#### 1. Install Heroku CLI
```bash
brew tap heroku/brew && brew install heroku
```

#### 2. Login and Create App
```bash
cd /Users/jeevanmulamoottil/Desktop/ews
heroku login
heroku create ews-kerala-safeai
```

#### 3. Add Environment Variables
```bash
heroku config:set OPENWEATHER_API_KEY=your_key_here
heroku config:set OPENAQ_API_KEY=your_key_here
heroku config:set SMTP_USER=your_email@gmail.com
heroku config:set SMTP_PASS=your_app_password
heroku config:set TWILIO_ACCOUNT_SID=your_sid
heroku config:set TWILIO_AUTH_TOKEN=your_token
heroku config:set TWILIO_PHONE_NUMBER=your_number
heroku config:set RECIPIENT_EMAIL=jeevanelias1@gmail.com
heroku config:set EMERGENCY_SMS_NUMBER=+916238275699
```

#### 4. Deploy
```bash
git push heroku main
```

---

## 🎯 Option 4: Docker + Any Cloud Platform

Your `Dockerfile` is ready! You can deploy to:
- **Google Cloud Run**
- **AWS ECS**
- **Azure Container Instances**
- **DigitalOcean App Platform**

### Example: Google Cloud Run
```bash
# Build and push
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/ews-kerala-safeai

# Deploy
gcloud run deploy ews-kerala-safeai \
  --image gcr.io/YOUR_PROJECT_ID/ews-kerala-safeai \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 📝 Important Notes

### 1. Environment Variables
**NEVER** commit your `.env` file to GitHub! It's already in `.gitignore`.

### 2. Gmail App Password
For SMTP to work, you need a Gmail **App Password**, not your regular password:
1. Go to https://myaccount.google.com/security
2. Enable 2-Factor Authentication
3. Go to "App passwords"
4. Generate a new app password for "Mail"
5. Use this password in `SMTP_PASS`

### 3. API Keys
Make sure you have valid API keys:
- **OpenWeather**: https://openweathermap.org/api
- **OpenAQ**: https://openaq.org/
- **Twilio**: https://www.twilio.com/

### 4. Database
Your SQLite database (`predictions.db`) will work on most platforms, but for production, consider:
- PostgreSQL (Render provides free PostgreSQL)
- MongoDB Atlas (free tier)

---

## 🔧 Troubleshooting

### Build Fails
- Check `requirements.txt` has all dependencies
- Ensure Python version is 3.11 (specified in Dockerfile)

### App Crashes
- Check logs in your hosting platform dashboard
- Verify all environment variables are set
- Test locally first: `./start.sh`

### API Errors
- Verify API keys are valid
- Check API rate limits
- Ensure you have credits/quota

---

## ✅ Recommended: Render.com

For your project, I **strongly recommend Render.com** because:
1. Your `render.yaml` is already configured
2. Free tier is generous
3. Easy to manage environment variables
4. Automatic deployments from GitHub
5. Great for Python/FastAPI apps

---

## 🎉 After Deployment

Once deployed, your app will be accessible at a public URL like:
- Render: `https://ews-kerala-safeai.onrender.com`
- Railway: `https://ews-kerala-safeai.up.railway.app`
- Heroku: `https://ews-kerala-safeai.herokuapp.com`

Share this URL with anyone to access your EcoGuard AI dashboard!

---

## 📞 Need Help?

If you encounter issues:
1. Check the deployment logs in your platform dashboard
2. Verify all environment variables are set correctly
3. Test the app locally first with `./start.sh`
4. Check that your API keys are valid and have quota

Good luck with your deployment! 🚀
