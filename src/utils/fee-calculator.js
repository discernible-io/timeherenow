/**
 * Minting Fee Calculator (Backend)
 * 
 * Calculates the minting fee for RODiT tokens based on:
 * - Base fee (from environment)
 * - Max requests allowed
 * - Request window (in seconds)
 * - Days until expiry
 * - Number of RODiT tokens
 * 
 * Formula: baseFee × (maxRequests/100) × (maxrqWindow/3600) × (daysUntilExpiry/365) × numberofrodit
 * 
 * IMPORTANT: This formula MUST match the frontend calculation in src/utils/fees.js
 */

const config = require('config');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calculate the minting fee for RODiT tokens
 * 
 * @param {Object} params - Calculation parameters
 * @param {string|number} params.maxRequests - Maximum requests allowed
 * @param {string|number} params.maxrqWindow - Request window in seconds
 * @param {string} params.notAfter - Expiration date (ISO 8601 format)
 * @param {string|number} [params.numberofrodit=1] - Number of RODiT tokens to mint
 * @param {string|number} [params.baseFee] - Base fee override (defaults to MINTING_FEE env var)
 * @returns {Object} Fee calculation result
 * @returns {string} return.totalFee - Total minting fee as string
 * @returns {number} return.perRoditFee - Fee per RODiT token
 * @returns {number} return.daysUntilExpiry - Calculated days until expiry
 * @returns {Object} return.breakdown - Detailed breakdown of calculation
 */
function calculateMintingFee({
  maxRequests,
  maxrqWindow,
  notAfter,
  numberofrodit = 1,
  baseFee = null
}) {
  // Convert all inputs to numbers
  const mr = Number(maxRequests);
  const mw = Number(maxrqWindow);
  const qty = Number(numberofrodit);
  
  // Get base fee from config or parameter
  const baselineFee = baseFee !== null 
    ? Number(baseFee) 
    : Number(process.env.MINTING_FEE || config.get('MINTING_FEE') || 0);
  
  // Validate inputs
  if (isNaN(mr) || mr <= 0) {
    throw new Error(`Invalid maxRequests: ${maxRequests}`);
  }
  if (isNaN(mw) || mw <= 0) {
    throw new Error(`Invalid maxrqWindow: ${maxrqWindow}`);
  }
  if (isNaN(qty) || qty <= 0) {
    throw new Error(`Invalid numberofrodit: ${numberofrodit}`);
  }
  if (isNaN(baselineFee) || baselineFee < 0) {
    throw new Error(`Invalid baseFee: ${baseFee || process.env.MINTING_FEE}`);
  }
  
  // Calculate days until expiry
  const expiryDate = new Date(notAfter);
  const today = new Date();
  
  if (isNaN(expiryDate.getTime())) {
    throw new Error(`Invalid notAfter date: ${notAfter}`);
  }
  
  const diffMs = expiryDate - today;
  
  if (diffMs < 0) {
    throw new Error(`Expiration date ${notAfter} is in the past`);
  }
  
  const daysUntilExpiry = Math.ceil(diffMs / ONE_DAY_MS);
  
  // Calculate fee multiplier components
  // FIXED: Match frontend formula - multiply by window, not divide
  const requestsMultiplier = mr / 100;
  const windowMultiplier = mw / 3600;  // ✅ CORRECTED: was 3600 / mw
  const daysMultiplier = daysUntilExpiry / 365;
  
  // Calculate fee per RODiT
  const feeMultiplier = requestsMultiplier * windowMultiplier * daysMultiplier;
  const perRoditFee = baselineFee * feeMultiplier;
  
  // Calculate total fee
  const totalFee = perRoditFee * qty;
  
  return {
    totalFee: totalFee.toString(),
    perRoditFee,
    daysUntilExpiry,
    breakdown: {
      baseFee: baselineFee,
      maxRequests: mr,
      maxrqWindow: mw,
      numberofrodit: qty,
      requestsMultiplier,
      windowMultiplier,
      daysMultiplier,
      feeMultiplier,
      expiryDate: expiryDate.toISOString(),
      today: today.toISOString()
    }
  };
}

/**
 * Get the minting fee account from configuration
 * 
 * @returns {string} The NEAR account that receives minting fees
 */
function getMintingFeeAccount() {
  return process.env.MINTING_FEEACCOUNT || config.get('MINTING_FEEACCOUNT') || '';
}

module.exports = {
  calculateMintingFee,
  getMintingFeeAccount
};
