import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db, APP_ID } from '../lib/firebase';
import { DashboardShell } from '../components/DashboardShell';
import { Plus, CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface Task {
    id: string;
    title: string;
    status: 'open' | 'in_progress' | 'done';
    priority: 'low' | 'medium' | 'high';
    dueDate: any;
}

export const Tasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTask, setNewTask] = useState('');

    useEffect(() => {
        const q = query(collection(db, `apps/${APP_ID}/tasks`));
        return onSnapshot(q, (snapshot) => {
            setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
        });
    }, []);

    const addTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.trim()) return;
        await addDoc(collection(db, `apps/${APP_ID}/tasks`), {
            title: newTask,
            status: 'open',
            priority: 'medium',
            dueDate: Timestamp.now(),
            createdAt: Timestamp.now()
        });
        setNewTask('');
    };

    const toggleTask = async (id: string, currentStatus: string) => {
        const nextStatus = currentStatus === 'done' ? 'open' : 'done';
        await updateDoc(doc(db, `apps/${APP_ID}/tasks`, id), { status: nextStatus });
    };

    return (
        <DashboardShell title="Aufgaben & Pendenzen">
            <div className="max-w-3xl">
                <form onSubmit={addTask} className="mb-8 flex gap-2">
                    <input
                        type="text"
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        placeholder="Neue Aufgabe für Construction Global Template..."
                        className="input-premium"
                    />
                    <button type="submit" className="bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Hinzufügen
                    </button>
                </form>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y">
                    {tasks.map((task) => (
                        <div key={task.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <button onClick={() => toggleTask(task.id, task.status)}>
                                    {task.status === 'done' ? (
                                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                                    ) : (
                                        <Circle className="w-6 h-6 text-gray-300" />
                                    )}
                                </button>
                                <span className={`${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                    {task.title}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-1 rounded-full uppercase font-bold ${task.priority === 'high' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {task.priority}
                                </span>
                            </div>
                        </div>
                    ))}
                    {tasks.length === 0 && (
                        <div className="p-12 text-center text-gray-400 italic">Keine Aufgaben vorhanden.</div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
};
