import { KeyboardEvent } from 'react';

export const useChatInput = (onSend: () => void) => {
    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            onSend();
        }
    };

    return { handleKeyDown };
};
