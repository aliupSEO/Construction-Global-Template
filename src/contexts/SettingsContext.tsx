import React, { createContext, useContext, useState, useEffect } from 'react';

interface AppSettings {
    fontSize: 'small' | 'normal' | 'large';
    compactMode: boolean;
    animations: boolean;
}

const defaultSettings: AppSettings = {
    fontSize: 'normal',
    compactMode: false,
    animations: true,
};

interface SettingsContextType {
    settings: AppSettings;
    updateSettings: (updates: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppSettings>(() => {
        const saved = localStorage.getItem('appSettings');
        if (saved) {
            try {
                return { ...defaultSettings, ...JSON.parse(saved) };
            } catch (e) {
                return defaultSettings;
            }
        }
        return defaultSettings;
    });

    useEffect(() => {
        localStorage.setItem('appSettings', JSON.stringify(settings));

        // Apply Font Size
        const html = document.documentElement;
        if (settings.fontSize === 'small') {
            html.style.fontSize = '14px';
        } else if (settings.fontSize === 'large') {
            html.style.fontSize = '18px';
        } else {
            html.style.fontSize = '16px';
        }

        // Apply Animations
        if (!settings.animations) {
            html.classList.add('disable-animations');
        } else {
            html.classList.remove('disable-animations');
        }

        // Apply Compact Mode
        if (settings.compactMode) {
            html.classList.add('compact-mode');
        } else {
            html.classList.remove('compact-mode');
        }
    }, [settings]);

    const updateSettings = (updates: Partial<AppSettings>) => {
        setSettings(prev => ({ ...prev, ...updates }));
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
