import express from 'express';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

// Load environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env') });

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
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
  },
  apis: ['./api/server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /api/schema:
 *   get:
 *     summary: Get API schema
 *     description: Returns the OpenAPI schema for the API
 *     responses:
 *       200:
 *         description: OpenAPI schema
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
app.get('/api/schema', (req, res) => {
  res.json(swaggerSpec);
});

/**
 * @openapi
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     description: Creates a new task and associates it with people (creating them if they don't exist)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - due_date
 *               - assigned_person_emails
 *             properties:
 *               title:
 *                 type: string
 *                 description: Task title
 *               description:
 *                 type: string
 *                 description: Task description
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, completed]
 *                 default: pending
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *               due_date:
 *                 type: string
 *                 format: date-time
 *               assigned_person_emails:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *     responses:
 *       201:
 *         description: Task created successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
app.post('/api/tasks', async (req, res) => {
  try {
    const taskData = TaskSchema.parse(req.body);
    
    // Get or create people by email
    const personIds = [];
    for (const email of taskData.assigned_person_emails) {
      // Check if person exists
      let { data: person } = await supabase
        .from('persons')
        .select('id')
        .eq('email', email)
        .single();

      if (!person) {
        // Create new person
        const { data: newPerson, error: createError } = await supabase
          .from('persons')
          .insert({
            email,
            name: email.split('@')[0], // Use email username as temporary name
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

    // Create task
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

/**
 * @openapi
 * /api/people:
 *   post:
 *     summary: Create a new person
 *     description: Creates a new person in the system
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - role
 *               - department
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *               department:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               avatar_url:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: Person created successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
app.post('/api/people', async (req, res) => {
  try {
    const personData = PersonSchema.parse(req.body);

    // Check if person exists
    const { data: existing } = await supabase
      .from('persons')
      .select('id')
      .eq('email', personData.email)
      .single();

    if (existing) {
      // Update existing person
      const { data: person, error } = await supabase
        .from('persons')
        .update(personData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      res.json(person);
    } else {
      // Create new person
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`API documentation available at http://localhost:${PORT}/api-docs`);
});