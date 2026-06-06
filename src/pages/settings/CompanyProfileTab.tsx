import React, { useState, useEffect } from 'react';
import { db, APP_ID } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { fileToBase64 } from '../../lib/utils';
import { Save, Upload, HardHat } from 'lucide-react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import toast from 'react-hot-toast';

export const CompanyProfileTab = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        companyName: '',
        address: '',
        postalCode: '',
        city: '',
        phone: '',
        email: '',
        website: '',
        managingDirector: '',
        vatId: '',
        commercialRegister: '',
        iban: '',
        bic: '',
        logoBase64: ''
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, 'apps', APP_ID, 'metadata', 'company_profile');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setFormData(docSnap.data() as any);
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 800 * 1024) {
                toast.error('Das Bild ist zu groß. Bitte wählen Sie ein Bild unter 800 KB.');
                return;
            }
            try {
                const base64 = await fileToBase64(file);
                setFormData({ ...formData, logoBase64: base64 });
            } catch (error) {
                console.error('Error converting file to base64:', error);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const docRef = doc(db, 'apps', APP_ID, 'metadata', 'company_profile');
            await setDoc(docRef, formData, { merge: true });
            toast.success('Einstellungen erfolgreich gespeichert.');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Fehler beim Speichern.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h3 className="text-lg font-medium text-gray-900">Unternehmensprofil</h3>
                <p className="mt-1 text-sm text-gray-500">
                    Diese Informationen werden auf den Bauberichten angezeigt.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Firmenname</label>
                        <input
                            type="text"
                            name="companyName"
                            value={formData.companyName}
                            onChange={handleChange}
                            placeholder="z.B. Muster Bau GmbH"
                            className="input-premium"
                            required
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Adresse (Straße & Hausnr.) *</label>
                        <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="z.B. Musterstraße 123"
                            required
                            className="input-premium"
                        />
                    </div>
                    <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">PLZ</label>
                            <input
                                type="text"
                                name="postalCode"
                                value={formData.postalCode}
                                onChange={handleChange}
                                placeholder="z.B. 1010"
                                className="input-premium"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Ort / Stadt</label>
                            <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                placeholder="z.B. Wien"
                                className="input-premium"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                        <div className="phone-premium-container">
                            <PhoneInput
                                country={'at'}
                                preferredCountries={['at', 'de', 'ch']}
                                value={formData.phone}
                                onChange={(phone) => setFormData({ ...formData, phone })}
                                containerClass="w-full"
                                inputClass="!w-full !h-[42px] !pl-12 !pr-4 !bg-gray-50/50 focus:!bg-white !border !border-gray-200 focus:!border-brand-primary focus:!ring-2 focus:!ring-brand-primary/20 !rounded-xl !text-sm !font-medium !text-gray-900 !transition-all hover:!border-gray-300"
                                buttonClass="!bg-transparent !border-none !rounded-l-xl !pl-3"
                                dropdownClass="!rounded-xl !border-gray-100 !shadow-xl"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">E-Mail</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="z.B. office@musterbau.at"
                            className="input-premium"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Website</label>
                        <input
                            type="url"
                            name="website"
                            value={formData.website || ''}
                            onChange={handleChange}
                            placeholder="z.B. https://www.musterbau.at"
                            className="input-premium"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Geschäftsführer</label>
                        <input
                            type="text"
                            name="managingDirector"
                            value={formData.managingDirector || ''}
                            onChange={handleChange}
                            placeholder="z.B. Max Mustermann"
                            className="input-premium"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">UID-Nummer</label>
                        <input
                            type="text"
                            name="vatId"
                            value={formData.vatId || ''}
                            onChange={handleChange}
                            placeholder="z.B. ATU12345678"
                            className="input-premium"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Firmenbuchnummer</label>
                        <input
                            type="text"
                            name="commercialRegister"
                            value={formData.commercialRegister || ''}
                            onChange={handleChange}
                            placeholder="z.B. FN 123456 x"
                            className="input-premium"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">IBAN</label>
                        <input
                            type="text"
                            name="iban"
                            value={formData.iban || ''}
                            onChange={handleChange}
                            placeholder="z.B. AT12 3456 7890 1234 5678"
                            className="input-premium"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">BIC</label>
                        <input
                            type="text"
                            name="bic"
                            value={formData.bic || ''}
                            onChange={handleChange}
                            placeholder="z.B. MUSTERAT"
                            className="input-premium"
                        />
                    </div>

                    <div className="sm:col-span-2 border-t mt-4 pt-6 border-gray-200">
                        <label className="block text-sm font-medium text-gray-700">Logo</label>
                        <p className="mt-1 text-xs text-gray-500 mb-3">
                            Empfohlene Größe: Quadratisch, max. 800 KB, z.B. 200x200 Pixel. Dieses Logo wird auf allen Bauberichten und in der Navigation angezeigt.
                        </p>
                        <div className="mt-1 flex items-center space-x-4">
                            {formData.logoBase64 ? (
                                <img src={formData.logoBase64} alt="Company Logo" className="h-16 w-auto object-contain bg-white shadow-sm border border-gray-100 rounded-xl p-2" />
                            ) : (
                                <div className="h-16 w-16 bg-brand-primary/10 rounded-xl flex items-center justify-center border border-brand-primary/20 shadow-sm">
                                    <HardHat className="w-8 h-8 text-brand-primary" />
                                </div>
                            )}
                            <label className="cursor-pointer bg-white py-2.5 px-4 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary flex items-center transition-all">
                                <Upload className="w-5 h-5 mr-2" />
                                Logo hochladen
                                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                            </label>
                            {formData.logoBase64 && (
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, logoBase64: '' })}
                                    className="py-2.5 px-4 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                                >
                                    Entfernen
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary disabled:opacity-50"
                    >
                        <div className={`animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 ${saving ? '' : 'hidden'}`} />
                        <Save className={`w-4 h-4 mr-2 ${saving ? 'hidden' : ''}`} />
                        Speichern
                    </button>
                </div>
            </form>
        </div>
    );
};
