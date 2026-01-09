const { Wallet } = require('xrpl');

const seed = "ssYeyQR6n4YsfijW7EiJnRNWyJYYF";

try {
  const wallet = Wallet.fromSeed(seed);
  console.log("✅ Seed is valid!");
  console.log("Address:", wallet.address);
  console.log("Expected: r4NnL62r1pJyQ5AZYaoHKjrV9tErJBUpWY");
  console.log("Match:", wallet.address === "r4NnL62r1pJyQ5AZYaoHKjrV9tErJBUpWY" ? "YES ✅" : "NO ❌");
} catch (err) {
  console.log("❌ Seed is INVALID!");
  console.log("Error:", err.message);
}
