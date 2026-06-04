import React from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { CompanyProfileTab } from './settings/CompanyProfileTab';

export const Settings = () => {
    return (
        <DashboardShell title="Einstellungen & Stammdaten">
            <div className="space-y-6 pt-2">
                <div className="pb-8">
                    <CompanyProfileTab />
                </div>
            </div>
        </DashboardShell>
    );
};
