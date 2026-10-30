import { createStore } from '@/lib/store';

/** Photos picked on the wardrobe screen, handed to the add flow. */
export const pendingFiles = createStore<File[]>([]);
