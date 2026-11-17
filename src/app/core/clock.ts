import { InjectionToken } from '@angular/core';

/** Текущее время. Подменяется в тестах, чтобы проверять поведение «вечером» и «утром». */
export const CLOCK = new InjectionToken<() => Date>('CLOCK', { providedIn: 'root', factory: () => () => new Date() });
