import { expose } from 'comlink';
import { evaluate, generate } from './generator';

expose({ generate, evaluate });
