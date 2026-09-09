import React from 'react';

const UserNotRegisteredError = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-tint-orange">
            <svg className="h-8 w-8 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="mb-4 text-3xl font-semibold tracking-[-0.04em] text-foreground">Access Restricted</h1>
          <p className="mb-8 text-muted-foreground">
            You are not registered to use this application. Please contact the app administrator to request access.
          </p>
          <div className="rounded-xl border border-border bg-surface-subtle p-4 text-left text-sm text-muted-foreground">
            <p>If you believe this is an error, you can:</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Verify you are logged in with the correct account</li>
              <li>Contact the app administrator for access</li>
              <li>Try logging out and back in again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
