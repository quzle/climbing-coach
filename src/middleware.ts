import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * @description Returns true if the given pathname is a public (unauthenticated)
 * route that should be accessible without a valid session.
 * @param pathname The URL pathname to check
 * @returns Whether the path is publicly accessible
 */
function isPublicPath(pathname: string): boolean {
  return pathname.startsWith('/auth/')
}

/**
 * @description Next.js middleware that refreshes the Supabase session on every
 * request and redirects unauthenticated users to the login page for all
 * protected routes.
 * @param request The incoming Next.js request
 * @returns Either a pass-through response or a redirect to /auth/login
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session — do not remove this call.
  // It keeps the user's session alive and syncs auth state.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect unauthenticated users to the login page for all protected routes.
  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - Files with an extension (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|eot)$).*)',
  ],
}
