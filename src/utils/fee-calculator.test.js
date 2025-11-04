/**
 * Tests for fee-calculator.js
 * 
 * Run with: node src/utils/fee-calculator.test.js
 */

const { calculateMintingFee, getMintingFeeAccount } = require('./fee-calculator');

// Test helper
function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`✓ ${testName}`);
  } else {
    console.error(`✗ ${testName}`);
    console.error(`  Expected: ${expected}`);
    console.error(`  Actual: ${actual}`);
    process.exit(1);
  }
}

function assertApprox(actual, expected, tolerance, testName) {
  if (Math.abs(actual - expected) <= tolerance) {
    console.log(`✓ ${testName}`);
  } else {
    console.error(`✗ ${testName}`);
    console.error(`  Expected: ${expected} (±${tolerance})`);
    console.error(`  Actual: ${actual}`);
    process.exit(1);
  }
}

function assertThrows(fn, testName) {
  try {
    fn();
    console.error(`✗ ${testName} - Expected error but none was thrown`);
    process.exit(1);
  } catch (error) {
    console.log(`✓ ${testName}`);
  }
}

console.log('Running fee calculator tests...\n');

// Test 1: Basic calculation with baseline values
console.log('Test 1: Basic calculation');
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 365); // 1 year from now

const result1 = calculateMintingFee({
  maxRequests: 100,
  maxrqWindow: 3600,
  notAfter: futureDate.toISOString(),
  numberofrodit: 1,
  baseFee: 0.1
});

// With baseline values (100 requests, 3600 window, 365 days, 1 rodit):
// fee = 0.1 × (100/100) × (3600/3600) × (365/365) × 1 = 0.1
assertApprox(parseFloat(result1.totalFee), 0.1, 0.01, 'Total fee should be ~0.1');
assertEqual(result1.daysUntilExpiry, 365, 'Days until expiry should be 365');

// Test 2: Double the requests
console.log('\nTest 2: Double the requests');
const result2 = calculateMintingFee({
  maxRequests: 200,
  maxrqWindow: 3600,
  notAfter: futureDate.toISOString(),
  numberofrodit: 1,
  baseFee: 0.1
});

// fee = 0.1 × (200/100) × (3600/3600) × (365/365) × 1 = 0.2
assertApprox(parseFloat(result2.totalFee), 0.2, 0.01, 'Total fee should be ~0.2');

// Test 3: Half the window (more requests per hour)
console.log('\nTest 3: Half the window');
const result3 = calculateMintingFee({
  maxRequests: 100,
  maxrqWindow: 1800,
  notAfter: futureDate.toISOString(),
  numberofrodit: 1,
  baseFee: 0.1
});

// fee = 0.1 × (100/100) × (3600/1800) × (365/365) × 1 = 0.2
assertApprox(parseFloat(result3.totalFee), 0.2, 0.01, 'Total fee should be ~0.2');

// Test 4: Half the duration
console.log('\nTest 4: Half the duration');
const halfYearDate = new Date();
halfYearDate.setDate(halfYearDate.getDate() + 182); // ~6 months

const result4 = calculateMintingFee({
  maxRequests: 100,
  maxrqWindow: 3600,
  notAfter: halfYearDate.toISOString(),
  numberofrodit: 1,
  baseFee: 0.1
});

// fee = 0.1 × (100/100) × (3600/3600) × (182/365) × 1 ≈ 0.05
assertApprox(parseFloat(result4.totalFee), 0.05, 0.01, 'Total fee should be ~0.05');

// Test 5: Multiple RODiTs
console.log('\nTest 5: Multiple RODiTs');
const result5 = calculateMintingFee({
  maxRequests: 100,
  maxrqWindow: 3600,
  notAfter: futureDate.toISOString(),
  numberofrodit: 5,
  baseFee: 0.1
});

// fee = 0.1 × (100/100) × (3600/3600) × (365/365) × 5 = 0.5
assertApprox(parseFloat(result5.totalFee), 0.5, 0.01, 'Total fee should be ~0.5');

// Test 6: String inputs (should convert properly)
console.log('\nTest 6: String inputs');
const result6 = calculateMintingFee({
  maxRequests: "100",
  maxrqWindow: "3600",
  notAfter: futureDate.toISOString(),
  numberofrodit: "1",
  baseFee: "0.1"
});

assertApprox(parseFloat(result6.totalFee), 0.1, 0.01, 'Should handle string inputs');

// Test 7: Invalid inputs
console.log('\nTest 7: Invalid inputs');
assertThrows(() => {
  calculateMintingFee({
    maxRequests: -100,
    maxrqWindow: 3600,
    notAfter: futureDate.toISOString(),
    numberofrodit: 1,
    baseFee: 0.1
  });
}, 'Should throw on negative maxRequests');

assertThrows(() => {
  calculateMintingFee({
    maxRequests: 100,
    maxrqWindow: 0,
    notAfter: futureDate.toISOString(),
    numberofrodit: 1,
    baseFee: 0.1
  });
}, 'Should throw on zero maxrqWindow');

assertThrows(() => {
  calculateMintingFee({
    maxRequests: 100,
    maxrqWindow: 3600,
    notAfter: "invalid-date",
    numberofrodit: 1,
    baseFee: 0.1
  });
}, 'Should throw on invalid date');

const pastDate = new Date();
pastDate.setDate(pastDate.getDate() - 1);
assertThrows(() => {
  calculateMintingFee({
    maxRequests: 100,
    maxrqWindow: 3600,
    notAfter: pastDate.toISOString(),
    numberofrodit: 1,
    baseFee: 0.1
  });
}, 'Should throw on past date');

// Test 8: Breakdown structure
console.log('\nTest 8: Breakdown structure');
const result8 = calculateMintingFee({
  maxRequests: 100,
  maxrqWindow: 3600,
  notAfter: futureDate.toISOString(),
  numberofrodit: 1,
  baseFee: 0.1
});

assertEqual(typeof result8.breakdown, 'object', 'Breakdown should be an object');
assertEqual(typeof result8.breakdown.baseFee, 'number', 'baseFee should be a number');
assertEqual(typeof result8.breakdown.requestsMultiplier, 'number', 'requestsMultiplier should be a number');
assertEqual(typeof result8.breakdown.windowMultiplier, 'number', 'windowMultiplier should be a number');
assertEqual(typeof result8.breakdown.daysMultiplier, 'number', 'daysMultiplier should be a number');

console.log('\n✓ All tests passed!');
