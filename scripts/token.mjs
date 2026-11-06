// Prints a random 128-bit token, e.g. for the STAFF_TOKEN secret (`pnpm token`). Family links are generated in the app.
import { randomBytes } from 'node:crypto'

console.log(randomBytes(16).toString('base64url'))
