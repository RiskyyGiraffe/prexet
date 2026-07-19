import { headers } from "next/headers";

import { PrexetLanding } from "@/components/prexet-landing";
import { PrexetWorkspace } from "@/components/prexet-workspace";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) return <PrexetLanding />;
  return <PrexetWorkspace user={session.user} />;
}
