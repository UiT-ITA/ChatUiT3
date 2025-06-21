import { ChatFile, ChatFileText, ChatFileImage, ContentType } from '../types/chatModels';

export class FileProcessingService {
    static async processFile(file: File): Promise<ChatFile> {
        if (this.isImageFile(file)) {
            return this.processImageFile(file);
        } else if (this.isTextFile(file)) {
            return this.processTextFile(file);
        }
        
        throw new Error(`Unsupported file type: ${file.type}`);
    }

    static isImageFile(file: File): boolean {
        return file.type.startsWith('image/') && 
               ['image/jpeg', 'image/png'].includes(file.type);
    }

    static isTextFile(file: File): boolean {
        return ['text/plain', 'text/csv', 'application/json'].includes(file.type);
    }

    private static async processImageFile(file: File): Promise<ChatFileImage> {
        const processedBase64 = await this.resizeAndConvertImage(file);
        
        // Change extension to .jpg
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        const filename = `${nameWithoutExt}.jpg`;
        
        return {
            id: crypto.randomUUID(),
            filename: filename,
            type: ContentType.Image,
            content: processedBase64
        };
    }

    private static async processTextFile(file: File): Promise<ChatFileText> {
        const textContent = await this.readTextFile(file);
        
        return {
            id: crypto.randomUUID(),
            filename: file.name,
            type: ContentType.Text,
            content: textContent
        };
    }

    private static readTextFile(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    private static async resizeAndConvertImage(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                try {
                    // Calculate new dimensions
                    const { width: newWidth, height: newHeight } = this.calculateImageDimensions(
                        img.width,
                        img.height
                    );

                    // Create canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    canvas.width = newWidth;
                    canvas.height = newHeight;

                    // Draw resized image
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);

                    // Convert to JPEG and get base64
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    const base64 = dataUrl.split(',')[1];
                    
                    resolve(base64);
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            
            // Load the image
            const reader = new FileReader();
            reader.onload = () => {
                img.src = reader.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    private static calculateImageDimensions(originalWidth: number, originalHeight: number): { width: number; height: number } {
        const MAX_LONG_SIDE = 2048;
        const MAX_SHORT_SIDE = 1024;
        
        // Determine if image is landscape or portrait
        const isLandscape = originalWidth > originalHeight;
        
        let targetWidth = originalWidth;
        let targetHeight = originalHeight;
        
        if (isLandscape) {
            // Landscape: width is the long side, height is the short side
            if (originalWidth > MAX_LONG_SIDE) {
                const ratio = MAX_LONG_SIDE / originalWidth;
                targetWidth = MAX_LONG_SIDE;
                targetHeight = originalHeight * ratio;
            }
            
            if (targetHeight > MAX_SHORT_SIDE) {
                const ratio = MAX_SHORT_SIDE / targetHeight;
                targetHeight = MAX_SHORT_SIDE;
                targetWidth = targetWidth * ratio;
            }
        } else {
            // Portrait: height is the long side, width is the short side
            if (originalHeight > MAX_LONG_SIDE) {
                const ratio = MAX_LONG_SIDE / originalHeight;
                targetHeight = MAX_LONG_SIDE;
                targetWidth = originalWidth * ratio;
            }
            
            if (targetWidth > MAX_SHORT_SIDE) {
                const ratio = MAX_SHORT_SIDE / targetWidth;
                targetWidth = MAX_SHORT_SIDE;
                targetHeight = targetHeight * ratio;
            }
        }
        
        return {
            width: Math.round(targetWidth),
            height: Math.round(targetHeight)
        };
    }
}
