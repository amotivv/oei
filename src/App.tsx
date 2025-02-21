import React, { useEffect, useState } from 'react';
import { Plus, LogOut, Menu, X as CloseIcon, Filter, Search, Users, AlertCircle } from 'lucide-react';
import { PersonForm } from './components/PersonForm';
import { PersonList } from './components/PersonList';
import { TaskList } from './components/TaskList';
import { TaskForm } from './components/TaskForm';
import { AuthForm } from './components/AuthForm';
import { PeopleLanding } from './components/PeopleLanding';
import { ThemeToggle } from './components/ThemeToggle';
import { supabase } from './lib/supabase';
import { signOut, getUser } from './lib/auth';
import type { Person, Task, TaskWithAssignees } from './types';

function App() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<TaskWithAssignees[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithAssignees | undefined>();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPersons, setIsLoadingPersons] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showPeopleLanding, setShowPeopleLanding] = useState(true);
  const [isPersonFormOpen, setIsPersonFormOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  useEffect(() => {
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchPersons();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && persons.length > 0) {
      fetchTasks();
    }
  }, [persons]);

  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isSidebarOpen]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await getUser();
      setUser(user);
      if (user) {
        await fetchPersons();
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPersonForm = (person?: Person) => {
    setEditingPerson(person || null);
    setIsPersonFormOpen(true);
  };

  const handleSubmitPerson = async (personData: Partial<Person>) => {
    setError(null);

    // Optimistically update UI
    const optimisticPersons = [...persons];
    if (editingPerson) {
      const index = optimisticPersons.findIndex(p => p.id === editingPerson.id);
      if (index !== -1) {
        optimisticPersons[index] = { ...editingPerson, ...personData };
      }
    } else {
      const tempId = `temp-${Date.now()}`;
      optimisticPersons.push({ id: tempId, ...personData } as Person);
    }
    fetchPersons(optimisticPersons);

    try {
      let result;
      
      if (editingPerson) {
        result = await supabase
          .from('persons')
          .update(personData)
          .eq('id', editingPerson.id)
          .select();
      } else {
        result = await supabase
          .from('persons')
          .insert([personData])
          .select();
      }

      if (result.error) {
        setError('Failed to save person. Please try again.');
        console.error('Supabase error:', result.error);
        // Revert optimistic update
        fetchPersons();
        return;
      }

      // Refresh to ensure consistency
      fetchPersons();
      setEditingPerson(null);
      setIsPersonFormOpen(false);
    } catch (err) {
      setError('Network error. Please check your connection.');
      console.error('Error saving person:', err);
      // Revert optimistic update
      fetchPersons();
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (!error) {
      setPersons([]);
      setTasks([]);
      setUser(null);
    }
  };

  const fetchPersons = async (optimisticUpdate?: Person[]) => {
    if (optimisticUpdate) {
      setPersons(optimisticUpdate);
      return;
    }

    setIsLoadingPersons(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('persons')
        .select('*')
        .order('name');
      
      if (error) {
        setError('Failed to load people. Please try again.');
        console.error('Error fetching persons:', error);
        return;
      }
      
      setPersons(data);
    } catch (err) {
      setError('Network error. Please check your connection.');
      console.error('Error fetching persons:', err);
    } finally {
      setIsLoadingPersons(false);
    }
  };

  const fetchTasks = async () => {
    setIsLoadingTasks(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date');
      
      if (error) {
        setError('Failed to load tasks. Please try again.');
        console.error('Error fetching tasks:', error);
        return;
      }
      
      const tasksWithAssignees = data.map((task: Task) => {
        const taskAssignees = persons.filter(person => 
          task.assigned_person_ids.includes(person.id)
        );
        
        return {
          ...task,
          assignees: taskAssignees,
        };
      });
      
      setTasks(tasksWithAssignees);
    } catch (err) {
      setError('Network error. Please check your connection.');
      console.error('Error fetching tasks:', err);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const handleSelectPerson = (personId: string) => {
    setSelectedPersonIds(prev => {
      if (prev.includes(personId)) {
        return prev.filter(id => id !== personId);
      }
      return [...prev, personId];
    });
  };

  const handleSubmitTask = async (taskData: Partial<Task>) => {
    const { assignees, ...taskDataWithoutAssignees } = taskData as any;
    setError(null);

    // Optimistically update UI
    if (editingTask) {
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === editingTask.id 
            ? { ...task, ...taskDataWithoutAssignees, assignees: task.assignees }
            : task
        )
      );
    } else {
      const optimisticTask = {
        ...taskDataWithoutAssignees,
        id: `temp-${Date.now()}`,
        assignees: persons.filter(person => 
          taskDataWithoutAssignees.assigned_person_ids.includes(person.id)
        ),
      } as TaskWithAssignees;
      
      setTasks(prevTasks => [...prevTasks, optimisticTask]);
    }

    try {
      const { data, error } = editingTask
        ? await supabase
            .from('tasks')
            .update(taskDataWithoutAssignees)
            .eq('id', editingTask.id)
            .select()
        : await supabase
            .from('tasks')
            .insert(taskDataWithoutAssignees)
            .select();

      if (error) {
        setError('Failed to save task. Please try again.');
        console.error('Error saving task:', error);
        // Revert optimistic update
        await fetchTasks();
        return;
      }

      // Refresh tasks to ensure consistency
      await fetchTasks();
      setEditingTask(undefined);
      setIsTaskFormOpen(false);
    } catch (err) {
      setError('Network error. Please check your connection.');
      console.error('Error saving task:', err);
      // Revert optimistic update
      await fetchTasks();
    }
  };

  const filteredTasks = tasks
    .filter(task => {
      const matchesPerson = selectedPersonIds.length === 0 || 
        selectedPersonIds.some(id => task.assigned_person_ids.includes(id));
      const matchesSearch = searchQuery === '' ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.assignees.some(person => 
          person.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      const matchesCompletion = showCompleted || task.status !== 'completed';
      return matchesPerson && matchesSearch && matchesCompletion;
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-indigo-200 dark:bg-indigo-900 rounded-full"></div>
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <h2 className="text-lg font-semibold">Error</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => {
              setError(null);
              checkUser();
            }}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onSuccess={checkUser} />;
  }

  const headerButton = "inline-flex items-center h-9 px-3 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 leading-none whitespace-nowrap";
  const secondaryButton = `${headerButton} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700`;
  const primaryButton = `${headerButton} border border-transparent bg-indigo-600 text-white hover:bg-indigo-700`;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Theme Toggle - Fixed Position */}
      <div className="fixed bottom-4 right-4 z-[60]">
        <ThemeToggle />
      </div>

      {showPeopleLanding && (
        <PeopleLanding
          persons={persons}
          tasks={tasks}
          onSelectPerson={(personId) => {
            setSelectedPersonIds([personId]);
            setShowPeopleLanding(false);
          }}
          onClose={() => setShowPeopleLanding(false)}
        />
      )}

      {/* Mobile Header */}
      <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 fixed top-0 left-0 right-0 z-[40]">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
          >
            {isSidebarOpen ? <CloseIcon className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Task Manager</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPeopleLanding(true)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <Users className="w-6 h-6" />
            </button>
            <button
              onClick={() => setIsTaskFormOpen(true)}
              className="p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      <div className="lg:max-w-7xl lg:mx-auto lg:px-8">
        {/* Desktop Header */}
        <div className="hidden lg:flex justify-between items-center py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Personal Task Manager</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Organize tasks by the people they affect</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPeopleLanding(true)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full"
              title="View People"
            >
              <Users className="w-5 h-5" />
            </button>
            
            <div className="relative h-9 ml-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-full w-64 pl-9 pr-4 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            
            <div className="flex items-center h-9 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
              <input
                type="checkbox"
                id="showCompleted"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="showCompleted" className="ml-2 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                Show completed
              </label>
            </div>
            
            <button
              onClick={() => setIsTaskFormOpen(true)}
              className={primaryButton}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Task
            </button>
            
            <button
              onClick={handleSignOut}
              className={secondaryButton}
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              Sign Out
            </button>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Mobile Sidebar Backdrop */}
          {isSidebarOpen && (
            <div 
              className="lg:hidden fixed inset-0 bg-black/50 dark:bg-black/50 backdrop-blur-sm z-[45]"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div 
            className={`
              fixed inset-y-0 left-0 w-3/4 lg:w-auto lg:static
              transform lg:transform-none
              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
              transition-transform duration-300 ease-in-out
              bg-white dark:bg-gray-800 lg:bg-transparent
              z-[50] lg:z-0
              overflow-hidden lg:overflow-visible
            `}
          >
            <div className="h-full lg:h-auto overflow-y-auto pt-16 lg:pt-0">
              <PersonList
                persons={persons}
                tasks={tasks}
                onSelectPerson={handleSelectPerson}
                selectedPersonIds={selectedPersonIds}
                onPersonsChange={fetchPersons}
                onOpenPersonForm={handleOpenPersonForm}
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 mt-16 lg:mt-0 px-4 lg:px-0 pb-32 lg:pb-4">
            {isLoadingTasks ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700/50 rounded-lg"></div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <TaskList
                tasks={filteredTasks}
                onEditTask={(task) => {
                  setEditingTask(task);
                  setIsTaskFormOpen(true);
                }}
              />
            )}
          </div>
        </div>

        {/* Modals */}
        {isTaskFormOpen && (
          <TaskForm
            task={editingTask}
            persons={persons}
            onSubmit={handleSubmitTask}
            onClose={() => {
              setIsTaskFormOpen(false);
              setEditingTask(undefined);
            }}
          />
        )}

        {isPersonFormOpen && (
          <PersonForm
            person={editingPerson || undefined}
            onSubmit={handleSubmitPerson}
            onClose={() => {
              setIsPersonFormOpen(false);
              setEditingPerson(null);
            }}
          />
        )}

        {/* Mobile Search and Filters */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 space-y-3 z-[40]">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mobileShowCompleted"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-500 bg-white dark:bg-gray-700"
              />
              <label htmlFor="mobileShowCompleted" className="text-sm text-gray-700 dark:text-gray-300">
                Show completed
              </label>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
