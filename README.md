# RAFI AI Dashboard

A futuristic AI dashboard built with React + Vite for chat, voice synthesis, image generation, calculator, task management, and code output.

## Features
- Chat with Gemini API
- Optional n8n webhook integration
- Voice output in Bengali/English
- AI image generation
- Calculator panel
- Quick task manager
- Code copy assistant
- Local settings persistence

## Local development

```bash
npm install
npm run dev
```

Then open the Vite app in the browser.

## Deployment
This app is static frontend friendly and can be deployed to:
- Firebase Hosting
- Google Cloud Storage
- Netlify
- Vercel

For Firebase Hosting:

```bash
npm run build
firebase init hosting
firebase deploy
```

## API setup
Enter your Gemini API key in the Settings modal. You can also set a webhook URL for n8n.

## Notes
- The app stores the API key in localStorage in the browser.
- For production deployment, prefer a backend proxy if you want to hide the API key.
