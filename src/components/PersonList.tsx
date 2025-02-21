import React, { useState } from 'react';
import { Users, Plus, Pencil, Trash2, AlertCircle, ArrowUpDown, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sortPersons, type SortOption } from '../lib/personSort';
import type { Person, Task } from '../types';

interface PersonListProps {
  persons: Person[];
  tasks: Task[];
  onSelectPerson: (personId: string) => void;
  selectedPersonIds: string[];
  onPersonsChange: (updatedPersons?: Person[]) => void;
  onOpenPersonForm: (person?: Person) => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'smart', label: 'Smart Sort (Priority + Due Date)' },
  { value: 'taskCount', label: 'Most Open Tasks' },
  { value: 'urgency', label: 'Most Urgent Tasks' },
  { value: 'priority', label: 'Highest Priority Tasks' },
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'role', label: 'Role (A-Z)' },
];

export function PersonList({ persons, tasks, onSelectPerson, selectedPersonIds, onPersonsChange, onOpenPersonForm }: PersonListProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('smart');

  const sortedPersons = sortPersons(persons, tasks, sortBy);

  const handleDelete = async (person: Person) => {
    if (confirm(`Are you sure you want to delete ${person.name}?`)) {
      setIsDeletingId(person.id);
      
      // Optimistically update UI
      const updatedPersons = persons.filter(p => p.id !== person.id);
      onPersonsChange(updatedPersons);

      try {
        const { error } = await supabase
          .from('persons')
          .delete()
          .eq('id', person.id);

        if (error) {
          // Revert optimistic update
          onPersonsChange();
          setError(error.message);
          console.error('Supabase delete error:', error);
          return;
        }
      } catch (error) {
        // Revert optimistic update
        onPersonsChange();
        console.error('Error deleting person:', error);
        setError('An unexpected error occurred while deleting. Please try again.');
      } finally {
        setIsDeletingId(null);
      }
    }
  };

  const getPersonStats = (person: Person) => {
    const personTasks = tasks.filter(task => 
      task.assigned_person_ids.includes(person.id)
    );
    const openTasks = personTasks.filter(task => task.status !== 'completed');
    const highPriorityTasks = openTasks.filter(task => task.priority === 'high');
    const overdueTasks = openTasks.filter(task => new Date(task.due_date) < new Date());

    return { openTasks, highPriorityTasks, overdueTasks };
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-gray-400 dark:text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">People</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => onOpenPersonForm()}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full"
              title="Add a person to organize tasks around"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {sortedPersons.map((person) => {
          const stats = getPersonStats(person);
          const hasUrgentTasks = stats.overdueTasks.length > 0 || stats.highPriorityTasks.length > 0;
          const isDeleting = isDeletingId === person.id;
          
          return (
            <div
              key={person.id}
              className={`p-4 lg:p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                selectedPersonIds.includes(person.id)
                  ? 'bg-indigo-50 dark:bg-indigo-900/30'
                  : ''
              } ${isDeleting ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  <img
                    src={person.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&background=random`}
                    alt={person.name}
                    className="w-12 h-12 rounded-full"
                  />
                  {stats.openTasks.length > 0 && (
                    <div className={`absolute -right-1 -bottom-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white ${
                      hasUrgentTasks 
                        ? 'bg-amber-500' 
                        : 'bg-indigo-500'
                    }`}>
                      {stats.openTasks.length}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onSelectPerson(person.id)}
                    disabled={isDeleting}
                    className="font-medium text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    {person.name}
                  </button>
                  {person.role && person.role !== person.department && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{person.role}</p>
                  )}
                  {person.department && (
                    <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{person.department}</p>
                  )}
                  
                  <div className="mt-2 flex flex-wrap gap-2">
                    {stats.openTasks.length > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                        {stats.openTasks.length} open
                      </span>
                    )}
                    {stats.highPriorityTasks.length > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                        {stats.highPriorityTasks.length} high priority
                      </span>
                    )}
                    {stats.overdueTasks.length > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                        {stats.overdueTasks.length} overdue
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => onOpenPersonForm(person)}
                    disabled={isDeleting}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(person)}
                    disabled={isDeleting}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {persons.length === 0 && (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            <p>Add people you interact with to organize your tasks around them.</p>
          </div>
        )}
      </div>

    </div>
  );
}
