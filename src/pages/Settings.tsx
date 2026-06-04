import React, { useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { CompanyProfileTab } from './settings/CompanyProfileTab';
import { GeneralSettingsTab } from './settings/GeneralSettingsTab';
import { Settings2, Building2 } from 'lucide-react';

export const Settings = () => {
    const [activeTab, setActiveTab] = useState<'general' | 'company'>('general');

    return (
        <DashboardShell title="Einstellungen & Stammdaten">
            <div className="space-y-6 pt-2">
                
                {/* Tabs Navigation */}
                <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-xl w-fit border border-gray-200/60 shadow-inner">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                            activeTab === 'general'
                                ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 border border-transparent'
                        }`}
                    >
                        <Settings2 className="w-4 h-4" />
                        <span>Allgemein</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('company')}
                        className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                            activeTab === 'company'
                                ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 border border-transparent'
                        }`}
                    >
                        <Building2 className="w-4 h-4" />
                        <span>Firmendaten</span>
                    </button>
                </div>

                <div className="pb-8">
                    {activeTab === 'general' ? <GeneralSettingsTab /> : <CompanyProfileTab />}
                </div>
            </div>
        </DashboardShell>
    );
};
