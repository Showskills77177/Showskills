import {
  isShowSkillsStagingHost,
  STAGING_ROBOTS_TXT,
  STAGING_SEARCH_ENGINE_BLOCK,
  STAGING_SITEMAP_XML,
} from './shared/stagingSite.mjs'

export default function middleware(request) {
  const host = request.headers.get('host') || ''
  if (!isShowSkillsStagingHost(host)) return

  const pathname = new URL(request.url).pathname
  const blockHeaders = {
    'X-Robots-Tag': STAGING_SEARCH_ENGINE_BLOCK,
    'Cache-Control': 'public, max-age=3600',
  }

  if (pathname === '/robots.txt') {
    return new Response(STAGING_ROBOTS_TXT, {
      status: 200,
      headers: {
        ...blockHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }

  if (pathname === '/sitemap.xml' || pathname === '/sitemap_index.xml') {
    return new Response(STAGING_SITEMAP_XML, {
      status: 200,
      headers: {
        ...blockHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
      },
    })
  }
}

export const config = {
  matcher: ['/robots.txt', '/sitemap.xml', '/sitemap_index.xml'],
}
