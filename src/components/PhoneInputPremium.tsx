import React from 'react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

interface PhoneInputPremiumProps {
    value: string;
    onChange: (phone: string) => void;
    disabled?: boolean;
    required?: boolean;
}

export const PhoneInputPremium: React.FC<PhoneInputPremiumProps> = ({ 
    value, 
    onChange, 
    disabled = false,
    required = false
}) => {
    return (
        <div className="phone-premium-container">
            <PhoneInput
                country={'at'} // Default to Austria
                value={value}
                onChange={onChange}
                disabled={disabled}
                inputProps={{
                    required: required,
                    placeholder: "+43 123 4567890"
                }}
                inputClass="input-premium-phone"
                buttonClass="phone-dropdown-btn"
                dropdownClass="phone-dropdown-menu"
            />
        </div>
    );
};
