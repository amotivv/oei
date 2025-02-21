import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Validation schemas
const PersonSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  department: z.string().min(1),
  email: z.string().email(),
  avatar_url: z.string().url().optional(),
});

const TaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).default('pending'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  due_date: z.string().datetime(),
  assigned_person_emails: z.array(z.string().email()),
});

// OpenAPI specification
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Task Manager API',
      version: '1.0.0',
      description: 'API for creating tasks and managing people in the task management system',
    },
    servers: [
      {
        url: '/.netlify/functions/api',
        description: 'Production server',
      },
    ],
  },
  apis: ['netlify/functions/api.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.get('/api/schema', (req, res) => {
  res.json(swaggerSpec);
});

app.post('/api/tasks', async (req, res) => {
  try {
    const taskData = TaskSchema.parse(req.body);
    
    // Get or create people by email
    const personIds = [];
    for (const email of taskData.assigned_person_emails) {
      let { data: person } = await supabase
        .from('persons')
        .select('id')
        .eq('email', email)
        .single();

      if (!person) {
        const { data: newPerson, error: createError } = await supabase
          .from('persons')
          .insert({
            email,
            name: email.split('@')[0],
            role: 'Auto-created',
            department: 'Imported',
          })
          .select('id')
          .single();

        if (createError) throw createError;
        person = newPerson;
      }

      personIds.push(person.id);
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        priority: taskData.priority,
        due_date: taskData.due_date,
        assigned_person_ids: personIds,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error('API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.post('/api/people', async (req, res) => {
  try {
    const personData = PersonSchema.parse(req.body);

    const { data: existing } = await supabase
      .from('persons')
      .select('id')
      .eq('email', personData.email)
      .single();

    if (existing) {
      const { data: person, error } = await supabase
        .from('persons')
        .update(personData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      res.json(person);
    } else {
      const { data: person, error } = await supabase
        .from('persons')
        .insert(personData)
        .select()
        .single();

      if (error) throw error;
      res.status(201).json(person);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error('API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Export the serverless function
export const handler = serverless(app);