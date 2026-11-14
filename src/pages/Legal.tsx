import { Link, useParams } from "react-router-dom";

const titles: Record<string, string> = { imprint: "Imprint", privacy: "Privacy policy", terms: "Terms of use" };

export function Legal() {
  const { page = "" } = useParams();
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="mb-4 text-3xl font-bold">{titles[page] ?? "Legal"}</h1>
      <p className="text-muted-foreground">Placeholder. Add the legal text from your lawyer here (company details, GDPR processing, platform terms: DirectStay only connects parties and is not party to rental contracts).</p>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="container py-24 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-muted-foreground">This page doesn't exist.</p>
      <Link to="/" className="mt-4 inline-block text-primary">Go home →</Link>
    </div>
  );
}
