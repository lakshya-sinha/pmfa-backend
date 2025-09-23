// hash-password.js
import bcrypt from "bcrypt";

const plain = process.argv[2];
if (!plain) {
  console.error('Usage: node hash-password.js <plain-password>');
  process.exit(1);
}

(async () => {
  const saltRounds = 12;
  const hash = await bcrypt.hash(plain, saltRounds);
  console.log('bcrypt hash:\n', hash);
})();
