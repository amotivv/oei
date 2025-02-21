import { differenceInDays, isPast, isWithinInterval, subDays } from 'date-fns';
import type { Person, Task } from '../types';

// Calculate person's priority score based on their tasks
export function calculatePersonScore(person: Person, tasks: Task[]) {
  const personTasks = tasks.filter(task => 
    task.assigned_person_ids.includes(person.id) && 
    task.status !== 'completed'
  );

  if (personTasks.length === 0) return 0;

  let score = 0;
  const today = new Date();

  // First, check for overdue tasks - these should heavily influence the score
  const overdueTasks = personTasks.filter(task => isPast(new Date(task.due_date)));
  if (overdueTasks.length > 0) {
    // Add a large base score for having any overdue tasks
    score += 1000;
    // Add additional score based on how many overdue tasks and how overdue they are
    overdueTasks.forEach(task => {
      const daysOverdue = Math.abs(differenceInDays(new Date(task.due_date), today));
      score += 100 * Math.min(daysOverdue, 10); // Cap at 10 days to avoid extreme scores
    });
  }

  // Then check for high priority tasks
  const highPriorityTasks = personTasks.filter(task => task.priority === 'high');
  if (highPriorityTasks.length > 0) {
    // Add significant score for high priority tasks
    score += 500 * highPriorityTasks.length;
  }

  // Process remaining tasks
  personTasks.forEach(task => {
    // Skip overdue tasks as they've already been counted
    if (!isPast(new Date(task.due_date))) {
      const priorityWeight = {
        high: 50,  // Increased weights
        medium: 20,
        low: 5
      }[task.priority];

      const dueDate = new Date(task.due_date);
      let dateWeight = 1;
      
      const daysUntilDue = differenceInDays(dueDate, today);
      if (daysUntilDue <= 1) dateWeight = 5;
      else if (daysUntilDue <= 3) dateWeight = 3;
      else if (daysUntilDue <= 7) dateWeight = 2;

      score += priorityWeight * dateWeight;
    }
  });

  // Apply a multiplier based on total task count, but with diminishing returns
  return score * (1 + Math.log2(personTasks.length + 1) * 0.2);
}

export type SortOption = 
  | 'smart'
  | 'taskCount'
  | 'urgency'
  | 'priority'
  | 'name'
  | 'role';

export function sortPersons(persons: Person[], tasks: Task[], sortBy: SortOption): Person[] {
  const personScores = new Map(
    persons.map(person => [person.id, calculatePersonScore(person, tasks)])
  );

  const getOpenTasks = (person: Person) => 
    tasks.filter(task => 
      task.assigned_person_ids.includes(person.id) && 
      task.status !== 'completed'
    );

  const getHighestPriority = (tasks: Task[]) => {
    const priorities = { high: 2, medium: 1, low: 0 };
    return Math.max(...tasks.map(t => priorities[t.priority]), 0);
  };

  const getEarliestDueDate = (tasks: Task[]) => {
    if (tasks.length === 0) return new Date(9999, 11, 31);
    return new Date(Math.min(...tasks.map(t => new Date(t.due_date).getTime())));
  };

  return [...persons].sort((a, b) => {
    switch (sortBy) {
      case 'smart': {
        const scoreA = personScores.get(a.id)!;
        const scoreB = personScores.get(b.id)!;
        return scoreB - scoreA;
      }

      case 'taskCount': {
        const aCount = getOpenTasks(a).length;
        const bCount = getOpenTasks(b).length;
        return bCount - aCount;
      }

      case 'urgency': {
        const aDate = getEarliestDueDate(getOpenTasks(a));
        const bDate = getEarliestDueDate(getOpenTasks(b));
        return aDate.getTime() - bDate.getTime();
      }

      case 'priority': {
        const aPriority = getHighestPriority(getOpenTasks(a));
        const bPriority = getHighestPriority(getOpenTasks(b));
        if (bPriority !== aPriority) {
          return bPriority - aPriority;
        }
        // If priorities are equal, sort by due date
        const aDate = getEarliestDueDate(getOpenTasks(a));
        const bDate = getEarliestDueDate(getOpenTasks(b));
        return aDate.getTime() - bDate.getTime();
      }

      case 'name':
        return a.name.localeCompare(b.name);

      case 'role':
        return a.role.localeCompare(b.role);

      default:
        return 0;
    }
  });
}