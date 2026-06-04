import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    itemName: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    itemName
}) => {
    const [inputValue, setInputValue] = useState('');

    if (!isOpen) return null;

    const isConfirmDisabled = inputValue.trim().toLowerCase() !== 'löschen';

    const handleConfirm = () => {
        if (!isConfirmDisabled) {
            onConfirm();
            setInputValue(''); // Reset on success
            // Note: onClose is usually called by the parent after confirming/deleting
        }
    };

    const handleCancel = () => {
        setInputValue('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={handleCancel} />
                
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

                <div 
                    className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-xl shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6"
                >
                    <div className="absolute top-0 right-0 pt-4 pr-4">
                        <button
                            type="button"
                            className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none"
                            onClick={handleCancel}
                        >
                            <span className="sr-only">Schließen</span>
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="sm:flex sm:items-start">
                        <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-red-100 rounded-full sm:mx-0 sm:h-10 sm:w-10">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                            <h3 className="text-lg font-medium leading-6 text-gray-900">
                                {title}
                            </h3>
                            <div className="mt-2 text-sm text-gray-500">
                                <p>Sie sind dabei, <strong>{itemName}</strong> unwiderruflich zu löschen.</p>
                                <p className="mt-2">Dies kann nicht rückgängig gemacht werden. Bitte tippen Sie das Wort <span className="font-semibold text-red-600 tracking-wider font-mono">löschen</span> in das folgende Feld ein, um die Aktion zu bestätigen.</p>
                            </div>

                            <div className="mt-4">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="löschen"
                                    className="input-premium font-mono !border-red-300 focus:!border-red-500 focus:!ring-red-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            disabled={isConfirmDisabled}
                            className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={handleConfirm}
                        >
                            Endgültig löschen
                        </button>
                        <button
                            type="button"
                            className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary sm:mt-0 sm:w-auto sm:text-sm"
                            onClick={handleCancel}
                        >
                            Abbrechen
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
