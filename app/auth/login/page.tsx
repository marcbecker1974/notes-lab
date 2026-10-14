import { AuthNotice } from "@/components/auth-notice";
import { LoginForm } from "@/components/login-form";
import { Suspense } from "react";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense>
          <AuthNotice searchParams={searchParams} />
        </Suspense>
        <LoginForm />
      </div>
    </div>
  );
}
