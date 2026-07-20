import { createHash } from "crypto";
import type { ProofOfReasoning, ProofHash } from "@/src/types/proof";

/**
 * Produces a deterministic 0x-prefixed SHA-256 hash of the proof object.
 * Keys are sorted before serialisation so field order never affects the hash.
 */
export function hashProof(proof: ProofOfReasoning): ProofHash {
  const canonical = JSON.stringify(proof, Object.keys(proof).sort() as never);
  const hex = createHash("sha256").update(canonical).digest("hex");
  return `0x${hex}`;
}
