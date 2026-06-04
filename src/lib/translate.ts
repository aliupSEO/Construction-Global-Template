export async function translateToGerman(text: string): Promise<string> {
    if (!text || text.trim() === '') return text;
    
    // API Key aus den Umgebungsvariablen laden (Vite Standard)
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 
    
    if (!API_KEY) {
        console.error("Translation error: VITE_GEMINI_API_KEY is missing.");
        return text;
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${API_KEY}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `Translate the following text to German. If it is already in German, just return the exact same text. Do not add any explanations, markdown formatting, or quotes, just the translated text:\n\n${text}` }]
                }],
                generationConfig: {
                    temperature: 0.1,
                }
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error("Gemini API Error:", data.error.message);
            return text;
        }

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            return data.candidates[0].content.parts[0].text.trim();
        }
        return text;
    } catch (error) {
        console.error("Translation error:", error);
        return text; // Fallback zum Originaltext bei Fehler
    }
}
