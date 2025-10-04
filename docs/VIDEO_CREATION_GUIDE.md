# 🎬 Video Creation Guide - Permisos Digitales

## Overview
You have a **professional Remotion setup** ready to create high-quality videos for marketing, tutorials, and social media.

## Available Videos

### 1. **60-Second Promotional Video** (`PromoVideo`)
- Full promotional video with 5 scenes
- Perfect for website, ads, and presentations
- Resolution: 1920x1080 (Full HD)

### 2. **WhatsApp Tutorial** (`WhatsAppTutorial`) 🆕
- 20-second step-by-step guide
- Shows users how to use WhatsApp bot
- Features smooth animations and clear instructions
- Perfect for onboarding new users

### 3. **Social Media Clips** (`SocialMediaClip`) 🆕
- 9-second engaging clips
- Available in 3 formats:
  - **Standard** (1920x1080) - YouTube, Twitter/X
  - **Square** (1080x1080) - Instagram Feed, Facebook
  - **Vertical** (1080x1920) - Stories, Reels, TikTok

## How to Create Videos

### 1. Preview in Remotion Studio
```bash
cd remotion-video
npm start
```
This opens an interactive studio where you can:
- Preview all videos in real-time
- Adjust animations
- Test different scenes

### 2. Quick Render Commands
```bash
cd remotion-video

# Render specific videos
./render-videos.sh whatsapp    # WhatsApp tutorial
./render-videos.sh social      # All social media formats
./render-videos.sh promo       # 60-second promo
./render-videos.sh all         # Everything

# Create GIFs for sharing
./render-videos.sh gif

# Create thumbnails
./render-videos.sh thumbnail
```

### 3. Manual Render Commands
```bash
# High quality MP4
npx remotion render WhatsAppTutorial out/whatsapp-hq.mp4 --codec=h264 --crf=18

# Compressed for web
npx remotion render SocialMediaClip out/social-web.mp4 --codec=h264 --crf=28

# Specific frame range
npx remotion render PromoVideo out/promo-excerpt.mp4 --frames=0-300
```

## Video Content Ideas

### WhatsApp Marketing
1. **Tutorial Series**
   - How to get your permit
   - Payment options explained
   - Document requirements

2. **Success Stories**
   - Customer testimonials
   - Before/after scenarios
   - Time saved statistics

### Social Media Content
1. **Quick Tips**
   - "Did you know?" series
   - Common mistakes to avoid
   - Benefits highlights

2. **Seasonal Campaigns**
   - Holiday permit reminders
   - Back-to-school campaigns
   - Weekend special offers

### Educational Content
1. **Process Explainers**
   - Step-by-step guides
   - FAQ videos
   - Troubleshooting tips

## Customization Guide

### Changing Colors
Edit brand colors in compositions:
```typescript
// Brand colors
const BRAND_RED = '#B5384D';
const WHATSAPP_GREEN = '#25D366';
const DARK_GREEN = '#128C7E';
```

### Updating Text
All text is in the component files:
- `/remotion-video/src/compositions/WhatsAppTutorial.tsx`
- `/remotion-video/src/compositions/SocialMediaClip.tsx`

### Adding New Scenes
1. Create new component in `/compositions`
2. Import in `Root.tsx`
3. Add Composition entry

## Best Practices

### For WhatsApp
- Keep videos under 30 seconds
- Use clear, large text
- Include phone number prominently
- Add captions for silent viewing

### For Social Media
- First 3 seconds are crucial
- Use eye-catching animations
- Include clear CTA
- Optimize for mobile viewing

### Technical Tips
- Use `--crf=18` for high quality
- Use `--crf=28` for web/social media
- Export GIFs at 480p for smaller files
- Create thumbnails at peak action moments

## Publishing Checklist

- [ ] Render in appropriate format
- [ ] Check video quality
- [ ] Verify text is readable on mobile
- [ ] Test with sound off
- [ ] Create engaging thumbnail
- [ ] Write compelling caption
- [ ] Include relevant hashtags
- [ ] Add WhatsApp number in description

## Video Specifications

| Platform | Resolution | Aspect Ratio | Max Duration | File Size |
|----------|------------|--------------|--------------|-----------|
| WhatsApp | 1920x1080 | 16:9 | 3 min | 16MB |
| Instagram Feed | 1080x1080 | 1:1 | 60 sec | 100MB |
| Instagram Stories | 1080x1920 | 9:16 | 15 sec | 100MB |
| TikTok | 1080x1920 | 9:16 | 3 min | 287MB |
| Twitter/X | 1920x1080 | 16:9 | 2:20 | 512MB |
| Facebook | 1920x1080 | 16:9 | 240 min | 10GB |

## Troubleshooting

### "Chrome not found" error
```bash
# Install Chrome dependencies
cd remotion-video
./install-chrome-deps.sh
```

### Slow rendering
- Close other applications
- Use `--concurrency=1` for stability
- Render at lower resolution first

### Out of memory
- Render in segments
- Reduce video dimensions
- Close browser tabs

## Next Steps

1. **Create a content calendar** - Plan weekly video releases
2. **A/B test different styles** - Track engagement metrics
3. **Build video templates** - Reusable components for quick creation
4. **Automate rendering** - Set up CI/CD for video generation

Your video infrastructure is ready for professional content creation! 🎉