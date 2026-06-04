import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Trash2, Save } from 'lucide-react';

interface SignaturePadProps {
    onSave: (base64: string) => void;
    initialData?: string;
    label: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, initialData, label }) => {
    const padRef = useRef<SignatureCanvas>(null);

    const handleClear = () => {
        padRef.current?.clear();
        onSave('');
    };

    const handleSave = () => {
        if (padRef.current?.isEmpty()) {
            onSave('');
            return;
        }
        const dataUrl = padRef.current?.getTrimmedCanvas().toDataURL('image/png');
        if (dataUrl) {
            onSave(dataUrl);
            alert('Unterschrift gespeichert.');
        }
    };

    return (
        <div className="flex flex-col space-y-2">
            <label className="block text-sm font-medium text-gray-700">{label}</label>

            {initialData && initialData.length > 0 ? (
                <div className="border border-gray-300 rounded-md p-2 bg-gray-50 flex flex-col items-center">
                    <img src={initialData} alt="Unterschrift" className="max-h-20 w-auto object-contain" />
                    <button
                        type="button"
                        onClick={handleClear}
                        className="mt-2 flex items-center text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                        <Trash2 className="w-4 h-4 mr-1" /> Neue Unterschrift
                    </button>
                </div>
            ) : (
                <div className="border border-gray-300 rounded-md overflow-hidden bg-white shadow-sm">
                    <div className="h-40 w-full relative bg-white">
                        <SignatureCanvas
                            ref={padRef}
                            penColor="#0000CD"
                            canvasProps={{
                                className: 'w-full h-full cursor-crosshair',
                                style: { touchAction: 'none' } // Prevents scrolling on touch screens while signing
                            }}
                        />
                    </div>
                    <div className="bg-gray-50 p-2 flex justify-end space-x-2 border-t border-gray-300">
                        <button
                            type="button"
                            onClick={handleClear}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Löschen
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-brand-primary hover:bg-brand-primary/90"
                        >
                            <Save className="w-3.5 h-3.5 mr-1" /> Bestätigen
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
