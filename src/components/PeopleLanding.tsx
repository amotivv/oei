import React from 'react';
import { Users, X as CloseIcon, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { sortPersons } from '../lib/personSort';
import type { Person, Task } from '../types';

interface PeopleLandingProps {
  persons: Person[];
  tasks: Task[];
  onSelectPerson: (personId: string) => void;
  onClose: () => void;
}

export function PeopleLanding({ persons, tasks, onSelectPerson, onClose }: PeopleLandingProps) {
  const getPersonStats = (person: Person) => {
    const personTasks = tasks.filter(task => 
      task.assigned_person_ids.includes(person.id) &&
      task.status !== 'completed'
    );
    
    const highPriorityTasks = personTasks.filter(task => task.priority === 'high');
    const overdueTasks = personTasks.filter(task => new Date(task.due_date) < new Date());
    const nextDeadline = personTasks.length > 0
      ? new Date(Math.min(...personTasks.map(t => new Date(t.due_date).getTime())))
      : null;

    return {
      openTasks: personTasks,
      highPriorityTasks,
      overdueTasks,
      nextDeadline
    };
  };

  // Sort persons by urgency using our smart sorting algorithm
  const sortedPersons = sortPersons(persons, tasks, 'smart');

  return (
    <div className="fixed inset-0 bg-gray-100/95 dark:bg-gray-900/95 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Your People</h1>
              <p className="text-gray-600 dark:text-gray-300">Select a person to view their tasks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 rounded-full hover:bg-white dark:hover:bg-gray-800"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPersons.map(person => {
            const stats = getPersonStats(person);
            const hasUrgentTasks = stats.overdueTasks.length > 0 || stats.highPriorityTasks.length > 0;
            
            return (
              <button
                key={person.id}
                onClick={() => {
                  onSelectPerson(person.id);
                  onClose();
                }}
                className={`group relative block text-left p-6 rounded-xl shadow-sm transition-all duration-200 ${
                  hasUrgentTasks 
                    ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800'
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <img
                      src={person.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&background=random`}
                      alt={person.name}
                      className={`w-16 h-16 rounded-full ring-4 ${
                        hasUrgentTasks 
                          ? 'ring-amber-200 dark:ring-amber-800' 
                          : 'ring-gray-100 dark:ring-gray-700'
                      }`}
                    />
                    {stats.openTasks.length > 0 && (
                      <div className={`absolute -right-1 -bottom-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white ${
                        hasUrgentTasks 
                          ? 'bg-amber-500 dark:bg-amber-600' 
                          : 'bg-indigo-500 dark:bg-indigo-600'
                      }`}>
                        {stats.openTasks.length}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{person.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{person.role}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{person.department}</p>
                    
                    {stats.nextDeadline && (
                      <div className="mt-3 flex items-center gap-1.5 text-sm">
                        <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-300">
                          Next due: {format(stats.nextDeadline, "MMM d 'at' h:mm a")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {(stats.overdueTasks.length > 0 || stats.highPriorityTasks.length > 0) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {stats.overdueTasks.length > 0 && (
                      <div className="flex items-center gap-1 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full">
                        <AlertCircle className="w-4 h-4" />
                        <span>{stats.overdueTasks.length} overdue</span>
                      </div>
                    )}
                    {stats.highPriorityTasks.length > 0 && (
                      <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
                        {stats.highPriorityTasks.length} high priority
                      </div>
                    )}
                  </div>
                )}

                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 opacity-0 transform translate-x-4 transition-all group-hover:opacity-100 group-hover:translate-x-0">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}