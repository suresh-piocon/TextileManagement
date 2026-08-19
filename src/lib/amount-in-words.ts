// Amount to words converter for Indian currency
// Ported from C# AmtInWords.cs

const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const tens = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function convertTwoDigits(num: number): string {
  if (num < 20) return ones[num];
  const ten = Math.floor(num / 10);
  const one = num % 10;
  return tens[ten] + (one ? " " + ones[one] : "");
}

function convertThreeDigits(num: number): string {
  if (num === 0) return "";
  const hundred = Math.floor(num / 100);
  const remainder = num % 100;
  let result = "";
  if (hundred > 0) {
    result = ones[hundred] + " Hundred";
    if (remainder > 0) result += " and ";
  }
  result += convertTwoDigits(remainder);
  return result;
}

export function amountInWords(amount: number): string {
  if (amount === 0) return "Zero Rupees Only";

  const isNegative = amount < 0;
  amount = Math.abs(amount);

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let result = "";

  if (rupees > 0) {
    // Indian number system: Crore, Lakh, Thousand, Hundred
    const crore = Math.floor(rupees / 10000000);
    const lakh = Math.floor((rupees % 10000000) / 100000);
    const thousand = Math.floor((rupees % 100000) / 1000);
    const hundred = rupees % 1000;

    if (crore > 0) result += convertTwoDigits(crore) + " Crore ";
    if (lakh > 0) result += convertTwoDigits(lakh) + " Lakh ";
    if (thousand > 0) result += convertTwoDigits(thousand) + " Thousand ";
    if (hundred > 0) result += convertThreeDigits(hundred);

    result = result.trim() + " Rupees";
  }

  if (paise > 0) {
    if (rupees > 0) result += " and ";
    result += convertTwoDigits(paise) + " Paise";
  }

  result += " Only";

  if (isNegative) result = "Minus " + result;

  return result;
}
