import { EventEmitter } from 'events';

// This is a global event emitter to decouple error handling from components.
export const errorEmitter = new EventEmitter();
