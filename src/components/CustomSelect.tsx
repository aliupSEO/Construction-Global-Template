import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    variant?: 'default' | 'inline';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Bitte wählen...',
    disabled = false,
    className = '',
    variant = 'default'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`flex items-center justify-between w-full text-left ${
                    variant === 'inline' 
                        ? 'text-xs text-brand-primary font-medium px-2 py-1 hover:bg-brand-primary/5 rounded-md transition-colors'
                        : disabled ? 'input-premium-readonly' : 'input-premium'
                }`}
            >
                <span className={`block whitespace-nowrap ${!selectedOption && variant === 'default' ? 'text-gray-400' : ''}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 ml-1 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${disabled ? 'text-gray-400' : (variant === 'inline' ? 'text-brand-primary' : 'text-gray-500')}`} />
            </button>

            {isOpen && !disabled && (
                <div className={`absolute z-50 ${variant === 'inline' ? 'w-max right-0' : 'w-full'} mt-1 bg-white rounded-xl shadow-lg border border-gray-100 max-h-60 overflow-auto focus:outline-none`}>
                    <ul className="py-1">
                        {options.map((option) => (
                            <li
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`relative cursor-pointer select-none py-2.5 pl-10 pr-4 hover:bg-brand-primary/5 transition-colors ${
                                    value === option.value ? 'text-brand-primary bg-brand-primary/5 font-medium' : 'text-gray-700'
                                }`}
                            >
                                <span className="block">{option.label}</span>
                                {value === option.value && (
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-primary">
                                        <Check className="w-4 h-4" />
                                    </span>
                                )}
                            </li>
                        ))}
                        {options.length === 0 && (
                            <li className="py-2.5 px-4 text-sm text-gray-500 text-center">Keine Optionen verfügbar</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};
