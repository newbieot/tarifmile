const LEGACY_HOST = 'tarifmile.pages.dev';
const CANONICAL_HOST = 'tarif.posnew.com';

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname.toLowerCase() === LEGACY_HOST) {
    url.protocol = 'https:';
    url.hostname = CANONICAL_HOST;
    url.port = '';
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
