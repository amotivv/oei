# People-Based Task Manager

A personal task manager that organizes tasks by the people they affect. Built with React, TypeScript, Vite, and Supabase for all the overwhelmed introverts.

## Features

- Associate tasks with people they impact
- Track task status and priorities
- Dark mode support
- Responsive design
- Authentication via Supabase

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example` and add your Supabase credentials:
```
VITE_SUPABASE_URL=your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Run development server:
```bash
npm run dev
```

## Production Build

```bash
npm run build
npm run preview  # Preview production build locally
```

## Deployment

This project is configured for deployment on Netlify:

1. Connect your GitHub repository to Netlify
2. Add the following environment variables in Netlify:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy using the default settings (build command: `npm run build`, publish directory: `dist`)

## License

MIT
