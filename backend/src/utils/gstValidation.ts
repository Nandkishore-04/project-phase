/**
 * GSTIN (Goods and Services Tax Identification Number) Validation
 * Format: 22AAAAA0000A1Z5
 * - First 2 digits: State Code (01-37)
 * - Next 10 characters: PAN (Permanent Account Number)
 * - 13th character: Entity number (1-9, A-Z)
 * - 14th character: Z (default)
 * - 15th character: Checksum digit
 */

// State codes mapping
export const STATE_CODES: { [key: string]: string } = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

/**
 * Validate GSTIN format
 */
export function validateGSTINFormat(gstin: string): {
  valid: boolean;
  error?: string;
  details?: {
    stateCode: string;
    stateName: string;
    pan: string;
    entityNumber: string;
    checksum: string;
  };
} {
  if (!gstin) {
    return { valid: false, error: 'GSTIN is required' };
  }

  // Remove spaces and convert to uppercase
  const cleanGSTIN = gstin.replace(/\s/g, '').toUpperCase();

  // Check length
  if (cleanGSTIN.length !== 15) {
    return { valid: false, error: 'GSTIN must be 15 characters long' };
  }

  // Check format using regex
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(cleanGSTIN)) {
    return { valid: false, error: 'Invalid GSTIN format' };
  }

  // Extract components
  const stateCode = cleanGSTIN.substring(0, 2);
  const pan = cleanGSTIN.substring(2, 12);
  const entityNumber = cleanGSTIN.substring(12, 13);
  const checksum = cleanGSTIN.substring(14, 15);

  // Validate state code
  const stateName = STATE_CODES[stateCode];
  if (!stateName) {
    return { valid: false, error: `Invalid state code: ${stateCode}` };
  }

  // Validate PAN format
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(pan)) {
    return { valid: false, error: 'Invalid PAN in GSTIN' };
  }

  return {
    valid: true,
    details: {
      stateCode,
      stateName,
      pan,
      entityNumber,
      checksum,
    },
  };
}

/**
 * Calculate GST breakdown based on supplier and buyer locations
 */
export function calculateGST(
  amount: number,
  gstRate: number,
  supplierStateCode: string,
  buyerStateCode: string
): {
  cgst: number;
  sgst: number;
  igst: number;
  totalGST: number;
  totalAmount: number;
  isSameState: boolean;
} {
  const gstAmount = (amount * gstRate) / 100;
  const isSameState = supplierStateCode === buyerStateCode;

  if (isSameState) {
    // Intra-state: CGST + SGST
    const cgst = gstAmount / 2;
    const sgst = gstAmount / 2;
    return {
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: 0,
      totalGST: Math.round(gstAmount * 100) / 100,
      totalAmount: Math.round((amount + gstAmount) * 100) / 100,
      isSameState: true,
    };
  } else {
    // Inter-state: IGST only
    return {
      cgst: 0,
      sgst: 0,
      igst: Math.round(gstAmount * 100) / 100,
      totalGST: Math.round(gstAmount * 100) / 100,
      totalAmount: Math.round((amount + gstAmount) * 100) / 100,
      isSameState: false,
    };
  }
}

/**
 * Extract state code from GSTIN
 */
export function extractStateCode(gstin: string): string | null {
  if (!gstin || gstin.length < 2) return null;
  return gstin.substring(0, 2);
}

/**
 * Get state name from code
 */
export function getStateName(stateCode: string): string | null {
  return STATE_CODES[stateCode] || null;
}

/**
 * Validate and calculate GST for invoice
 */
export function processInvoiceGST(
  subtotal: number,
  gstRate: number,
  supplierGSTIN: string,
  buyerGSTIN: string = process.env.COMPANY_GSTIN || '29AAAAA0000A1Z5'
): {
  valid: boolean;
  error?: string;
  gstBreakdown?: ReturnType<typeof calculateGST>;
  supplierState?: string;
  buyerState?: string;
} {
  // Validate supplier GSTIN
  const supplierValidation = validateGSTINFormat(supplierGSTIN);
  if (!supplierValidation.valid) {
    return {
      valid: false,
      error: `Invalid supplier GSTIN: ${supplierValidation.error}`,
    };
  }

  // Validate buyer GSTIN
  const buyerValidation = validateGSTINFormat(buyerGSTIN);
  if (!buyerValidation.valid) {
    return {
      valid: false,
      error: `Invalid buyer GSTIN: ${buyerValidation.error}`,
    };
  }

  const supplierStateCode = extractStateCode(supplierGSTIN)!;
  const buyerStateCode = extractStateCode(buyerGSTIN)!;

  const gstBreakdown = calculateGST(subtotal, gstRate, supplierStateCode, buyerStateCode);

  return {
    valid: true,
    gstBreakdown,
    supplierState: supplierValidation.details!.stateName,
    buyerState: buyerValidation.details!.stateName,
  };
}
