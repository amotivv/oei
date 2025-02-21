import React, { useState } from 'react';
import { Users, Plus, Pencil, Trash2, AlertCircle, ArrowUpDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sortPersons, type SortOption } from '../lib/personSort';
import type { Person, Task } from '../types';

interface PersonListProps {
  persons: Person[];
  tasks: Task[];
  onSelectPerson: (personId: string) => void;
  selectedPersonIds: string[];
  onPersonsChange: () => void;
}

interface PersonFormData {
  name: string;
  role: string;
  department: string;
  email: string;
  avatar_url?: string;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'smart', label: 'Smart Sort (Priority + Due Date)' },
  { value: 'taskCount', label: 'Most Open Tasks' },
  { value: 'urgency', label: 'Most Urgent Tasks' },
  { value: 'priority', label: 'Highest Priority Tasks' },
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'role', label: 'Role (A-Z)' },
];

export function PersonList({ persons, tasks, onSelectPerson, selectedPersonIds, onPersonsChange }: PersonListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('smart');
  const [formData, setFormData] = useState<PersonFormData>({
    name: '',
    role: '',
    department: '',
    email: '',
    avatar_url: '',
  });

  const sortedPersons = sortPersons(persons, tasks, sortBy);

  const handleOpenForm = (person?: Person) => {
    setError(null);
    if (person) {
      setEditingPerson(person);
      setFormData({
        name: person.name,
        role: person.role,
        department: person.department,
        email: person.email,
        avatar_url: person.avatar_url,
      });
    } else {
      setEditingPerson(null);
      setFormData({
        name: '',
        role: '',
        department: '',
        email: '',
        avatar_url: '',
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      let result;
      
      if (editingPerson) {
        result = await supabase
          .from('persons')
          .update(formData)
          .eq('id', editingPerson.id)
          .select();
      } else {
        result = await supabase
          .from('persons')
          .insert([formData])
          .select();
      }

      if (result.error) {
        console.error('Supabase error:', result.error);
        setError(result.error.message);
        return;
      }

      onPersonsChange();
      setIsFormOpen(false);
    } catch (error) {
      console.error('Error saving person:', error);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleDelete = async (person: Person) => {
    if (confirm(`Are you sure you want to delete ${person.name}?`)) {
      try {
        const { error } = await supabase
          .from('persons')
          .delete()
          .eq('id', person.id);

        if (error) {
          console.error('Supabase delete error:', error);
          setError(error.message);
          return;
        }

        onPersonsChange();
      } catch (error) {
        console.error('Error deleting person:', error);
        setError('An unexpected error occurred while deleting. Please try again.');
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
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-6 p-4">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">People</h2>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/50 rounded-full"
          title="Add a person to organize tasks around"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6 px-4">
        <ArrowUpDown className="w-5 h-5 text-gray-500" />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="flex-1 rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          {sortOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2 p-2">
        {sortedPersons.map((person) => {
          const stats = getPersonStats(person);
          const hasUrgentTasks = stats.overdueTasks.length > 0 || stats.highPriorityTasks.length > 0;
          
          return (
            <div
              key={person.id}
              className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
                selectedPersonIds.includes(person.id)
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 border-2 border-indigo-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-transparent'
              }`}
            >
              <button
                className="flex-1 flex items-start gap-4"
                onClick={() => onSelectPerson(person.id)}
              >
                <div className="relative">
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
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">{person.name}</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{person.role}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{person.department}</p>
                  
                  <div className="mt-2 flex flex-wrap gap-2">
                    {stats.openTasks.length > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200">
                        {stats.openTasks.length} open
                      </span>
                    )}
                    {stats.highPriorityTasks.length > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200">
                        {stats.highPriorityTasks.length} high priority
                      </span>
                    )}
                    {stats.overdueTasks.length > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-200">
                        {stats.overdueTasks.length} overdue
                      </span>
                    )}
                  </div>
                </div>
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenForm(person)}
                  className="p-1.5 text-gray-400 hover:text-indigo-400 hover:bg-indigo-900/50 rounded-full"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(person)}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/50 rounded-full"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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

      {isFormOpen && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-[100]">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {editingPerson ? 'Edit Person' : 'Add Person'}
              </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Add someone you interact with to organize your tasks around them.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-200">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Role</label>
                <input
                  type="text"
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., Client, Team Lead, Friend"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Context</label>
                <input
                  type="text"
                  required
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., Work, Personal, Project X"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Avatar URL (optional)</label>
                <input
                  type="url"
                  value={formData.avatar_url || ''}
                  onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="https://..."
                />
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700"
                >
                  {editingPerson ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
