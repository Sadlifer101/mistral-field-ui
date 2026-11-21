/**
 * Development-only stand-ins for the Convex Auth hooks the preview tree imports.
 *
 * Aliased for `@convex-dev/auth/react` and `@convex-dev/auth/methods/google/react`
 * only in `--mode preview`. No provider, token, or session is created: the
 * preview simply reports an authenticated shell so the console screens render.
 * Real authentication code is untouched and still runs in the normal app.
 */

export function useAuthActions() {
  return {
    signIn: async () => undefined,
    signOut: async () => undefined,
  };
}

export function useSignInWithGoogle(_api: unknown) {
  console.info("[mistral-preview] Google sign-in is disabled in preview mode");
  return {
    signIn: async () => ({ status: "complete" as const }),
  };
}

export function useOauth(_api: unknown) {
  return {
    signIn: async () => ({ status: "complete" as const }),
  };
}

export function ConvexAuthProvider(props: { children?: unknown }) {
  return props.children as never;
}
