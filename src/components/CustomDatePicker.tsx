import React from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { de } from 'date-fns/locale/de';
import { Calendar } from 'lucide-react';
import "react-datepicker/dist/react-datepicker.css";

registerLocale('de', de);

interface CustomDatePickerProps {
    selected: Date | null;
    onChange: (date: Date | null) => void;
    placeholderText?: string;
    disabled?: boolean;
    className?: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
    selected,
    onChange,
    placeholderText = "tt.mm.jjjj",
    disabled = false,
    className = ''
}) => {
    return (
        <div className={`relative w-full ${className}`}>
            <DatePicker
                selected={selected}
                onChange={onChange}
                locale="de"
                dateFormat="dd.MM.yyyy"
                placeholderText={placeholderText}
                disabled={disabled}
                className={`w-full ${disabled ? 'input-premium-readonly' : 'input-premium'} pr-10`}
                showPopperArrow={false}
                wrapperClassName="w-full"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Calendar className={`w-4 h-4 ${disabled ? 'text-gray-400' : 'text-gray-500'}`} />
            </div>
        </div>
    );
};
