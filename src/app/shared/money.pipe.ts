import { Pipe, PipeTransform } from '@angular/core';

/** 1250 → «1 250»: только число с разрядами, без валюты (для ценника-бирки). */
export const amount = (v: number): string => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** 1250 → «1 250 смн». */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(v: number | null | undefined): string {
    if (v === null || v === undefined) return '';
    return `${amount(v)} смн`;
  }
}
