import { Pipe, PipeTransform } from '@angular/core';

/** 1250 → «1 250 смн». */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(v: number | null | undefined): string {
    if (v === null || v === undefined) return '';
    return `${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} смн`;
  }
}
