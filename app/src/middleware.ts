import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Garante Cross-Origin-Opener-Policy: same-origin-allow-popups nas rotas de
// auth em tempo de request. O next.config.js já declara isto via headers()
// — este middleware existe como reforço, caso alguma camada intermediária
// (proxy/CDN do EdgeOne Pages) não repasse o header estático do build.
// Sem isto, o popup/credential flow do Google Identity Services não
// consegue devolver a credential para esta página (window.postMessage
// bloqueado pelo COOP padrão same-origin do host).
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  return response;
}

export const config = {
  matcher: ['/auth/:path*'],
};
