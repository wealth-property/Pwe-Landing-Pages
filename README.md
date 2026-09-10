# Property Wealth Engineering Landing Pages

Static landing pages for Property Wealth Engineering (PWE) campaigns.

## Pages

- `intensive/index.html` - Private invitation page for the PWE Private Wealth Intensive.
- `webinar/index.html` - Lead page for the free PWE Wealth Gap Session.

## Project Structure

```text
.
├── intensive/
│   └── index.html
├── webinar/
│   └── index.html
└── README.md
```

Each page is self-contained and includes its HTML, CSS, and JavaScript. The pages load the Cormorant Garamond and Inter fonts from Google Fonts.

### Page Assets

- `intensive/sylvia-photo.png` - Sylvia's portrait used in the invitation hero.
- `intensive/home.png` - Residential property image used in the property analysis section.
- `intensive/wealth p.png` - Property wealth image used in the architecture image band.
- `intensive/gap.png` - Wealth gap image used in the architecture image band.
- `webinar/sylvia-photo.png` - Sylvia's portrait used in the webinar hero and host section.
- `webinar/gap.png` - Wealth gap visual used in the diagnostic section.
- `webinar/wealth.png` - Property wealth visual used in the diagnostic section.

## Preview Locally

From the project root, start a local web server:

```powershell
python -m http.server 8000
```

Then open:

- http://localhost:8000/intensive/
- http://localhost:8000/webinar/

You can also open either `index.html` file directly in a browser, although a local server is recommended for testing links and browser behavior consistently.

## Editing

Update the relevant `index.html` file directly. Keep page-specific assets in the same directory as the page that uses them, and test both desktop and mobile layouts after making changes.

## Deployment

Because this is a static site, it can be deployed to GitHub Pages, Netlify, Vercel, or any static hosting service. Configure the host to serve the repository root as the site directory.
