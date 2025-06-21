export const getFileExtension = (filename: string): string => {
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.slice(lastDot + 1).toLowerCase();
};

export const getFileIcon = (filename: string): string => {
    const extension = getFileExtension(filename);
    
    switch (extension) {
        case 'txt':
            return '📄';
        case 'csv':
            return '📊';
        case 'json':
            return '📋';
        case 'jpg':
        case 'jpeg':
        case 'png':
            return '🖼️';
        default:
            return '📄';
    }
};

export const isValidFileType = (file: File): boolean => {
    const validTypes = [
        'text/plain',
        'text/csv', 
        'application/json',
        'image/jpeg',
        'image/png'
    ];
    
    return validTypes.includes(file.type);
};

export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
