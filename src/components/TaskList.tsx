import React, { useState } from 'react';
import { Calendar, Clock, AlertCircle, Filter, Search, CheckCircle2, Circle, ArrowUpCircle, ChevronDown, Loader2 } from 'lucide-react';
import { format, isAfter, isBefore, startOfToday } from 'date-fns';
import { supabase } from '../lib/supabase';
import type { TaskWithAssignees, Task } from '../types';

interface TaskListProps {
  tasks: TaskWithAssignees[];
  onEditTask: (task: TaskWithAssignees) => void;
}

const priorityConfig = {
  low: {
    color: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
    label: 'Low Priority'
  },
  medium: {
    color: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200',
    label: 'Medium Priority'
  },
  high: {
    color: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
    label: 'High Priority'
  }
};

const statusConfig = {
  pending: {
    color: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    icon: Circle,
    label: 'To Do',
    next: 'in_progress'
  },
  in_progress: {
    color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
    icon: ArrowUpCircle,
    label: 'In Progress',
    next: 'completed'
  },
  completed: {
    color: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200',
    icon: CheckCircle2,
    label: 'Completed',
    next: 'pending'
  }
};

export function TaskList({ tasks, onEditTask }: TaskListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = startOfToday();

  const filteredTasks = tasks.filter(task => {
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignees.some(person => person.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const handleStatusClick = async (e: React.MouseEvent, task: TaskWithAssignees) => {
    e.stopPropagation();
    if (updatingTaskId) return;

    setError(null);
    setUpdatingTaskId(task.id);
    const nextStatus = statusConfig[task.status].next as Task['status'];

    // Optimistically update UI
    onEditTask({
      ...task,
      status: nextStatus
    });

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: nextStatus })
        .eq('id', task.id);

      if (error) {
        setError('Failed to update task status. Please try again.');
        // Revert optimistic update
        onEditTask(task);
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
      // Revert optimistic update
      onEditTask(task);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Mobile Filters */}
      <div className="lg:hidden p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="mt-3 w-full flex items-center justify-between px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200"
        >
          <span className="flex items-center">
            <Filter className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" />
            {statusFilter === 'all' ? 'All Status' : statusConfig[statusFilter as keyof typeof statusConfig].label}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transform transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
        </button>
        {isFilterOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 rounded-md shadow-lg border border-gray-200 dark:border-gray-600">
            <div className="py-1">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setIsFilterOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                All Status
              </button>
              {Object.entries(statusConfig).map(([value, { label }]) => (
                <button
                  key={value}
                  onClick={() => {
                    setStatusFilter(value);
                    setIsFilterOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Filters */}
      <div className="hidden lg:block p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tasks</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="all">All Status</option>
                <option value="pending">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {sortedTasks.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No tasks found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery
                ? "No tasks match your search criteria"
                : statusFilter !== 'all'
                ? `No ${statusFilter.replace('_', ' ')} tasks`
                : "You're all caught up! Add a new task to get started."}
            </p>
          </div>
        ) : (
          sortedTasks.map((task) => {
            const dueDate = new Date(task.due_date);
            const isOverdue = isBefore(dueDate, today) && task.status !== 'completed';
            const isDueSoon = !isOverdue && isBefore(dueDate, new Date(today.getTime() + 24 * 60 * 60 * 1000));
            const isUpdating = updatingTaskId === task.id;
            
            const StatusIcon = statusConfig[task.status].icon;

            return (
              <div
                key={task.id}
                className={`p-4 lg:p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  task.status === 'completed' ? 'opacity-75' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={(e) => handleStatusClick(e, task)}
                    disabled={isUpdating}
                    className={`p-2 rounded-full ${statusConfig[task.status].color} transition-opacity ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                    title={`Click to mark as ${statusConfig[task.status].next.replace('_', ' ')}`}
                  >
                    {isUpdating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <StatusIcon className="w-5 h-5" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0" onClick={() => onEditTask(task)}>
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-2 lg:gap-4">
                      <h3 className={`text-base font-semibold break-words ${
                        task.status === 'completed' 
                          ? 'text-gray-500 dark:text-gray-400 line-through' 
                          : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {task.title}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityConfig[task.priority].color}`}>
                          {priorityConfig[task.priority].label}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig[task.status].color}`}>
                          {statusConfig[task.status].label}
                        </span>
                      </div>
                    </div>
                    
                    {task.description && (
                      <p className={`mt-2 text-sm break-words ${
                        task.status === 'completed' 
                          ? 'text-gray-400 dark:text-gray-500' 
                          : 'text-gray-600 dark:text-gray-300'
                      }`}>
                        {task.description}
                      </p>
                    )}
                    
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                      <div className={`flex items-center gap-1 ${
                        isOverdue 
                          ? 'text-red-600 dark:text-red-400' 
                          : isDueSoon 
                          ? 'text-yellow-600 dark:text-yellow-400' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span>{format(dueDate, 'MMM d, yyyy')}</span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>{format(dueDate, 'h:mm a')}</span>
                      </div>
                      
                      {isOverdue && (
                        <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>Overdue</span>
                        </div>
                      )}
                      {isDueSoon && !isOverdue && (
                        <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>Due soon</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {task.assignees.map((person) => (
                          <img
                            key={person.id}
                            className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800"
                            src={person.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&background=random`}
                            alt={person.name}
                            title={person.name}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {task.assignees.length === 1
                          ? task.assignees[0].name
                          : `${task.assignees.length} people`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
