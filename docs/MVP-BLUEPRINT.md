# MVP Technical Blueprint

Social Media Growth Analytics Platform
Apify + Claude + n8n — Full Product Architecture

# Product Concept

A SaaS platform where users connect their Instagram and TikTok accounts, add competitor profiles, and receive automated data-driven insights, content recommendations, and growth tracking through a visual dashboard.
## Core User Flow
User signs up and enters their IG/TikTok profile URLs
User adds 5–10 competitor or aspirational profile URLs
System automatically scrapes all profiles via Apify
Claude API analyzes the data and generates insights
User sees a dashboard with metrics, trends, and recommendations
System re-scrapes weekly and updates insights automatically
## Key Features (MVP)
Profile analytics: engagement rate, growth trend, content mix breakdown
Competitor benchmarking: side-by-side comparison with rival accounts
AI-powered recommendations: what to post, when, which formats, which hashtags
Trend detection: emerging hashtags, sounds, and content themes in the user’s niche
30-day content calendar: auto-generated, data-backed posting schedule
# System Architecture

## High-Level Architecture
The system has four layers: the frontend dashboard, the backend API, the n8n automation engine, and external services (Apify + Claude API).

## Recommended Tech Stack
# Database Schema

Core tables needed for the MVP. All timestamps in UTC.

# n8n Workflow Design

You need three core n8n workflows. Each is triggered differently and handles a distinct part of the pipeline.
## Workflow 1: Scrape Pipeline
**Trigger:** Cron schedule (weekly) OR webhook from your backend when a user adds a new profile

## Workflow 2: AI Analysis Pipeline
**Trigger:** Webhook from Workflow 1 (scrape complete) OR on-demand from dashboard

## Workflow 3: Trend Monitor
**Trigger:** Daily cron (runs every 24h)

# Claude API Integration

The key to getting structured, parseable output from Claude is a well-designed system prompt and asking for JSON responses.
## System Prompt Template

## Cost Estimation
*At 1,000 active users running weekly analysis, Claude API costs would be roughly $180/month — easily covered by even the lowest subscription tier.*

# Dashboard Design

The dashboard is the product. It needs to make complex data feel simple and actionable. Here are the core views:
## Dashboard Pages
## Key UI Components
Metric cards: follower count, engagement rate, posts this week — each with a trend arrow (up/down %)
Engagement heatmap: 7 × 24 grid showing best posting times
Content mix donut chart: % reels vs. carousels vs. images vs. TikTok
Recommendation cards: category icon + title + description + priority badge
Competitor comparison radar chart: engagement, frequency, growth, hashtag diversity
# Pricing & Monetization

# Phased Build Plan

## Phase 1: Core MVP (Weeks 1–2)
Auth system (NextAuth + Google/email sign-in)
Database setup (Supabase + Prisma schema)
Profile management UI (add/remove profiles)
n8n Workflow 1: basic scrape pipeline for Instagram
Raw data display in dashboard (table of posts + metrics)
## Phase 2: AI Analysis (Weeks 3–4)
n8n Workflow 2: Claude analysis pipeline
Dashboard charts: engagement trends, content mix, heatmap
Recommendation engine + display
Competitor comparison view
Add TikTok scraping support
## Phase 3: Growth Features (Weeks 5–6)
30-day content calendar (AI-generated)
n8n Workflow 3: trend monitoring
Email notifications (weekly digest)
Stripe integration for subscriptions
Landing page with waitlist/signup
## Phase 4: Scale (Post-Launch)
Add YouTube, X/Twitter support
Team/agency features (multiple users per account)
API access for power users
White-label option for agencies
Mobile app (React Native)

# Risks & Mitigations

# Your Immediate Next Steps

Set up the project repo: npx create-next-app@latest with TypeScript + Tailwind
Create a Supabase project and configure the Prisma schema from Section 3
Sign up for Apify and get your API token from Settings → Integrations
Get a Claude API key from console.anthropic.com
Deploy n8n on Railway (one-click Docker template)
Build Workflow 1 in n8n (start with just Instagram scraping)
Build the basic dashboard with hardcoded data first, then connect to real data
Integrate Claude API analysis and display results
