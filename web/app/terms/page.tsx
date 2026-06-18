import { LegalDoc } from "@/components/LegalDoc";
import { terms } from "@/lib/legal";

export default function TermsScreen() {
  return <LegalDoc doc={terms} />;
}
