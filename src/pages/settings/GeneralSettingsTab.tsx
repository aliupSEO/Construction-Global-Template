import React from 'react';
import { Type, LayoutList, Zap } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

export const GeneralSettingsTab = () => {
    const { settings, updateSettings } = useSettings();

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h3 className="text-lg font-medium text-gray-900">Allgemeine Einstellungen</h3>
                <p className="mt-1 text-sm text-gray-500">
                    Passen Sie das Erscheinungsbild und Verhalten der App an Ihre Bedürfnisse an.
                </p>
            </div>

            <div className="p-6 space-y-8">
                {/* Font Size */}
                <div className="flex items-start">
                    <div className="flex-shrink-0 mt-1 bg-brand-primary/10 p-2 rounded-lg">
                        <Type className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div className="ml-4 flex-1">
                        <label className="text-base font-medium text-gray-900 block mb-1">Schriftgröße</label>
                        <p className="text-sm text-gray-500 mb-4">Wählen Sie die bevorzugte Textgröße für die Benutzeroberfläche.</p>
                        
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => updateSettings({ fontSize: 'small' })}
                                className={`px-4 py-2 border rounded-xl text-sm font-medium transition-all ${settings.fontSize === 'small' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                            >
                                Klein (14px)
                            </button>
                            <button
                                onClick={() => updateSettings({ fontSize: 'normal' })}
                                className={`px-4 py-2 border rounded-xl text-sm font-medium transition-all ${settings.fontSize === 'normal' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                            >
                                Normal (16px)
                            </button>
                            <button
                                onClick={() => updateSettings({ fontSize: 'large' })}
                                className={`px-4 py-2 border rounded-xl text-sm font-medium transition-all ${settings.fontSize === 'large' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                            >
                                Groß (18px)
                            </button>
                        </div>
                    </div>
                </div>

                {/* Compact Mode */}
                <div className="flex items-start pt-6 border-t border-gray-100">
                    <div className="flex-shrink-0 mt-1 bg-brand-primary/10 p-2 rounded-lg">
                        <LayoutList className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div className="ml-4 flex-1 flex justify-between items-center">
                        <div>
                            <label className="text-base font-medium text-gray-900 block mb-1">Kompaktes Layout</label>
                            <p className="text-sm text-gray-500">Verringert die Abstände in Listen und Tabellen, um mehr Inhalte auf einmal anzuzeigen.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={settings.compactMode}
                                onChange={(e) => updateSettings({ compactMode: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-brand-primary/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                        </label>
                    </div>
                </div>

                {/* Animations */}
                <div className="flex items-start pt-6 border-t border-gray-100">
                    <div className="flex-shrink-0 mt-1 bg-brand-primary/10 p-2 rounded-lg">
                        <Zap className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div className="ml-4 flex-1 flex justify-between items-center">
                        <div>
                            <label className="text-base font-medium text-gray-900 block mb-1">UI Animationen</label>
                            <p className="text-sm text-gray-500">Deaktivieren Sie Animationen und Übergänge für eine schnellere Bedienung.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={settings.animations}
                                onChange={(e) => updateSettings({ animations: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-brand-primary/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                        </label>
                    </div>
                </div>

            </div>
        </div>
    );
};
