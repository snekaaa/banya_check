/**
 * Форматирует число с разделителями разрядов
 * @param value - число для форматирования
 * @param decimals - количество знаков после запятой (по умолчанию 0)
 * @returns отформатированная строка
 *
 * @example
 * formatNumber(1000) // "1 000"
 * formatNumber(1234567) // "1 234 567"
 * formatNumber(1234.56, 2) // "1 234.56"
 */
export function formatNumber(value: number, decimals: number = 0): string {
  if (isNaN(value) || value === null || value === undefined) {
    return '0';
  }

  // Округляем до нужного количества знаков после запятой
  const rounded = decimals > 0
    ? value.toFixed(decimals)
    : Math.round(value).toString();

  // Разделяем на целую и дробную части
  const [integerPart, decimalPart] = rounded.split('.');

  // Добавляем разделители разрядов (пробелы) для целой части
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // Возвращаем с дробной частью если она есть
  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}

/**
 * Форматирует сумму в рублях с разделителями
 * @param value - сумма
 * @returns отформатированная строка с символом рубля
 *
 * @example
 * formatPrice(1000) // "1 000 ₽"
 * formatPrice(1234567) // "1 234 567 ₽"
 */
export function formatPrice(value: number): string {
  return `${formatNumber(value)} ₽`;
}
