#!/bin/bash

# 🚀 Push to GitHub using Personal Access Token

echo "======================================"
echo "🔐 GitHub Push Helper"
echo "======================================"
echo ""
echo "To push your code, you need a GitHub Personal Access Token."
echo ""
echo "📝 Steps to get your token:"
echo "1. Go to: https://github.com/settings/tokens"
echo "2. Click 'Generate new token (classic)'"
echo "3. Give it a name: 'EcoGuard AI Deploy'"
echo "4. Select scopes: ✅ repo (all)"
echo "5. Click 'Generate token'"
echo "6. COPY the token (you won't see it again!)"
echo ""
echo "======================================"
echo ""
read -p "Enter your GitHub Personal Access Token: " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
    echo "❌ No token provided. Exiting."
    exit 1
fi

echo "📤 Pushing to GitHub..."
git push https://$TOKEN@github.com/jeevanelias1-source/EcoGuard-AI.git main

if [ $? -eq 0 ]; then
    echo ""
    echo "======================================"
    echo "✅ Successfully pushed to GitHub!"
    echo "======================================"
    echo ""
    echo "🎯 Next step: Deploy to Render.com"
    echo ""
    echo "1. Go to: https://render.com"
    echo "2. Sign up/Login with GitHub"
    echo "3. Click 'New +' → 'Web Service'"
    echo "4. Select: jeevanelias1-source/EcoGuard-AI"
    echo "5. Add environment variables"
    echo "6. Deploy!"
    echo ""
else
    echo ""
    echo "❌ Push failed. Please check:"
    echo "- Token has 'repo' permissions"
    echo "- You're using the correct token"
    echo "- Repository exists: jeevanelias1-source/EcoGuard-AI"
    echo ""
fi
