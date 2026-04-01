# Hugo Portfolio Site

## Quick Start

1. Install Hugo: https://gohugo.io/installation/

   ```bash
   # macOS
   brew install hugo
   ```

2. Run the development server:
   ```bash
   cd hugo-site
   hugo server -D
   ```

3. Open http://localhost:1313 in your browser

## Build for Production

```bash
hugo --minify
```

Output will be in the `public/` directory.

## Project Structure

```
hugo-site/
├── config.toml          # Site configuration
├── content/
│   ├── blog/            # Blog posts (markdown)
│   ├── projects/        # Project pages (markdown)
│   └── experience/      # Experience section
├── data/                # JSON data files
│   ├── certifications.json
│   ├── education.json
│   ├── experience.json
│   └── skills.json
├── static/
│   ├── images/          # Avatar and images
│   └── files/           # CV and downloadable files
└── themes/portfolio/    # Custom theme
```

## Adding Content

### New Blog Post
```bash
hugo new blog/my-new-post.md
```

### New Project
```bash
hugo new projects/my-project.md
```

## Deployment

Works with any static hosting:
- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront
