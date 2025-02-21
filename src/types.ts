export interface Person {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  avatar_url?: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  due_date: string;
  assigned_person_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface TaskWithAssignees extends Task {
  assignees: Person[];
}