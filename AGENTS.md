# Meta Ship Rate

You are working on a project that compares the rate of "meta posts" to "project ships" for some events. Meta post amount is obtained by searching slack for messages in channel id "C0188CY57PZ" for messages containing the name of the event. Only include root posts, do not include posts in threads

Project names and ships counts can be obtained from https://api2.hackclub.com/v0.1/Unified%20YSWS%20Projects%20DB/YSWS%20Programs/. Here is what an example looks like: (2 programs, but the real thing has hundreds)

```json
[{"id":"rec06Z5m1dWOWcW5g","fields":{"Name":"Waffles","Unweighted–Total":47}},
{"id":"rec09TOqfk7JuJ0jt","fields":{"Name":"Iframe","Unweighted–Total":17}}]
```

# Tech Stack

- **Framework**: Express.js with Nunjucks templating
- **Database**: PostgreSQL with Knex.js migrations
- **Authentication**: Hack Club OAuth 2.0 (auth.hackclub.com)
- **Session Management**: express-session with PostgreSQL storage (connect-pg-simple)
- **Development**: Nodemon for live reload

# Project Structure

```
src/
  ├── index.js                 # Main Express app, middleware, routes setup
  ├── slackbot.js              # Slack API integration for searching meta posts
  ├── unified.js               # Hack Club Unified API client for fetching programs/ships
  ├── db/
  │   ├── index.js             # Knex database initialization
  │   └── migrations/          # Database migrations
  ├── routes/
  │   └── auth.js              # OAuth login/callback/logout routes
  ├── views/                   # Nunjucks templates
  │   ├── base.njk             # Base template
  │   ├── index.njk            # Home page
  │   ├── login.njk            # Login page
  │   └── macros/
  │       └── themeSwitcher.njk # Theme switcher component
  ├── public/
  │   ├── css/
  │   │   └── style.css        # Main styles (uses Catppuccin colors)
  │   └── js/
  │       └── theme.js         # Theme switching logic
```

# Core Modules

## slackbot.js
Searches Slack for meta posts in channel `C0188CY57PZ`. Exports:
- `search(programName)` - Returns `{ programName, metaPostCount, posts }` (filters to root posts only)

Requires `SLACK_TOKEN` environment variable.

## unified.js
Fetches YSWS program data from Hack Club's Unified API. Exports:
- `getEvents()` - Returns array of program names
- `getShips(eventName)` - Returns ship count (`Unweighted–Total`) for a program

# Environment Variables

Required in .env:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret key for session encryption
- `HACKCLUB_CLIENT_ID` - Hack Club OAuth client ID
- `HACKCLUB_CLIENT_SECRET` - Hack Club OAuth client secret
- `BASE_URL` - Application base URL (e.g., http://localhost:3000)
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)

# Key Features

1. **Authentication**: Hack Club OAuth 2.0 integration with token management
2. **Session Management**: Server-side sessions stored in PostgreSQL
3. **User Tracking**: Stores user info (Hack Club ID, email, access tokens) in database
4. **Rate Limiting**: Built-in rate limiter (10 requests per second)
5. **Template System**: Nunjucks with reusable macros and layouts

# Commands

- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm run migrate` - Run pending Knex migrations
- `npm run migrate:rollback` - Rollback last migration

Note: npm run dev and npm start both start servers that will continue running in the background, so you should not use them. Use node --check to check syntax.

# Styling

Styling is defined at [src/public/css/style.css](file:///src/public/css/style.css). Uses Catppuccin Mocha color scheme:
- Use `ctp-base` for the base background
- Use `ctp-text` for text color
- Use `ctp-rosewater` for accent elements like buttons