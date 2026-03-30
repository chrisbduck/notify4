export function apiFetch(relativeURL: string, init?: RequestInit): Promise<Response> {
    const normalizedPath = relativeURL.startsWith('/') ? relativeURL.slice(1) : relativeURL;
    return fetch(`/api/${normalizedPath}`, init);
}
