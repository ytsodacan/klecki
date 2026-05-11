import data from './languages.json';

// Convert dictionary → array
export const languages = Object.keys(data).map((code) => ({
    code,
    name: data[code].name || code
}));

// English is the base language
export const english = data["en"];

// Load a language by code
export async function loadLanguage(code: string) {
    return data[code] || {};
}

export type TTranslationCode = keyof typeof english;
